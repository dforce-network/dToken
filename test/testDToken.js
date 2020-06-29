const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const DTokenController = artifacts.require("DTokenController");
const DToken = artifacts.require("DToken");
const DSGuard = artifacts.require("DSGuard");
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const BN = require("bn.js");
const {syncBuiltinESMExports} = require("module");

const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));
const BASE = new BN(10).pow(new BN(18));
const FEE = new BN(10).pow(new BN(14));
const INTEREST_RATE = new BN(10).pow(new BN(16));

const MINT_SELECTOR = "0x40c10f19";
const BURN_SELECTOR = "0x9dc29fac";

describe("DToken Contract", function () {
  let owner, account1, account2, account3, account4;
  let USDC;
  let dispatcher;
  let handlers;
  let handler_addresses;
  let dtoken_controller;
  let dUSDC;
  let ds_guard;

  before(async function () {
    [
      owner,
      account1,
      account2,
      account3,
      account4,
    ] = await web3.eth.getAccounts();
  });

  async function resetContracts(handler_num, proportions) {
    USDC = await FiatToken.new("USDC", "USDC", "USD", 6, owner, owner, owner, {
      from: owner,
    });

    dtoken_controller = await DTokenController.new();
    ds_guard = await DSGuard.new();

    handlers = new Array();
    handler_addresses = new Array();
    for (i = 0; i < handler_num; i++) {
      let h = await InternalHandler.new(dtoken_controller.address);
      await h.enableTokens([USDC.address]);
      await h.setAuthority(ds_guard.address);

      handler_addresses.push(h.address);
      handlers.push(h);
    }

    dispatcher = await Dispatcher.new(handler_addresses, proportions);
    dUSDC = await DToken.new(
      "dUSDC",
      "dUSDC",
      USDC.address,
      dispatcher.address
    );

    await dtoken_controller.setdTokensRelation([USDC.address], [dUSDC.address]);
    await dUSDC.setAuthority(ds_guard.address);
    await dispatcher.setAuthority(ds_guard.address);

    for (i = 0; i < handler_num; i++) {
      await handlers[i].approve(USDC.address);
      await ds_guard.permitx(dUSDC.address, handler_addresses[i]);
    }

    await USDC.allocateTo(account1, 1000e6);
    await USDC.allocateTo(account2, 1000e6);
    USDC.approve(dUSDC.address, UINT256_MAX, {from: account1});
    USDC.approve(dUSDC.address, UINT256_MAX, {from: account2});
  }

  describe("Deployment", function () {
    it("Should deployed and only initialized once", async function () {
      await resetContracts(1, [1000000]);

      await truffleAssert.reverts(
        dUSDC.initialize("dUSDC", "dUSDC", USDC.address, dispatcher.address, {
          from: owner,
        }),
        "initialize: Already initialized!"
      );
    });
  });

  describe("updateDispatcher", function () {
    let new_dispatcher;
    before(async function () {
      await resetContracts(1, [1000000]);
    });

    it("Should only allow auth to update dispatcher", async function () {
      new_dispatcher = await Dispatcher.new(handler_addresses, [1000000]);
      await dUSDC.updateDispatcher(new_dispatcher.address);

      await truffleAssert.reverts(
        dUSDC.updateDispatcher(dispatcher.address, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not allow to update to address 0 or the old one as dispatcher ", async function () {
      await truffleAssert.reverts(
        dUSDC.updateDispatcher(ZERO_ADDR),
        "updateDispatcher: dispatcher can be not set to 0 or the current one."
      );

      await truffleAssert.reverts(
        dUSDC.updateDispatcher(new_dispatcher.address),
        "updateDispatcher: dispatcher can be not set to 0 or the current one."
      );
    });
  });

  describe("setFeeRecipient", function () {
    before(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to set fee recipient", async function () {
      await dUSDC.setFeeRecipient(account1);

      await truffleAssert.reverts(
        dUSDC.setFeeRecipient(account2, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not set address 0 or the old one as fee recipient", async function () {
      await truffleAssert.reverts(
        dUSDC.setFeeRecipient(ZERO_ADDR),
        "setFeeRecipient: feeRecipient can be not set to 0 or the current one."
      );

      await truffleAssert.reverts(
        dUSDC.setFeeRecipient(account1),
        "setFeeRecipient: feeRecipient can be not set to 0 or the current one."
      );
    });
  });

  describe("updateOriginationFee", function () {
    before(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to set fee", async function () {
      await dUSDC.updateOriginationFee(MINT_SELECTOR, FEE);

      await truffleAssert.reverts(
        dUSDC.updateOriginationFee(MINT_SELECTOR, FEE, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not set fee to more than 100%", async function () {
      await truffleAssert.reverts(
        dUSDC.updateOriginationFee(BURN_SELECTOR, BASE),
        "updateOriginationFee: incorrect fee."
      );
    });

    it("Should not set fee to the old value", async function () {
      await truffleAssert.reverts(
        dUSDC.updateOriginationFee(MINT_SELECTOR, FEE),
        "updateOriginationFee: fee has already set to this value."
      );
    });
  });

  describe("transferFee", function () {
    before(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);

      // Fee rate is 0.01%
      await dUSDC.updateOriginationFee(MINT_SELECTOR, FEE);
      await dUSDC.updateOriginationFee(BURN_SELECTOR, FEE);

      await dUSDC.mint(account1, 1000e6, {from: account1});
      await dUSDC.burn(account1, 50e6, {from: account1});
    });

    it("Should not transfer fee to itself", async function () {
      // The default fee recipient is itself
      await truffleAssert.reverts(
        dUSDC.transferFee(USDC.address, 100),
        "transferFee: Can not transfer fee back to this contract."
      );
    });

    it("Should only allow auth to transfer fee", async function () {
      await dUSDC.setFeeRecipient(account2);
      let balance = await USDC.balanceOf(account2);

      await dUSDC.transferFee(USDC.address, 100);

      let new_balance = await USDC.balanceOf(account2);
      assert.equal(new_balance.sub(balance).toString(), 100);

      await truffleAssert.reverts(
        dUSDC.transferFee(USDC.address, 100, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });
  });

  describe("rebalance", function () {
    before(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);

      await dUSDC.mint(account1, 1000e6, {from: account1});
    });

    it("Should not rebalance when giving mismatch handle and amount pair", async function () {
      await truffleAssert.reverts(
        dUSDC.rebalance([handler_addresses[0]], [], [], []),
        "rebalance: the length of addresses and amounts must match."
      );

      await truffleAssert.reverts(
        dUSDC.rebalance([handler_addresses[0]], [10000], [], [10000]),
        "rebalance: the length of addresses and amounts must match."
      );
    });

    it("Should rebalance from one handler to another", async function () {
      let balance1 = await handlers[0].getBalance(USDC.address);
      let balance2 = await handlers[1].getBalance(USDC.address);

      await dUSDC.rebalance(
        [handler_addresses[0]],
        [10000],
        [handler_addresses[1]],
        [10000]
      );

      let new_balance1 = await handlers[0].getBalance(USDC.address);
      let new_balance2 = await handlers[1].getBalance(USDC.address);

      assert.equal(new_balance1.sub(balance1).toString(), -10000);
      assert.equal(new_balance2.sub(balance2).toString(), 10000);
    });

    it("Should rebalance all from one handler to another", async function () {
      let balance1 = await handlers[1].getBalance(USDC.address);
      let balance2 = await handlers[2].getBalance(USDC.address);

      await dUSDC.rebalance(
        [handler_addresses[1]],
        [-1],
        [handler_addresses[2]],
        [10000]
      );

      let new_balance1 = await handlers[1].getBalance(USDC.address);
      let new_balance2 = await handlers[2].getBalance(USDC.address);

      assert.equal(new_balance1.sub(balance1).toString(), -balance1.toString());
      assert.equal(new_balance2.sub(balance2).toString(), 10000);
    });

    it("Should not rebalance to deposit to unknown handler", async function () {
      // We have a fully functional unknown handler here
      let unknown_handler = await InternalHandler.new(
        dtoken_controller.address
      );
      await unknown_handler.enableTokens([USDC.address]);
      await unknown_handler.approve(USDC.address);
      await unknown_handler.setAuthority(ds_guard.address);
      await ds_guard.permitx(dUSDC.address, unknown_handler.address);
      await USDC.allocateTo(unknown_handler.address, 1000e6);
      await unknown_handler.deposit(USDC.address, 1000e6);

      let balance1 = await unknown_handler.getBalance(USDC.address);
      let balance2 = await handlers[1].getBalance(USDC.address);

      // It allows to withdraw from unknown handler
      await dUSDC.rebalance(
        [unknown_handler.address],
        [100],
        [handler_addresses[1]],
        [100]
      );

      let new_balance1 = await unknown_handler.getBalance(USDC.address);
      let new_balance2 = await handlers[1].getBalance(USDC.address);

      assert.equal(new_balance1.sub(balance1).toString(), -100);
      assert.equal(new_balance2.sub(balance2).toString(), 100);

      // It does not allow to deposit to unknown handler
      await truffleAssert.reverts(
        dUSDC.rebalance(
          [handler_addresses[1]],
          [-1],
          [unknown_handler.address],
          [100]
        ),
        "rebalance: both handler and token must be enabled"
      );

      // Does not allow disabled token either
      await handlers[1].disableTokens([USDC.address]);
      await truffleAssert.reverts(
        dUSDC.rebalance(
          [handler_addresses[2]],
          [-1],
          [handler_addresses[1]],
          [100]
        ),
        "rebalance: both handler and token must be enabled"
      );
    });
  });

  describe("Mint", function () {
    beforeEach(async function () {
      await resetContracts(5, [1000000, 0, 0, 0, 0]);
    });

    it("Should mint by initial exchange rate 1", async function () {
      let amount = new BN(10e6);

      let orig_usdc = await USDC.balanceOf(account1);
      let orig_dusdc = await dUSDC.balanceOf(account1);

      await dUSDC.mint(account1, amount, {from: account1});

      let usdc = await USDC.balanceOf(account1);
      let dusdc = await dUSDC.balanceOf(account1);
      let usdc_diff = usdc.sub(orig_usdc);
      let dusdc_diff = dusdc.sub(orig_dusdc);

      assert.equal(usdc_diff.toString(), "-" + amount.toString());
      assert.equal(dusdc_diff.toString(), amount.toString());
    });

    it("Should mint for account other than sender", async function () {
      let amount = new BN(10e6);
      await dUSDC.mint(account2, amount, {from: account1});

      let balance1 = await dUSDC.balanceOf(account1);
      let balance2 = await dUSDC.balanceOf(account2);

      assert.equal(balance1.toString(), "0");
      assert.equal(balance2.toString(), amount.toString());
    });

    it("Should not mint dtoken with the smallest unit underlying token when exchange rate > 1", async function () {
      // when exchange rate <= 1, it should be fine
      await dUSDC.mint(account1, 1, {from: account1});

      // Some mockup interest to make the exchange rate go up > 1
      await USDC.allocateTo(handlers[1].address, 10e4);

      // Now try to mint the smallest unit underlying token whose value is < 1 dtoken
      await truffleAssert.reverts(
        dUSDC.mint(account1, 1, {from: account1}),
        "mint:"
      );
    });

    it("Check mint the smallest unit of underlying token when exchange rate < 1", async function () {
      let proportions = [200000, 200000, 200000, 200000, 200000];
      await resetContracts(5, proportions);
      await dUSDC.mint(account1, 500e6, {from: account1});

      // Remove a handler so the exchange rate would drop to 0.8
      await dispatcher.resetHandlers(
        [
          handler_addresses[0],
          handler_addresses[1],
          handler_addresses[2],
          handler_addresses[3],
        ],
        [250000, 250000, 250000, 250000]
      );

      let orig_usdc = await USDC.balanceOf(account1);
      let orig_dusdc = await dUSDC.balanceOf(account1);

      // Now try to mint 1 underlying token whose value is > 1 dtoken
      await dUSDC.mint(account1, 1, {from: account1});

      let usdc = await USDC.balanceOf(account1);
      let dusdc = await dUSDC.balanceOf(account1);
      let usdc_diff = usdc.sub(orig_usdc);
      let dusdc_diff = dusdc.sub(orig_dusdc);

      //console.log("Before : ", orig_dusdc.toString(), orig_usdc.toString());
      //console.log("After : ", dusdc.toString(), usdc.toString());

      // User would exchange 1 underlying token to 1 dToken as it's floored
      assert.equal(usdc_diff.toString(), "-1");
      assert.equal(dusdc_diff.toString(), "1");
    });

    it("Check mint with some interest and changing exchange rate", async function () {
      await dUSDC.mint(account1, 100e6, {from: account1});

      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        // Mock some interest, so the exchange rate would change
        await USDC.allocateTo(handlers[0].address, 123456);

        let amount = new BN(12345678);
        let exchangeRate = await dUSDC.getExchangeRate();
        console.log("      Exchange rate: " + exchangeRate);

        // Get the underlying token balance in dToken
        let balanceBefore = await dUSDC.getTokenBalance(account1);
        let underlyingBalanceB = await USDC.balanceOf(account1);

        await dUSDC.mint(account1, amount, {from: account1});

        let balanceAfter = await dUSDC.getTokenBalance(account1);
        let underlyingBalanceA = await USDC.balanceOf(account1);

        let changed = balanceAfter.sub(balanceBefore);
        let underlyingChanged = underlyingBalanceB.sub(underlyingBalanceA);

        //console.log(changed.toString(), underlyingChanged.toString());
        //assert.equal(changed.toString(), underlyingChanged.toString());

        // The diff could be 1 due to accuracy loss
        let diff = changed.sub(underlyingChanged).abs();
        assert.equal(diff.lte(new BN(1)), true);
      }
    });
  });

  describe("Burn", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should burn all tokens", async function () {
      await dUSDC.mint(account1, 10e6, {from: account1});

      let balance = await dUSDC.balanceOf(account1);
      await dUSDC.burn(account1, balance, {from: account1});

      balance = await dUSDC.balanceOf(account1);
      assert.equal(balance.toString(), "0");

      let total_supply = await dUSDC.totalSupply();
      assert.equal(total_supply.toString(), "0");

      let total_balance = await dUSDC.getTotalBalance();
      assert.equal(total_balance.toString(), "0");
    });

    it("Should burn for account other than sender", async function () {
      let amount = new BN(10e6);
      await dUSDC.mint(account2, amount, {from: account2});

      let original1 = await dUSDC.balanceOf(account1);
      let original2 = await dUSDC.balanceOf(account2);

      // account2 has not approve account1 yet
      await truffleAssert.reverts(
        dUSDC.burn(account2, amount, {from: account1}),
        "burn: insufficient allowance"
      );

      await dUSDC.approve(account1, amount, {from: account2});
      await dUSDC.burn(account2, amount, {from: account1});

      let current1 = await dUSDC.balanceOf(account1);
      let current2 = await dUSDC.balanceOf(account2);
      let diff1 = current1.sub(original1);
      let diff2 = current2.sub(original2);

      assert.equal(diff1.toString(), "0");
      assert.equal(diff2.toString(), "-" + amount.toString());
    });

    it("Should not burn more than balance", async function () {
      // Need to make sure the handler has enough liquidity
      await dUSDC.mint(account2, 10e6, {from: account2});

      let balance = await dUSDC.balanceOf(account1);
      await truffleAssert.reverts(
        dUSDC.burn(account1, balance.add(new BN(1)), {from: account1}),
        "burn: insufficient balance"
      );
    });

    it("Should burn the smallest unit of dtoken when exchange rate >= 1", async function () {
      await dUSDC.mint(account1, 10e6, {from: account1});

      // Some mockup interest to make the exchange rate go up
      await USDC.allocateTo(handlers[1].address, 10e4);

      let orig_dusdc = await dUSDC.balanceOf(account1);
      let orig_usdc = await USDC.balanceOf(account1);

      // Now try to burn 1 dtoken
      await dUSDC.burn(account1, 1, {from: account1});

      let dusdc = await dUSDC.balanceOf(account1);
      let usdc = await USDC.balanceOf(account1);

      let diff_dusdc = dusdc.sub(orig_dusdc);
      let diff_usdc = usdc.sub(orig_usdc);

      // User would get less underlying token as it is floored
      assert.equal(diff_dusdc.toString(), "-1");
      assert.equal(diff_usdc.toString(), "1");
    });

    it("Check burn the smallest unit of dtoken when exchange rate < 1", async function () {
      let proportions = [200000, 200000, 200000, 200000, 200000];
      await resetContracts(5, proportions);
      await dUSDC.mint(account1, 500e6, {from: account1});

      // Remove a handler so the exchange rate would drop to 0.8
      await dispatcher.resetHandlers(
        [
          handler_addresses[0],
          handler_addresses[1],
          handler_addresses[2],
          handler_addresses[3],
        ],
        [250000, 250000, 250000, 250000]
      );

      let orig_usdc = await USDC.balanceOf(account1);
      let orig_dusdc = await dUSDC.balanceOf(account1);

      // Now try to burn 1 dtoken whose value is < 1 underlying token
      await dUSDC.burn(account1, 1, {from: account1});

      let usdc = await USDC.balanceOf(account1);
      let dusdc = await dUSDC.balanceOf(account1);
      let usdc_diff = usdc.sub(orig_usdc);
      let dusdc_diff = dusdc.sub(orig_dusdc);

      // User would get 0 underlying token while 1 dToken was burned
      assert.equal(usdc_diff.toString(), 0);
      assert.equal(dusdc_diff.toString(), -1);
    });

    it("Check burn with some interest and changing exchange rate", async function () {
      await dUSDC.mint(account1, 1000e6, {from: account1});
      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        let amount = new BN(12345678);
        // Mock some interest, so the exchange rate would change
        await USDC.allocateTo(handlers[1].address, 123456);

        let exchangeRate = await dUSDC.getExchangeRate();
        console.log("      Exchange rate: " + exchangeRate);

        // Get the underlying token balance in dToken
        let balanceBefore = await dUSDC.getTokenBalance(account1);
        let underlyingBalanceB = await USDC.balanceOf(account1);

        await dUSDC.burn(account1, amount, {from: account1});

        let balanceAfter = await dUSDC.getTokenBalance(account1);
        let underlyingBalanceA = await USDC.balanceOf(account1);

        let changed = balanceBefore.sub(balanceAfter);
        let underlyingChanged = underlyingBalanceA.sub(underlyingBalanceB);

        //console.log(changed.toString(), underlyingChanged.toString());
        //assert.equal(changed.toString(), underlyingChanged.toString());

        // The diff could be 1 due to accuracy loss
        let diff = changed.sub(underlyingChanged).abs();
        assert.equal(diff.lte(new BN(1)), true);
      }
    });
  });

  describe("Redeem", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should redeem all tokens", async function () {
      // Exchange rate does not change here, should remain 1
      await dUSDC.mint(account1, 10e6, {from: account1});
      await dUSDC.redeem(account1, 10e6, {from: account1});

      let balance = await dUSDC.balanceOf(account1);
      assert.equal(balance.toString(), "0");

      let total_supply = await dUSDC.totalSupply();
      assert.equal(total_supply.toString(), "0");

      let total_balance = await dUSDC.getTotalBalance();
      assert.equal(total_balance.toString(), "0");
    });

    it("Should redeem for account other than sender", async function () {
      let amount = new BN(10e6);
      await dUSDC.mint(account2, amount, {from: account2});

      let original1 = await dUSDC.balanceOf(account1);
      let original2 = await dUSDC.balanceOf(account2);

      // account2 has not approve account1 yet
      await truffleAssert.reverts(
        dUSDC.redeem(account2, amount, {from: account1}),
        "redeem: insufficient allowance"
      );

      await dUSDC.approve(account1, amount, {from: account2});
      await dUSDC.redeem(account2, amount, {from: account1});

      let current1 = await dUSDC.balanceOf(account1);
      let current2 = await dUSDC.balanceOf(account2);
      let diff1 = current1.sub(original1);
      let diff2 = current2.sub(original2);

      assert.equal(diff1.toString(), "0");
      assert.equal(diff2.toString(), "-" + amount.toString());
    });

    it("Should not redeem more than balance", async function () {
      // Need to make sure the handler has enough liquidity
      await dUSDC.mint(account2, 10e6, {from: account2});

      let balance = await dUSDC.balanceOf(account1);

      // The exchange rate is 1 here, use the dUSDC balance where it should be a usdc amount
      await truffleAssert.reverts(
        dUSDC.redeem(account1, balance.add(new BN(1)), {from: account1}),
        "redeem: insufficient balance"
      );
    });

    it("Should redeem the smallest unit of underlying token when exchange rate > 1", async function () {
      await dUSDC.mint(account1, 10e6, {from: account1});

      let orig_dusdc = await dUSDC.balanceOf(account1);
      let orig_usdc = await USDC.balanceOf(account1);

      // Some mockup interest to make the exchange rate go up to 2
      await USDC.allocateTo(handlers[1].address, 10e6);

      await dUSDC.redeem(account1, 1, {from: account1});

      let dusdc = await dUSDC.balanceOf(account1);
      let usdc = await USDC.balanceOf(account1);
      let dusdc_diff = dusdc.sub(orig_dusdc);
      let usdc_diff = usdc.sub(orig_usdc);

      // The dusdc_diff should be about -0.5, but we round up
      assert.equal(dusdc_diff.toString(), "-1");
      assert.equal(usdc_diff.toString(), "1");
    });

    it("Check redeem the smallest unit of underlying token when exchange rate < 1", async function () {
      let proportions = [200000, 200000, 200000, 200000, 200000];
      await resetContracts(5, proportions);
      await dUSDC.mint(account1, 500e6, {from: account1});

      // Remove a handler so the exchange rate would drop to 0.8
      await dispatcher.resetHandlers(
        [
          handler_addresses[0],
          handler_addresses[1],
          handler_addresses[2],
          handler_addresses[3],
        ],
        [250000, 250000, 250000, 250000]
      );

      let orig_usdc = await USDC.balanceOf(account1);
      let orig_dusdc = await dUSDC.balanceOf(account1);

      // Now try to redeem 1 underlying token whose value is > 1 dtoken
      await dUSDC.redeem(account1, 1, {from: account1});

      let usdc = await USDC.balanceOf(account1);
      let dusdc = await dUSDC.balanceOf(account1);
      let usdc_diff = usdc.sub(orig_usdc);
      let dusdc_diff = dusdc.sub(orig_dusdc);

      // User would get 1 underlying token while 2 dToken was burned
      assert.equal(usdc_diff.toString(), 1);
      assert.equal(dusdc_diff.toString(), -2);
    });

    it("Check redeem with some interest and changing exchange rate", async function () {
      await dUSDC.mint(account1, 1000e6, {from: account1});
      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        let amount = new BN(12345678);
        // Mock some interest, so the exchange rate would change
        await USDC.allocateTo(handlers[1].address, 123456);

        let exchangeRate = await dUSDC.getExchangeRate();
        console.log("      Exchange rate: " + exchangeRate);

        // Get the underlying token balance in dToken
        let balanceBefore = await dUSDC.getTokenBalance(account1);
        let underlyingBalanceB = await USDC.balanceOf(account1);

        await dUSDC.redeem(account1, amount, {from: account1});

        let balanceAfter = await dUSDC.getTokenBalance(account1);
        let underlyingBalanceA = await USDC.balanceOf(account1);

        let changed = balanceBefore.sub(balanceAfter);
        let underlyingChanged = underlyingBalanceA.sub(underlyingBalanceB);

        //console.log(changed.toString(), underlyingChanged.toString());
        //assert.equal(changed.toString(), underlyingChanged.toString());

        // The diff could be 1 due to accuracy loss
        let diff = changed.sub(underlyingChanged).abs();
        assert.equal(diff.lte(new BN(1)), true);
      }
    });
  });

  describe("transfer/transferFrom", function () {
    before(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);

      await dUSDC.mint(account1, 1000e6, {from: account1});
    });

    it("Should be able to transfer dToken", async function () {
      await dUSDC.transfer(account2, 100e6, {from: account1});
      assert.equal((await dUSDC.balanceOf(account1)).toString(), 900e6);
      assert.equal((await dUSDC.balanceOf(account2)).toString(), 100e6);
    });

    it("Should be able to transferFrom dToken", async function () {
      await dUSDC.transferFrom(account1, account2, 100e6, {from: account1});
      assert.equal((await dUSDC.balanceOf(account1)).toString(), 800e6);
      assert.equal((await dUSDC.balanceOf(account2)).toString(), 200e6);
    });

    it("Should not be able to transferFrom dToken more than its balance", async function () {
      await truffleAssert.reverts(
        dUSDC.transferFrom(account1, account2, 1000e6, {from: account1}),
        "transferFrom: insufficient balance"
      );
    });

    it("Should not be able to transferFrom dToken from unapproved account", async function () {
      await truffleAssert.reverts(
        dUSDC.transferFrom(account1, account2, 10e6, {from: account2}),
        "transferFrom: insufficient allowance"
      );
    });
  });

  describe("Approve/increaseAllowance/decreaseAllowance", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
      await dUSDC.mint(account1, 1000e6, {from: account1});
    });

    it("Should be able to transfer others dToken when approved", async function () {
      await dUSDC.approve(account2, 100e6, {from: account1});

      // Account2 should have enough allowance
      dUSDC.transferFrom(account1, account2, 10e6, {from: account2});
    });

    it("Should be able to increase allowance when it is insufficient", async function () {
      await dUSDC.approve(account2, 100e6, {from: account1});

      // The remaining allowance is insufficient
      await truffleAssert.reverts(
        dUSDC.transferFrom(account1, account2, 101e6, {from: account2}),
        "transferFrom: insufficient allowance"
      );

      // Increase allowance and should succeed
      await dUSDC.increaseAllowance(account2, 10e6, {from: account1});
      await dUSDC.transferFrom(account1, account2, 101e6, {from: account2});
    });

    it("Should be able to decrease allowance", async function () {
      await dUSDC.approve(account2, 100e6, {from: account1});

      // Decrease allowance
      await dUSDC.decreaseAllowance(account2, 10e6, {from: account1});

      // The remaining allowance is insufficient
      await truffleAssert.reverts(
        dUSDC.transferFrom(account1, account2, 91e6, {from: account2}),
        "transferFrom: insufficient allowance"
      );
    });

    it("Should not be able to decrease allowance to < 0", async function () {
      await dUSDC.approve(account2, 100e6, {from: account1});

      await truffleAssert.reverts(
        dUSDC.decreaseAllowance(account2, 101e6, {from: account1})
      );
    });

    it("Should be able to approve allowance to maximum", async function () {
      await dUSDC.approve(account2, UINT256_MAX, {from: account1});

      // Should have the allowance to transfer all balance
      let balance = await dUSDC.balanceOf(account1);
      await dUSDC.transferFrom(account1, account3, balance, {from: account2});
    });
  });

  describe("balanceOf", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get 0 as the initial dToken balance of account", async function () {
      assert.equal((await dUSDC.balanceOf(account1)).toString(), 0);
    });

    it("Should be able to get dToken balance of account", async function () {
      await dUSDC.mint(account1, 1000e6, {from: account1});
      await dUSDC.burn(account1, 10e6, {from: account1});
      await dUSDC.transfer(account2, 1e6, {from: account1});

      assert.equal((await dUSDC.balanceOf(account1)).toString(), 989e6);
    });
  });

  describe("getTokenBalance", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get 0 as initial token balance", async function () {
      assert.equal((await dUSDC.getTokenBalance(account1)).toString(), 0);
    });

    it("Should get token balance with difference exchange rate", async function () {
      let amount = new BN(1000e6);
      await dUSDC.mint(account1, amount, {from: account1});

      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        // Mock some interest
        let interest = new BN(1234567);
        await USDC.allocateTo(handler_addresses[0], interest);

        assert.equal(
          (await dUSDC.getTokenBalance(account1)).toString(),
          amount
            .mul(await dUSDC.getExchangeRate())
            .div(BASE)
            .toString()
        );
      }
    });
  });

  describe("getCurrentInterest", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get 0 as initial interest", async function () {
      assert.equal((await dUSDC.getCurrentInterest(account1)).toString(), 0);
    });

    it("Should get correct interest", async function () {
      let amount = new BN(1000e6);
      let totalInterest = new BN(0);
      await dUSDC.mint(account1, amount, {from: account1});

      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        // Some mock interest to make the exchange rate go up
        let interest = new BN(12345);
        await USDC.allocateTo(handler_addresses[0], interest);

        totalInterest = totalInterest.add(interest);
        assert.equal(
          (await dUSDC.getCurrentInterest(account1)).toString(),
          totalInterest.toString()
        );
      }
    });
  });

  describe("getHandlers", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get handlers", async function () {
      let handlers = await dUSDC.getHandlers();

      //console.log(handlers.toString(), handler_addresses.toString());
      assert.equal(handlers.toString(), handler_addresses.toString());
    });
  });

  describe("getTotalBalance", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get 0 as the initial total balance", async function () {
      assert.equal((await dUSDC.getTotalBalance()).toString(), 0);
    });

    it("Should get total balance", async function () {
      await dUSDC.mint(account1, 1000e6, {from: account1});
      await dUSDC.mint(account2, 1000e6, {from: account2});
      await dUSDC.burn(account1, 10e6, {from: account1});
      await USDC.allocateTo(handlers[4].address, 1e6);

      assert.equal((await dUSDC.getTotalBalance()).toString(), 1991e6);
    });
  });

  describe("getLiquidity", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get 0 as the initial liquidity", async function () {
      assert.equal((await dUSDC.getLiquidity()).toString(), 0);
    });

    it("Should get liquidity", async function () {
      await dUSDC.mint(account1, 1000e6, {from: account1});
      await dUSDC.mint(account2, 1000e6, {from: account2});
      await dUSDC.burn(account1, 10e6, {from: account1});

      assert.equal((await dUSDC.getLiquidity()).toString(), 1990e6);
    });
  });

  describe("getExchangeRate", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get 1 as the initial exchange rate", async function () {
      let expected = BASE;
      let exchange_rate = await dUSDC.getExchangeRate();

      assert.equal(exchange_rate.toString(), expected.toString());
    });

    it("Should get default exchange rate when there is some initial token in handlers", async function () {
      let expected = BASE;

      await USDC.allocateTo(handler_addresses[0], 1000e6);
      let exchange_rate = await dUSDC.getExchangeRate();

      assert.equal(exchange_rate.toString(), expected.toString());
    });

    it("Should get 0 when there is no token in handlers", async function () {
      // Mint some dtoken and mock some interest to make the exchange rate go up to 2
      await dUSDC.mint(account1, 1000e6, {from: account1});
      await USDC.allocateTo(handler_addresses[0], 1000e6);
      await dUSDC.burn(account1, 100e6, {from: account1});

      let expected = 0;

      // Reset handlers, handler1 does not have any token yet so there would be no token
      await dispatcher.resetHandlers([handler_addresses[1]], [1000000]);
      let exchange_rate = await dUSDC.getExchangeRate();

      assert.equal(exchange_rate.toString(), expected.toString());
    });

    it("Should update the exchange rate", async function () {
      let amount = new BN(1000e6);
      let totalSupply = new BN(1000e6);
      await dUSDC.mint(account1, amount, {from: account1});

      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        // Some mock interest to make the exchange rate go up
        let interest = new BN(123);
        await USDC.allocateTo(handler_addresses[0], interest);

        amount = amount.add(interest);
        let exchange_rate = await dUSDC.getExchangeRate();
        let expected = BASE.mul(amount).div(totalSupply);

        assert.equal(exchange_rate.toString(), expected.toString());
      }
    });
  });
});
