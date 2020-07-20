// For unit test
usePlugin("@nomiclabs/buidler-truffle5");

usePlugin("@nomiclabs/buidler-waffle");
// usePlugin("@nomiclabs/builder-ganache");
usePlugin("buidler-gas-reporter");
usePlugin("solidity-coverage");

// // For scripts
// // usePlugin("@nomiclabs/builder-ethers");

// // Faster compilation
// usePlugin("@nomiclabs/builder-docker-solc");

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
module.exports = {
  networks: {
    buidlerevm: {
      accounts: [
        {
          privateKey:
            "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122",
          balance: "10000000000000000000000",
        },
        {
          privateKey:
            "0xd49743deccbccc5dc7baa8e69e5be03298da8688a15dd202e20f15d5e0e9a9fb",
          balance: "10000000000000000000000",
        },
        {
          privateKey:
            "0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569",
          balance: "10000000000000000000000",
        },
        {
          privateKey:
            "0xee9d129c1997549ee09c0757af5939b2483d80ad649a0eda68e8b0357ad11131",
          balance: "10000000000000000000000",
        },
        {
          privateKey:
            "0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc",
          balance: "10000000000000000000000",
        },
      ],
    },
  },
  // This is a sample solc configuration that specifies which version of solc to use
  solc: {
    version: "0.5.12",
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  paths: {
    sources: "./contracts",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    // enabled: true,
    currency: "USD",
  },
  mocha: { timeout: 50000 },
};
