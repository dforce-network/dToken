# dToken

[![CircleCI](https://circleci.com/gh/dforce-network/dToken/tree/dev.svg?style=svg)](<(https://circleci.com/gh/dforce-network/dToken/tree/dev.svg?style=svg)>)

## Usage

Install buidler and plugins

```
npm install
```

Separately run the following commands to compile different versions of the contracts

```
npx buidler compile --config buidler.config.4.js
npx buidler compile
```

To run the tests

```
npx buidler test
```

Run a local develop network with buidler EVM

```
npx buidler node
```

And then you can run the test case to get a gas report

```
npx buidler test --network localhost
```

Solidity code coverage plugin: `solidity-coverage`, install:

`npm install --save-dev solidity-coverage`

This plugin implements a coverage task

`npx buidler coverage`

For more information please check [Buidler's doc](https://buidler.dev/getting-started)
