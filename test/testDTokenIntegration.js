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
const INTEREST_RATE = new BN(10).pow(new BN(16));

const MINT_SELECTOR = "0x40c10f19";
const BURN_SELECTOR = "0x9dc29fac";

describe("DToken Contract Integration", function () {
  let owner, account1, account2, account3, account4;
  let USDC, USDT;
  let ds_guard;
  let dispatcher;
  let dtoken_controller;
  let internal_handler, compound_handler, aave_handler, other_handler;
  let dUSDC, dUSDT;
  let cUSDT, cUSDC;
  let aUSDC, aUSDT;
  let lending_pool_core;
  let lending_pool;
  let other_contract;

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
    USDC = await FiatToken.new("USDC", "USDC", "USD", 6, owner, owner, owner);

    USDT = await TetherToken.new("0", "USDT", "USDT", 6);

    dtoken_controller = await DTokenController.new();
    ds_guard = await DSGuard.new();

    internal_handler = await InternalHandler.new(dtoken_controller.address);

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
    await dispatcher.setAuthority(ds_guard.address);

    // Initialize all handlers
    let handlers = [internal_handler, compound_handler, aave_handler];
    for (const handler of handlers) {
      await handler.setAuthority(ds_guard.address);
      await handler.approve(USDC.address);
      await handler.approve(USDT.address);
      await ds_guard.permitx(dUSDC.address, handler.address);
      await ds_guard.permitx(dUSDT.address, handler.address);

      await handler.enableTokens([USDC.address, USDT.address]);
    }

    // Allocate some token to all accounts
    let accounts = [account1, account2, account3, account4];
    for (const account of accounts) {
      await USDC.allocateTo(account, 100000e6);
      await USDT.allocateTo(account, 100000e6);
      USDC.approve(dUSDC.address, UINT256_MAX, {from: account});
      USDT.approve(dUSDT.address, UINT256_MAX, {from: account});
    }
  }

  async function getAllTokenBalances(account) {
    let balances = {};

    balances.usdc = await USDC.balanceOf(account);
    balances.usdt = await USDT.balances(account);
    balances.dusdc = await dUSDC.balanceOf(account);
    balances.dusdt = await dUSDT.balanceOf(account);

    // console.log("usdc:" + balances.usdc.toString());
    // console.log("usdt:" + balances.usdt.toString());
    // console.log("dusdc:" + balances.dusdc.toString());
    // console.log("dusdt:" + balances.dusdt.toString());

    return balances;
  }

  async function getAllLiquidities() {
    let liquidities = {};

    liquidities.int_usdc = await internal_handler.getLiquidity(USDC.address);
    liquidities.com_usdc = await compound_handler.getLiquidity(USDC.address);
    liquidities.aav_usdc = await aave_handler.getLiquidity(USDC.address);

    liquidities.int_usdt = await internal_handler.getLiquidity(USDT.address);
    liquidities.com_usdt = await compound_handler.getLiquidity(USDT.address);
    liquidities.aav_usdt = await aave_handler.getLiquidity(USDT.address);

    // console.log("int_usdc:" + liquidities.int_usdc.toString());
    // console.log("com_usdc:" + liquidities.com_usdc.toString());
    // console.log("aav_usdc:" + liquidities.aav_usdc.toString());
    // console.log("int_usdc:" + liquidities.int_usdt.toString());
    // console.log("com_usdc:" + liquidities.com_usdt.toString());
    // console.log("aav_usdc:" + liquidities.aav_usdt.toString());

    return liquidities;
  }

  async function calcDiff(asyncFn, args, account) {
    let diff = {};

    let balances = await getAllTokenBalances(account);
    let liq = await getAllLiquidities();
    let dusdc_rate = (await dUSDC.data())["0"];
    let dusdt_rate = (await dUSDT.data())["0"];

    await asyncFn(...args);

    let new_balances = await getAllTokenBalances(account);
    let new_liq = await getAllLiquidities();
    let new_dusdc_rate = (await dUSDC.data())["0"];
    let new_dusdt_rate = (await dUSDT.data())["0"];

    diff.usdc = new_balances.usdc.sub(balances.usdc).toString();
    diff.usdt = new_balances.usdt.sub(balances.usdt).toString();
    diff.dusdc = new_balances.dusdc.sub(balances.dusdc).toString();
    diff.dusdt = new_balances.dusdt.sub(balances.dusdt).toString();
    diff.int_usdc = new_liq.int_usdc.sub(liq.int_usdc).toString();
    diff.com_usdc = new_liq.com_usdc.sub(liq.com_usdc).toString();
    diff.aav_usdc = new_liq.aav_usdc.sub(liq.aav_usdc).toString();
    diff.int_usdt = new_liq.int_usdt.sub(liq.int_usdt).toString();
    diff.com_usdt = new_liq.com_usdt.sub(liq.com_usdt).toString();
    diff.aav_usdt = new_liq.aav_usdt.sub(liq.aav_usdt).toString();
    diff.dusdc_rate = new_dusdc_rate.sub(dusdc_rate).toString();
    diff.dusdt_rate = new_dusdt_rate.sub(dusdt_rate).toString();

    if (!new_dusdc_rate.eq(dusdc_rate)) {
      console.log(
        "dUSDC Exchange rate: " +
          dusdc_rate.toString() +
          " => " +
          new_dusdc_rate.toString()
      );
    }

    if (!new_dusdt_rate.eq(dusdt_rate)) {
      console.log(
        "dUSDT Exchange rate: " +
          dusdc_rate.toString() +
          " => " +
          new_dusdc_rate.toString()
      );
    }

    //console.log(diff);

    return diff;
  }

  function mulFraction(x, num, denom) {
    let bn_num = new BN(num);
    let bn_denom = new BN(denom);

    return x.mul(bn_num).div(bn_denom);
  }

  describe("DToken Integration: Only internal handler", function () {
    before(async function () {
      await resetContracts();
    });

    it("Case 2: Should not reset handler with invalid proportion", async function () {
      await truffleAssert.reverts(
        dispatcher.resetHandlers([internal_handler.address], [10000]),
        "the sum of proportions must be 1000000"
      );
    });

    it("Case 3: Should not update handler proportion with invalid one", async function () {
      await truffleAssert.reverts(
        dispatcher.updateProportions([internal_handler.address], [10000]),
        "the sum of proportions must be 1000000"
      );
    });

    it("Case 4: Should be able to disable underlying token", async function () {
      // We need to mint some in order to burn
      await dUSDC.mint(account1, 1000e6, {from: account1});

      await internal_handler.disableTokens([USDC.address]);
    });

    it("Case 5: Should not be able to mint after underlying token is disabled", async function () {
      await truffleAssert.reverts(
        dUSDC.mint(account1, 1000e6, {from: account1}),
        "deposit: Token is disabled!"
      );
    });

    it("Case 6: Should be able to burn/redeem even after underlying token is disabled", async function () {
      let diff = {};

      diff = await calcDiff(
        dUSDC.burn,
        [account1, 500e6, {from: account1}],
        account1
      );

      assert.equal(diff.usdc, 500e6);
      assert.equal(diff.dusdc, -500e6);
      assert.equal(diff.int_usdc, -500e6);

      diff = await calcDiff(
        dUSDC.redeem,
        [account1, 500e6, {from: account1}],
        account1
      );

      assert.equal(diff.usdc, 500e6);
      assert.equal(diff.dusdc, -500e6);
      assert.equal(diff.int_usdc, -500e6);
    });

    it("Case 7: Should be able to enable underlying token", async function () {
      await internal_handler.enableTokens([USDC.address]);
    });

    it("Case 8: Should be able to mint/burn/redeem after enabling underlying token", async function () {
      let diff = {};

      diff = await calcDiff(
        dUSDC.mint,
        [account1, 1000e6, {from: account1}],
        account1
      );
      assert.equal(diff.usdc, -1000e6);
      assert.equal(diff.dusdc, 1000e6);
      assert.equal(diff.int_usdc, 1000e6);

      diff = await calcDiff(
        dUSDC.burn,
        [account1, 500e6, {from: account1}],
        account1
      );
      assert.equal(diff.usdc, 500e6);
      assert.equal(diff.dusdc, -500e6);
      assert.equal(diff.int_usdc, -500e6);

      diff = await calcDiff(
        dUSDC.redeem,
        [account1, 500e6, {from: account1}],
        account1
      );
      assert.equal(diff.usdc, 500e6);
      assert.equal(diff.dusdc, -500e6);
      assert.equal(diff.int_usdc, -500e6);
    });

    it("Case 9: Should be able to pause internal handler", async function () {
      await dUSDC.mint(account1, 1000e6, {from: account1});
      await internal_handler.pause();
    });

    it("Case 10: Should not be able to mint/burn/redeem after internal handler is paused", async function () {
      await truffleAssert.reverts(
        dUSDC.mint(account1, 1000e6, {from: account1}),
        "mint:"
      );
      await truffleAssert.reverts(
        dUSDC.burn(account1, 500e6, {from: account1}),
        "burn:"
      );
      await truffleAssert.reverts(
        dUSDC.redeem(account1, 500e6, {from: account1}),
        "redeem:"
      );
    });

    it("Case 11: Should be able to transfer after internal handler is paused", async function () {
      let balance2 = await dUSDC.balanceOf(account2);

      let diff = await calcDiff(
        dUSDC.transfer,
        [account2, 100e6, {from: account1}],
        account1
      );

      assert.equal(diff.dusdc, -100e6);

      let new_balance2 = await dUSDC.balanceOf(account2);
      assert.equal(new_balance2.sub(balance2).toString(), 100e6);
    });

    it("Case 12: Should be able to unpause internal handler", async function () {
      await internal_handler.unpause();
    });

    it("Case 13: Should be able to mint/burn/redeem after unpause internal handler", async function () {
      await dUSDC.mint(account1, 1000e6, {from: account1});
      await dUSDC.burn(account1, 500e6, {from: account1});
      await dUSDC.redeem(account1, 500e6, {from: account1});
    });

    it("Case 14: Should be able to pause DToken", async function () {
      await dUSDC.pause();
    });

    it("Case 15: Should not be able to mint/burn/redeem after DToken is paused", async function () {
      await truffleAssert.reverts(
        dUSDC.mint(account1, 1000e6, {from: account1}),
        "whenNotPaused: paused"
      );
      await truffleAssert.reverts(
        dUSDC.burn(account1, 500e6, {from: account1}),
        "whenNotPaused: paused"
      );
      await truffleAssert.reverts(
        dUSDC.redeem(account1, 500e6, {from: account1}),
        "whenNotPaused: paused"
      );
    });

    it("Case 16: Should not be able to transfer after DToken is paused", async function () {
      await truffleAssert.reverts(
        dUSDC.transfer(account2, 100e6, {from: account1}),
        "whenNotPaused: paused"
      );
    });

    it("Case 17: Should not be able to unpause DToken", async function () {
      await dUSDC.unpause();
    });

    it("Case 18: Should be able to mint/burn/redeem DToken", async function () {
      await dUSDC.mint(account1, 1000e6, {from: account1});
      await dUSDC.burn(account1, 500e6, {from: account1});
      await dUSDC.redeem(account1, 500e6, {from: account1});
    });

    it("Case 19: Should be able to transfer DToken", async function () {
      let balance2 = await dUSDC.balanceOf(account2);

      let diff = await calcDiff(
        dUSDC.transfer,
        [account2, 100e6, {from: account1}],
        account1
      );

      assert.equal(diff.dusdc, -100e6);

      let new_balance2 = await dUSDC.balanceOf(account2);
      assert.equal(new_balance2.sub(balance2).toString(), 100e6);
    });

    it("Case 20: Should be able to mint and check internal liquidity", async function () {
      let amount = new BN(1000e6);

      // Charge some fee for mint
      await dUSDC.updateOriginationFee(MINT_SELECTOR, FEE); // Mint

      let diff = await calcDiff(
        dUSDC.mint,
        [account1, amount, {from: account1}],
        account1
      );

      assert.equal(diff.usdc, -1000e6);
      assert.equal(diff.int_usdc, mulFraction(amount, 9999, 10000).toString());
      assert.equal(diff.dusdc_rate, 0);
    });

    it("Case 21: Should be able to burn and check internal liquidity", async function () {
      let amount = new BN(1000e6);

      // Charge some fee for Burn
      await dUSDC.updateOriginationFee(BURN_SELECTOR, FEE); // Mint

      let diff = await calcDiff(
        dUSDC.burn,
        [account1, amount, {from: account1}],
        account1
      );

      assert.equal(diff.usdc, mulFraction(amount, 9999, 10000).toString());
      assert.equal(diff.int_usdc, -1000e6);
      assert.equal(diff.dusdc_rate, 0);
    });

    it("Case 22: Should be able to redeem and check internal liquidity", async function () {
      let amount = new BN(10e6);

      let diff = await calcDiff(
        dUSDC.burn,
        [account1, amount, {from: account1}],
        account1
      );

      assert.equal(diff.usdc, mulFraction(amount, 9999, 10000).toString());
      assert.equal(diff.int_usdc, -10e6);
      assert.equal(diff.dusdc_rate, 0);
    });

    it("Case 23: Should not be able to set fee >= 100%", async function () {
      // Try to set fee to 100%, 1/10000 by default
      await truffleAssert.reverts(
        dUSDC.updateOriginationFee(BURN_SELECTOR, FEE.mul(new BN(10000))),
        "updateOriginationFee: incorrect fee."
      );
    });
  });

  describe("DToken Integration: internal and compound handler ", async function () {
    before(async function () {
      await resetContracts();
    });

    // 24. Add compound handler
    it("Case 24: Should add compound handler", async function () {
      await dispatcher.addHandlers([compound_handler.address]);
    });

    // 25. mint some dusdc
    it("Case 25: Should mint/burn/redeem some DToken", async function () {
      let amount = new BN(1000e6);
      let diff;

      diff = await calcDiff(
        dUSDC.mint,
        [account1, amount, {from: account1}],
        account1
      );
      assert.equal(diff.usdc, "-" + amount.toString());
      assert.equal(diff.dusdc, amount.toString());
      assert.equal(diff.int_usdc, amount.toString());
      assert.equal(diff.com_usdc, "0");

      // burn some
      diff = await calcDiff(
        dUSDC.burn,
        [account1, amount, {from: account1}],
        account1
      );
      assert.equal(diff.usdc, amount.toString());
      assert.equal(diff.dusdc, "-" + amount.toString());
      assert.equal(diff.int_usdc, "-" + amount.toString());
      assert.equal(diff.com_usdc, "0");

      // redeem some
      await dUSDC.mint(account1, amount, {from: account1});
      diff = await calcDiff(
        dUSDC.redeem,
        [account1, amount, {from: account1}],
        account1
      );
      assert.equal(diff.usdc, amount.toString());
      assert.equal(diff.dusdc, "-" + amount.toString());
      assert.equal(diff.int_usdc, "-" + amount.toString());
      assert.equal(diff.com_usdc, "0");
    });

    // 26. update an invalid proportion
    it("Case 26: Should not update proportion to 10/10", async function () {
      await truffleAssert.reverts(
        dispatcher.resetHandlers(
          [internal_handler.address, compound_handler.address],
          [100000, 100000]
        ),
        "the sum of proportions must be 1000000"
      );
    });

    // 27. update a valid proportion
    it("Case 27: Should update the proportion to 90/10", async function () {
      await dispatcher.updateProportions(
        [internal_handler.address, compound_handler.address],
        [900000, 100000]
      );
    });

    it("Case 28: should mint some DToken with fee", async function () {
      let amount = new BN(1000e6);
      let diff;

      // 28. Charge some fee here 1/10000
      await dUSDC.updateOriginationFee(Buffer.from("9dc29fac", "hex"), FEE); // Burn
      await dUSDC.updateOriginationFee(Buffer.from("40c10f19", "hex"), FEE); // Mint

      diff = await calcDiff(
        dUSDC.mint,
        [account1, amount, {from: account1}],
        account1
      );

      let real_amount = mulFraction(amount, 9999, 10000);
      assert.equal(diff.usdc, "-" + amount.toString());
      assert.equal(diff.dusdc, real_amount.toString());
      assert.equal(diff.int_usdc, mulFraction(real_amount, 9, 10).toString());
      assert.equal(diff.com_usdc, mulFraction(real_amount, 1, 10).toString());
    });

    // 29. Burn some dUSDC, should all withdraw from internal
    it("Case 29: Should only withdraw from internal handler", async function () {
      await resetContracts();
      let diff;
      let amount = new BN(1000e6);

      await dispatcher.resetHandlers(
        [internal_handler.address, compound_handler.address],
        [500000, 500000]
      );
      await dUSDC.mint(account1, 2000e6, {from: account1});
      await dUSDC.updateOriginationFee(Buffer.from("9dc29fac", "hex"), FEE); // Burn

      // Burn some dUSDC
      // Now internal and compound each should have 1000
      // and internal handler should have enough liquidity
      diff = await calcDiff(
        dUSDC.burn,
        [account1, amount, {from: account1}],
        account1
      );
      let real_amount = mulFraction(amount, 9999, 10000);
      assert.equal(diff.usdc, real_amount.toString());
      assert.equal(diff.dusdc, "-" + amount.toString());
      assert.equal(diff.int_usdc, "-" + amount.toString());
      assert.equal(diff.com_usdc, "0");
    });

    it("Case 30: Should withdraw from both internal and compound handlers", async function () {
      await resetContracts();
      let diff;
      let amount = new BN(1500e6);

      await dispatcher.resetHandlers(
        [internal_handler.address, compound_handler.address],
        [500000, 500000]
      );
      await dUSDC.mint(account1, 2000e6, {from: account1});
      await dUSDC.updateOriginationFee(Buffer.from("9dc29fac", "hex"), FEE); // Burn
      // Now internal and compound each should have 1000

      let internal_liquidity = new BN(1000e6);
      let real_amount = mulFraction(amount, 9999, 10000);

      diff = await calcDiff(
        dUSDC.burn,
        [account1, amount, {from: account1}],
        account1
      );
      assert.equal(diff.usdc, real_amount.toString());
      assert.equal(diff.dusdc, "-" + amount.toString());
      assert.equal(diff.int_usdc, "-" + internal_liquidity.toString());
      assert.equal(
        diff.com_usdc,
        "-" + amount.sub(internal_liquidity).toString()
      );
    });

    it("Case 31: Should withdraw from both internal and compound handlers", async function () {
      await resetContracts();
      let diff;
      let amount = new BN(2000e6);

      await dispatcher.resetHandlers(
        [internal_handler.address, compound_handler.address],
        [500000, 500000]
      );
      await dUSDC.mint(account1, 2000e6, {from: account1});
      await dUSDC.updateOriginationFee(Buffer.from("9dc29fac", "hex"), FEE); // Burn
      // Now internal and compound each should have 1000

      let internal_liquidity = new BN(1000e6);
      let real_amount = mulFraction(amount, 9999, 10000);

      // Redeem would fail as there is not enough balance to pay fee
      await truffleAssert.reverts(
        dUSDC.redeem(account1, amount, {from: account1}),
        ""
      );

      // Use burn to clean all
      diff = await calcDiff(
        dUSDC.burn,
        [account1, amount, {from: account1}],
        account1
      );
      assert.equal(diff.usdc, real_amount.toString());
      assert.equal(diff.dusdc, "-" + amount.toString());
      assert.equal(diff.int_usdc, "-" + internal_liquidity.toString());
      assert.equal(
        diff.com_usdc,
        "-" + amount.sub(internal_liquidity).toString()
      );

      //Exchange rate remains 1
      assert.equal(diff.dusdc_rate, 0);
    });

    it("Case 32: Should pause Compound handler", async function () {
      //Mint some dToken for later use
      await dUSDT.mint(account1, 2000e6, {from: account1});
      await dUSDC.mint(account1, 2000e6, {from: account1});

      await compound_handler.pause();
    });

    it("Case 33: Should fail on Mint/Burn/Redeem when Compound handler paused", async function () {
      await truffleAssert.reverts(
        dUSDC.mint(account1, 2000e6, {from: account1}),
        "mint:"
      );

      await truffleAssert.reverts(
        dUSDT.mint(account1, 2000e6, {from: account1}),
        "mint:"
      );

      await truffleAssert.reverts(
        dUSDC.burn(account1, 2000e6, {from: account1}),
        "burn:"
      );

      await truffleAssert.reverts(
        dUSDT.burn(account1, 2000e6, {from: account1}),
        "burn:"
      );

      await truffleAssert.reverts(
        dUSDC.redeem(account1, 2000e6, {from: account1}),
        "redeem:"
      );

      await truffleAssert.reverts(
        dUSDT.redeem(account1, 2000e6, {from: account1}),
        "redeem:"
      );
    });

    it("Case 35: Should be able to transfer when Compound handler paused", async function () {
      await dUSDT.transfer(account2, 1e6, {from: account1});
      await dUSDC.transfer(account2, 1e6, {from: account1});
    });

    it("Case 36: should unpause Compound handler", async function () {
      await compound_handler.unpause();
    });

    it("Case 37: Should succeed in Mint/Burn/Redeem", async function () {
      await dUSDC.mint(account1, 2000e6, {from: account1});
      await dUSDT.mint(account1, 2000e6, {from: account1});
      await dUSDC.burn(account1, 1000e6, {from: account1});
      await dUSDT.burn(account1, 1000e6, {from: account1});
      await dUSDC.redeem(account1, 900e6, {from: account1});
      await dUSDT.redeem(account1, 900e6, {from: account1});
    });

    it("Case 38: Should be able to pause dToken", async function () {
      await dUSDC.pause();
      await dUSDT.pause();
    });

    it("Case 39: Should fail on Mint/Burn/Redeem when DToken paused", async function () {
      await truffleAssert.reverts(
        dUSDC.mint(account1, 2000e6, {from: account1}),
        "whenNotPaused: paused"
      );

      await truffleAssert.reverts(
        dUSDT.mint(account1, 2000e6, {from: account1}),
        "whenNotPaused: paused"
      );

      await truffleAssert.reverts(
        dUSDC.burn(account1, 2000e6, {from: account1}),
        "whenNotPaused: paused"
      );

      await truffleAssert.reverts(
        dUSDT.burn(account1, 2000e6, {from: account1}),
        "whenNotPaused: paused"
      );

      await truffleAssert.reverts(
        dUSDC.redeem(account1, 2000e6, {from: account1}),
        "whenNotPaused: paused"
      );

      await truffleAssert.reverts(
        dUSDT.redeem(account1, 2000e6, {from: account1}),
        "whenNotPaused: paused"
      );
    });

    it("Case 40: Should not be able to transfer when DToken paused", async function () {
      await truffleAssert.reverts(
        dUSDT.transfer(account2, 1e6, {from: account1}),
        "whenNotPaused: paused"
      );
      await truffleAssert.reverts(
        dUSDC.transfer(account2, 1e6, {from: account1}),
        "whenNotPaused: paused"
      );
    });

    it("Case 41: Should unpause DToken", async function () {
      await dUSDC.unpause();
      await dUSDT.unpause();
    });

    it("Case 42: Should be able to mint/burn/redeem DToken", async function () {
      await dUSDC.mint(account1, 2000e6, {from: account1});
      await dUSDT.mint(account1, 2000e6, {from: account1});
      await dUSDC.burn(account1, 1000e6, {from: account1});
      await dUSDT.burn(account1, 1000e6, {from: account1});
      await dUSDC.redeem(account1, 100e6, {from: account1});
      await dUSDT.redeem(account1, 100e6, {from: account1});
    });

    it("Case 43: Disable USDC in compound", async function () {
      await compound_handler.disableTokens([USDC.address]);
    });

    it("Case 44: Should not be able to mint dUSDC", async function () {
      await truffleAssert.reverts(
        dUSDC.mint(account1, 1000e6, {from: account1}),
        "deposit: Token is disabled!"
      );
    });

    it("Case 45: Should be able to burn/redeem dUSDC", async function () {
      dUSDC.burn(account1, 10e6, {from: account1});
      dUSDC.redeem(account1, 10e6, {from: account1});
    });

    it("Case 46: Should be able mint dUSDT", async function () {
      dUSDT.mint(account1, 1000e6, {from: account1});
    });

    it("Case 47: Should be able to burn/redeem dUSDT", async function () {
      dUSDT.burn(account1, 10e6, {from: account1});
      dUSDT.redeem(account1, 10e6, {from: account1});
    });

    it("Case 48: Enable USDC in compound", async function () {
      await compound_handler.enableTokens([USDC.address]);
    });

    it("Case 49: Should be able to mint/burn/redeem dUSDC", async function () {
      await dUSDC.mint(account1, 2000e6, {from: account1});
      await dUSDC.burn(account1, 1000e6, {from: account1});
      await dUSDC.redeem(account1, 100e6, {from: account1});
    });

    it("Case 50: Should be able to rebalance 100 from compound to internal", async function () {
      let diff = await calcDiff(
        dUSDC.rebalance,
        [[compound_handler.address], [100e6], [], []],
        account1
      );

      assert.equal(diff.com_usdc, "-100000000");
      assert.equal(diff.int_usdc, "100000000");
    });

    it("Case 51: Should not be able to rebalance more than from compound's current liquidity", async function () {
      let liquidity = await compound_handler.getLiquidity(USDC.address);
      await truffleAssert.reverts(
        dUSDC.rebalance(
          [compound_handler.address],
          [liquidity.add(new BN(1e6))],
          [],
          []
        ),
        ""
      );
    });

    it("Case 52: Should be able to rebalance all from compound's current liquidity", async function () {
      let liquidity = await compound_handler.getLiquidity(USDC.address);

      //console.log(liquidity.toString());

      let diff = await calcDiff(
        dUSDC.rebalance,
        [[compound_handler.address], [UINT256_MAX], [], []],
        account1
      );

      assert.equal(diff.com_usdc, "-" + liquidity.toString());
      assert.equal(diff.int_usdc, liquidity.toString());
    });

    it("Case 53: Should be able to rebalance from internal to compound", async function () {
      let amount = new BN(100e6);
      let diff = await calcDiff(
        dUSDC.rebalance,
        [[], [], [compound_handler.address], [amount]],
        account1
      );

      assert.equal(diff.com_usdc, amount.toString());
      assert.equal(diff.int_usdc, "-" + amount.toString());
    });

    it("Case 54: Should not be able to rebalance more than its liquidity from internal to compound", async function () {
      let amount = (await internal_handler.getLiquidity(USDC.address)).add(
        new BN(1)
      );

      await truffleAssert.reverts(
        dUSDC.rebalance([], [], [compound_handler.address], [amount]),
        ""
      );
    });

    it("Case 55: Should be able to rebalance from internal to compound", async function () {
      await dUSDC.mint(account1, 2000e6, {from: account1});
      let amount = await internal_handler.getLiquidity(USDC.address);
      let diff = await calcDiff(
        dUSDC.rebalance,
        [[], [], [compound_handler.address], [amount]],
        account1
      );

      assert.equal(diff.com_usdc, amount.toString());
      assert.equal(diff.int_usdc, "-" + amount.toString());
    });
  });

  describe("DToken Integration: internal, compound and avee handler ", async function () {
    before(async function () {
      await resetContracts();
    });

    it("Case 56: Add aave handler", async function () {
      await dispatcher.resetHandlers(
        [
          internal_handler.address,
          compound_handler.address,
          aave_handler.address,
        ],
        [900000, 100000, 0]
      );
    });

    it("Case 57: Normal executions with two handlers", async function () {
      let mint_amount = new BN(10 ** 9);
      let burn_amount = new BN(4 * 10 ** 6);

      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      let redeem_amount = (await dUSDC.balanceOf(account1)).toString();
      await calcDiff(
        dUSDC.redeem,
        [account1, redeem_amount, {from: account1}],
        account1
      );
      let remained_dToken_balance = (
        await dUSDC.balanceOf(account1)
      ).toString();
      await dUSDC.burn(account1, remained_dToken_balance, {from: account1});
      //console.log((await dUSDC.getExchangeRate()).toString());
      let newExchangeRate = await dUSDC.getExchangeRate();
      // TODO:
      // assert.isAbove(Number((newExchangeRate.sub(BASE)).toString()), 0,'exchange rate should be greater than 1');
    });

    it("Case 58: failed to update proportions", async function () {
      await truffleAssert.reverts(
        dispatcher.updateProportions(
          [
            internal_handler.address,
            compound_handler.address,
            aave_handler.address,
          ],
          [1000000, 1000000, 1000000]
        ),
        "the sum of proportions must be 1000000"
      );
    });

    it("Case 59: succeed to update proportions", async function () {
      let original_proportions = [700000, 200000, 100000];
      await dispatcher.updateProportions(
        [
          internal_handler.address,
          compound_handler.address,
          aave_handler.address,
        ],
        original_proportions
      );
      let actual_proportions = (await dispatcher.getHandlers())[1];
      assert.equal(
        Number(actual_proportions[0]).toString(),
        original_proportions[0],
        "propotion should be the same"
      );
      assert.equal(
        Number(actual_proportions[1]).toString(),
        original_proportions[1],
        "propotion should be the same"
      );
      assert.equal(
        Number(actual_proportions[2]).toString(),
        original_proportions[2],
        "propotion should be the same"
      );
    });

    it("Case 60: Normal executions with three handlers", async function () {
      let mint_amount = new BN(10 ** 9);
      let burn_amount = new BN(4 * 10 ** 6);

      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      let redeem_amount = (await dUSDC.balanceOf(account1)).toString();

      await calcDiff(
        dUSDC.redeem,
        [account1, redeem_amount, {from: account1}],
        account1
      );

      let newExchangeRate = await dUSDC.getExchangeRate();
      // TODO:
      // assert.isAbove(Number((newExchangeRate.sub(BASE)).toString()), 0,'exchange rate should be greater than 1');
    });

    it("Case 61: Execution with three handlers and fee of mint", async function () {
      let mint_amount = new BN(10 ** 9);
      await dUSDC.updateOriginationFee(MINT_SELECTOR, FEE); // Mint

      let mint_result = await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      // console.log("mint result is: ", mint_result);

      assert.equal(
        mint_result.dusdc,
        999900000,
        "When exchange rate is 1, and mint fee is 0.1%, dusdc should be equal to 999.9"
      );
      assert.equal(
        mint_result.int_usdc,
        699930000,
        "Based on current propotions, internal handler should has 699.93 usdc"
      );
      assert.equal(
        mint_result.com_usdc,
        199980000,
        "Based on current propotions, compound handler should has 199.98 usdc"
      );
      assert.equal(
        mint_result.aav_usdc,
        99990000,
        "Based on current propotions, aave handler should has 99.99 usdc",
        "\n"
      );
      // console.log("current exchange rate is: ", (await dUSDC.getExchangeRate()).toString());
    });

    it("Case 62: Burn dUSDC form internal handler", async function () {
      let burn_amount = new BN(5 * 10 ** 8);

      await dUSDC.updateOriginationFee(BURN_SELECTOR, FEE); // Burn

      let burn_result = await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      // console.log("burn result is: ", burn_result);

      assert.equal(
        burn_result.usdc,
        499950000,
        "When exchange rate is 1, and burn fee is 0.1%, usdc should be equal to 499.95"
      );
      assert.equal(
        burn_result.int_usdc,
        -500000000,
        "When exchange rate is 1, and burn fee is 0.1%, usdc should be equal to 499.95"
      );
      assert.equal(
        burn_result.com_usdc,
        0,
        "The USDC balance of the compound handler should not be changed"
      );
      assert.equal(
        burn_result.aav_usdc,
        0,
        "The USDC balance of the aave handler should not be changed"
      );
    });

    it("Case 63: Burn dUSDC form internal handler and compound handler", async function () {
      let mint_amount = new BN(15 * 10 ** 8);
      let burn_amount = new BN(15 * 10 ** 8);
      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      let burn_result = await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      let liquidity_result = await getAllLiquidities();

      // console.log('burn_result', burn_result)
      assert.equal(
        burn_result.usdc,
        1499850000,
        "When exchange rate is 1, and burn fee is 0.1%, usdc should be equal to 1499.85"
      );
      assert.equal(
        liquidity_result.int_usdc.toString(),
        0,
        "Internal handler liquidity should be 0"
      );
      assert.isAbove(
        Number(liquidity_result.com_usdc.toString()),
        0,
        "Compound handler should not be 0"
      );
      assert.equal(burn_result.aav_usdc, 0, "Aave handler should not change");
    });

    it("Case 64: Burn dUSDC form internal handler, compound handler and aave handler", async function () {
      let mint_amount = new BN(24 * 10 ** 8);
      let burn_amount = new BN(25 * 10 ** 8);

      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      let burn_result = await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );

      let liquidity_result = await getAllLiquidities();
      assert.equal(
        burn_result.usdc,
        2499750000,
        "When exchange rate is 1, and burn fee is 0.1%, usdc should be equal to 249.975"
      );
      assert.equal(
        liquidity_result.int_usdc.toString(),
        0,
        "Internal handler liquidity should be 0"
      );
      assert.equal(
        liquidity_result.com_usdc.toString(),
        0,
        "Compound handler should be 0"
      );
      assert.isAbove(
        Number(liquidity_result.aav_usdc.toString()),
        0,
        "Aave handler should not be 0"
      );
    });

    // it("Case 65: Burn dUSDC form internal handler, compound handler and aave handler", async function () {
    //   let mint_amount = new BN(40 * 10 ** 8);
    //   let burn_amount = new BN(40 * 10 ** 8);

    //   await calcDiff(dUSDC.mint, [account1, mint_amount.toString(), { from: account1 }], account1);
    //   let burn_result = await calcDiff(dUSDC.burn, [account1, burn_amount.toString(), { from: account1 }], account1);

    //   let liquidity_result = await getAllLiquidities();
    //   // assert.equal(burn_result.usdc, 2499750000, "When exchange rate is 1, and burn fee is 0.1%, usdc should be equal to 249.975");
    //   // assert.equal(liquidity_result.int_usdc.toString(), 0, "Internal handler liquidity should be 0");
    //   // assert.equal(liquidity_result.com_usdc.toString(), 0, "Compound handler should be 0");
    //   // assert.isAbove(Number(liquidity_result.aav_usdc.toString()), 0, "Aave handler should not be 0");
    // });
    it("Case 66: Burn dUSDC form internal handler, compound handler and aave handler", async function () {
      let burn_all_amount = await aave_handler.getLiquidity(USDC.address);
      await calcDiff(
        dUSDC.burn,
        [account1, burn_all_amount.toString(), {from: account1}],
        account1
      );
      let mint_amount = new BN(26 * 10 ** 8);
      let redeem_amount = new BN(25 * 10 ** 8);

      // console.log('current internal handler usdc', (await internal_handler.getLiquidity(USDC.address)).toString())
      // console.log('current comp handler usdc', (await compound_handler.getLiquidity(USDC.address)).toString())
      // console.log('current aave handler usdc', (await aave_handler.getLiquidity(USDC.address)).toString())
      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      let redeem_result = await calcDiff(
        dUSDC.redeem,
        [account1, redeem_amount.toString(), {from: account1}],
        account1
      );
      let liquidity_result = await getAllLiquidities();

      assert.equal(
        redeem_result.dusdc,
        -2500250026,
        "When redeem 2500 usdc, expect to cost 2500250026 dusdc"
      );
      assert.equal(
        liquidity_result.int_usdc.toString(),
        0,
        "Internal handler liquidity should be 0"
      );
      assert.equal(
        liquidity_result.com_usdc.toString(),
        0,
        "Compound handler should be 0"
      );
      assert.isAbove(
        Number(liquidity_result.aav_usdc.toString()),
        0,
        "Aave handler should not be 0"
      );
    });

    it("Case 67: Should only pause Aave handler", async function () {
      // To ensure have cash in the case 68
      await dUSDC.mint(account1, "1000", {from: account1});
      await aave_handler.pause();
      assert.equal(
        await aave_handler.paused(),
        true,
        "Aave handler should be paused"
      );
      assert.equal(
        await internal_handler.paused(),
        false,
        "Internal handler should not be paused"
      );
      assert.equal(
        await compound_handler.paused(),
        false,
        "Compound handler should not be paused"
      );
    });

    it("Case 68: When pause one of the handlers, mint-burn-redeem will fail", async function () {
      one_wei = "1";

      // when paused, mint will fail
      await truffleAssert.reverts(
        dUSDC.mint(account1, one_wei, {from: account1}),
        "revert mint:"
      );
      // when paused, burn will fail
      await truffleAssert.reverts(
        dUSDC.burn(account1, one_wei, {from: account1}),
        "revert burn:"
      );
      // when paused, redeem will fail
      await truffleAssert.reverts(
        dUSDC.redeem(account1, one_wei, {from: account1}),
        "revert redeem"
      );
    });

    it("Case 69: Transfer 5 dusdc", async function () {
      let transfer_amount = new BN(5 * 10 ** 6);
      let original_dtoken_balance = (
        await dUSDC.balanceOf(account1)
      ).toString();
      await dUSDC.transfer(account2, transfer_amount.toString(), {
        from: account1,
      });
      let current_dtoken_balance = (await dUSDC.balanceOf(account1)).toString();
      assert.equal(
        original_dtoken_balance - current_dtoken_balance,
        transfer_amount.toString()
      );
    });

    it("Case 70: Unpause Aave handler", async function () {
      await aave_handler.unpause();
      assert.equal(
        await aave_handler.paused(),
        false,
        "Aave handler should be paused"
      );
      assert.equal(
        await internal_handler.paused(),
        false,
        "Internal handler should not be paused"
      );
      assert.equal(
        await compound_handler.paused(),
        false,
        "Compound handler should not be paused"
      );
    });

    it("Case 71: Should execute normally", async function () {
      let mint_amount = new BN(2 * 10 ** 9);
      let burn_amount = new BN(10 ** 9);
      let redeem_amount = new BN(10 ** 9);

      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.redeem,
        [account1, redeem_amount.toString(), {from: account1}],
        account1
      );
    });

    it("Case 72: Should pause dToken", async function () {
      await dUSDC.pause();
      await dUSDT.pause();
      assert.equal(await dUSDC.paused(), true, "dUSDC should be paused");
      assert.equal(await dUSDT.paused(), true, "dUSDT should be paused");
    });

    it("Case 73: When pause the dTokenController, mint-burn-redeem will fail", async function () {
      let mint_amount = new BN(10 ** 9);

      // when paused, mint will fail
      await truffleAssert.reverts(
        dUSDC.mint(account1, mint_amount.toString(), {from: account1}),
        "revert whenNotPaused: paused"
      );
      // when paused, burn will fail
      await truffleAssert.reverts(
        dUSDC.burn(account1, mint_amount.toString(), {from: account1}),
        "revert whenNotPaused: paused"
      );
      // when paused, redeem will fail
      await truffleAssert.reverts(
        dUSDC.redeem(account1, mint_amount.toString(), {from: account1}),
        "revert whenNotPaused: paused"
      );
    });

    it("Case 74: When pause the dTokenController, transfer dToken will fail", async function () {
      await truffleAssert.reverts(
        dUSDC.transfer(account2, "100", {from: account1}),
        "revert whenNotPaused: paused"
      );
      await truffleAssert.reverts(
        dUSDT.transfer(account2, "100", {from: account1}),
        "revert whenNotPaused: paused"
      );
    });

    it("Case 75: Unpause dToken", async function () {
      await dUSDC.unpause();
      await dUSDT.unpause();
      assert.equal(await dUSDC.paused(), false, "dUSDC should not be paused");
      assert.equal(await dUSDT.paused(), false, "dUSDT should not be paused");
    });

    it("Case 76: Should execute normally", async function () {
      let mint_amount = new BN(2 * 10 ** 9);
      let burn_amount = new BN(10 ** 9);
      let redeem_amount = new BN(10 ** 9);

      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.redeem,
        [account1, redeem_amount.toString(), {from: account1}],
        account1
      );
    });

    it("Case 77: Should disable token in the Aave handler", async function () {
      await aave_handler.disableTokens([USDC.address, USDT.address]);
      assert.equal(
        await aave_handler.tokenIsEnabled(USDC.address),
        false,
        "USDC should be disabled in Aave handler"
      );
      assert.equal(
        await aave_handler.tokenIsEnabled(USDT.address),
        false,
        "USDT should be disabled in Aave handler"
      );
    });

    it("Case 78: When disable token, mint will fail", async function () {
      await truffleAssert.reverts(
        dUSDC.mint(account2, "100", {from: account1}),
        "revert deposit: Token is disabled!"
      );
      await truffleAssert.reverts(
        dUSDT.mint(account2, "100", {from: account1}),
        "revert deposit: Token is disabled!"
      );
    });

    it("Case 79: When disable token, can burn and redeem will fail", async function () {
      let burn_amount = new BN(10 ** 7);
      let redeem_amount = new BN(10 ** 7);

      let burn_result = await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      // console.log('burn amount', burn_result);
      assert.equal(
        Number(0 - burn_result.aav_usdc),
        Number(burn_amount.toString())
      );
      let redeem_result = await calcDiff(
        dUSDC.redeem,
        [account1, redeem_amount.toString(), {from: account1}],
        account1
      );
      // console.log('redeem amount', redeem_result);
      assert.equal(Number(0 - redeem_result.aav_usdc), 10001001);
    });

    it("Case 80: When disable token, can burn and redeem will fail", async function () {
      await aave_handler.enableTokens([USDC.address, USDT.address]);
      assert.equal(
        await aave_handler.tokenIsEnabled(USDC.address),
        true,
        "USDC should be enabled in Aave handler"
      );
      assert.equal(
        await aave_handler.tokenIsEnabled(USDT.address),
        true,
        "USDT should be enabled in Aave handler"
      );
    });

    it("Case 81: Should execute normally", async function () {
      let mint_amount = new BN(2 * 10 ** 9);
      let burn_amount = new BN(10 ** 9);
      let redeem_amount = new BN(10 ** 9);

      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.redeem,
        [account1, redeem_amount.toString(), {from: account1}],
        account1
      );
    });

    it("Case 82: Rebalance from Compound and Aave to internal", async function () {
      let mint_amount = new BN(1000 * 10 ** 6);
      await dUSDC.updateOriginationFee(MINT_SELECTOR, 0);
      await dUSDC.updateOriginationFee(BURN_SELECTOR, 0);
      await dispatcher.resetHandlers(
        [
          internal_handler.address,
          compound_handler.address,
          aave_handler.address,
        ],
        [400000, 300000, 300000]
      );
      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );

      let diff = await calcDiff(
        dUSDC.rebalance,
        [
          [compound_handler.address, aave_handler.address],
          [100e6, 100e6],
          [internal_handler.address],
          [0],
        ],
        account1
      );
      // console.log('-----diff', diff);
      assert.equal(diff.int_usdc, 200000000);
      assert.equal(diff.com_usdc, -100000000);
      assert.equal(diff.aav_usdc, -100000000);
    });

    it("Case 83: Rebalance too much Aave", async function () {
      await truffleAssert.reverts(
        calcDiff(
          dUSDC.rebalance,
          [
            [compound_handler.address, aave_handler.address],
            [100e6, 300e6],
            [internal_handler.address],
            [0],
          ],
          account1
        ),
        "revert"
      );
    });

    it("Case 84: Rebalance max value from Aave and Compound", async function () {
      let internal_compound_handler = (
        await internal_handler.getLiquidity(USDC.address)
      ).toString();
      let last_compound_handler = (
        await compound_handler.getLiquidity(USDC.address)
      ).toString();
      let last_aave_handler = (
        await aave_handler.getLiquidity(USDC.address)
      ).toString();
      let diff = await calcDiff(
        dUSDC.rebalance,
        [
          [compound_handler.address, aave_handler.address],
          [UINT256_MAX, UINT256_MAX],
          [internal_handler.address],
          [0],
        ],
        account1
      );
      let current_internal_balance = (
        await internal_handler.getLiquidity(USDC.address)
      ).toString();
      let total_wirhdraw_balance =
        Number(last_compound_handler) + Number(last_aave_handler);
      let total_increase_blance =
        Number(current_internal_balance) - Number(internal_compound_handler);
      let liquidities = await getAllLiquidities();

      assert.equal(total_wirhdraw_balance, total_increase_blance);
      assert.equal(liquidities.com_usdc, 0);
      assert.equal(liquidities.aav_usdc, 0);
    });

    it("Case 85: Rebalance from internal handler value to Aave and Compound", async function () {
      let diff = await calcDiff(
        dUSDC.rebalance,
        [
          [internal_handler.address],
          [0],
          [compound_handler.address, aave_handler.address],
          [10, 10],
        ],
        account1
      );
      // console.log("diff", diff)
      assert.equal(diff.int_usdc, -20);
      assert.equal(diff.com_usdc, 10);
      assert.equal(diff.aav_usdc, 10);
    });

    it("Case 86: Rebalance too much from internal handler", async function () {
      let liquidities = await internal_handler.getLiquidity(USDC.address);
      await truffleAssert.reverts(
        calcDiff(
          dUSDC.rebalance,
          [
            [internal_handler.address],
            [0],
            [compound_handler.address, aave_handler.address],
            [liquidities, 1e6],
          ],
          account1
        ),
        "revert"
      );
    });

    it("Case 87: Rebalance from internal handler to aave and compound", async function () {
      let diff = await calcDiff(
        dUSDC.rebalance,
        [
          [internal_handler.address],
          [0],
          [compound_handler.address, aave_handler.address],
          [100e6, 100e6],
        ],
        account1
      );
      // console.log("diff", diff)
      assert.equal(diff.int_usdc, -200000000);
      assert.equal(diff.com_usdc, 100000000);
      assert.equal(diff.aav_usdc, 100000000);
    });

    it("Case 88: Rebalance from internal handler to aave and compound", async function () {
      let diff = await calcDiff(
        dUSDC.rebalance,
        [
          [internal_handler.address, compound_handler.address],
          [100e6, 100e6],
          [aave_handler.address],
          [150e6],
        ],
        account1
      );
      // console.log("diff", diff)
      assert.equal(diff.int_usdc, -50000000);
      assert.equal(diff.com_usdc, -100000000);
      assert.equal(diff.aav_usdc, 150000000);
    });

    it("Case 89: Rebalance from internal handler to aave and compound", async function () {
      await resetContracts();
      let mint_amount = new BN(1000 * 10 ** 6);
      await dispatcher.resetHandlers(
        [
          internal_handler.address,
          compound_handler.address,
          aave_handler.address,
        ],
        [200000, 200000, 600000]
      );
      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );

      let diff = await calcDiff(
        dUSDC.rebalance,
        [
          [internal_handler.address, compound_handler.address],
          [100e6, 200e6],
          [aave_handler.address],
          [250e6],
        ],
        account1
      );
      // console.log("diff", diff)
      assert.equal(diff.int_usdc, -50000000);
      assert.equal(diff.com_usdc, -200000000);
      assert.equal(diff.aav_usdc, 250000000);
    });

    it("Case 90: Rebalance too much", async function () {
      await resetContracts();
      let mint_amount = new BN(1000 * 10 ** 6);
      await dispatcher.resetHandlers(
        [
          internal_handler.address,
          compound_handler.address,
          aave_handler.address,
        ],
        [200000, 200000, 600000]
      );
      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );

      await truffleAssert.reverts(
        calcDiff(
          dUSDC.rebalance,
          [
            [internal_handler.address, compound_handler.address],
            [100e6, 200e6],
            [aave_handler.address],
            [500e6],
          ],
          account1
        ),
        "revert"
      );
    });

    it("Case 91: Remove Aave handler", async function () {
      let new_propotions = [100000, 900000];
      await dispatcher.resetHandlers(
        [internal_handler.address, compound_handler.address],
        new_propotions
      );
      let actual_propotions = (await dispatcher.getHandlers())[1];
      // console.log('actual_propotions', actual_propotions);
      assert.equal(
        Number(actual_propotions[0]).toString(),
        new_propotions[0],
        "propotion should be the same"
      );
      assert.equal(
        Number(actual_propotions[1]).toString(),
        new_propotions[1],
        "propotion should be the same"
      );
    });

    it("Case 92: Should execute normally and change the exchange rate", async function () {
      await USDC.allocateTo(account1, 100000e6);
      let mint_amount = new BN(100 * 10 ** 9);
      let burn_amount = new BN(10 ** 9);
      let redeem_amount = new BN(10 ** 9);

      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.redeem,
        [account1, redeem_amount.toString(), {from: account1}],
        account1
      );
    });

    it("Case 93: Remove Compound handler", async function () {
      let new_propotions = [1000000];
      await dispatcher.resetHandlers(
        [internal_handler.address],
        new_propotions
      );
      let actual_propotions = (await dispatcher.getHandlers())[1];
      // console.log('actual_propotions', actual_propotions);
      assert.equal(
        Number(actual_propotions[0]).toString(),
        new_propotions[0],
        "propotion should be the same"
      );
    });

    it("Case 94: Should execute normally and change the exchange rate", async function () {
      let mint_amount = new BN(3 * 10 ** 9);
      let burn_amount = new BN(10 ** 9);
      let redeem_amount = new BN(10 ** 9);

      await calcDiff(
        dUSDC.mint,
        [account1, mint_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.burn,
        [account1, burn_amount.toString(), {from: account1}],
        account1
      );
      await calcDiff(
        dUSDC.redeem,
        [account1, redeem_amount.toString(), {from: account1}],
        account1
      );
    });
  });

  describe("DToken Integration: Fee related cases ", async function () {
    before(async function () {
      await resetContracts();
      await dUSDC.updateOriginationFee(BURN_SELECTOR, FEE);
      await dUSDC.updateOriginationFee(MINT_SELECTOR, FEE);
    });

    it("Case 108: Should be able to set fee recipient", async function () {
      await dUSDC.setFeeRecipient(account2);
      let amount = new BN(10000e6);
      let fee = new BN(1e6);

      let diff = await calcDiff(
        dUSDC.mint,
        [account1, amount, {from: account1}],
        account2
      );
      assert.equal(diff.usdc, fee.toString());
    });

    it("Case 109: Should be able to transfer Fee out", async function () {
      await dUSDC.mint(account1, 10000e6, {from: account1});
      let fee = await USDC.balanceOf(dUSDC.address);

      let diff = await calcDiff(
        dUSDC.transferFee,
        [USDC.address, fee],
        account2
      );
      assert.equal(diff.usdc, fee.toString());
    });
  });

  describe("DToken Integration: Rebalance related cases ", async function () {
    before(async function () {
      await resetContracts();
      await dispatcher.resetHandlers(
        [internal_handler.address, compound_handler.address],
        [100000, 900000]
      );
      await dUSDC.mint(account1, 100000e6, {from: account1});
      other_handler = await InternalHandler.new(dtoken_controller.address);
      other_contract = await await TetherToken.new("0", "TOKEN", "TOKEN", 18);
      await USDC.allocateTo(other_handler.address, 100000e6);
      await USDC.allocateTo(other_contract.address, 100000e6);
    });

    it("Case Rebalance 105: rebalance withdraw other ", async function () {
      let other_handler_balance = await other_handler.getLiquidity(
        USDC.address
      );
      await truffleAssert.reverts(
        dUSDC.rebalance(
          [other_handler.address],
          [other_handler_balance],
          [],
          []
        ),
        "ds-auth-unauthorized"
      );
    });

    it("Case Rebalance 106: rebalance withdraw compound other ", async function () {
      await other_handler.setAuthority(ds_guard.address);
      await ds_guard.permitx(dUSDC.address, other_handler.address);
      let other_handler_balance = await other_handler.getLiquidity(
        USDC.address
      );
      await truffleAssert.reverts(
        dUSDC.rebalance(
          [compound_handler.address, other_handler.address],
          [new BN(100000), other_handler_balance],
          [],
          []
        )
      );
    });

    it("Case Rebalance 107: rebalance supply other ", async function () {
      let internal_balance = await internal_handler.getLiquidity(USDC.address);
      await truffleAssert.reverts(
        dUSDC.rebalance(
          [],
          [],
          [other_handler.address],
          [internal_balance.div(new BN(2))]
        ),
        "rebalance: both handler and token must be enabled"
      );
    });

    it("Case Rebalance 108: rebalance supply compound aave ", async function () {
      let internal_balance = await internal_handler.getLiquidity(USDC.address);
      await truffleAssert.reverts(
        dUSDC.rebalance(
          [],
          [],
          [compound_handler.address, aave_handler.address],
          [internal_balance.div(new BN(4)), internal_balance.div(new BN(4))]
        ),
        "rebalance: both handler and token must be enabled"
      );
    });

    it("Case Rebalance 109: add handler ", async function () {
      await dispatcher.addHandlers([other_contract.address]);
      let handlers = await dUSDC.getHandlers();
      assert.equal(other_contract.address, handlers[handlers.length - 1]);
    });

    it("Case Rebalance 110: update proportions ", async function () {
      await dispatcher.updateProportions(
        [
          internal_handler.address,
          compound_handler.address,
          other_contract.address,
        ],
        [100000, 700000, 200000]
      );
    });

    it("Case Rebalance 111: user mint burn redeem ", async function () {
      await USDC.allocateTo(account1, 100000e6);
      await truffleAssert.reverts(
        dUSDC.mint(account1, 100e6, {from: account1}),
        "function selector was not recognized and there's no fallback function"
      );

      await truffleAssert.reverts(
        dUSDC.burn(account1, 1e6, {from: account1}),
        "function selector was not recognized and there's no fallback function"
      );

      await truffleAssert.reverts(
        dUSDC.redeem(account1, 1e6, {from: account1}),
        "function selector was not recognized and there's no fallback function"
      );
    });

    it("Case Rebalance 112: rebalance withdraw other contract ", async function () {
      await truffleAssert.reverts(
        dUSDC.rebalance([other_contract.address], [100], [], []),
        "function selector was not recognized and there's no fallback function"
      );
    });

    it("Case Rebalance 113: rebalance withdraw compound ", async function () {
      let compound_balance = await compound_handler.getLiquidity(USDC.address);
      await dUSDC.rebalance([compound_handler.address], [100], [], []);
      assert.equal(
        compound_balance
          .sub(await compound_handler.getLiquidity(USDC.address))
          .abs()
          .toString(),
        100
      );
    });

    it("Case Rebalance 114: rebalance withdraw compound other contract ", async function () {
      await truffleAssert.reverts(
        dUSDC.rebalance(
          [compound_handler.address, other_contract.address],
          [100, 100],
          [],
          []
        ),
        "function selector was not recognized and there's no fallback function"
      );
    });

    it("Case Rebalance 115: rebalance supply other contract ", async function () {
      await truffleAssert.reverts(
        dUSDC.rebalance([], [], [other_contract.address], [100]),
        "function selector was not recognized and there's no fallback function"
      );
    });

    it("Case Rebalance 116: rebalance supply compound ", async function () {
      let compound_balance = await compound_handler.getLiquidity(USDC.address);
      await dUSDC.rebalance([], [], [compound_handler.address], [100]);
      assert.equal(
        compound_balance
          .sub(await compound_handler.getLiquidity(USDC.address))
          .abs()
          .toString(),
        100
      );
    });

    it("Case Rebalance 117: rebalance supply compound other contract ", async function () {
      await truffleAssert.reverts(
        dUSDC.rebalance(
          [],
          [],
          [compound_handler.address, other_contract.address],
          [100, 100]
        ),
        "function selector was not recognized and there's no fallback function"
      );
    });

    it("Case Rebalance 118: resetHandler compound other contract ", async function () {
      await dispatcher.resetHandlers(
        [compound_handler.address, other_contract.address],
        [100000, 900000]
      );

      await truffleAssert.reverts(
        dUSDC.getExchangeRate(),
        "function selector was not recognized and there's no fallback function"
      );
    });

    it("Case Rebalance 119: user mint burn redeem with compound and other contracts ", async function () {
      await truffleAssert.reverts(
        dUSDC.mint(account1, 100e6, {from: account1}),
        "function selector was not recognized and there's no fallback function"
      );

      await truffleAssert.reverts(
        dUSDC.burn(account1, 1e6, {from: account1}),
        "function selector was not recognized and there's no fallback function"
      );

      await truffleAssert.reverts(
        dUSDC.redeem(account1, 1e6, {from: account1}),
        "function selector was not recognized and there's no fallback function"
      );
    });

    it("Case Rebalance 120: rebalance withdraw compound with other contracts ", async function () {
      let compound_balance = await compound_handler.getLiquidity(USDC.address);
      await dUSDC.rebalance([compound_handler.address], [100], [], []);
      assert.equal(
        compound_balance
          .sub(await compound_handler.getLiquidity(USDC.address))
          .abs()
          .toString(),
        0
      );
    });

    it("Case Rebalance 121: rebalance supply compound with other contracts ", async function () {
      let compound_balance = await compound_handler.getLiquidity(USDC.address);
      await dUSDC.rebalance([], [], [compound_handler.address], [100]);
      assert.equal(
        compound_balance
          .sub(await compound_handler.getLiquidity(USDC.address))
          .abs()
          .toString(),
        0
      );
    });

    it("Case Rebalance 122: resetHandler other contract ", async function () {
      await dispatcher.resetHandlers([other_contract.address], [1000000]);

      await truffleAssert.reverts(
        dUSDC.getExchangeRate(),
        "function selector was not recognized and there's no fallback function"
      );
    });

    it("Case Rebalance 123: user mint burn redeem with other contracts ", async function () {
      await truffleAssert.reverts(
        dUSDC.mint(account1, 100e6, {from: account1}),
        "function selector was not recognized and there's no fallback function"
      );

      await truffleAssert.reverts(
        dUSDC.burn(account1, 1e6, {from: account1}),
        "function selector was not recognized and there's no fallback function"
      );

      await truffleAssert.reverts(
        dUSDC.redeem(account1, 1e6, {from: account1}),
        "function selector was not recognized and there's no fallback function"
      );
    });

    it("Case Rebalance 124: rebalance withdraw other contract ", async function () {
      let other_contract_balance = await USDC.balanceOf(other_contract.address);
      await dUSDC.rebalance([other_contract.address], [10000], [], []);
      assert.equal(
        other_contract_balance
          .sub(await USDC.balanceOf(other_contract.address))
          .abs()
          .toString(),
        0
      );
    });

    it("Case Rebalance 125: rebalance supply other contract ", async function () {
      await truffleAssert.reverts(
        dUSDC.rebalance([], [], [other_contract.address], [100]),
        "function selector was not recognized and there's no fallback function"
      );
    });
  });
});
