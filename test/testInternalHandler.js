const InternalHandler = artifacts.require("InternalHandler");
const FiatToken = artifacts.require("FiatTokenV1");
const DTokenController = artifacts.require("DTokenController");
const truffleAssert = require("truffle-assertions");
const BN = require("bn.js");
const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));

describe("InternalHandler contract", function () {
  let owner, account1, account2, account3, account4;
  let USDC;
  let handler;
  let dtoken_controller;
  let mock_dtoken = "0x0000000000000000000000000000000000000001";

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
    dtoken_controller = await DTokenController.new();
    handler = await InternalHandler.new(dtoken_controller.address);
    USDC = await FiatToken.new("USDC", "USDC", "USD", 6, owner, owner, owner, {
      from: owner,
    });
    await USDC.allocateTo(handler.address, 1000e6, {
      from: owner,
    });

    await dtoken_controller.setdTokensRelation([USDC.address], [mock_dtoken]);
    await handler.enableTokens([USDC.address]);
  }

  describe("Deployment", function () {
    it("Should deployed and only initialized once", async function () {
      await resetContracts();

      await truffleAssert.reverts(
        handler.initialize(dtoken_controller.address, {
          from: owner,
        }),
        "initialize: Already initialized!"
      );
    });
  });

  describe("setDTokenController", function () {
    it("Should only allow auth to set dTokenController", async function () {
      let new_dtoken_addresses = await DTokenController.new();
      await handler.setDTokenController(new_dtoken_addresses.address);

      await truffleAssert.reverts(
        handler.setDTokenController(new_dtoken_addresses.address, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not allow set dTokenController with the same address", async function () {
      await truffleAssert.reverts(
        handler.setDTokenController(await handler.dTokenController()),
        "setDTokenController: The same dToken mapping contract address!"
      );
    });
  });

  describe("disableToken/enableToken", function () {
    before(async function () {
      await resetContracts();
    });

    it("Should only allow auth to disable token", async function () {
      await handler.disableTokens([USDC.address]);
      assert.equal(await handler.tokenIsEnabled(USDC.address), false);

      await truffleAssert.reverts(
        handler.disableTokens([USDC.address], {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not allow to disable token already disabled", async function () {
      await truffleAssert.reverts(
        handler.disableTokens([USDC.address]),
        "disableToken: Has been disabled!"
      );
    });

    it("Should only allow auth to enable token", async function () {
      await handler.enableTokens([USDC.address]);
      assert.equal(await handler.tokenIsEnabled(USDC.address), true);

      await truffleAssert.reverts(
        handler.enableTokens([USDC.address], {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not allow to enable token already enabled", async function () {
      await truffleAssert.reverts(
        handler.enableTokens([USDC.address]),
        "enableToken: Has been enabled!"
      );
    });
  });

  describe("approve", function () {
    before(async function () {
      await resetContracts();
    });

    it("Should only allow auth to approve", async function () {
      await handler.approve(USDC.address);
      let allowance = await USDC.allowance(handler.address, mock_dtoken);
      assert.equal(allowance.eq(UINT256_MAX), true);

      await truffleAssert.reverts(
        handler.approve(USDC.address, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );

      // Approve again should do nothing
      await handler.approve(USDC.address);
    });
  });

  describe("deposit", function () {
    before(async function () {
      await resetContracts();
    });

    it("Should only allow auth to deposit", async function () {
      let amount = await handler.deposit(USDC.address, 1000e6);

      //TODO: Check returen value from transaction
      //console.log(JSON.stringify(amount));
      //assert.equal(amount.eq(new BN(1000e6)), true);

      await truffleAssert.reverts(
        handler.deposit(USDC.address, 1000e6, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not deposit with disabled token", async function () {
      await truffleAssert.reverts(
        handler.deposit(mock_dtoken, 1000e6),
        "deposit: Token is disabled!"
      );
    });

    it("Should not deposit when paused", async function () {
      await handler.pause();
      await truffleAssert.reverts(
        handler.deposit(USDC.address, 1000e6),
        "whenNotPaused: paused"
      );
    });

    it("!! TODO: Should not be able to reenter", async function () {});
  });

  describe("withdraw", function () {
    before(async function () {
      await resetContracts();
      await handler.deposit(USDC.address, 1000e6);
    });

    it("Should only allow auth to withdraw", async function () {
      // The internal handler will do nothing
      await handler.withdraw(USDC.address, 100e6);

      await truffleAssert.reverts(
        handler.withdraw(USDC.address, 1000e6, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not withdraw when paused", async function () {
      await handler.pause();
      await truffleAssert.reverts(
        handler.withdraw(USDC.address, 1000e6),
        "whenNotPaused: paused"
      );

      await handler.unpause();
    });

    it("Should be able to withdraw all", async function () {
      // The internal handler just do nothing
      await handler.withdraw(USDC.address, UINT256_MAX);
    });
  });

  describe("getBalance", function () {
    beforeEach(async function () {
      await resetContracts();
      await handler.deposit(USDC.address, 1000e6);
    });

    it("Should get some balance", async function () {
      let balance = await handler.getBalance(USDC.address);
      assert.equal(balance.eq(new BN(1000e6)), true);
    });
  });

  describe("getLiquidity", function () {
    beforeEach(async function () {
      await resetContracts();
      await handler.deposit(USDC.address, 1000e6);
    });

    it("Should get some liquidity", async function () {
      let balance = await handler.getLiquidity(USDC.address);
      assert.equal(balance.eq(new BN(1000e6)), true);
    });
  });

  describe("getRealBalance", function () {
    beforeEach(async function () {
      await resetContracts();
      await handler.deposit(USDC.address, 1000e6);
    });

    it("Should get some real balance", async function () {
      let balance = await handler.getRealBalance(USDC.address);

      //TODO: Check returen value from transaction
      //console.log(JSON.stringify(balance));
      //assert.equal(balance.eq(new BN(1000e6)), true);
    });
  });
});
