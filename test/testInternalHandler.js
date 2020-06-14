const InternalHandler = artifacts.require("InternalHandler");
const FiatToken = artifacts.require("FiatTokenV1");
const truffleAssert = require("truffle-assertions");
const BN = web3.utils.BN;

describe("InternalHandler contract", function () {
  let owner, account1, account2, account3, account4;
  let USDC;
  let handler;

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
    handler = await InternalHandler.new();
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
    await USDC.allocateTo(handler.address, 1000e6, {
      from: owner,
    });
  }

  describe("Deployment", function () {
    it("Should deployed", async function () {
      await resetContracts();
    });

    it("Should not be initialized again", async function () {
      await truffleAssert.reverts(
        handler.initialize({
          from: owner,
        }),
        "initialize: Already initialized!"
      );
    });
  });

  describe("Supply", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should supply", async function () {
      await handler.supply(USDC.address, {
        from: owner,
      });
    });

    it("Should not supply with non-auth", async function () {
      await truffleAssert.reverts(
        handler.supply(USDC.address, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });
  });

  describe("withdrawTo", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should withdraw", async function () {
      await handler.withdrawTo(USDC.address, account1, 100e6, {
        from: owner,
      });
      assert.equal(await USDC.balanceOf(account1), 100e6);
    });

    it("Should withdraw all ", async function () {
      await handler.withdrawTo(USDC.address, account1, -1, {from: owner});
      assert.equal(
        (await USDC.balanceOf(account1)).toString(),
        new BN(1000e6).toString()
      );
    });
  });

  describe("removeReserve", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should remove reserve", async function () {
      await handler.removeReserve(USDC.address, account1, 1000e6, {
        from: owner,
      });
      assert.equal(await USDC.balanceOf(account1), 1000e6);
    });
  });

  // approve() needs interact with dToken contract
  describe("approve", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should approve", async function () {
      await handler.approve(USDC.address, account1, {
        from: owner,
      });
    });
  });

  describe("deposit", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should deposit", async function () {
      await handler.enableToken(USDC.address, {
        from: owner,
      });
      await handler.deposit(USDC.address, {
        from: owner,
      });
    });

    it("Should not deposit when paused", async function () {
      await handler.enableToken(USDC.address, {from: owner});
      await handler.pause({from: owner});
      await truffleAssert.reverts(
        handler.deposit(USDC.address, {from: owner}),
        "whenNotPaused: paused"
      );
    });
  });

  describe("withdraw", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should withdraw", async function () {
      await handler.withdraw(USDC.address, 1000e6, {
        from: owner,
      });
    });
  });

  describe("redeem", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should redeem", async function () {
      await handler.redeem(USDC.address, 1000e6, {
        from: owner,
      });
    });
  });

  describe("getBalance", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should have some balance by default", async function () {
      let balance = await handler.getBalance(USDC.address);
      assert.equal(balance.toString(), new BN(1000e6).toString());
    });
  });

  describe("getInterestRate", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should have default InterestRate as 0", async function () {
      let ir = await handler.getInterestRate(USDC.address, {
        from: owner,
      });
      assert.equal(ir, 0);
    });
  });
});
