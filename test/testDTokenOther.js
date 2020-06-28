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
    USDC = await FiatToken.new("USDC", "USDC", "USD", 6, owner, owner, owner);

    USDT = await TetherToken.new("0", "USDT", "USDT", 6);

    DF = await TetherToken.new("0", "DF", "DF", 18);

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
    // let dusdc_rate = (await dUSDC.data())["0"];
    // let dusdt_rate = (await dUSDT.data())["0"];

    let dusdc_rate = await dUSDC.getExchangeRate();
    let dusdt_rate = await dUSDT.getExchangeRate();

    await asyncFn(...args);

    let new_balances = await getAllTokenBalances(account);
    let new_liq = await getAllLiquidities();
    // let new_dusdc_rate = (await dUSDC.data())["0"];
    // let new_dusdt_rate = (await dUSDT.data())["0"];
    let new_dusdc_rate = await dUSDC.getExchangeRate();
    let new_dusdt_rate = await dUSDT.getExchangeRate();

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

    if (dusdc_rate.gt(new_dusdc_rate)) {
      console.log(
        "dUSDC Exchange rate decrease to: " +
          toStringDecimals(
            divFractionBN(new_dusdc_rate, dusdc_rate, BASE).toString(),
            18
          )
      );
    }

    if (new_dusdc_rate.gt(dusdc_rate)) {
      console.log(
        "dUSDC Exchange rate increase to: " +
          toStringDecimals(
            divFractionBN(new_dusdc_rate, dusdc_rate, BASE).toString(),
            18
          )
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

    if (diff.dusdc != "0") {
      console.log(
        "account dusdc executing exchange rate: " +
          divFraction(diff.usdc, diff.dusdc, BASE)
            .toLocaleString()
            .replace(/,/g, "")
      );
    }

    // if (diff.dusdc != '0') {
    //   console.log(
    //     "account dusdc executing exchange rate: " +
    //     divUpFraction(diff.usdc, diff.dusdc, BASE).toLocaleString().replace(/,/g,''));

    // }

    if (diff.dusdt != "0") {
      console.log(
        "account dusdt executing exchange rate: " +
          divFraction(diff.usdt, diff.dusdt, BASE)
            .toLocaleString()
            .replace(/,/g, "")
      );
    }

    // console.log(diff);
    console.log("\n\n");

    return diff;
  }

  function mulFraction(x, num, denom) {
    let bn_num = new BN(num);
    let bn_denom = new BN(denom);

    return x.mul(bn_num).div(bn_denom);
  }

  function divFraction(x, num, denom) {
    let bn_x = new BN(x).abs();
    let bn_num = new BN(num).abs();
    let bn_denom = new BN(denom).abs();

    return bn_x.mul(bn_denom).div(bn_num);
  }

  function divUpFraction(x, num, denom) {
    let bn_x = new BN(x).add(new BN("1")).abs();
    let bn_num = new BN(num).abs();
    let bn_denom = new BN(denom).abs();

    return bn_x.mul(bn_denom).div(bn_num);
  }

  function mulFractionBN(x, num, denom) {
    return x.mul(num).div(denom);
  }

  function divFractionBN(x, num, denom) {
    return x.mul(denom).div(num);
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

  function toStringDecimals(numStr, decimals, decimalPlace = decimals) {
    numStr = numStr.toLocaleString().replace(/,/g, "");
    decimals = decimals.toString();

    var str = Number(`1e+${decimals}`)
      .toLocaleString()
      .replace(/,/g, "")
      .slice(1);

    var res = (numStr.length > decimals
      ? numStr.slice(0, numStr.length - decimals) +
        "." +
        numStr.slice(numStr.length - decimals)
      : "0." + str.slice(0, str.length - numStr.length) + numStr
    ).replace(/(0+)$/g, "");

    // res = res.slice(-1) == '.' ? res + '00' : res;

    if (decimalPlace == 0) return res.slice(0, res.indexOf("."));

    var length = res.indexOf(".") + 1 + decimalPlace;
    res = res
      .slice(0, length >= res.length ? res.length : length)
      .replace(/(0+)$/g, "");
    return res.slice(-1) == "." ? res + "00" : res;
  }

  describe("DToken Integration: Other case reset handler", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Case 97~99 (Skipped in coverage)", async function () {
      dispatcher.resetHandlers(
        [
          internal_handler.address,
          compound_handler.address,
          aave_handler.address,
        ],
        [700000, 200000, 100000]
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );

      diff = await calcDiff(
        dispatcher.resetHandlers,
        [
          [internal_handler.address, aave_handler.address],
          [100000, 900000],
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );

      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              1,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dispatcher.resetHandlers,
        [
          [
            internal_handler.address,
            compound_handler.address,
            aave_handler.address,
          ],
          [600000, 350000, 50000],
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              10,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dispatcher.resetHandlers,
        [
          [internal_handler.address, aave_handler.address],
          [100000, 900000],
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [account1, 1, {from: account1}],
        account1
      );
      console.log("dUSDC empty!");
      diff = await calcDiff(
        dUSDC.burn,
        [account1, await dUSDC.balanceOf(account1), {from: account1}],
        account1
      );

      await dUSDC.updateOriginationFee(Buffer.from("9dc29fac", "hex"), FEE); // Burn
      await dUSDC.updateOriginationFee(Buffer.from("40c10f19", "hex"), FEE); // Mint

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );

      let amount = new BN(randomNum(1, 100));
      console.log("Exchange rate is expected to grow: " + amount.toString());
      diff = await calcDiff(
        USDC.allocateTo,
        [
          internal_handler.address,
          mulFraction(
            await dUSDC.getTotalBalance(),
            BASE.div(new BN("100")).mul(amount),
            BASE
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [account1, 1, {from: account1}],
        account1
      );
      console.log("dUSDC empty!");
      diff = await calcDiff(
        dUSDC.burn,
        [account1, await dUSDC.balanceOf(account1), {from: account1}],
        account1
      );

      amount = new BN(randomNum(1, 100));
      console.log("Exchange rate is expected to grow: 0");
      diff = await calcDiff(
        DF.allocateTo,
        [
          internal_handler.address,
          mulFraction(
            await dUSDC.getTotalBalance(),
            BASE.div(new BN("100")).mul(amount),
            BASE
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [account1, 1, {from: account1}],
        account1
      );
      console.log("dUSDC empty!");
      diff = await calcDiff(
        dUSDC.burn,
        [account1, await dUSDC.balanceOf(account1), {from: account1}],
        account1
      );

      console.log(
        "account balance: " +
          (await dUSDC.balanceOf(account1)).toLocaleString().replace(/,/g, "")
      );
      console.log(
        "totalSupply: " +
          (await dUSDC.totalSupply()).toLocaleString().replace(/,/g, "")
      );
      console.log(
        "internal balance: " +
          (await internal_handler.getLiquidity(USDC.address))
            .toLocaleString()
            .replace(/,/g, "")
      );
      console.log(
        "comp balance: " +
          (await compound_handler.getLiquidity(USDC.address))
            .toLocaleString()
            .replace(/,/g, "")
      );
      console.log(
        "aave balance: " +
          (await aave_handler.getLiquidity(USDC.address))
            .toLocaleString()
            .replace(/,/g, "")
      );
    });
  });

  describe("DToken Integration: Other case change exchange rate", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Case 100~104 (Skipped in coverage)", async function () {
      await dUSDC.updateOriginationFee(Buffer.from("9dc29fac", "hex"), FEE); // Burn
      await dUSDC.updateOriginationFee(Buffer.from("40c10f19", "hex"), FEE); // Mint
      diff = await calcDiff(
        dispatcher.resetHandlers,
        [
          [
            internal_handler.address,
            compound_handler.address,
            aave_handler.address,
          ],
          [700000, 200000, 100000],
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );

      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              1,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              10,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      let amount = new BN("2");
      console.log("Exchange rate is expected to grow: " + amount.toString());
      diff = await calcDiff(
        USDC.allocateTo,
        [
          internal_handler.address,
          mulFraction(
            await dUSDC.getTotalBalance(),
            BASE.div(new BN("100")).mul(amount),
            BASE
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );

      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              1,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              10,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      amount = new BN("98");
      console.log("Exchange rate is expected to grow: " + amount.toString());
      diff = await calcDiff(
        USDC.allocateTo,
        [
          internal_handler.address,
          mulFraction(
            await dUSDC.getTotalBalance(),
            BASE.div(new BN("100")).mul(amount),
            BASE
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );

      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              1,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              10,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(1000e6, 10000e6)), {from: account1}],
        account1
      );

      amount = new BN("50");
      diff = await calcDiff(
        dUSDC.rebalance,
        [
          [compound_handler.address, aave_handler.address],
          [UINT256_MAX, UINT256_MAX],
          [compound_handler.address],
          [
            mulFractionBN(
              await dUSDC.getTotalBalance(),
              BASE.div(new BN("100")).mul(amount),
              BASE
            ),
          ],
        ],
        account1
      );
      console.log("Exchange rate is expected to fall: " + amount.toString());
      diff = await calcDiff(
        dispatcher.resetHandlers,
        [
          [internal_handler.address, aave_handler.address],
          [900000, 100000],
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );

      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              1,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [
          account1,
          new BN(
            randomNum(
              10,
              (await dUSDC.balanceOf(account1))
                .toLocaleString()
                .replace(/,/g, "")
            )
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(1000e6, 10000e6)), {from: account1}],
        account1
      );

      amount = new BN("50");
      diff = await calcDiff(
        dUSDC.rebalance,
        [
          [aave_handler.address],
          [UINT256_MAX],
          [aave_handler.address],
          [
            mulFraction(
              await dUSDC.getTotalBalance(),
              BASE.div(new BN("100")).mul(amount),
              BASE
            ),
          ],
        ],
        account1
      );
      console.log("Exchange rate is expected to fall: " + amount.toString());
      diff = await calcDiff(
        dispatcher.resetHandlers,
        [[internal_handler.address], [1000000]],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [account1, 1, {from: account1}],
        account1
      );
      console.log("dUSDC empty!");
      diff = await calcDiff(
        dUSDC.burn,
        [account1, await dUSDC.balanceOf(account1), {from: account1}],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );

      amount = new BN(randomNum(1, 100));
      console.log("Exchange rate is expected to grow: " + amount.toString());
      diff = await calcDiff(
        USDC.allocateTo,
        [
          internal_handler.address,
          mulFraction(
            await dUSDC.getTotalBalance(),
            BASE.div(new BN("100")).mul(amount),
            BASE
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [account1, 1, {from: account1}],
        account1
      );
      console.log("dUSDC empty!");
      diff = await calcDiff(
        dUSDC.burn,
        [account1, await dUSDC.balanceOf(account1), {from: account1}],
        account1
      );

      amount = new BN(randomNum(1, 100));
      console.log("Exchange rate is expected to grow: 0");
      diff = await calcDiff(
        DF.allocateTo,
        [
          internal_handler.address,
          mulFraction(
            await dUSDC.getTotalBalance(),
            BASE.div(new BN("100")).mul(amount),
            BASE
          ),
          {from: account1},
        ],
        account1
      );

      diff = await calcDiff(
        dUSDC.mint,
        [account1, new BN(randomNum(10, 1000e6)), {from: account1}],
        account1
      );
      diff = await calcDiff(
        dUSDC.burn,
        [account1, 1, {from: account1}],
        account1
      );
      console.log("dUSDC empty!");
      diff = await calcDiff(
        dUSDC.burn,
        [account1, await dUSDC.balanceOf(account1), {from: account1}],
        account1
      );

      console.log(
        "account balance: " +
          (await dUSDC.balanceOf(account1)).toLocaleString().replace(/,/g, "")
      );
      console.log(
        "totalSupply: " +
          (await dUSDC.totalSupply()).toLocaleString().replace(/,/g, "")
      );
      console.log(
        "internal balance: " +
          (await internal_handler.getLiquidity(USDC.address))
            .toLocaleString()
            .replace(/,/g, "")
      );
      console.log(
        "comp balance: " +
          (await compound_handler.getLiquidity(USDC.address))
            .toLocaleString()
            .replace(/,/g, "")
      );
      console.log(
        "aave balance: " +
          (await aave_handler.getLiquidity(USDC.address))
            .toLocaleString()
            .replace(/,/g, "")
      );
    });
  });
});
