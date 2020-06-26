const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const dTokenAddresses = artifacts.require("dTokenAddresses");
const DToken = artifacts.require("DToken");
const DSGuard = artifacts.require("DSGuard");
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const BN = require("bn.js");
const {syncBuiltinESMExports} = require("module");

const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));
const BASE = new BN(10).pow(new BN(18));

describe("DToken Contract", function () {
  let owner, account1, account2, account3, account4;
  let USDC;
  let dispatcher;
  let handlers;
  let handler_addresses;
  let dtoken_addresses;
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
    USDC = await FiatToken.new(
      "USDC",
      "USDC",
      "USD",
      6,
      owner,
      owner,
      owner,
      owner,
      {
        from: owner,
      }
    );

    dtoken_addresses = await dTokenAddresses.new();
    ds_guard = await DSGuard.new();

    handlers = new Array();
    handler_addresses = new Array();
    for (i = 0; i < handler_num; i++) {
      let h = await InternalHandler.new(dtoken_addresses.address);
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

    await dtoken_addresses.setdTokensRelation([USDC.address], [dUSDC.address]);
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
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to set fee recipient", async function () {});

    it("Should not set address 0 or the old one as fee recipient", async function () {});
  });

  describe("updateOriginationFee", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to set fee", async function () {});

    it("Should not set fee to more than 10% or the old value", async function () {});
  });

  describe("transferFee", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to transfer fee", async function () {});

    it("Should not set fee to more than 10% or the old value", async function () {});
  });

  describe("rebalance", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should rebalance some token from handler to handler", async function () {});
  });

  describe("Mint", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
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

    it("Should not mint less than 1 dtoken", async function () {
      // when exchange rate <= 1, it should be fine
      await dUSDC.mint(account1, 1, {from: account1});

      // Some mockup interest to make the exchange rate go up > 1
      await USDC.allocateTo(handlers[1].address, 10e4);

      // Now try to mint 1 underlying token whose value is < 1 dtoken
      await truffleAssert.reverts(
        dUSDC.mint(account1, 1, {from: account1}),
        "mint:"
      );
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

    it("Should burn minimum dtoken when exchange rate >= 1", async function () {
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

      assert.equal(diff_dusdc.toString(), "-1");
      assert.equal(diff_usdc.toString(), "1");
    });

    // TODO: Burn minimum dtoken when exchange rate < 1
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

    it("Should redeem minimum underlying token", async function () {
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
  });

  describe("getTotalBalance", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get 0 as initial total balance", async function () {
      let total_balance = await dUSDC.getTotalBalance();

      assert.equal(total_balance.toString(), "0");
    });

    it("Should get total balance", async function () {
      await dUSDC.mint(account1, 10e6, {from: account1});
      await USDC.allocateTo(handlers[4].address, 1e6);

      let expected = new BN(11e6);
      let total_balance = await dUSDC.getTotalBalance();

      assert.equal(total_balance.toString(), expected.toString());
    });
  });

  describe("getHandler", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get handlers", async function () {
      let handlers = await dUSDC.getHandler();

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
  });

  describe("getLiquidity", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get 0 as the initial liquidity", async function () {
      assert.equal((await dUSDC.getLiquidity()).toString(), 0);
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

    it("Should update the exchange rate", async function () {
      await dUSDC.mint(account1, 10e6, {from: account1});

      // Some mockup interest to make the exchange rate go up to 2
      await USDC.allocateTo(handlers[0].address, 10e6);

      let exchange_rate = await dUSDC.getExchangeRate();
      let expected = BASE.mul(new BN(2));

      assert.equal(exchange_rate.toString(), expected.toString());
    });
  });
});
