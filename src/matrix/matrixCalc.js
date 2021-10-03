const loader = require("../utils/loader");
const { table } = require("table");

const unique = (value, index, self) => {
  return self.indexOf(value) === index;
};

function matrixJsonToMatrix(matrixJson) {
  const tests = getTestsFromMatrixJson(matrixJson);
  const mutants = getMutantsFromMatrixJson(matrixJson);

  var matrix = [...Array(mutants.length + 1)].map(() =>
    Array(tests.length + 1).fill("")
  );

  const path = require("path");
  matrix[0][0] = "";
  matrixJson.forEach((mutantJson, i) => {
    matrix[i + 1][0] =
      path.basename(mutantJson.contract) + ":" + mutantJson.mutant;
  });
  tests.forEach((t, j) => {
    matrix[0][j + 1] = path.basename(t);
  });

  matrixJson.forEach((mutantJson, i) => {
    const killers = mutantJson.killers;
    const saviors = mutantJson.saviors;
    tests.forEach((test, j) => {
      var cell;
      if (killers.includes(test)) cell = "K";
      if (saviors.includes(test)) cell = "";
      matrix[i + 1][j + 1] = cell;
    });
  });

  return matrix;
}

function jsonMatrixFromMatrix(matrix) {
  var mutants = [];
  for (let i = 1; i < matrix.length; i++) {
    const contract_mutant = matrix[i][0].split(":", 2);
    const contract = contract_mutant[0];
    const mutant = contract_mutant[1];
    var killers = [];
    var saviors = [];
    for (let t = 1; t < matrix[0].length; t++) {
      if (matrix[i][t] == "K") killers.push(matrix[0][t]);
      else saviors.push(matrix[0][t]);
    }
    mutants.push({
      contract: contract,
      mutant: mutant,
      killers: killers,
      saviors: saviors,
    });
  }
  return mutants;
}

function getContractsFromMatrixJson(matrixJson) {
  return matrixJson.map((j) => j.contract).filter(unique);
}

function getTestsFromMatrixJson(matrixJson) {
  var tests = [];
  matrixJson.forEach((j) => {
    tests = tests.concat(j.killers.concat(j.saviors));
  });
  return tests.filter(unique).sort();
}

function getMutantsFromMatrixJson(matrixJson) {
  return matrixJson.map((j) => j.mutant);
}

function getMutantsOfContractsFromMatrixJson(matrixJson, contracts) {
  return matrixJson.filter((j) => contracts.includes(j.contract));
}

function getAliveMutantsFromMatrixJson(matrixJson) {
  return matrixJson.filter((j) => j.killers.length == 0);
}

function getKilledMutantsFromMatrixJson(matrixJson) {
  return matrixJson.filter((j) => j.killers.length > 0);
}

function calculateMutationScoreFromMatrixJson(matrixJson) {
  return (
    getKilledMutantsFromMatrixJson(matrixJson).length /
    getMutantsFromMatrixJson(matrixJson).length
  );
}

function calculateMutationScore(all, killed) {
  return killed.length / all.length;
}

