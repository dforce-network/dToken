const truffleAssert = require("truffle-assertions");
const FiatTokenV1 = artifacts.require("FiatTokenV1");
const TetherToken = artifacts.require("TetherToken");
const CToken = artifacts.require("CErc20");
const AToken = artifacts.require("AToken");
const CompoundHandler = artifacts.require("CompoundHandler");
const AaveHandler = artifacts.require("AaveHandler");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const dTokenAddresses = artifacts.require("dTokenAddresses");
const DToken = artifacts.require("DToken");
const DSGuard = artifacts.require("DSGuard");
const LendingPoolCore = artifacts.require("LendingPoolCore");
const LendingPool = artifacts.require("LendingPool");
const DTokenProxy = artifacts.require("DTokenProxy");
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const BN = require("bn.js");

const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));
const BASE = new BN(10).pow(new BN(18));
const FEE = new BN(10).pow(new BN(14));
const FEE_MAX = BASE.div(new BN(10)).sub(new BN(1));
const TOTAL_PROPORTION = new BN(1000000);

const MINT_SELECTOR = "0x40c10f19";
const BURN_SELECTOR = "0x9dc29fac";
const FEE_HASHES_LIST = [MINT_SELECTOR, BURN_SELECTOR];
contract("DToken Contract Integration", (accounts) => {
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

  let tokens = [];
  let dtokens = [];
  let atokens = [];
  let ctokens = [];

  let handlers = {};

  let user_behavior = [];
  let user_behavior_name = [];
  let dtoken_admin_behavior = [];
  let dispatcher_admin_behavior = [];

  before(async function () {

    console.log("all accounts are: ", accounts);
    owner = accounts[0];
    account1 = accounts[1];
    account2 = accounts[2];
    account3 = accounts[3];
    account4 = accounts[4];
    // DSGuard
    dsGuard = await DSGuard.at("0xB1fe1B1C3F1a50cc4f28C433B4b652f5aD4C139A");
    console.log("dsGuard address: ", dsGuard.address);
    // dToken address mapping contract
    dTokenContractsLibrary = await dTokenAddresses.at("0x0aA28320e0fF92050052c652a3B1Ab3f63E38647");
    console.log("dTokenContractsLibrary address: ", dTokenContractsLibrary.address);
    // Compound USDC
    USDC = await FiatTokenV1.at("0xb7a4F3E9097C08dA09517b5aB877F7a917224ede");
    console.log('balance is', (await USDC.balanceOf(owner)).toString());
    // Compound cUSDC
    cUSDC = await CToken.at("0x4a92E71227D294F041BD82dd8f78591B75140d63");
    console.log("cUSDC address: ", cUSDC.address);
    // dUSDC Token
    dUSDC = await DToken.at("0x3088cF50e1921b0CB17ed1e39f9407C8838973F1");
    console.log("dUSDC address: ", dUSDC.address);
    // Aave USDT
    USDT = await TetherToken.at("0x13512979ade267ab5100878e2e0f485b568328a4");
    console.log("usdt address: ", USDT.address);
    // Aave aUSDT
    aUSDT = await AToken.at("0xA01bA9fB493b851F4Ac5093A324CB081A909C34B");
    console.log("aUSDT address: ", aUSDT.address);
    // dUSDT Token
    dUSDT = await DToken.at("0x7B061564cf07d40b9d023856Fb72cC64542DB646");
    console.log("dUSDT address: ", dUSDT.address);
    // Internal handler
    internalHandler = await InternalHandler.at("0xF7b536d927D0d7e271ce07ED34EFCF402143cc8a");
    console.log("internalHandler address: ", internalHandler.address);
    // Compound handler
    compoundHandler = await CompoundHandler.at("0x7016022576bf78D034400dDf9966E7F3F99e2147");
    console.log("compoundHandler address: ", compoundHandler.address);
    // Aave handler
    aaveHandler = await AaveHandler.at("0x2f19Ed333Fc24ceE69AAB8dE8641afE9b121e902");
    console.log("aaveHandler address: ", aaveHandler.address);

    for (const account of accounts) {
      USDC.approve(dUSDC.address, UINT256_MAX, {
        from: account
      });
      USDT.approve(dUSDT.address, UINT256_MAX, {
        from: account
      });
    }
    console.log("here!!!")

    tokens = [USDC, USDT];
    dtokens = [dUSDC, dUSDT];
    atokens = [aUSDT];
    ctokens = [cUSDC];
    user_behavior = [
      dUSDC.mint,
      dUSDC.burn,
      dUSDC.redeem,
      dUSDT.mint,
      dUSDT.burn,
      dUSDT.redeem
    ];
    user_behavior_name = [
      'mint',
      'burn',
      'redeem',
    ];
    dtoken_admin_behavior = [
      dUSDC.rebalance,
      // dUSDC.updateOriginationFee,
      dUSDT.rebalance,
      // dUSDT.updateOriginationFee
    ];
    dispatcher_admin_behavior = [
    ];
  });

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

  function createRandomData(sourceData, lengthMin = 0, lengthMax = sourceData.length) {
    let dataList = [];

    lengthMax = sourceData.length > lengthMax ? lengthMax : sourceData.length;
    lengthMax = lengthMin < lengthMax ? lengthMax : lengthMin;
    lengthMin = lengthMin < lengthMax ? lengthMin : lengthMax;

    if (lengthMax <= 0)
      return dataList;

    var indexList = [];
    var randomIndex = 0;
    for (let index = 0; index < lengthMax; index++) {

      if (index == randomNum(lengthMin, lengthMax - 1))
        break;
      randomIndex = randomNum(0, sourceData.length - 1);
      if (indexList.indexOf(randomIndex) >= 0) {
        index--;
        continue;
      }
      dataList[dataList.length] = sourceData[randomIndex];
      indexList[indexList.length] = randomIndex;

    }
    return dataList;
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
    // console.log((await DToken.getExchangeRate()).toLocaleString().replace(/,/g, ""));
    // console.log(exchange_rate.toLocaleString().replace(/,/g, ""));
    // console.log(exchange_rate_stored.toLocaleString().replace(/,/g, ""));
    console.log('totalSupply : ' + (await DToken.totalSupply()).toLocaleString().replace(/,/g, ""));
    console.log('totalBalance :' + balances.getTotalBalance.toLocaleString().replace(/,/g, ""));

    if (asyncFn != DToken.mint && balances.getTotalBalance.eq(new BN(0)) && (await DToken.totalSupply()).gt(new BN(0)))
      return;
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

    let account_dtoken_change = dtoken_balance.sub(new_dtoken_balance).abs();
    let account_token_change = balances.account.sub(new_balances.account).abs();
    let fee_recipient_change = new_balances.fee_recipient.sub(balances.fee_recipient).abs();
    let underlying_change = balances.getTotalBalance.sub(new_balances.getTotalBalance).abs();
    switch (asyncFn) {
      case DToken.mint:
        assert.equal(account_token_change.toLocaleString().replace(/,/g, ""), args[1].toLocaleString().replace(/,/g, ""));
        assert.equal(underlying_change.toLocaleString().replace(/,/g, ""), (account_token_change.sub(fee_recipient_change)).toLocaleString().replace(/,/g, ""));
        assert.equal(rdiv(underlying_change, exchange_rate_stored).toLocaleString().replace(/,/g, ""), account_dtoken_change.toLocaleString().replace(/,/g, ""));
        break;
      case DToken.burn:
        assert.equal(account_dtoken_change.toLocaleString().replace(/,/g, ""), args[1].toLocaleString().replace(/,/g, ""));
        assert.equal(account_token_change.add(fee_recipient_change).toLocaleString().replace(/,/g, ""), rmul(account_dtoken_change, exchange_rate_stored).toLocaleString().replace(/,/g, ""));
        assert.equal(underlying_change.toLocaleString().replace(/,/g, ""), (account_token_change.add(fee_recipient_change)).toLocaleString().replace(/,/g, ""));
        assert.equal(underlying_change.toLocaleString().replace(/,/g, ""), rmul(account_dtoken_change, exchange_rate_stored).toLocaleString().replace(/,/g, ""));
        break;
      case DToken.redeem:
        assert.equal(account_token_change.toLocaleString().replace(/,/g, ""), args[1].toLocaleString().replace(/,/g, ""));
        assert.equal(account_dtoken_change.toLocaleString().replace(/,/g, ""), rdivup(underlying_change, exchange_rate_stored).toLocaleString().replace(/,/g, ""));
        assert.equal(underlying_change.toLocaleString().replace(/,/g, ""), (account_token_change.add(fee_recipient_change)).toLocaleString().replace(/,/g, ""));
        // assert.equal(underlying_change.toLocaleString().replace(/,/g, ""), rmul(account_dtoken_change, exchange_rate_stored).toLocaleString().replace(/,/g, ""));
        break;
      default:
        break;
    }
  }

  var run_number = 1000;
  condition = 0;
  while (condition < run_number) {
    condition++;

    it(`Case Simulated user behavior test case ${condition}`, async function () {
      console.log('Start to test randomly ...')

      var account;
      var balance;
      var amount;
      for (let index = 0; index < dtokens.length; index++) {
        account = accounts[randomNum(0, accounts.length - 1)];
        // balance = (await dtokens[index].balanceOf(account)).toString();
        amount = new BN(randomNum(0, 90000000).toString());
        await dtokens[index].transfer(accounts[randomNum(0, accounts.length - 1)], amount, {
          from: account
        });
        // await atokens[index].updateBalance(new BN(randomNum(0, BASE.div(new BN('10')).toLocaleString().replace(/,/g, "")).toLocaleString().replace(/,/g, "")));
        // await ctokens[index].updateExchangeRate(new BN(randomNum(0, BASE.div(new BN('10')).toLocaleString().replace(/,/g, "")).toLocaleString().replace(/,/g, "")));

        if (randomNum(0, 10) == 2) {
          var args = [];
          var dtoken_admin_index = 0;
          switch (dtoken_admin_index) {
            case 0:
              var handler_list = await dtokens[index].getHandler();
              var withdraw_handlers = createRandomData(handler_list);
              var liquidity;
              var amount;
              var total_amount = await handlers[handler_list[0]].getBalance(tokens[index].address);
              var withdraw_amounts = [];
              for (const handler of withdraw_handlers) {
                liquidity = await handlers[handler].getLiquidity(tokens[index].address);
                amount = new BN(randomNum(0, liquidity.toLocaleString().replace(/,/g, "")).toLocaleString().replace(/,/g, ""));
                total_amount = handler == handler_list[0] ? total_amount : total_amount.add(amount);
                withdraw_amounts.push(amount.eq(await handlers[handler].getBalance(tokens[index].address)) ? UINT256_MAX : amount);
              }
              var deposit_handlers = createRandomData(handler_list);
              var deposit_amounts = [];
              for (const handler of deposit_handlers) {
                amount = new BN(randomNum(0, total_amount.toLocaleString().replace(/,/g, "")).toLocaleString().replace(/,/g, ""));
                total_amount = total_amount.sub(amount);
                deposit_amounts.push(amount);
              }
              console.log([internal_handler.address, compound_handler.address, aave_handler.address, other_handler.address]);
              console.log(handler_list);
              console.log((await handlers[handler_list[0]].getBalance(tokens[index].address)).toLocaleString().replace(/,/g, ""));
              console.log(await dtokens[index].symbol() + ':rebalance');
              console.log('withdraw_handlers:' + withdraw_handlers);
              console.log('withdraw_amounts:' + withdraw_amounts);
              console.log('deposit_handlers:' + deposit_handlers);
              console.log('deposit_amounts:' + deposit_amounts);
              await dtoken_admin_behavior[index * 2 + dtoken_admin_index](withdraw_handlers, withdraw_amounts, deposit_handlers, deposit_amounts);
              break;
            // case 1:
            //   var fee_index = FEE_HASHES_LIST[randomNum(0, FEE_HASHES_LIST.length - 1)];
            //   var fee = randomNum(0, FEE_MAX.toLocaleString().replace(/,/g, "")).toLocaleString().replace(/,/g, "");
            //   var old_fee = (await dtokens[index].originationFee(fee_index)).toLocaleString().replace(/,/g, "");
            //   if (fee != old_fee) {

            //     await dtoken_admin_behavior[index * 2 + dtoken_admin_index](fee_index, new BN(fee));
            //     console.log(await dtokens[index].symbol() + ':updateOriginationFee old fee : ' + old_fee + ' fee : ' + fee);
            //   }
            //   break;
          }
        }
      }

      account = accounts[randomNum(0, accounts.length - 1)];
      var user_behavior_index = randomNum(0, user_behavior.length - 1);
      var dtoken_index = Math.floor(user_behavior_index / 3);

      switch (user_behavior_index % 3) {
        case 0:
          balance = (await tokens[dtoken_index].balanceOf(account)).toLocaleString().replace(/,/g, "");
          break;
        case 1:
          balance = (await dtokens[dtoken_index].balanceOf(account)).toLocaleString().replace(/,/g, "");
          break;
        case 2:
          balance = (rmul(await dtokens[dtoken_index].getTokenBalance(account), BASE.sub(await dtokens[dtoken_index].originationFee('0x9dc29fac')))).toLocaleString().replace(/,/g, "");
          break;
      }
      amount = new BN(randomNum(0, balance).toLocaleString().replace(/,/g, ""));
      console.log(`${await dtokens[dtoken_index].symbol()} ${user_behavior_name[user_behavior_index % 3]} :: balance : ${balance}   amount : ${amount}`);
      if (amount.lte(new BN('0')))
        return;

      await checkUserBehavior(
        user_behavior[user_behavior_index],
        [account, amount, {
          from: account
        }],
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
        if ((await dtokens[i].getTotalBalance()).eq(new BN(0)))
          continue;
        await dtokens[i].burn(accounts[j], amount, {
          from: accounts[j]
        });

        assert.equal((await dtokens[i].balanceOf(accounts[j])).toLocaleString().replace(/,/g, ""), new BN(0).toLocaleString().replace(/,/g, ""));
      }
      // if ((await dtokens[i].getTotalBalance()).eq(new BN(0)) && (await dtokens[i].totalSupply()).gt(new BN(0)));
      // assert.equal((await dtokens[i].totalSupply()).toLocaleString().replace(/,/g, ""), new BN(0).toLocaleString().replace(/,/g, ""));
      console.log(await dtokens[i].symbol() + " totalSupply: " + (await dtokens[i].totalSupply()).toLocaleString().replace(/,/g, ""));
      console.log(await dtokens[i].symbol() + " underlying balance: " + (await dtokens[i].getTotalBalance()).toLocaleString().replace(/,/g, ""));
    }
  });
});
