var fs = require("fs");

async function copyArtifacts() {
  const uniswapFiles = [
    ["v2-periphery/build/", "WETH9"],
    ["v2-core/build/", "UniswapV2Factory"],
    ["v2-core/build/", "UniswapV2Pair"],
    ["v2-periphery/build/", "UniswapV2Router02"],
  ];

  uniswapFiles.forEach((file) => {
    fs.copyFileSync(
      "./node_modules/@uniswap/" + file[0] + file[1] + ".json",
      "./build/" + file[1] + ".json"
    );
  });
}

module.exports = {
  onCompileComplete: copyArtifacts,
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

  mocha: {
    grep: "(Skipped in coverage)", // We have some cases need to be skipped
    invert: true, // Run the grep's inverse set.
  },
};
