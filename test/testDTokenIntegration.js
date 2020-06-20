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
const INTEREST_RATE = new BN(10).pow(new BN(16));

const MINT_SELECTOR = "0x40c10f19";
const BURN_SELECTOR = "0x9dc29fac";

describe("DToken Contract Integration", function () {
  let owner, account1, account2, account3, account4;
  let USDC, USDT;
  let ds_guard;
  let dispatcher;
  let dtoken_addresses;
  let internal_handler, compound_handler, aave_handler;
  let dUSDC, dUSDT;
  let cUSDT, cUSDC;
  let aUSDC, aUSDT;
  let lending_pool_core;
  let lending_pool;

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

    dtoken_addresses = await dTokenAddresses.new();
    ds_guard = await DSGuard.new();

    internal_handler = await InternalHandler.new(dtoken_addresses.address);

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
        dispatcher.resetHandler([internal_handler.address], [10000]),
        "the sum of propotions must be 1000000"
      );
    });

    it("Case 3: Should not update handler proportion with invalid one", async function () {
      await truffleAssert.reverts(
        dispatcher.updatePropotion([internal_handler.address], [10000]),
        "the sum of propotions must be 1000000"
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
      await dUSDC.burn(account1, 500e6, {from: account1});
      await dUSDC.redeem(account1, 500e6, {from: account1});
    });

    it("Case 7: Should be able to enable underlying token", async function () {
      await internal_handler.enableTokens([USDC.address]);
    });

    it("Case 8: Should be able to mint/burn/redeem after enabling underlying token", async function () {
      await dUSDC.mint(account1, 1000e6, {from: account1});
      await dUSDC.burn(account1, 500e6, {from: account1});
      await dUSDC.redeem(account1, 500e6, {from: account1});
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
      await dUSDC.transfer(account2, 100e6, {from: account1});
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
      await dUSDC.transfer(account2, 100e6, {from: account1});
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
    });

    it("Case 23: Should not be able to set fee > 10%", async function () {
      // Try to set fee to 10%, 1/10000 by default
      await truffleAssert.reverts(
        dUSDC.updateOriginationFee(BURN_SELECTOR, FEE.mul(new BN(1000))),
        "updateOriginationFee: fee should be less than ten percent."
      );

      // 20%
      await truffleAssert.reverts(
        dUSDC.updateOriginationFee(MINT_SELECTOR, FEE.mul(new BN(2000))),
        "updateOriginationFee: fee should be less than ten percent."
      );
    });
  });

  describe("DToken Integration: internal and compound handler ", async function () {
    before(async function () {
      await resetContracts();
    });

    // 24. Add compound handler
    it("Case 24: Should add compound handler", async function () {
      await dispatcher.addHandler([compound_handler.address]);
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
        dispatcher.resetHandler(
          [internal_handler.address, compound_handler.address],
          [100000, 100000]
        ),
        "the sum of propotions must be 1000000"
      );
    });

    // 27. update a valid proportion
    it("Case 27: Should update the proportion to 90/10", async function () {
      await dispatcher.updatePropotion(
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

      await dispatcher.resetHandler(
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

      await dispatcher.resetHandler(
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

      await dispatcher.resetHandler(
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
      let balance = await USDC.balanceOf(compound_handler.address);

      let diff = await calcDiff(
        dUSDC.rebalance,
        [[compound_handler.address], [UINT256_MAX], [], []],
        account1
      );

      console.log(liquidity.toString(), balance.toString());
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
      let amount = (await compound_handler.getLiquidity(USDC.address)).add(
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
      await dispatcher.resetHandler([internal_handler.address, compound_handler.address, aave_handler.address], [900000, 100000, 0]);
    });

    it("Case 57: Normal executions with two handlers", async function () {
      let mint_amount = new BN(10**9)
      let burn_amount = new BN(4 * 10 ** 6)

      await calcDiff(dUSDC.mint, [account1, mint_amount.toString(), { from: account1 }], account1);
      await calcDiff(dUSDC.burn, [account1, burn_amount.toString(), { from: account1 }], account1);
      let redeem_amount = (await dUSDC.balanceOf(account1)).toString();
      await calcDiff(dUSDC.redeem, [account1, redeem_amount, { from: account1 }], account1);
      let remained_dToken_balance = (await dUSDC.balanceOf(account1)).toString();
      await dUSDC.burn(account1, remained_dToken_balance, {from: account1});
      console.log((await dUSDC.getExchangeRate()).toString())
      let newExchangeRate = await dUSDC.getExchangeRate();
      // TODO:
      // assert.isAbove(Number((newExchangeRate.sub(BASE)).toString()), 0,'exchange rate should be greater than 1');
    });

    it("Case 58: failed to update propotions", async function () {
      await truffleAssert.reverts(
        dispatcher.updatePropotion([internal_handler.address, compound_handler.address, aave_handler.address], [1000000, 1000000, 1000000]),
        "the sum of propotions must be 1000000"
      );
    });

    it("Case 59: succeed to update propotions", async function () {
      let original_propotions = [700000, 200000, 100000];
      await dispatcher.updatePropotion(
        [internal_handler.address, compound_handler.address, aave_handler.address],
        original_propotions
      );
      let actual_propotions = (await dispatcher.getHandler())[1];
      assert.equal(Number(actual_propotions[0]).toString(), original_propotions[0], "propotion should be the same");
      assert.equal(Number(actual_propotions[1]).toString(), original_propotions[1], "propotion should be the same");
      assert.equal(Number(actual_propotions[2]).toString(), original_propotions[2], "propotion should be the same");
    });

    it("Case 60: Normal executions with three handlers", async function () {
      let mint_amount = new BN(10 ** 9);
      let burn_amount = new BN(4 * 10 ** 6);

      await calcDiff(dUSDC.mint, [account1, mint_amount.toString(), { from: account1 }], account1);
      await calcDiff(dUSDC.burn, [account1, burn_amount.toString(), { from: account1 }], account1);
      let redeem_amount = (await dUSDC.balanceOf(account1)).toString();

      await calcDiff(dUSDC.redeem, [account1, redeem_amount, { from: account1 }], account1);

      let newExchangeRate = await dUSDC.getExchangeRate();
      // TODO:
      // assert.isAbove(Number((newExchangeRate.sub(BASE)).toString()), 0,'exchange rate should be greater than 1');
    });

    it("Case 61: Execution with three handlers and fee of mint", async function () {
      let mint_amount = new BN(10 ** 9);
      await dUSDC.updateOriginationFee("0x40c10f19", FEE); // Mint

      let mint_result = await calcDiff(dUSDC.mint, [account1, mint_amount.toString(), { from: account1 }], account1);
      console.log("mint result----", mint_result)

      assert.equal(mint_result.dusdc, 999900000, "When exchange rate is 1, and fee is 0.1%, dusdc should be equal to 999.9");
      assert.equal(mint_result.int_usdc, 699930000, "Based on current propotions, internal handler should has 699.93 usdc");
      assert.equal(mint_result.com_usdc, 199980000, "Based on current propotions, compound handler should has 199.98 usdc");
      assert.equal(mint_result.aav_usdc, 99990000, "Based on current propotions, aave handler should has 99.99 usdc");
    });
  });
});