function updateMutationScoreFromPreviousMatrixJson(
  previousMatrixJson,
  currentMatrixJson
) {
  const currentContracts = getContractsFromMatrixJson(currentMatrixJson);
  const previousContracts = getContractsFromMatrixJson(previousMatrixJson);

  const unselectedContracts = previousContracts.filter(
    (c) => !currentContracts.includes(c)
  );

  //step 1: get mutants generated in the previous version from unselected contracts
  //(generated from E, G, H: E1,E2,E3,E4,G1,G2,H1,H2,H3)
  const mutantsOfUnselectedContracts = getMutantsOfContractsFromMatrixJson(
    previousMatrixJson,
    unselectedContracts
  );

  //step 2: add mutants generated in the previous version from unselected contracts to current mutants
  //(C1,C2,C3,D1,D3,D4,D5,D6,F1,F2,F3,F4,F5 + E1,E2,E3,E4,G1,G2,H1,H2,H3)
  const currentMutants = getMutantsFromMatrixJson(currentMatrixJson);
  const totalMutants =
    currentMutants.length + mutantsOfUnselectedContracts.length;

  const currentKilledMutants =
    getKilledMutantsFromMatrixJson(currentMatrixJson);
  const previousKilledMutants =
    getKilledMutantsFromMatrixJson(previousMatrixJson);

  //step 3: add killed mutants generated in the previous version from unselected contracts to current killed mutants
  //(C1,D1,D3,D5 + E1,E2,E3,E4,G1,G2)
  var previousKilledMutantsOfUnselectedContractsToAdd = [];
  mutantsOfUnselectedContracts.forEach((mutantJson) => {
    if (previousKilledMutants.map((j) => j.mutant).includes(mutantJson.mutant))
      previousKilledMutantsOfUnselectedContractsToAdd.push(mutantJson);
  });
  var totalKilledMutants =
    currentKilledMutants.length +
    previousKilledMutantsOfUnselectedContractsToAdd.length;
  console.log(
    "step 1-2-3: " +
      totalKilledMutants +
      "/" +
      totalMutants +
      "=" +
      totalKilledMutants / totalMutants
  );

  //step 4: get unselected tests
  //(T2,T3,T4,T5,T7)
  const previousTests = getTestsFromMatrixJson(previousMatrixJson);
  const currentTests = getTestsFromMatrixJson(currentMatrixJson);
  var unselectedTests = [];
  previousTests.forEach((test) => {
    if (!currentTests.includes(test)) unselectedTests.push(test);
  });

  //step 5: get killed mutants of the previous version generated in both the versions that were killed by unselected tests
  //(F3,F4,F5 + C1,D1,D3,D5,E1,E2,E3,E4,G1,G2)
  const mutantsKilledByUnselectedTestsInPreviousMatrix = [];
  previousMatrixJson.forEach((mutantJson) => {
    if (
      mutantJson.killers.length > 0 &&
      mutantJson.killers.every((killer) => unselectedTests.indexOf(killer) > -1)
    ) {
      mutantsKilledByUnselectedTestsInPreviousMatrix.push(mutantJson);
    }
  });

  //step 6: add killed mutants of the previous version generated in both the versions that were killed by unselected tests and now are alive to current killed mutants
  //(F3,F4,F5 + C1,D1,D3,D5,E1,E2,E3,E4,G1,G2)
  const currentAliveMutants = getAliveMutantsFromMatrixJson(currentMatrixJson);
  const mutantsKilledByUnselectedTestsInPreviousMatrixThatAreNowAlive =
    mutantsKilledByUnselectedTestsInPreviousMatrix
      .map((c) => c.mutant)
      .filter((c) => currentAliveMutants.map((c) => c.mutant).includes(c));
  totalKilledMutants =
    totalKilledMutants +
    mutantsKilledByUnselectedTestsInPreviousMatrixThatAreNowAlive.length;

  console.log(
    "step 4-5-6: " +
      totalKilledMutants +
      "/" +
      totalMutants +
      "=" +
      totalKilledMutants / totalMutants
  );
}

