const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const TetherToken = artifacts.require("TetherToken");
const CTokenMock = artifacts.require("CTokenMock");
const CompoundHandler = artifacts.require("CompoundHandler");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const dTokenAddresses = artifacts.require("dTokenAddresses");
const DToken = artifacts.require("DToken");
const DSGuard = artifacts.require("DSGuard");
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const BN = require("bn.js");

const LendingPoolCore = artifacts.require("AaveLendingPoolCoreMock");
const LendPool = artifacts.require("AaveLendPoolMock");
const aTokenMock = artifacts.require("aTokenMock");
const AaveHandler = artifacts.require("AaveHandler");

const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));
const BASE = new BN(10).pow(new BN(18));
const FEE = new BN(10).pow(new BN(14));

const MINT_SELECTOR = "0x40c10f19";
const BURN_SELECTOR = "0x9dc29fac";

describe("DToken Contract Integration", function () {
  let owner, account1, account2, account3, account4;
  let USDC, USDT, DF;
  let ds_guard;
  let dispatcher;
  let dtoken_addresses;
  let internal_handler, compound_handler, aave_handler, other_handler;
  let dUSDC, dUSDT;
  let cUSDT, cUSDC;
  let aUSDC, aUSDT;
  let lending_pool_core;
  let lending_pool;

  let accounts = [];

  let tokens = [];
  let dtokens = [];
  let atokens = [];
  let ctokens = [];
  
  let user_behavior = [];
  let admin_behavior = [];

  before(async function () {
    [
      owner,
      account1,
      account2,
      account3,
      account4,
    ] = await web3.eth.getAccounts();
  });

  async function resetContracts() {
    USDC = await FiatToken.new(
      "USDC",
      "USDC",
      "USD",
      6,
      owner,
      owner,
      owner,
      owner
    );

    USDT = await TetherToken.new("0", "USDT", "USDT", 6);
    DF = await TetherToken.new("0", "DF", "DF", 18);

    dtoken_addresses = await dTokenAddresses.new();
    ds_guard = await DSGuard.new();

    internal_handler = await InternalHandler.new(dtoken_addresses.address);
    other_handler = await InternalHandler.new(dtoken_addresses.address);

    cUSDT = await CTokenMock.new("cUSDT", "cUSDT", USDT.address);
    cUSDC = await CTokenMock.new("cUSDC", "cUSDC", USDC.address);

    compound_handler = await CompoundHandler.new(dtoken_addresses.address);
    await compound_handler.setcTokensRelation(
      [USDT.address, USDC.address],
      [cUSDT.address, cUSDC.address]
    );

    // Deploys Aave system
    lending_pool_core = await LendingPoolCore.new();
    aUSDC = await aTokenMock.new(
      "aUSDC",
      "aUSDC",
      USDC.address,
      lending_pool_core.address
    );
    aUSDT = await aTokenMock.new(
      "aUSDT",
      "aUSDT",
      USDT.address,
      lending_pool_core.address
    );
    await lending_pool_core.setReserveATokenAddress(
      USDC.address,
      aUSDC.address
    );
    await lending_pool_core.setReserveATokenAddress(
      USDT.address,
      aUSDT.address
    );
    lending_pool = await LendPool.new(lending_pool_core.address);

    aave_handler = await AaveHandler.new(
      dtoken_addresses.address,
      lending_pool.address,
      lending_pool_core.address
    );

    // Use internal handler by default
    dispatcher = await Dispatcher.new([internal_handler.address], [1000000]);
    dUSDC = await DToken.new(
      "dUSDC",
      "dUSDC",
      USDC.address,
      dispatcher.address
    );
    dUSDT = await DToken.new(
      "dUSDT",
      "dUSDT",
      USDT.address,
      dispatcher.address
    );

    await dtoken_addresses.setdTokensRelation(
      [USDC.address, USDT.address],
      [dUSDC.address, dUSDT.address]
    );

    await dUSDC.setAuthority(ds_guard.address);
    await dUSDT.setAuthority(ds_guard.address);
    await dispatcher.setAuthority(ds_guard.address);

    // Initialize all handlers
    let handlers = [internal_handler, compound_handler, aave_handler, other_handler];
    for (const handler of handlers) {
      await handler.setAuthority(ds_guard.address);
      await handler.approve(USDC.address);
      await handler.approve(USDT.address);
      await ds_guard.permitx(dUSDC.address, handler.address);
      await ds_guard.permitx(dUSDT.address, handler.address);

      await handler.enableTokens([USDC.address, USDT.address]);
    }

    // Allocate some token to all accounts
    accounts = [account1, account2, account3, account4];
    for (const account of accounts) {
      await USDC.allocateTo(account, 1000000e6);
      await USDT.allocateTo(account, 1000000e6);
      USDC.approve(dUSDC.address, UINT256_MAX, {from: account});
      USDT.approve(dUSDT.address, UINT256_MAX, {from: account});
    }

    tokens = [USDC, USDT];
    dtokens = [dUSDC, dUSDT];
    atokens = [aUSDC, aUSDT];
    ctokens = [cUSDC, cUSDT];
    user_behavior = [
      dUSDC.mint,
      dUSDC.burn,
      dUSDC.redeem,
      // dUSDC.transfer,
      dUSDT.mint,
      dUSDT.burn,
      dUSDT.redeem
      // dUSDT.transfer
    ];
    admin_behavior = [
      dUSDC.rebalance,
      dUSDC.updateOriginationFee,
      dUSDT.rebalance,
      dUSDT.updateOriginationFee,
      dispatcher.resetHandlers,
      dispatcher.updateProportion,
    ];
  }

  async function checkUserBehavior(asyncFn, args, DToken, account) {
    let token = await DToken.token();
    let fee_recipient = await DToken.feeRecipient();
    let token_contract = token == USDC.address ? USDC : USDT;

    let balances = {};
    balances.account = await token_contract.balanceOf(account);
    balances.fee_recipient = await token_contract.balanceOf(fee_recipient);
    balances.getTotalBalance = await DToken.getTotalBalance();

    let dtoken_balance = await DToken.balanceOf(account);
    let exchange_rate = await DToken.getExchangeRate();
    // let exchange_rate_stored = (await DToken.data())['0'];
    console.log((await DToken.getExchangeRate()).toLocaleString().replace(/,/g, ""));
    // console.log(exchange_rate.toLocaleString().replace(/,/g, ""));
    // console.log(exchange_rate_stored.toLocaleString().replace(/,/g, ""));

    await asyncFn(...args);

    let new_balances = {};
    new_balances.account = await token_contract.balanceOf(account);
    new_balances.fee_recipient = await token_contract.balanceOf(fee_recipient);
    new_balances.getTotalBalance = await DToken.getTotalBalance();

    let new_dtoken_balance = await DToken.balanceOf(account);
    let new_exchange_rate = await DToken.getExchangeRate();
    let exchange_rate_stored = (await DToken.data())['0'];

    console.log((await DToken.totalSupply()).toLocaleString().replace(/,/g, ""));
    console.log(exchange_rate.toLocaleString().replace(/,/g, ""));
    console.log(exchange_rate_stored.toLocaleString().replace(/,/g, ""));
    console.log(new_exchange_rate.toLocaleString().replace(/,/g, ""));

    assert.equal(exchange_rate.toLocaleString().replace(/,/g, ""), exchange_rate_stored.toLocaleString().replace(/,/g, ""));

    switch (asyncFn) {
      case DToken.mint:
        var account_token_decrease = balances.account.sub(new_balances.account);
        var fee_recipient_increase = new_balances.fee_recipient.sub(balances.fee_recipient);
        var underlying_increase = account_token_decrease.sub(fee_recipient_increase);

        assert.equal(account_token_decrease.toLocaleString().replace(/,/g, ""), args[1].toLocaleString().replace(/,/g, ""));
        assert.equal(underlying_increase.toLocaleString().replace(/,/g, ""), (new_balances.getTotalBalance.sub(balances.getTotalBalance)).toLocaleString().replace(/,/g, ""));
        assert.equal(rdiv(underlying_increase, exchange_rate).toLocaleString().replace(/,/g, ""), (new_dtoken_balance.sub(dtoken_balance)).toLocaleString().replace(/,/g, ""));
        break;
      case DToken.burn:
        var account_dtoken_decrease = dtoken_balance.sub(new_dtoken_balance);
        // var underlying_decrease = rmul(account_dtoken_decrease, exchange_rate);
        var underlying_decrease = balances.getTotalBalance.sub(new_balances.getTotalBalance);
        var account_increase = new_balances.account.sub(balances.account);
        var fee_recipient_increase = new_balances.fee_recipient.sub(balances.fee_recipient);

        assert.equal(account_dtoken_decrease.toLocaleString().replace(/,/g, ""), args[1].toLocaleString().replace(/,/g, ""));
        assert.equal(underlying_decrease.toLocaleString().replace(/,/g, ""), account_increase.add(fee_recipient_increase).toLocaleString().replace(/,/g, ""));
        assert.equal(underlying_decrease.toLocaleString().replace(/,/g, ""), rmul(account_dtoken_decrease, exchange_rate).toLocaleString().replace(/,/g, ""));
        // assert.equal(account_increase.toLocaleString().replace(/,/g, ""), (underlying_decrease.sub(fee_recipient_increase)).toLocaleString().replace(/,/g, ""));
        assert.equal(account_increase.add(fee_recipient_increase).toLocaleString().replace(/,/g, ""), rmul(account_dtoken_decrease, exchange_rate).toLocaleString().replace(/,/g, ""));
        break;
      case DToken.redeem:
        var account_dtoken_decrease = dtoken_balance.sub(new_dtoken_balance);
        var underlying_decrease = balances.getTotalBalance.sub(new_balances.getTotalBalance);
        var account_increase = new_balances.account.sub(balances.account);
        var fee_recipient_increase = new_balances.fee_recipient.sub(balances.fee_recipient);
        
        assert.equal(account_increase.toLocaleString().replace(/,/g, ""), args[1].toLocaleString().replace(/,/g, ""));
        assert.equal(underlying_decrease.toLocaleString().replace(/,/g, ""), (account_increase.add(fee_recipient_increase)).toLocaleString().replace(/,/g, ""));
        assert.equal(account_dtoken_decrease.toLocaleString().replace(/,/g, ""), rdivup(underlying_decrease, exchange_rate).toLocaleString().replace(/,/g, ""));
        break;
      default:
        break;
    }
  }

  function rmul(x, y) {
    return x.mul(y).div(BASE);
  }

  function rdiv(x, y) {
    return x.mul(BASE).div(y);
  }

  function rdivup(x, y) {
    return x.mul(BASE).add(y.sub(new BN('1'))).div(y);
  }

  function randomNum(minNum, maxNum) {
    switch (arguments.length) {
      case 1:
        return parseInt(Math.random() * minNum + 1, 10);
        break;
      case 2:
        return parseInt(Math.random() * (maxNum - minNum + 1) + minNum, 10);
        break;
      default:
        return 0;
        break;
    }
  }

  describe("DToken Integration: Random comprehensive test", function () {
    before(async function () {
      await resetContracts();
      dispatcher.resetHandlers(
        [
          internal_handler.address,
          compound_handler.address,
          aave_handler.address,
        ],
        [700000, 200000, 100000]
      );

      await dUSDC.updateOriginationFee('0x9dc29fac', FEE); // Burn
      await dUSDC.updateOriginationFee('0x40c10f19', FEE); // Mint
    });

    var run_number = 500;
    condition = 0;
    while (condition < run_number) {
      condition++;
      
      it(`Case Simulated user behavior test case ${condition}`, async function () {

        var account;
        var balance;
        var amount;
        for (let index = 0; index < dtokens.length; index++) {
          account = accounts[randomNum(0, accounts.length - 1)];
          balance = (await dtokens[index].balanceOf(account)).toLocaleString().replace(/,/g, "");
          amount = new BN(randomNum(0, balance));
          await dtokens[index].transfer(accounts[randomNum(0, accounts.length - 1)], amount, {from : account});
          amount = new BN(randomNum(0, BASE.div(new BN('10')).toLocaleString().replace(/,/g, "")).toLocaleString().replace(/,/g, ""));
          // console.log(amount);
          // console.log(amount.toString());
          await atokens[index].updateBalance(amount);
          await ctokens[index].updateExchangeRate(new BN(randomNum(0, BASE.div(new BN('10')).toLocaleString().replace(/,/g, "")).toLocaleString().replace(/,/g, "")));
        }

        account = accounts[randomNum(0, accounts.length - 1)];
        var user_behavior_index = randomNum(0, user_behavior.length - 1);
        var dtoken_index = Math.floor(user_behavior_index / 3);

        switch (user_behavior_index % 3) {
          case 0:
            balance = (await tokens[dtoken_index].balanceOf(account)).toLocaleString().replace(/,/g, "");
            amount = new BN(randomNum(0, balance).toLocaleString().replace(/,/g, ""));
            // amount = new BN(randomNum(0, balance));
            console.log(`mint :: balance : ${balance}   amount : ${amount}`);
            break;
          case 1:
            // var balance1 = await dtokens[dtoken_index].balanceOf(account);
            // if (balance1.lte(new BN('100'))) {
            //   amount = new BN('0');
            //   break;
            // }
            // balance = (await dtokens[dtoken_index].balanceOf(account)).sub(new BN('100')).toLocaleString().replace(/,/g, "");
            balance = (await dtokens[dtoken_index].balanceOf(account)).toLocaleString().replace(/,/g, "");
            amount = new BN(randomNum(0, balance).toLocaleString().replace(/,/g, ""));
            // amount = new BN(randomNum(0, balance));
            console.log(`burn :: balance : ${balance}   amount : ${amount}`);
            break;
          case 2:
            balance = (rmul(await dtokens[dtoken_index].getTokenBalance(account), BASE.sub(await dtokens[dtoken_index].originationFee('0x9dc29fac')))).toLocaleString().replace(/,/g, "");
            amount = new BN(randomNum(0, balance).toLocaleString().replace(/,/g, ""));
            // amount = new BN(randomNum(0, balance));
            console.log(`redeem :: balance : ${balance}   amount : ${amount}`);
            break;
        }
        if (amount.lte(new BN('0')))
          return;

        await checkUserBehavior(
          user_behavior[user_behavior_index],
          [account, amount, {from: account}],
          dtokens[dtoken_index],
          account
        )
      });
    }

    it("Empty the end test", async function () {
      for (let i = 0; i < dtokens.length; i++) {
        for (let j = 0; j < accounts.length; j++) {
          var amount = await dtokens[i].balanceOf(accounts[j]);
          if (amount.lte(new BN('0')))
            continue;
          await dtokens[i].burn(accounts[j], amount, {from: accounts[j]});
          // await checkUserBehavior(
          //   dtokens[i].burn,
          //   [accounts[j], amount, {from: accounts[j]}],
          //   dtokens[i],
          //   accounts[j]
          // )

          assert.equal((await dtokens[i].balanceOf(accounts[j])).toLocaleString().replace(/,/g, ""), new BN(0).toLocaleString().replace(/,/g, ""));
        }
        assert.equal((await dtokens[i].totalSupply()).toLocaleString().replace(/,/g, ""), new BN(0).toLocaleString().replace(/,/g, ""));
        console.log(await dtokens[i].symbol() + " underlying balance: " + (await dtokens[i].getTotalBalance()).toLocaleString().replace(/,/g, ""));
      }
    });
  });
});
