module.exports = {
  skipFiles: [
    "assets",
    "markets",
    "library",
    "interface",
    "mock",
    "DTokenProxy.sol",
    "Migrations.sol",
    "MoneyMarketHandler.sol",
  ],

  // mocha: {
  //   grep: "(Skipped in coverage)", // We have some cases need to be skipped
  //   invert: true, // Run the grep's inverse set.
  // },
};
