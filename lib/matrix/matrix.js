const Table = require('cli-table');
const _ = require('lodash');
const { avg } = require('./utils');
const { htmlTemplate, tableTemplate } = require('./templates');

function getMatrixTable (m, detail = false, cli = true) {
  let rowHeaders = _.keys(m);
  let colHeaders = [];
  for (let a of _.keys(m)) {
    for (let v of _.keys(m[a])) {
      // v is the version but we don't know what the platform is yet, so
      // figure that out
      let devices = [];
      for (let t of _.keys(m[a][v])) {
        for (let d of _.keys(m[a][v][t])) {
          devices.push(d);
        }
      }
      let isIos = true;
      for (let d of devices) {
        if (d[0] !== 'i') {
          isIos = false;
          break;
        }
      }
      let platform = isIos ? 'iOS' : 'Android';
      let alreadyExists = false;
      for (let c of colHeaders) {
        if (c.platform === platform && c.version === v) {
          alreadyExists = true;
          break;
        }
      }
      if (!alreadyExists) {
        colHeaders.push({platform, version: v});
      }
    }
  }
  colHeaders.sort();
  rowHeaders.sort();
  let t = new Table({head: [""].concat(colHeaders.map(c => `${c.platform} ${c.version}`))});
  for (let r of rowHeaders) {
    let row = [];
    for (let c of colHeaders) {
      let support;
      let v = c.version;
      if (_.isUndefined(m[r][v])) {
        support = "\u2014";
      } else if (m[r][v].all === 1) {
        support = '\u2713';
      } else if (m[r][v].all === 0) {
        support = '\u2717';
      } else {
        if (detail) {
          support = getInnerTable(m[r][v]);
          if (cli) {
            support = support.toString();
          }
        } else {
          support = m[r][v].all.toFixed(2).toString();
        }
      }
      row.push(support);
    }
    let rowObj = {};
    rowObj[`Appium ${r}`] = row;
    t.push(rowObj);
  }
  return t;
}

function getInnerTable (combo) {
  let tests = [], devices = [];
  let avgForSet = "";
  for (let [test, deviceObjs] of _.toPairs(combo)) {
    if (test === 'all') {
      avgForSet = deviceObjs.toFixed(2);
      continue;
    }
    tests.push(test);
    for (let dName of _.keys(deviceObjs)) {
      devices.push(dName);
    }
  }
  tests = _.uniq(tests);
  devices = _.uniq(devices);
  let innerTable = new Table({head: [avgForSet].concat(devices)});
  for (let t of tests) {
    let rowObj = {};
    let row = [];
    for (let d of devices) {
      let val = combo[t][d];
      if (_.isUndefined(val)) {
        row.push("\u2014");
      } else if (val === 1) {
        row.push("\u2713");
      } else if (val === 0) {
        row.push("\u2717");
      } else {
        row.push(val.toFixed(2));
      }
    }
    rowObj[t] = row;
    innerTable.push(rowObj);
  }
  for (let [i, h] of _.toPairs(innerTable.options.head)) {
    innerTable.options.head[i] = h.replace(' Simulator', '');
  }
  return innerTable;
}

function matrix (runs) {
  let mat = {};
  for (let r of runs) {
    const a = r.caps.appiumVersion;
    const v = r.caps.platformVersion;
    const d = r.caps.deviceName;
    const t = r.test;
    const s = r.stack ? 0 : 1;
    if (!mat[a]) {
      mat[a] = {};
    }
    if (!mat[a][v]) {
      mat[a][v] = {};
    }
    if (!mat[a][v][t]) {
      mat[a][v][t] = {};
    }
    if (!mat[a][v][t][d]) {
      mat[a][v][t][d] = [];
    }
    mat[a][v][t][d].push(s);
  }
  for (let [, vers] of _.toPairs(mat)) {
    for (let [, tests] of _.toPairs(vers)) {
      let testValues = [];
      for (let [, devices] of _.toPairs(tests)) {
        for (let [dLabel, stats] of _.toPairs(devices)) {
          let avgStats = avg(stats);
          devices[dLabel] = avgStats;
          testValues.push(avgStats);
        }
      }
      tests.all = avg(testValues);
    }
  }
  return mat;
}

function printMatrix (m, detail) {
  let t = getMatrixTable(m, detail);
  console.log(t.toString());
}

function rowFromCrossTableRowObj (rowObj) {
  let rowPairs = _.toPairs(rowObj)[0];
  return [rowPairs[0]].concat(rowPairs[1]);
}

function printMatrixHTML (m, detail) {
  let t = getMatrixTable(m, detail, false);
  let colHeaders = t.options.head;
  let rows = [colHeaders];
  for (let rowObj of t) {
    let newRow = [];
    let row = rowFromCrossTableRowObj(rowObj);
    for (let cell of row) {
      if (cell instanceof Table) {
        let innerColHeaders = cell.options.head;
        let innerRows = [innerColHeaders];
        for (let innerRow of cell) {
          innerRows.push(rowFromCrossTableRowObj(innerRow));
        }
        newRow.push(tableTemplate({klass: 'innerTable', rows: innerRows}));
      } else {
        newRow.push(cell);
      }
    }
    rows.push(newRow);
  }
  let outerTable = tableTemplate({klass: 'outerTable', rows});
  let html = htmlTemplate({table: outerTable});
  console.log(html);
}

module.exports = { matrix, printMatrix, printMatrixHTML };
