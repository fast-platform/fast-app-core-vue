import FORMIO from 'modules/Formio/api/Formio'
import Configuration from "libraries/fastjs/repositories/Configuration/Configuration";
import USER from "libraries/fastjs/database/models/User";
import SyncHelper from 'libraries/fastjs/database/helpers/SyncHelper'
import _isEmpty from 'lodash/isEmpty'
import axios from 'axios'

let User = (() => {
  async function find() {
    let config = await Configuration.getLocal()
    let users = await FORMIO.users(config.APP_NAME)
    return users
  }
  async function storeLocally(formIoUser) {
    let user = await USER.local().findOne({
      'data.data.email': formIoUser.data.email
    })

    formIoUser = SyncHelper.deleteNulls(formIoUser)
    let isUserAlreadyStored = !!user && !_isEmpty(user)

    //  check if user is already present in local storage
    if (isUserAlreadyStored) {
      user.data = formIoUser
      //  update the user with the updated information
      let error = new Error('The user email is already taken')
      throw error
      // User.local().update(user)
    } else {
      //  Insert the new user
      await USER.local().insert({
        data: formIoUser
      })
    }
  }

  async function login({ credentials, role }) {
    let config = await Configuration.getLocal()
    let url = config.APP_URL
    if (role === 'admin') {
      url = url + '/admin/login'
    } else {
      url = url + '/user/login'
    }
    return axios.post(url, {
      data: {
        email: credentials.username,
        password: credentials.password
      }
    })
  }

  return Object.freeze({
    find,
    storeLocally,
    login
  });
})()
export default User