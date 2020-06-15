const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const dTokenAddresses = artifacts.require("dTokenAddresses");

const mock_dtoken = "0x0000000000000000000000000000000000000001";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

describe("Dispatcher Contract", function () {
  let owner, account1, account2, account3, account4;
  let USDC;
  let dispatcher;
  let handlers;
  let handler_addresses;
  let dtoken_addresses;

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
    await dtoken_addresses.setdTokensRelation([USDC.address], [mock_dtoken]);

    handlers = new Array();
    handler_addresses = new Array();
    for (i = 0; i < handler_num; i++) {
      let h = await InternalHandler.new(dtoken_addresses.address);
      await h.enableToken(USDC.address);
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
        "setHandler: array parameters mismatch"
      );
    });

    it("Should not set handlers with 0 address", async function () {
      let proportions = [1000000];
      let handler_addresses = [ZERO_ADDR];

      await truffleAssert.reverts(
        Dispatcher.new(handler_addresses, proportions),
        "setHandler: handlerAddr contract address invalid"
      );
    });

    it("Should not set handlers with proportion not summing up to 1000000", async function () {
      let proportions = [2000000];
      await truffleAssert.reverts(
        resetContracts(1, proportions),
        "the sum of propotions must be 1000000"
      );

      proportions = [100000, 100000, 100000, 100000, 100000];
      await truffleAssert.reverts(
        resetContracts(5, proportions),
        "the sum of propotions must be 1000000"
      );
    });
  });

  describe("updateProportion", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to update proportion", async function () {
      let proportions = [500000, 500000, 0, 0, 0];

      await dispatcher.updatePropotion(handler_addresses, proportions);

      let { 0: h, 1: p } = await dispatcher.getHandler();
      assert_handlers_equal(
        h,
        handler_addresses,
        p.map((p) => p.toNumber()),
        proportions
      );

      await truffleAssert.reverts(
        dispatcher.updatePropotion(handler_addresses, proportions, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not update proportion as length mismatch", async function () {
      let proportions = [500000, 500000, 0, 0];
      await truffleAssert.reverts(
        dispatcher.updatePropotion(handler_addresses, proportions),
        "updatePropotion: array parameters mismatch"
      );
    });

    it("Should not update proportion using wrong address", async function () {
      let proportions = [500000, 500000, 0, 0, 0];
      let addresses = handler_addresses;
      addresses[0] = account1;
      await truffleAssert.reverts(
        dispatcher.updatePropotion(addresses, proportions),
        "updatePropotion: the handler contract address does not exist"
      );
    });
  });

  describe("addHandler", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to add handler", async function () {
      let new_handlers = [
        (await InternalHandler.new(dtoken_addresses.address)).address,
      ];
      await dispatcher.addHandler(new_handlers);

      //TODO: Check new handlers are retrievable

      new_handlers = [
        (await InternalHandler.new(dtoken_addresses.address)).address,
      ];
      await truffleAssert.reverts(
        dispatcher.addHandler(new_handlers, { from: account1 }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not add existing handler ", async function () {
      let new_handlers = handler_addresses;
      await truffleAssert.reverts(
        dispatcher.addHandler(new_handlers),
        "addHandler: handler contract address already exists"
      );
    });

    it("Should not add handler with invalid address", async function () {
      let new_handlers = [ZERO_ADDR];
      await truffleAssert.reverts(
        dispatcher.addHandler(new_handlers),
        "addHandler: handler contract address invalid"
      );
    });
  });

  describe("resetHandler", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should only allow auth to reset handlers ", async function () {
      let new_handlers = handler_addresses;
      let new_proportions = [500000, 500000, 0, 0, 0];
      await dispatcher.resetHandler(new_handlers, new_proportions);

      //TODO: Check new handlers are retrievable

      await truffleAssert.reverts(
        dispatcher.resetHandler(new_handlers, new_proportions, {
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
      dispatcher.updateDefaultHandler(handler_addresses[1]);

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

  describe("getHandler", function () {
    let proportions = [1000000, 0, 0, 0, 0];
    beforeEach(async function () {
      await resetContracts(5, proportions);
    });

    it("Should get Handler", async function () {
      let { 0: h, 1: p } = await dispatcher.getHandler();
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

    it("Should not get empty deposit strategy if any handler is paused", async function () {
      await handlers[3].pause();
      let { 0: h, 1: p } = await dispatcher.getDepositStrategy(10000000);

      assert.equal(h.length, 0);
      assert.equal(p.length, 0);
    });
  });

  describe("getWithdrawStrategy", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get withdraw strategy 1", async function () {
      // Transfer some token to mock up the liquidity
      await USDC.allocateTo(handler_addresses[0], 2000e6);
      await USDC.allocateTo(handler_addresses[1], 1000e6);
      await USDC.allocateTo(handler_addresses[2], 3000e6);
      await USDC.allocateTo(handler_addresses[3], 5000e6);
      await USDC.allocateTo(handler_addresses[4], 500e6);

      let amounts = [1000e6, 0, 3000e6, 5000e6, 0];
      let { 0: h, 1: p } = await dispatcher.getWithdrawStrategy(
        USDC.address,
        9000e6
      );

      console.log(
        handler_addresses,
        h,
        p.map((p) => p.toNumber())
      );

      assert_handlers_equal(
        h,
        handler_addresses,
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

      let amounts = [1500e6, 0, 0, 0, 0];
      let { 0: h, 1: p } = await dispatcher.getWithdrawStrategy(
        USDC.address,
        1500e6
      );

      console.log(
        h,
        p.map((p) => p.toNumber())
      );

      assert_handlers_equal(
        h,
        handler_addresses,
        p.map((p) => p.toNumber()),
        amounts
      );
    });

    it("Should not get empty deposit strategy if any handler is paused", async function () {
      await USDC.allocateTo(handler_addresses[0], 2000e6);
      await handlers[3].pause();
      let { 0: h, 1: p } = await dispatcher.getWithdrawStrategy(
        USDC.address,
        10000000
      );

      assert.equal(h.length, 0);
      assert.equal(p.length, 0);
    });
  });
});
