import * as Database from 'database/Database'
import _ from 'lodash'
const LocalSubmission = class {
  /**
   * [get description]
   * @param  {[type]} id [description]
   * @return {[type]}    [description]
   */
  static async get (id) {
  	let db = await Database.get()
  	id = id.replace(/\s/g, '')
    let offline = await db.submissions.findOne()
      .where('_id').eq(id).exec()
    let online = await db.submissions.findOne()
      .where('data._id').eq(id).exec()

    if (online) {
      return online
    }
    if (offline) {
      return offline
    }
  }

  static async offline (userId, formId) {
    let db = await Database.get()
    let filter = await db.submissions.find().exec()
    // updated incomplete submission
    filter = _.filter(filter, function (o) {
      return (o.data.sync === false && o.data.draft === false)
    })
    filter = _.orderBy(filter, ['data.created'], ['asc'])
    return filter
  }

  static async stored (userId, formId) {
    let db = await Database.get()
    return db.submissions
      .find({
        // Only include this filter if we dont share data
        // between users
        'data.owner': {
          $exists: true,
          $eq: userId
        },
        'data.formio.formId': {
          $exists: true,
          $eq: formId
        }
      }).exec()
  }
}
export default LocalSubmission
