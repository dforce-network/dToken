const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const TetherToken = artifacts.require("TetherToken");
const CTokenMock = artifacts.require("CTokenMock");
const CompoundHandler = artifacts.require("CompoundHandler");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const DTokenController = artifacts.require("DTokenController");
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
const FEE_MAX = BASE.div(new BN(10)).sub(new BN(1));
const TOTAL_PROPORTION = new BN(1000000);

const MINT_SELECTOR = "0x40c10f19";
const BURN_SELECTOR = "0x9dc29fac";
const FEE_HASHES_LIST = [MINT_SELECTOR, BURN_SELECTOR];
describe("DToken Contract Integration", function () {
  let owner, account1, account2, account3, account4;
  let USDC, USDT, DF;
  let ds_guard;
  let dispatcher;
  let dtoken_controller;
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

  let handlers = {};

  let user_behavior = [];
  let user_behavior_name = [];
  let dtoken_admin_behavior = [];
  let dispatcher_admin_behavior = [];

  before(async function () {
    [
      owner,
      account1,
      account2,
      account3,
      account4,
      account5,
    ] = await web3.eth.getAccounts();
  });

  async function resetContracts() {
    USDC = await FiatToken.new("USDC", "USDC", "USD", 6, owner, owner, owner);

    USDT = await TetherToken.new("0", "USDT", "USDT", 6);
    DF = await TetherToken.new("0", "DF", "DF", 18);

    dtoken_controller = await DTokenController.new();
    ds_guard = await DSGuard.new();

    internal_handler = await InternalHandler.new(dtoken_controller.address);
    other_handler = await InternalHandler.new(dtoken_controller.address);

    cUSDT = await CTokenMock.new("cUSDT", "cUSDT", USDT.address);
    cUSDC = await CTokenMock.new("cUSDC", "cUSDC", USDC.address);

    compound_handler = await CompoundHandler.new(dtoken_controller.address);
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
      dtoken_controller.address,
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

    await dtoken_controller.setdTokensRelation(
      [USDC.address, USDT.address],
      [dUSDC.address, dUSDT.address]
    );

    await dUSDC.setAuthority(ds_guard.address);
    await dUSDT.setAuthority(ds_guard.address);
    await dUSDC.setFeeRecipient(account5);
    await dUSDT.setFeeRecipient(account5);
    await dispatcher.setAuthority(ds_guard.address);

    // Initialize all handlers
    handlers[internal_handler.address] = internal_handler;
    handlers[compound_handler.address] = compound_handler;
    handlers[aave_handler.address] = aave_handler;
    handlers[other_handler.address] = other_handler;
    for (const key in handlers) {
      await handlers[key].setAuthority(ds_guard.address);
      await handlers[key].approve(USDC.address);
      await handlers[key].approve(USDT.address);
      await ds_guard.permitx(dUSDC.address, handlers[key].address);
      await ds_guard.permitx(dUSDT.address, handlers[key].address);

      await handlers[key].enableTokens([USDC.address, USDT.address]);
    }

    // Allocate some token to all accounts
    accounts = [account1, account2, account3, account4];
    for (const account of accounts) {
      await USDC.allocateTo(account, 1000000e6);
      await USDT.allocateTo(account, 1000000e6);
      USDC.approve(dUSDC.address, UINT256_MAX, { from: account });
      USDT.approve(dUSDT.address, UINT256_MAX, { from: account });
    }

    tokens = [USDC, USDT];
    dtokens = [dUSDC, dUSDT];
    atokens = [aUSDC, aUSDT];
    ctokens = [cUSDC, cUSDT];
    user_behavior = [
      dUSDC.mint,
      dUSDC.burn,
      dUSDC.redeem,
      dUSDT.mint,
      dUSDT.burn,
      dUSDT.redeem,
    ];
    user_behavior_name = ["mint", "burn", "redeem"];
    dtoken_admin_behavior = [
      dUSDC.rebalance,
      dUSDC.updateOriginationFee,
      dUSDT.rebalance,
      dUSDT.updateOriginationFee,
    ];
    dispatcher_admin_behavior = [
      dispatcher.resetHandlers,
      dispatcher.updateProportions,
    ];
  }

  function rmul(x, y) {
    return x.mul(y).div(BASE);
  }

  function rdiv(x, y) {
    return x.mul(BASE).div(y);
  }

  function rdivup(x, y) {
    return x
      .mul(BASE)
      .add(y.sub(new BN("1")))
      .div(y);
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

  function createRandomData(
    sourceData,
    lengthMin = 0,
    lengthMax = sourceData.length
  ) {
    let dataList = [];

    lengthMax = sourceData.length > lengthMax ? lengthMax : sourceData.length;
    lengthMax = lengthMin < lengthMax ? lengthMax : lengthMin;
    lengthMin = lengthMin < lengthMax ? lengthMin : lengthMax;

    if (lengthMax <= 0) return dataList;

    var indexList = [];
    var randomIndex = 0;
    for (let index = 0; index < lengthMax; index++) {
      if (index == randomNum(lengthMin, lengthMax - 1)) break;
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
    console.log(
      "totalSupply : " +
        (await DToken.totalSupply()).toLocaleString().replace(/,/g, "")
    );
    console.log(
      "totalBalance :" +
        balances.getTotalBalance.toLocaleString().replace(/,/g, "")
    );

    if (asyncFn == DToken.mint && rdiv(args[1], exchange_rate).eq(new BN(0))) {
      await truffleAssert.reverts(
        asyncFn(...args),
        "mint: can not mint the smallest unit with the given amount"
      );
      console.log("mint: can not mint the smallest unit with the given amount");
      return;
    }

    if (
      asyncFn != DToken.mint &&
      balances.getTotalBalance.eq(new BN(0)) &&
      (await DToken.totalSupply()).gt(new BN(0))
    )
      return;

    await asyncFn(...args);

    let new_balances = {};
    new_balances.account = await token_contract.balanceOf(account);
    new_balances.fee_recipient = await token_contract.balanceOf(fee_recipient);
    new_balances.getTotalBalance = await DToken.getTotalBalance();

    let new_dtoken_balance = await DToken.balanceOf(account);
    let new_exchange_rate = await DToken.getExchangeRate();
    let exchange_rate_stored = (await DToken.data())["0"];

    // console.log((await DToken.totalSupply()).toLocaleString().replace(/,/g, ""));
    console.log(
      (await token_contract.symbol()) +
        " balanceOf : " +
        (await token_contract.balanceOf(DToken.address))
          .toLocaleString()
          .replace(/,/g, "")
    );
    console.log(exchange_rate.toLocaleString().replace(/,/g, ""));
    console.log(exchange_rate_stored.toLocaleString().replace(/,/g, ""));
    console.log(new_exchange_rate.toLocaleString().replace(/,/g, "") + "\n");

    assert.equal(
      exchange_rate.toLocaleString().replace(/,/g, ""),
      exchange_rate_stored.toLocaleString().replace(/,/g, "")
    );

    let account_dtoken_change = dtoken_balance.sub(new_dtoken_balance).abs();
    let account_token_change = balances.account.sub(new_balances.account).abs();
    let fee_recipient_change = new_balances.fee_recipient
      .sub(balances.fee_recipient)
      .abs();
    let underlying_change = balances.getTotalBalance
      .sub(new_balances.getTotalBalance)
      .abs();
    switch (asyncFn) {
      case DToken.mint:
        assert.equal(
          account_token_change.toLocaleString().replace(/,/g, ""),
          args[1].toLocaleString().replace(/,/g, "")
        );
        assert.equal(
          underlying_change.toLocaleString().replace(/,/g, ""),
          account_token_change
            .sub(fee_recipient_change)
            .toLocaleString()
            .replace(/,/g, "")
        );
        assert.equal(
          rdiv(underlying_change, exchange_rate_stored)
            .toLocaleString()
            .replace(/,/g, ""),
          account_dtoken_change.toLocaleString().replace(/,/g, "")
        );
        break;
      case DToken.burn:
        assert.equal(
          account_dtoken_change.toLocaleString().replace(/,/g, ""),
          args[1].toLocaleString().replace(/,/g, "")
        );
        assert.equal(
          account_token_change
            .add(fee_recipient_change)
            .toLocaleString()
            .replace(/,/g, ""),
          rmul(account_dtoken_change, exchange_rate_stored)
            .toLocaleString()
            .replace(/,/g, "")
        );
        assert.equal(
          underlying_change.toLocaleString().replace(/,/g, ""),
          account_token_change
            .add(fee_recipient_change)
            .toLocaleString()
            .replace(/,/g, "")
        );
        assert.equal(
          underlying_change.toLocaleString().replace(/,/g, ""),
          rmul(account_dtoken_change, exchange_rate_stored)
            .toLocaleString()
            .replace(/,/g, "")
        );
        break;
      case DToken.redeem:
        assert.equal(
          account_token_change.toLocaleString().replace(/,/g, ""),
          args[1].toLocaleString().replace(/,/g, "")
        );
        assert.equal(
          account_dtoken_change.toLocaleString().replace(/,/g, ""),
          rdivup(underlying_change, exchange_rate_stored)
            .toLocaleString()
            .replace(/,/g, "")
        );
        assert.equal(
          underlying_change.toLocaleString().replace(/,/g, ""),
          account_token_change
            .add(fee_recipient_change)
            .toLocaleString()
            .replace(/,/g, "")
        );
        // assert.equal(underlying_change.toLocaleString().replace(/,/g, ""), rmul(account_dtoken_change, exchange_rate_stored).toLocaleString().replace(/,/g, ""));
        break;
      default:
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
        // [700000, 300000]
        [700000, 200000, 100000]
      );

      await dUSDC.updateOriginationFee(BURN_SELECTOR, FEE);
      await dUSDC.updateOriginationFee(MINT_SELECTOR, FEE);
      await dUSDT.updateOriginationFee(BURN_SELECTOR, FEE);
      await dUSDT.updateOriginationFee(MINT_SELECTOR, FEE);
    });

    var run_number = 1000;
    condition = 0;
    while (condition < run_number) {
      condition++;

      it(`Case Simulated user behavior test case ${condition} (Skipped in coverage)`, async function () {
        var account;
        var balance;
        var amount;
        for (let index = 0; index < dtokens.length; index++) {
          account = accounts[randomNum(0, accounts.length - 1)];
          balance = (await dtokens[index].balanceOf(account))
            .toLocaleString()
            .replace(/,/g, "");
          amount = new BN(
            randomNum(0, balance).toLocaleString().replace(/,/g, "")
          );
          await dtokens[index].transfer(
            accounts[randomNum(0, accounts.length - 1)],
            amount,
            { from: account }
          );
          await atokens[index].updateBalance(
            new BN(
              randomNum(
                0,
                BASE.div(new BN("1000")).toLocaleString().replace(/,/g, "")
              )
                .toLocaleString()
                .replace(/,/g, "")
            )
          );
          await ctokens[index].updateExchangeRate(
            new BN(
              randomNum(
                0,
                BASE.div(new BN("1000")).toLocaleString().replace(/,/g, "")
              )
                .toLocaleString()
                .replace(/,/g, "")
            )
          );

          if (randomNum(0, 12) == 2) {
            console.log("\n");
            var args = [];
            var dtoken_admin_index = randomNum(0, 1);
            switch (dtoken_admin_index) {
              case 0:
                var handler_list = await dtokens[index].getHandlers();
                var withdraw_handlers = createRandomData(handler_list);
                var liquidity;
                var amount;
                var total_amount = await handlers[handler_list[0]].getBalance(
                  tokens[index].address
                );
                var withdraw_amounts = [];
                for (const handler of withdraw_handlers) {
                  liquidity = await handlers[handler].getLiquidity(
                    tokens[index].address
                  );
                  amount = new BN(
                    randomNum(0, liquidity.toLocaleString().replace(/,/g, ""))
                      .toLocaleString()
                      .replace(/,/g, "")
                  );
                  total_amount =
                    handler == handler_list[0]
                      ? total_amount
                      : total_amount.add(amount);
                  withdraw_amounts.push(
                    amount.eq(
                      await handlers[handler].getBalance(tokens[index].address)
                    )
                      ? UINT256_MAX
                      : amount
                  );
                }
                var deposit_handlers = createRandomData(handler_list);
                var deposit_amounts = [];
                for (const handler of deposit_handlers) {
                  amount = new BN(
                    randomNum(
                      0,
                      total_amount.toLocaleString().replace(/,/g, "")
                    )
                      .toLocaleString()
                      .replace(/,/g, "")
                  );
                  total_amount = total_amount.sub(amount);
                  deposit_amounts.push(amount);
                }
                console.log([
                  internal_handler.address,
                  compound_handler.address,
                  aave_handler.address,
                  other_handler.address,
                ]);
                console.log(handler_list);
                console.log(
                  (
                    await handlers[handler_list[0]].getBalance(
                      tokens[index].address
                    )
                  )
                    .toLocaleString()
                    .replace(/,/g, "")
                );
                console.log((await dtokens[index].symbol()) + ":rebalance");
                console.log("withdraw_handlers:" + withdraw_handlers);
                console.log("withdraw_amounts:" + withdraw_amounts);
                console.log("deposit_handlers:" + deposit_handlers);
                console.log("deposit_amounts:" + deposit_amounts);
                await dtoken_admin_behavior[index * 2 + dtoken_admin_index](
                  withdraw_handlers,
                  withdraw_amounts,
                  deposit_handlers,
                  deposit_amounts
                );
                break;
              case 1:
                var fee_index =
                  FEE_HASHES_LIST[randomNum(0, FEE_HASHES_LIST.length - 1)];
                var fee = randomNum(
                  0,
                  FEE_MAX.toLocaleString().replace(/,/g, "")
                )
                  .toLocaleString()
                  .replace(/,/g, "");
                var old_fee = (await dtokens[index].originationFee(fee_index))
                  .toLocaleString()
                  .replace(/,/g, "");
                if (fee != old_fee) {
                  await dtoken_admin_behavior[index * 2 + dtoken_admin_index](
                    fee_index,
                    new BN(fee)
                  );
                  console.log(
                    (await dtokens[index].symbol()) +
                      ":updateOriginationFee old fee : " +
                      old_fee +
                      " fee : " +
                      fee
                  );
                }
                break;
            }
          }

          if (randomNum(0, 50) == 1) {
            console.log("\n");
            var handler_list = [];
            var args = [];
            var dispatcher_admin_index = randomNum(0, 1);
            switch (dispatcher_admin_index) {
              case 0:
                handler_list = createRandomData([
                  compound_handler.address,
                  aave_handler.address,
                ]);
                handler_list.unshift(
                  ...createRandomData(
                    [internal_handler.address, other_handler.address],
                    1,
                    2
                  )
                );
                console.log("resetHandlers:");
                break;
              case 1:
                handler_list = await dtokens[index].getHandlers();
                handler_list = createRandomData(
                  handler_list,
                  handler_list.length,
                  handler_list.length
                );
                console.log("updateProportion:");
                break;
            }
            var proportions = [];
            var proportional_quota = TOTAL_PROPORTION;
            var proportion;
            for (let index = 0; index < handler_list.length; index++) {
              proportion =
                index == handler_list.length - 1
                  ? proportional_quota
                  : new BN(
                      randomNum(
                        0,
                        proportional_quota.toLocaleString().replace(/,/g, "")
                      )
                        .toLocaleString()
                        .replace(/,/g, "")
                    );
              proportions.push(proportion);
              proportional_quota = proportional_quota.sub(proportion);
            }
            args.push(handler_list);
            args.push(proportions);
            // console.log([internal_handler.address, compound_handler.address, aave_handler.address, other_handler.address]);
            console.log("handlers:" + args[0]);
            console.log("proportions:" + args[1]);
            await dispatcher_admin_behavior[dispatcher_admin_index](...args);
          }
        }

        account = accounts[randomNum(0, accounts.length - 1)];
        var user_behavior_index = randomNum(0, user_behavior.length - 1);
        var dtoken_index = Math.floor(user_behavior_index / 3);

        switch (user_behavior_index % 3) {
          case 0:
            balance = (await tokens[dtoken_index].balanceOf(account))
              .toLocaleString()
              .replace(/,/g, "");
            break;
          case 1:
            balance = (await dtokens[dtoken_index].balanceOf(account))
              .toLocaleString()
              .replace(/,/g, "");
            break;
          case 2:
            balance = rmul(
              await dtokens[dtoken_index].getTokenBalance(account),
              BASE.sub(await dtokens[dtoken_index].originationFee("0x9dc29fac"))
            )
              .toLocaleString()
              .replace(/,/g, "");
            break;
        }
        amount = new BN(
          randomNum(0, balance).toLocaleString().replace(/,/g, "")
        );
        console.log(
          `${await dtokens[dtoken_index].symbol()} ${
            user_behavior_name[user_behavior_index % 3]
          } :: balance : ${balance}   amount : ${amount}`
        );
        if (amount.lte(new BN("0"))) return;

        await checkUserBehavior(
          user_behavior[user_behavior_index],
          [account, amount, { from: account }],
          dtokens[dtoken_index],
          account
        );
      });
    }

    it("Empty the end test", async function () {
      for (let i = 0; i < dtokens.length; i++) {
        for (let j = 0; j < accounts.length; j++) {
          var amount = await dtokens[i].balanceOf(accounts[j]);
          if (amount.lte(new BN("0"))) continue;
          if ((await dtokens[i].getTotalBalance()).eq(new BN(0))) continue;
          await dtokens[i].burn(accounts[j], amount, {
            from: accounts[j],
          });

          assert.equal(
            (await dtokens[i].balanceOf(accounts[j]))
              .toLocaleString()
              .replace(/,/g, ""),
            new BN(0).toLocaleString().replace(/,/g, "")
          );
        }
        // if ((await dtokens[i].getTotalBalance()).eq(new BN(0)) && (await dtokens[i].totalSupply()).gt(new BN(0)));
        // assert.equal((await dtokens[i].totalSupply()).toLocaleString().replace(/,/g, ""), new BN(0).toLocaleString().replace(/,/g, ""));
        console.log(
          (await dtokens[i].symbol()) +
            " totalSupply: " +
            (await dtokens[i].totalSupply()).toLocaleString().replace(/,/g, "")
        );
        console.log(
          (await dtokens[i].symbol()) +
            " underlying balance: " +
            (await dtokens[i].getTotalBalance())
              .toLocaleString()
              .replace(/,/g, "")
        );
      }
    });
  });
});
