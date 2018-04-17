import Connection from 'libraries/fastjs/Wrappers/Connection'
import Submission from 'libraries/fastjs/database/models/Submission'
import User from 'libraries/fastjs/database/models/User'
import FormioJS from 'formiojs'
import Raven from 'config/raven'
import Event from 'libraries/fastjs/Wrappers/Event'
import Promise from 'bluebird'

let OfflineData = (() => {
  async function send(data) {
    let offlineSubmissions = data
    let syncedSubmissionsCount = 0
    let syncedSubmissions = []
    let offlinePlugin = FormioJS.getPlugin('offline')
    if (Connection.isOnline()) {
      Promise.each(offlineSubmissions, async function (offlineSubmission) {
        let formio = new FormioJS(offlineSubmission.data.formio.formUrl)
        let postData = {
          data: offlineSubmission.data.data
        }
        offlineSubmission.data.queuedForSync = true
        let model = Submission.local()

        if (offlineSubmission.data.formio.formId === 'userregister') {
          model = User
        }
        await model.update(offlineSubmission)

        // If it has an ID and the Id its not local (doesnt contain "_local")
        if (offlineSubmission.data._id && offlineSubmission.data._id.indexOf('_local') === -1) {
          postData._id = offlineSubmission.data._id
        }
        FormioJS.deregisterPlugin('offline')

        try {
          let FormIOinsertedData = await formio.saveSubmission(postData)
          if (!FormIOinsertedData._id) {
            throw Error('Submission cannot be synced')
          }
          FormIOinsertedData.formio = formio

          syncedSubmissionsCount = syncedSubmissionsCount + 1
          syncedSubmissions.push(FormIOinsertedData)

          // Update the local submission
          offlineSubmission.data = FormIOinsertedData
          await model.update(offlineSubmission)

          if (offlinePlugin) {
            FormioJS.registerPlugin(offlinePlugin, 'offline')
          }
        } catch (e) {
          console.log('The submission cannot be synced ', e)
          Raven.send(new Error('Submission cannot be synced'), {
            error: e
          })
          if (e === 'TypeError: Could not connect to API server (Failed to fetch)') {
            console.log('Error connecting to the API server')
          }
          offlineSubmission.data.queuedForSync = false
          offlineSubmission.data.syncError = e

          if (offlineSubmission.data.formio.formId === 'userregister') {
            model.remove(offlineSubmission)
            var errorEvent = new CustomEvent('FAST:USER:REGISTRATION:ERROR', {
              'detail': {
                'data': {
                  submission: offlineSubmission.data.data,
                  error: e
                },
                'text': 'Validation Error'
              }
            })
            document.dispatchEvent(errorEvent)
          } else {
            await model.update(offlineSubmission)
          }
          if (offlinePlugin) {
            FormioJS.registerPlugin(offlinePlugin, 'offline')
          }
        }
      }).then((result) => {
        Event.emit({
          name: 'FAST:SUBMISSION:SYNCED',
          data: {
            count: syncedSubmissionsCount,
            data: syncedSubmissions
          },
          text: 'The submissions have been synced'
        })
      })
    }
  }

  return Object.freeze({
    send
  });
})()

export default OfflineData