function updateCurrentMatrixFromPreviousMatrixJson(
  previousMatrixJson,
  currentMatrixJson
) {
  const currentContracts = getContractsFromMatrixJson(currentMatrixJson);
  const previousContracts = getContractsFromMatrixJson(previousMatrixJson);

  const unselectedContracts = previousContracts.filter(
    (c) => !currentContracts.includes(c)
  );

  //step 1: get mutants generated in the previous version from unselected contracts
  //(generated from E, G, H: E1,E2,E3,E4,G1,G2,H1,H2,H3)
  const mutantsOfUnselectedContracts = getMutantsOfContractsFromMatrixJson(
    previousMatrixJson,
    unselectedContracts
  );

  //step 2: add mutants generated in the previous version from unselected contracts to current mutants
  //(C1,C2,C3,D1,D3,D4,D5,D6,F1,F2,F3,F4,F5 + E1,E2,E3,E4,G1,G2,H1,H2,H3)
  const currentMutants = currentMatrixJson;
  // const totalMutants = currentMutants
  //   .concat(mutantsOfUnselectedContracts)
  //   .sort(function (a, b) {
  //     return a.mutant < b.mutant ? -1 : 1;
  //   });

  // console.log(table(matrixJsonToMatrix(totalMutants)));
  // console.log(calculateMutationScoreFromMatrixJson(totalMutants));

  // //step 3: add killed mutants generated in the previous version from unselected contracts to current killed mutants
  // //(C1,D1,D3,D5 + E1,E2,E3,E4,G1,G2)
  // const currentKilledMutants =
  //   getKilledMutantsFromMatrixJson(currentMatrixJson);
  // const previousKilledMutants =
  //   getKilledMutantsFromMatrixJson(previousMatrixJson);
  // var previousKilledMutantsOfUnselectedContractsToAdd = [];
  // mutantsOfUnselectedContracts.forEach((mutantJson) => {
  //   if (previousKilledMutants.map((j) => j.mutant).includes(mutantJson.mutant))
  //     previousKilledMutantsOfUnselectedContractsToAdd.push(mutantJson);
  // });
  // var totalKilledMutants =
  //   currentKilledMutants.length +
  //   previousKilledMutantsOfUnselectedContractsToAdd.length;
  // console.log(
  //   "step 1-2-3: " +
  //     totalKilledMutants +
  //     "/" +
  //     totalMutants +
  //     "=" +
  //     totalKilledMutants / totalMutants
  // );

  //step 4: get unselected tests
  //(T2,T3,T4,T5,T7)
  const previousTests = getTestsFromMatrixJson(previousMatrixJson);
  const currentTests = getTestsFromMatrixJson(currentMatrixJson);
  var unselectedTests = [];
  previousTests.forEach((test) => {
    if (!currentTests.includes(test)) unselectedTests.push(test);
  });

  currentMutants.forEach((current, c) => {
    const previousRef = previousMatrixJson.filter(function (p) {
      return p.mutant == current.mutant;
    })[0];
    if (previousRef != undefined) {
      const preKillers = previousRef.killers.filter((t) =>
        unselectedTests.includes(t)
      );

      const preSaviors = previousRef.saviors.filter((t) =>
        unselectedTests.includes(t)
      );

      currentMutants[c].killers = currentMutants[c].killers.concat(preKillers);
      currentMutants[c].saviors = currentMutants[c].saviors.concat(preSaviors);
    }
  });

  var newMutants = [];
  currentMutants.forEach((c) => {
    if (!previousMatrixJson.map((j) => j.mutant).includes(c.mutant)) {
      newMutants.push(c);
    }
  });

  currentMutants.forEach((current, c) => {
    if (newMutants.map((j) => j.mutant).includes(current.mutant))
      currentMutants[c].saviors =
        currentMutants[c].saviors.concat(unselectedTests);
  });

  const updatedMatrixJson = currentMutants
    .concat(mutantsOfUnselectedContracts)
    .sort(function (a, b) {
      return a.mutant < b.mutant ? -1 : 1;
    });
  return updatedMatrixJson;
}

module.exports = {
  matrixJsonToMatrix: matrixJsonToMatrix,
  getKilledMutantsFromMatrixJson: getKilledMutantsFromMatrixJson,
  getAliveMutantsFromMatrixJson: getAliveMutantsFromMatrixJson,
  getMutantsFromMatrixJson: getMutantsFromMatrixJson,
  getTestsFromMatrixJson: getTestsFromMatrixJson,
  updateMutationScoreFromPreviousMatrixJson:
    updateMutationScoreFromPreviousMatrixJson,
  updateCurrentMatrixFromPreviousMatrixJson:
    updateCurrentMatrixFromPreviousMatrixJson,
  calculateMutationScoreFromMatrixJson: calculateMutationScoreFromMatrixJson,
};
