import Formio from 'modules/Formio/api/Formio'
import * as Database from 'database/Database'
import SyncHelper from 'database/helpers/SyncHelper'
import _ from 'lodash'
import moment from 'moment'
import Auth from 'modules/Auth/api/Auth'
import Connection from 'modules/Wrappers/Connection'
import LocalSubmission from 'database/collections/scopes/LocalSubmission'
import FormioJS from 'formiojs'
import deep from 'deep-diff'
import {
  Toast
} from 'quasar'
import Promise from 'bluebird'
const actions = {

  async updateLocalResource({
    collection,
    label,
    data
  }) {
    // let offlinePlugin = FormioJS.getPlugin('offline')
    var formio = new FormioJS('https://' + data.appName + '.form.io')
    let isOnline = Connection.isOnline()
    const DB = await Database.get()
    let localResources = await DB.getCollection(collection).find()

    let remoteResources = (isOnline && collection !== 'forms') ? await Formio[collection](data.appName) : []

    if (collection === 'forms') {
      if (isOnline) {
        FormioJS.clearCache()
      }
      remoteResources = isOnline ? await formio.loadForms({
        params: {
          limit: '100'
        }
      }) : []
    }

    let sync = SyncHelper.offlineOnlineSync({
      collection,
      LocalResults: localResources,
      OnlineResults: remoteResources,
      isOnline: isOnline
    })
    // For every new or updated entry
    _.forEach(sync, async function (res, key) {
      const DB = await Database.get()
      let localRes = await DB.getCollection(collection).find({
        'data._id': res._id
      })
      // remove local duplicated or updated entries
      _.forEach(localRes, function (local) {
        local.remove()
      })
      // Insery the new or updated entry
      DB.getCollection(collection).insert({
        data: res
      })
    })

    if (sync.length > 0) {
      Toast.create.positive({
        html: sync.length + ' ' + label + ' were updated'
      })
    } else {
      // Toast.create.info({html: 'Local forms up to date'})
    }
  },

  /**
   * [getResources description]
   * @param  {[type]} options.commit [description]
   * @param  {[type]} projectName    [description]
   * @return {[type]}                [description]
   */
  async getResources({
    commit
  }, data) {
    let promises = [
      actions.getForms({
        commit
      }, data)
    ]

    if (Auth.check()) {
      promises.push(actions.getUsers({
        commit
      }, data))
    }
    await Promise.all(promises)
  },

  /**
   * [getUsers description]
   * @param  {[type]} options.commit [description]
   * @param  {[type]} projectName    [description]
   * @return {[type]}                [description]
   */
  async getUsers({
    commit
  }, data) {
    actions.updateLocalResource({
      data,
      collection: 'users',
      label: 'users'
    })
  },

  /**
   * [getForms description]
   * @param  {[type]} options.commit [description]
   * @param  {[type]} projectName    [description]
   * @return {[type]}                [description]
   */
  async getForms({
    commit
  }, data) {
    actions.updateLocalResource({
      data,
      collection: 'forms',
      label: 'forms'
    })
  },

  /**
   * [getSubmissions description]
   * @param  {[type]} options.commit [description]
   * @param  {[type]} projectName    [description]
   * @return {[type]}                [description]
   */
  async getSubmissions({
    commit
  }, {
    currentForm,
    User
  }) {
    FormioJS.setToken(Auth.user().x_jwt_token)
    const DB = await Database.get()
    let isOnline = Connection.isOnline()
    let formUrl = 'https://' + currentForm.data.machineName.substring(0, currentForm.data.machineName.indexOf(':')) + '.form.io/' + currentForm.data.path

    let formio = new FormioJS(formUrl)

    let localUnSyncSubmissions = await LocalSubmission.offline(User.id, currentForm.data.path)

    FormioJS.clearCache()

    let remoteSubmissions = (isOnline) ? await formio.loadSubmissions({
      params: {
        limit: '100'
      }
    }) : []

    _.map(remoteSubmissions, function (o) {
      o.formio = formio
    })

    let localSubmissions = LocalSubmission.stored(User.id, currentForm.data.path)

    var Localresult = _.unionBy(localSubmissions, localUnSyncSubmissions, '_id')
    let sync = SyncHelper.offlineOnlineSync({
      LocalResults: Localresult,
      OnlineResults: remoteSubmissions,
      isOnline: isOnline
    })
    // await DB.submissions.remove();
    // For every new or updated entry
    _.forEach(sync, async function (submission, key) {
      let localSubmissions = await DB.getCollection('submissions').find({
        'data._id': submission._id
      })
      let localSubmission = {}
      // remove local duplicated or updated entries
      _.forEach(localSubmissions, function (local) {
        localSubmission = local
        if (!(localSubmission.data.sync === false || localSubmission.data.draft === false)) {
          local.remove()
        }
      })
      let isRepleaceble = localSubmission.data && !(localSubmission.data.sync === false || localSubmission.data.draft === false)
      let isNotLocal = typeof localSubmission.data === 'undefined'
      if (isRepleaceble || isNotLocal) {
        // Inser the new or updated entry
        DB.getCollection('submissions').insert({
          data: submission
        })
      }
    })
    /*
    if (sync.length > 0) {
      Toast.create.positive({ html: sync.length + ' Submissions were updated' })
    } else {
      // Toast.create.info({html: 'Submissions are up to date'})
    }
    */
  },
  /**
   * [addSubmission description]
   * @param {[type]} options.commit [description]
   * @param {[type]} currentForm    [description]
   */
  async addSubmission({
    commit
  }, {
    formSubmission,
    formio,
    User
  }) {
    const DB = await Database.get()

    let submission = formSubmission
    submission.sync = false
    submission.user_email = User.email
    submission.formio = formio
    submission.created = moment().format()
    submission = SyncHelper.deleteNulls(submission)
    // If we are updating the submission
    if (formSubmission._id || (formSubmission.trigger !== 'createLocalDraft' && formSubmission.trigger !== 'resourceCreation')) {
      submission.type = 'update'
      let localSubmission = await LocalSubmission.get(formSubmission._id)
      let differences = deep.diff(SyncHelper.deleteNulls(localSubmission.data.data), SyncHelper.deleteNulls(submission.data))
      let submitting = submission.draft === false
      let localDraft = localSubmission.data.draft === false
      let submissionNotDraft = submission.draft === true
      let autoSave = submission.trigger === 'autoSaveAsDraft'
      let isSynced = !!(localSubmission.data.access && Array.isArray(localSubmission.data.access))
      // If there are differences between the
      // Stored and the new data.
      if (((differences || submitting || (localDraft && submissionNotDraft)) && !autoSave) || (!isSynced && differences && autoSave)) {
        await localSubmission.update({
            data: submission
        })
      }
      return localSubmission
      // If we are creating a new draft from scratch
    } else if (formSubmission.trigger === 'createLocalDraft' || formSubmission.trigger === 'resourceCreation') {
      let newSubmission = await DB.getCollection('submissions').insert({
        data: submission
      })
      if (formSubmission.trigger === 'resourceCreation') {
        newSubmission.trigger = 'resourceCreation'
      }
      return newSubmission
    }
  },

  /**
   * [sendOfflineData description]
   * @param  {[type]} options.commit     [description]
   * @param  {[type]} offlineSubmissions [description]
   * @return {[type]}                    [description]
   */
  async sendOfflineData({
    commit
  }, data) {
    let offlineSubmissions = data.offlineSubmissions
    let vm = data.vm
    let isOnline = Connection.isOnline()
    let syncedSubmissionsCount = 0
    let syncedSubmissions = []
    let offlinePlugin = FormioJS.getPlugin('offline')
    if (isOnline) {
      Promise.each(offlineSubmissions, async function (offlineSubmission) {
        // Create FormIOJS plugin instace (Manipulation)
        let formio = new FormioJS(offlineSubmission.data.formio.formUrl)
        let postData = {
          data: offlineSubmission.data.data
        }
        await offlineSubmission.update({
          $set: {
            'data.queuedForSync': true
          }
        })

        // If it has an ID and the Id its not local (doesnt contain ":")
        if (offlineSubmission.data._id && offlineSubmission.data._id.indexOf(':') === -1) {
          postData._id = offlineSubmission.data._id
        }
        FormioJS.deregisterPlugin('offline')

        try {
          let FormIOinsertedData = await formio.saveSubmission(postData)
          FormIOinsertedData.formio = formio

          syncedSubmissionsCount = syncedSubmissionsCount + 1
          syncedSubmissions.push(FormIOinsertedData)

          await offlineSubmission.update({
            $set: {
              data: FormIOinsertedData
            }
          })

          if (offlinePlugin) {
            FormioJS.registerPlugin(offlinePlugin, 'offline')
          }
        } catch (e) {
          console.log('The submission cannot be synced ', e)
          if (e === 'TypeError: Could not connect to API server (Failed to fetch)') {
            console.log('Error connecting to the API server')
          }
          await offlineSubmission.update({
            $set: {
              'data.queuedForSync': false,
              'data.syncError': e.isJoi ? e : false
            }
          })
          if (offlinePlugin) {
            FormioJS.registerPlugin(offlinePlugin, 'offline')
          }
        }
      }).then((result) => {
        vm.$eventHub.emit('FAST-DATA_SYNCED', {
          count: syncedSubmissionsCount,
          data: syncedSubmissions
        })
      })
    }
  }
}

export default actions
