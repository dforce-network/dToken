# dToken

[![CircleCI](https://circleci.com/gh/dforce-network/dToken/tree/dev.svg?style=svg)](<(https://circleci.com/gh/dforce-network/dToken/tree/dev.svg?style=svg)>)

## Usage

Install buidler and plugins

```
npm install
mv .example.env .env
```

Run the following commands to compile all contracts:

```
npx buidler compile
```

To run the tests:

```
npx buidler test
```

To deploy contracts, need to set basic config parameters in `.env`:

```
INFURA_APIKEY: Infura key.
PRIVATE_KEY: Private key of deployer account.
```

Deploy contracts at the local:

```
truffle migrate
```

Deploy contracts at the testnet: Kovan.

```
truffle migrate --network kovan
```

Run a local develop network with buidler EVM:

```
npx buidler node
```
