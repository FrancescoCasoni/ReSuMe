const path = require("path");
const fs = require("fs");
const config = require("../config");
const glob = require("glob");
const fileSys = require("./fileSys");

function loadTests() {
  const paths = glob.sync(fileSys.testsDir);

  var tests = new Array();
  paths.forEach((test) => {
    tests.push({
      path: test,
      name: path.parse(test).base,
      content: fs.readFileSync(test),
    });
  });

  return tests;
}

function loadContracts() {
  const paths = glob.sync(fileSys.contractsDir);

  var contracts = new Array();
  paths.forEach((contract) => {
    contracts.push({
      path: contract,
      name: path.parse(contract).base,
      content: fs.readFileSync(contract),
    });
  });
  return contracts;
}

const getAllFiles = function (dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
};

module.exports = {
  loadTests: loadTests,
  loadContracts: loadContracts,
};
