import Papa from "papaparse";
import jsonexport from "jsonexport"
import Promise from "bluebird"
import _zip from "lodash/zip"
import _unzip from "lodash/unzip"
let Csv = class {
  static async toCsv(json) {
    return new Promise((resolve, reject) => {
      jsonexport(json, function (err, csv) {
        if (err) reject(err)
        resolve(csv);
      });
    })
  }
  static async get({ json }) {
    return new Promise(async (resolve, reject) => {
      let csv = await Csv.toCsv(json.data)
      let labelsRow = [];
      let parsedCsv = Papa.parse(csv, { dynamicTyping: true });

      let zipped = _zip(...parsedCsv.data)

      let orderedArray = []

      json.labels.forEach(label => {
        zipped.forEach(zip => {
          if (zip[0].indexOf(label.apiKey) >= 0) {
            orderedArray.push(zip)
          }
        })
      })

      parsedCsv = _unzip(orderedArray)
      let columns = parsedCsv[0];

      columns.forEach(c => {
        let newLabel = "";
        let innerLabels = c.split(".");
        // Include the original label (Translated)
        innerLabels.forEach((innerLabel, idx) => {
          if (isNaN(innerLabel)) {
            let correspondingLabel = json.labels.find(label => {
              return label.apiKey === innerLabel;
            });
            let matchingLabel =
              (correspondingLabel && correspondingLabel.label) || innerLabel;
            newLabel = newLabel + matchingLabel;
          } else {
            if (idx === innerLabels.length - 1) {
              newLabel = newLabel + "." + innerLabel;
            } else {
              newLabel = newLabel + "." + innerLabel + ".";
            }
          }
        });
        labelsRow.push(newLabel);
      });
      let newCSV = Papa.unparse(
        { fields: labelsRow, data: parsedCsv },
        { header: true, delimiter: ";" }
      );
      let name = "backup_" + json.date + ".csv";
      resolve({ csv: newCSV, name: name })
    })
  }
  static orderColumns(parsedCsv, formioForm) {
    return parsedCsv
  }
}
export default Csv
