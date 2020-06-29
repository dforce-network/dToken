/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like truffle-hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura API
 * keys are available for free at: infura.io/register
 *
 *   > > Using Truffle V5 or later? Make sure you install the `web3-one` version.
 *
 *   > > $ npm install truffle-hdwallet-provider@web3-one
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

require('dotenv').config();

const HDWalletProvider = require("truffle-hdwallet-provider");
var infuraKey = process.env.INFURA_APIKEY;
var privateKey = process.env.PRIVATE_KEY;


module.exports = {
    /**
     * Networks define how you connect to your ethereum client and let you set the
     * defaults web3 uses to send transactions. If you don't specify one truffle
     * will spin up a development blockchain for you on port 9545 when you
     * run `develop` or `test`. You can ask a truffle command to use a specific
     * network from the command line, e.g
     *
     * $ truffle test --network <network-name>
     */

    networks: {
        // Useful for testing. The `development` name is special - truffle uses it by default
        // if it's defined here and no other network is specified at the command line.
        // You should run a client (like ganache-cli, geth or parity) in a separate terminal
        // tab if you use this network and you must also set the `host`, `port` and `network_id`
        // options below to some value.
        //
        development: {
            host: "localhost",
            port: 7545,
            network_id: "*",
            gasPrice: 20000000000,
            gas: 8000000
        },

        mainnet: {
            provider: () => new HDWalletProvider(privateKey, `https://mainnet.infura.io/v3/${infuraKey}`),
            network_id: 1, // Mainnet's id
            gas: 6721975, // Gas limit used for deploys
            gasPrice: 7000000000, // Gas price used for deploys: 7gwei
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true
        },

        kovan: {
            provider: () => new HDWalletProvider(privateKey, `https://kovan.infura.io/v3/${infuraKey}`),
            network_id: 42, // Kovan's id
            gas: 6721975,
            gasPrice: 10000000000, // Gas price used for deploys: 10gwei
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true,
            networkCheckTimeout: 600000
        },

        ropsten: {
            provider: () => new HDWalletProvider(privateKey, `https://ropsten.infura.io/v3/${infuraKey}`),
            network_id: 3, // ropsten's id
            gas: 6721975,
            gasPrice: 10000000000, // Gas price used for deploys: 10gwei
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true
        },

        rinkeby: {
            provider: () => new HDWalletProvider(privateKey, `https://rinkeby.infura.io/v3/${infuraKey}`),
            network_id: 4, // ropsten's id
            gas: 6721975,
            gasPrice: 10000000000, // Gas price used for deploys: 10gwei
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true
        }
    },

    // Set default mocha options here, use special reporters etc.
    mocha: {
        enableTimeouts: false,
        useColors: true,
        bail: true
    },

    // Configure your compilers
    compilers: {
        solc: {
            version: "0.5.12", // Fetch exact version from solc-bin (default: truffle's version)
            // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
            settings: { // See the solidity docs for advice about optimization and evmVersion
                optimizer: {
                    enabled: true,
                    runs: 200
                },
                //  evmVersion: "byzantium"
                // }
            }
        }
    }
}
