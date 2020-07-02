const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const IDispatcherView = artifacts.require("IDispatcherView");
const DTokenController = artifacts.require("DTokenController");

const mock_dtoken = "0x0000000000000000000000000000000000000001";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

describe("Dispatcher Contract", function () {
  let owner, account1, account2, account3, account4;
  let USDC;
  let dispatcher;
  let handlers;
  let handler_addresses;
  let dtoken_controller;

  function assert_handlers_equal(
    addresses1,
    addresses2,
    proportions1,
    proportions2
  ) {
    let i;

    for (i = 0; i < addresses1.length; i++) {
      assert.equal(addresses1[i], addresses2[i]);
      assert.equal(proportions1[i], proportions2[i]);
    }
  }

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
    await dtoken_controller.setdTokensRelation([USDC.address], [mock_dtoken]);

    handlers = new Array();
    handler_addresses = new Array();
    for (i = 0; i < handler_num; i++) {
      let h = await InternalHandler.new(dtoken_controller.address);
      await h.enableTokens([USDC.address]);
      await USDC.allocateTo(h.address, 1000e6);

      handler_addresses.push(h.address);
      handlers.push(h);
    }

    dispatcher = await Dispatcher.new(handler_addresses, proportions);
  }

  describe("Deployment", function () {
    it("Should deployed", async function () {
      let proportions = [1000000];
      await resetContracts(1, proportions);
    });

    it("Should not set handlers with mismatch arrays", async function () {
      let proportions = [1000000];

      await truffleAssert.reverts(
        resetContracts(2, proportions),
        "setHandlers: handlers & proportions should not have 0 or different lengths"
      );
    });

    it("Should not set handlers with 0 address", async function () {
      let proportions = [1000000];
      let handler_addresses = [ZERO_ADDR];

      await truffleAssert.reverts(
        Dispatcher.new(handler_addresses, proportions),
        "setHandlers: handlerAddr contract address invalid"
      );
    });

    it("Should not set handlers with proportion not summing up to 1000000", async function () {
      let proportions = [2000000];
      await truffleAssert.reverts(
        resetContracts(1, proportions),
        "the sum of proportions must be 1000000"
      );

      proportions = [100000, 100000, 100000, 100000, 100000];
      await truffleAssert.reverts(
        resetContracts(5, proportions),
        "the sum of proportions must be 1000000"
      );
    });
  });

  describe("updateProportions", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to update proportion", async function () {
      let proportions = [500000, 500000, 0, 0, 0];

      await dispatcher.updateProportions(handler_addresses, proportions);

      let { 0: h, 1: p } = await dispatcher.getHandlers();
      assert_handlers_equal(
        h,
        handler_addresses,
        p.map((p) => p.toNumber()),
        proportions
      );

      await truffleAssert.reverts(
        dispatcher.updateProportions(handler_addresses, proportions, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not update proportion as length mismatch", async function () {
      let proportions = [500000, 500000, 0, 0];
      await truffleAssert.reverts(
        dispatcher.updateProportions(handler_addresses, proportions),
        "updateProportions: handlers & proportions must match the current length"
      );
    });

    it("Should not update proportion using wrong address", async function () {
      let proportions = [500000, 500000, 0, 0, 0];
      let addresses = handler_addresses;
      addresses[0] = account1;
      await truffleAssert.reverts(
        dispatcher.updateProportions(addresses, proportions),
        "updateProportions: the handler contract address does not exist"
      );
    });
  });

  describe("addHandlers", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to add handler", async function () {
      let new_handlers = [
        (await InternalHandler.new(dtoken_controller.address)).address,
      ];
      await dispatcher.addHandlers(new_handlers);

      let { 0: h, 1: p } = await dispatcher.getHandlers();

      new_handlers = [
        (await InternalHandler.new(dtoken_controller.address)).address,
      ];
      await truffleAssert.reverts(
        dispatcher.addHandlers(new_handlers, { from: account1 }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not add existing handler ", async function () {
      let new_handlers = handler_addresses;
      await truffleAssert.reverts(
        dispatcher.addHandlers(new_handlers),
        "addHandlers: handler address already exists"
      );
    });

    it("Should not add handler with invalid address", async function () {
      let new_handlers = [ZERO_ADDR];
      await truffleAssert.reverts(
        dispatcher.addHandlers(new_handlers),
        "addHandlers: handler address invalid"
      );
    });
  });

  describe("resetHandlers", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to reset handlers ", async function () {
      let new_handlers = handler_addresses;
      let new_proportions = [500000, 500000, 0, 0, 0];
      await dispatcher.resetHandlers(new_handlers, new_proportions);

      let { 0: h, 1: p } = await dispatcher.getHandlers();
      assert_handlers_equal(
        h,
        new_handlers,
        p.map((p) => p.toNumber()),
        new_proportions
      );

      await truffleAssert.reverts(
        dispatcher.resetHandlers(new_handlers, new_proportions, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });
  });

  describe("updateDefaultHandler", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to update default handler", async function () {
      await dispatcher.updateDefaultHandler(handler_addresses[1]);

      assert.equal(await dispatcher.defaultHandler(), handler_addresses[1]);

      await truffleAssert.reverts(
        dispatcher.updateDefaultHandler(handler_addresses[1], {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not update default handler with 0 address", async function () {
      await truffleAssert.reverts(
        dispatcher.updateDefaultHandler(ZERO_ADDR),
        "updateDefaultHandler: New defaultHandler should not be zero address"
      );
    });

    it("Should not update default handler with current default handler", async function () {
      await truffleAssert.reverts(
        dispatcher.updateDefaultHandler(handler_addresses[0]),
        "updateDefaultHandler: Old and new address cannot be the same."
      );
    });
  });

  describe("getHandlers", function () {
    let proportions = [1000000, 0, 0, 0, 0];
    beforeEach(async function () {
      await resetContracts(5, proportions);
    });

    it("Should get Handler", async function () {
      let { 0: h, 1: p } = await dispatcher.getHandlers();
      assert_handlers_equal(
        h,
        handler_addresses,
        p.map((p) => p.toNumber()),
        proportions
      );
    });
  });

  describe("getDepositStrategy", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get deposit strategy", async function () {
      let amounts = [10000000, 0, 0, 0, 0];
      let { 0: h, 1: p } = await dispatcher.getDepositStrategy(10000000);

      assert_handlers_equal(
        h,
        handler_addresses,
        p.map((p) => p.toNumber()),
        amounts
      );
    });

    it("Should get empty deposit strategy if any handler is paused", async function () {
      await handlers[3].pause();
      let { 0: h, 1: p } = await dispatcher.getDepositStrategy(10000000);

      assert.equal(h.length, 0);
      assert.equal(p.length, 0);
    });
  });

  describe("getWithdrawStrategy", function () {
    let dispatcher_view;
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
      dispatcher_view = await IDispatcherView.at(dispatcher.address);
    });

    it("Should get withdraw strategy 1", async function () {
      // Transfer some token to mock up the liquidity
      await USDC.allocateTo(handler_addresses[0], 2000e6);
      await USDC.allocateTo(handler_addresses[1], 1000e6);
      await USDC.allocateTo(handler_addresses[2], 3000e6);
      await USDC.allocateTo(handler_addresses[3], 5000e6);
      await USDC.allocateTo(handler_addresses[4], 500e6);

      let sorted = [
        handler_addresses[0],
        handler_addresses[3],
        handler_addresses[2],
        handler_addresses[1],
        handler_addresses[4],
      ];
      let amounts = [3000e6, 6000e6, 0, 0, 0];
      let { 0: h, 1: p } = await dispatcher_view.getWithdrawStrategy(
        USDC.address,
        9000e6
      );

      assert_handlers_equal(
        h,
        sorted,
        p.map((p) => p.toNumber()),
        amounts
      );
    });

    it("Should get withdraw strategy 2", async function () {
      // Transfer some token to mock up the liquidity
      await USDC.allocateTo(handler_addresses[0], 2000e6);
      await USDC.allocateTo(handler_addresses[1], 1000e6);
      await USDC.allocateTo(handler_addresses[2], 3000e6);
      await USDC.allocateTo(handler_addresses[3], 5000e6);
      await USDC.allocateTo(handler_addresses[4], 500e6);

      let sorted = [
        handler_addresses[0],
        handler_addresses[3],
        handler_addresses[2],
        handler_addresses[1],
        handler_addresses[4],
      ];
      let amounts = [1500e6, 0, 0, 0, 0];
      let { 0: h, 1: p } = await dispatcher_view.getWithdrawStrategy(
        USDC.address,
        1500e6
      );

      assert_handlers_equal(
        h,
        sorted,
        p.map((p) => p.toNumber()),
        amounts
      );
    });

    it("Should get withdraw strategy 3", async function () {
      await dispatcher.resetHandlers(
        [
          handler_addresses[0],
          handler_addresses[1],
          handler_addresses[2],
          handler_addresses[3],
        ],
        [1000000, 0, 0, 0]
      );

      // Transfer some token to mock up the liquidity
      await USDC.allocateTo(handler_addresses[0], 2000e6);
      await USDC.allocateTo(handler_addresses[1], 1000e6);
      await USDC.allocateTo(handler_addresses[2], 3000e6);
      await USDC.allocateTo(handler_addresses[3], 5000e6);

      let sorted = [
        handler_addresses[0],
        handler_addresses[3],
        handler_addresses[2],
        handler_addresses[1],
      ];
      let amounts = [1500e6, 0, 0, 0];
      let { 0: h, 1: p } = await dispatcher_view.getWithdrawStrategy(
        USDC.address,
        1500e6
      );

      assert_handlers_equal(
        h,
        sorted,
        p.map((p) => p.toNumber()),
        amounts
      );
    });

    it("Should get empty deposit strategy if any handler is paused and restore after unpause", async function () {
      await USDC.allocateTo(handler_addresses[0], 2000e6);
      await USDC.allocateTo(handler_addresses[1], 1000e6);
      await USDC.allocateTo(handler_addresses[2], 3000e6);
      await USDC.allocateTo(handler_addresses[3], 5000e6);
      await USDC.allocateTo(handler_addresses[4], 500e6);

      await handlers[3].pause();
      let { 0: h, 1: p } = await dispatcher_view.getWithdrawStrategy(
        USDC.address,
        9000e6
      );

      assert.equal(h.length, 0);
      assert.equal(p.length, 0);

      await handlers[3].unpause();
      let { 0: h1, 1: p1 } = await dispatcher_view.getWithdrawStrategy(
        USDC.address,
        9000e6
      );

      let sorted = [
        handler_addresses[0],
        handler_addresses[3],
        handler_addresses[2],
        handler_addresses[1],
        handler_addresses[4],
      ];
      let amounts = [3000e6, 6000e6, 0, 0, 0];

      assert_handlers_equal(
        h1,
        sorted,
        p1.map((p) => p.toNumber()),
        amounts
      );
    });
  });
});
