const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const CToken = artifacts.require("CTokenMockup");
const CompoundHandler = artifacts.require("CompoundHandler");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const dTokenAddresses = artifacts.require("dTokenAddresses");
const DToken = artifacts.require("DToken");
const DSGuard = artifacts.require("DSGuard");
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const BN = require("bn.js");

const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));
const BASE = new BN(10).pow(new BN(18));
const FEE = new BN(10).pow(new BN(14));

describe("DToken Contract Integration", function () {
  let owner, account1, account2, account3, account4;
  let USDC, USDT;
  let ds_guard;
  let dispatcher;
  let dtoken_addresses;
  let internal_handler, compound_handler, aave_handler;
  let dUSDC, dUSDT;

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

    USDT = await FiatToken.new("USDT", "USDT", 6, owner, owner, owner, owner);

    dtoken_addresses = await dTokenAddresses.new();
    ds_guard = await DSGuard.new();

    internal_handler = await InternalHandler.new(dtoken_addresses.address);

    let cUSDT = await CToken.new("cUSDT", "cUSDT", USDT.address);
    let cUSDC = await CToken.new("cUSDC", "cUSDC", USDC.address);

    compound_handler = await CompoundHandler.new(dtoken_addresses.address);
    await compound_handler.setcTokensRelation(
      [USDT.address, USDC.address],
      [cUSDT.address, cUSDC.address]
    );

    aave_handler = await InternalHandler.new(dtoken_addresses.address);

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

      await handler.enableTokens([USDC.address, USDT.address]);
    }

    // Allocate some token to all accounts
    let accounts = [account1, account2, account3, account4];
    for (const account of accounts) {
      await USDC.allocateTo(account, 100000e6);
      await USDT.allocateTo(account, 100000e6);
      USDC.approve(dUSDC.address, UINT256_MAX, { from: account });
      USDT.approve(dUSDT.address, UINT256_MAX, { from: account });
    }
  }

  async function getAllTokenBalances(account) {
    let balances = {};

    balances.usdc = await USDC.balanceOf(account);
    balances.usdt = await USDT.balanceOf(account);
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

  async function calcDiff(asyncFn, amount, account) {
    let diff = {};

    let balances = await getAllTokenBalances(account);
    let liq = await getAllLiquidities();

    await asyncFn(account, amount, { from: account });

    let new_balances = await getAllTokenBalances(account);
    let new_liq = await getAllLiquidities();

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

    //console.log(diff);

    return diff;
  }

  function mulFraction(x, num, denom) {
    let bn_num = new BN(num);
    let bn_denom = new BN(denom);

    return x.mul(bn_num).div(bn_denom);
  }

  describe("DToken Integration: Only internal handler", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Case 1", async function () {
      await truffleAssert.reverts(
        dispatcher.resetHandler([internal_handler.address], [10000]),
        "the sum of propotions must be 1000000"
      );

      await truffleAssert.reverts(
        dispatcher.updatePropotion([internal_handler.address], [10000]),
        "the sum of propotions must be 1000000"
      );

      // We need to mint some in order to burn
      await dUSDC.mint(account1, 1000e6, { from: account1 });

      await internal_handler.disableTokens([USDC.address]);
      await truffleAssert.reverts(
        dUSDC.mint(account1, 1000e6, { from: account1 }),
        "deposit: Token is disabled!"
      );

      await internal_handler.enableTokens([USDC.address]);
      await dUSDC.mint(account1, 1000e6, { from: account1 });
    });
  });

  describe("DToken Integration: internal and compound handler ", async function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Case 1", async function () {
      let amount = new BN(1000e6);
      let diff;

      // 24. Add compound handler
      await dispatcher.addHandler([compound_handler.address]);

      // 25. mint some dusdc
      diff = await calcDiff(dUSDC.mint, amount, account1);
      assert.equal(diff.usdc, "-" + amount.toString());
      assert.equal(diff.dusdc, amount.toString());
      assert.equal(diff.int_usdc, amount.toString());
      assert.equal(diff.com_usdc, "0");

      // burn some
      diff = await calcDiff(dUSDC.burn, amount, account1);
      assert.equal(diff.usdc, amount.toString());
      assert.equal(diff.dusdc, "-" + amount.toString());
      assert.equal(diff.int_usdc, "-" + amount.toString());
      assert.equal(diff.com_usdc, "0");

      // redeem some
      await dUSDC.mint(account1, amount, { from: account1 });
      diff = await calcDiff(dUSDC.redeem, amount, account1);
      assert.equal(diff.usdc, amount.toString());
      assert.equal(diff.dusdc, "-" + amount.toString());
      assert.equal(diff.int_usdc, "-" + amount.toString());
      assert.equal(diff.com_usdc, "0");

      // 26. update an invalid proportion
      await truffleAssert.reverts(
        dispatcher.resetHandler(
          [internal_handler.address, compound_handler.address],
          [100000, 100000]
        ),
        "the sum of propotions must be 1000000"
      );

      // 27. update a valid proportion
      await dispatcher.updatePropotion(
        [internal_handler.address, compound_handler.address],
        [900000, 100000]
      );

      // 28. Charge some fee here 1/10000
      await dUSDC.updateOriginationFee(Buffer.from("9dc29fac", "hex"), FEE);
      await dUSDC.updateOriginationFee(Buffer.from("40c10f19", "hex"), FEE);

      diff = await calcDiff(dUSDC.mint, amount, account1);
      let real_amount = mulFraction(amount, 9999, 10000);
      assert.equal(diff.usdc, "-" + amount.toString());
      assert.equal(diff.dusdc, real_amount.toString());
      assert.equal(diff.int_usdc, mulFraction(real_amount, 9, 10).toString());
      assert.equal(diff.com_usdc, mulFraction(real_amount, 1, 10).toString());
    });
  });

  describe("DToken Integration: internal, compound and avee handler ", async function () {
    beforeEach(async function () {
      await resetContracts();
    });
    it("Case 1", async function () {});
  });
});
