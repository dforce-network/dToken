const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");

describe("Dispatcher Contract", function () {
  let owner, account1, account2, account3, account4;
  let USDC;
  let dispatcher;
  let handlers;
  let handler_addresses;

  function assert_handlers_equal(
    addresses1,
    addresses2,
    proportions1,
    proportions2
  ) {
    let i;

    for (i = 0; i < addresses1.length; i++) {
      // TODO: sort the addresses
      //assert.equal(addresses1[i], addresses2[i]);
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

    handlers = new Array();
    handler_addresses = new Array();
    for (i = 0; i < handler_num; i++) {
      let h = await InternalHandler.new();
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

    it("Should failed when length does not match", async function () {
      let proportions = [1000000];

      await truffleAssert.reverts(
        resetContracts(2, proportions),
        "setHandler: array parameters mismatch"
      );
    });
  });

  describe("updateProportion", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should update proportion", async function () {
      let proportions = [500000, 500000, 0, 0, 0];

      await dispatcher.updatePropotion(handler_addresses, proportions);

      let {0: h, 1: p} = await dispatcher.getHandler();
      assert_handlers_equal(
        h,
        handler_addresses,
        p.map((p) => p.toNumber()),
        proportions
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

    it("Should add handler", async function () {});
  });

  describe("resetHandler", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should reset handler", async function () {});
  });

  describe("updateDefaultHandler", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should update default handler", async function () {});
  });

  describe("getHandler", function () {
    let proportions = [1000000, 0, 0, 0, 0];
    beforeEach(async function () {
      await resetContracts(5, proportions);
    });

    it("Should get Handler", async function () {
      let {0: h, 1: p} = await dispatcher.getHandler();
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
      let {0: h, 1: p} = await dispatcher.getDepositStrategy(10000000);
    });
  });

  describe("getWithdrawStrategy", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get withdraw strategy", async function () {
      let {0: h, 1: p} = await dispatcher.getWithdrawStrategy(
        USDC.address,
        10000000
      );
    });
  });

  describe("getRedeemStrategy", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get redeem strategy", async function () {
      let {0: h, 1: p} = await dispatcher.getRedeemStrategy(
        USDC.address,
        10000000
      );
    });
  });

  describe("getRealAmount", function () {
    beforeEach(async function () {
      let proportions = [1000000, 0, 0, 0, 0];
      await resetContracts(5, proportions);
    });

    it("Should get real amount", async function () {
      let amount = await dispatcher.getRealAmount(100);
    });
  });
});
