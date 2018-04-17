import moment from 'moment'
import _orderBy from "lodash/orderBy"
import baseModel from './baseModelFactory'
import remoteModel from './baseModel/remote'
import Connection from 'libraries/fastjs/Wrappers/Connection'
let Form = (args) => {
  var baseModel = args.baseModel;
  /**
   * [getOwnName description]
   * @return {[type]} [description]
   */
  /* eslint-disable no-unused-vars */
  function getOwnName() {
    return 'Form'
  }

  function getFormPath() {
    return 'custom'
  }

  async function rFind({ filter = undefined, limit = 200, select, pagination, form } = {}) {
    let formio = await remoteModel.getFormioInstance({ formPath: 'custom' })
    let queryParams = {}
    if (limit) {
      queryParams.limit = limit
    }

    if (filter) {
      let filterQuery = filterToString(filter)
      queryParams = { ...queryParams, ...filterQuery }
    }

    let remoteForms = Connection.isOnline() ? await formio.loadForms({
      params: queryParams
    }) : []
    return remoteForms
  }

  function filterToString(filter) {
    if (!filter) {
      return
    }
    // Condition {element: '_id', query: 'in', value: ''}
    let filterQuery = {}
    filter.forEach(condition => {
      let valueString = ''
      switch (condition.query) {
        case '=':
          filterQuery[condition.element] = condition.value
          break;
        case '!=':
          filterQuery[condition.element + '__ne'] = condition.value
          break;
        case '>':
          filterQuery[condition.element + '__gt'] = condition.value
          break;
        case '>=':
          filterQuery[condition.element + '__gte'] = condition.value
          break;
        case '<':
          filterQuery[condition.element + '__lt'] = condition.value
          break;
        case '<=':
          filterQuery[condition.element + '__lte'] = condition.value
          break;
        case 'in':
          valueString = ''
          condition.value.forEach((value, index, array) => {
            valueString = index === array.length - 1 ? valueString + value : valueString + value + ','
          })
          filterQuery[condition.element + '__in'] = valueString
          break;
        case 'nin':
          valueString = ''
          condition.value.forEach((value, index, array) => {
            valueString = index === array.length - 1 ? valueString + value : valueString + value + ','
          })
          filterQuery[condition.element + '__nin'] = valueString
          break;
        case 'exists':
          filterQuery[condition.element + '__exists'] = true
          break;
        case '!exists':
          filterQuery[condition.element + '__exists'] = false
          break;
        case 'regex':
          filterQuery[condition.element + '__regex'] = condition.value
          break;
      }
    });
    return filterQuery
  }

  async function get(id) {
    id = id.replace(/\s/g, '')

    let formRequest = await Form.findOne({
      'data.name': id
    })
    let formRequestID = await Form.findOne({
      'data._id': id
    })
    let formRequestPath = await Form.findOne({
      'data.path': id
    })

    if (formRequest) {
      return formRequest.data
    }
    if (formRequestID) {
      return formRequestID.data
    }
    if (formRequestPath) {
      return formRequestPath.data
    }
  }

  async function cardFormattedForms(action) {
    let result = await Form.local().find();
    result = result.filter(o => {
      return o.data.tags.indexOf("visible") > -1;
    });
    result = _orderBy(result, "data.title", "asc");
    result = result.map(f => {
      return {
        innerCardsTitle: f.data.title,
        innerCardsTags: f.data.tags,
        innerCardsAvatar: action === "create" ? "statics/customSVG/startSurvey.svg" : "statics/customSVG/collectedData.svg",
        innerCardsSubtitle: "Last updated: " + moment(f.data.modified).fromNow(),
        innerCardsActions: [{
          innerCardsActionsText: action === "create" ? 'Start' : 'View data',
          innerCardsActionsTarget: "form",
          innerCardsActionsAction: action,
          innerCardsActionsForm: {
            path: f.data.path
          }
        }
        ]
      }
    });

    result = { innerCards: result }
    return result
  }

  return Object.freeze(Object.assign({}, baseModel, {
    getOwnName,
    getFormPath,
    get,
    cardFormattedForms,
    rFind
  }));
}
Form = Form({
  baseModel: baseModel()
});
export default Form