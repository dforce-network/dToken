const DForceLendingHandler = artifacts.require("DForceLendingHandler");
const IHandlerView = artifacts.require("IHandlerView");
const iToken = artifacts.require("iTokenMock");
const Controller = artifacts.require("Controller");
const RewardDistributor = artifacts.require("RewardDistributor");
const FiatToken = artifacts.require("FiatTokenV1");
const TestERC20 = artifacts.require("TestERC20");
const RewardToken = artifacts.require("DSToken");
const DTokenController = artifacts.require("DTokenController");

const truffleAssert = require("truffle-assertions");
const Waffle = require("ethereum-waffle");
const BN = require("bn.js");

const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));
const BASE = new BN(10).pow(new BN(18));
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

describe("DForceLendingHandlerMock contract", function () {
  let owner, account1, account2, account3, account4;
  let DForceController, DForceRewardDistributor;
  let USDC, iUSDC, ERC20, iERC20, ERC20E, iERC20E, DF;
  let handler, handler_view;
  let dtoken_controller;
  let dUSDC_address = "0x0000000000000000000000000000000000000001";
  let dERC20_address = "0x0000000000000000000000000000000000000002";
  let dERC20E_address = "0x0000000000000000000000000000000000000003";

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
    // Mock DF, can return boolean value
    DF = await RewardToken.new("DF");
    dtoken_controller = await DTokenController.new();
    handler = await DForceLendingHandler.new(
      dtoken_controller.address,
      DF.address
    );
    handler_view = await IHandlerView.at(handler.address);

    // Mock Controller and RewardDistributor
    DForceRewardDistributor = await RewardDistributor.new(DF.address);
    DForceController = await Controller.new(DForceRewardDistributor.address);

    // Mock USDC
    USDC = await FiatToken.new("USDC", "USDC", "USD", 6, owner, owner, owner);
    iUSDC = await iToken.new("iUSDC", "iUSDC", DForceController.address, USDC.address);

    // Mock TestERC20, can return boolean value
    ERC20 = await TestERC20.new("ERC20", "ERC20", 18);
    iERC20 = await iToken.new("iERC20", "iERC20", DForceController.address, ERC20.address);

    // Mock TestERC20 and Mock iToken, can return error when calling DForceLending
    ERC20E = await TestERC20.new("ERC20E", "ERC20E", 18);
    let user = await ethers.provider.getSigner();
    iERC20E = await Waffle.deployMockContract(user, iToken.abi);

    await handler.enableTokens([USDC.address, ERC20.address, ERC20E.address]);
    await handler.setiTokensRelation(
      [USDC.address, ERC20.address, ERC20E.address],
      [iUSDC.address, iERC20.address, iERC20E.address]
    );

    await dtoken_controller.setdTokensRelation(
      [USDC.address, ERC20.address, ERC20E.address],
      [dUSDC_address, dERC20_address, dERC20E_address]
    );

    await handler.approve(USDC.address, UINT256_MAX);
    await handler.approve(ERC20.address, UINT256_MAX);
    await handler.approve(ERC20E.address, UINT256_MAX);
  }

  describe("Deployment", function () {
    it("Should deployed and only initialized once", async function () {
      await resetContracts();

      await truffleAssert.reverts(
        handler.initialize(dtoken_controller.address, DF.address, {
          from: owner,
        }),
        "initialize: Already initialized!"
      );
    });
  });

  describe("setiTokensRelation", function () {
    it("Should only allow auth to set cTokens Relation", async function () {
      await handler.setiTokensRelation([USDC.address], [iUSDC.address]);

      await truffleAssert.reverts(
        handler.setiTokensRelation([USDC.address], [iUSDC.address], {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not allow set cTokens Relation with the different length", async function () {
      await truffleAssert.reverts(
        handler.setiTokensRelation(
          [USDC.address],
          [iUSDC.address, iUSDC.address]
        ),
        "setTokensRelation: Array length do not match!"
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

  describe("approve", async function () {
    before(async function () {
      await resetContracts();
    });

    it("Should only allow auth to approve", async function () {
      await handler.approve(USDC.address, UINT256_MAX);
      let allowance = await USDC.allowance(handler.address, dUSDC_address);
      assert.equal(allowance.eq(UINT256_MAX), true);

      await truffleAssert.reverts(
        handler.approve(USDC.address, UINT256_MAX, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );

      // Approve again should be ok
      await handler.approve(USDC.address, UINT256_MAX);
    });

    it("Should fail if underlying approve failed", async function () {
      // Already approved when setting up
      // ERC20 does not allow approve again
      await truffleAssert.reverts(
        handler.approve(ERC20.address, UINT256_MAX),
        "approve: Approve cToken failed!"
      );
    });
  });

  describe("deposit", function () {
    before(async function () {
      await resetContracts();
      await handler.approve(USDC.address, UINT256_MAX);
    });

    it("Should only allow auth to deposit", async function () {
      let amount = await handler.deposit(USDC.address, 1000e6);

      //TODO: Check return value from transaction
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
        handler.deposit(dUSDC_address, 1000e6),
        "deposit: Token is disabled!"
      );
    });

    it("Should not deposit when paused", async function () {
      await handler.pause();
      await truffleAssert.reverts(
        handler.deposit(USDC.address, 1000e6),
        "whenNotPaused: paused"
      );

      await handler.unpause();
    });

    it("Should not deposit 0 amount", async function () {
      await truffleAssert.reverts(
        handler.deposit(USDC.address, 0),
        "deposit: Deposit amount should be greater than 0!"
      );
    });

    it("Should not deposit if the underlying token has no corresponding iToken", async function () {
      // Unset the iUSDC
      await handler.setiTokensRelation([USDC.address], [ZERO_ADDR]);
      await truffleAssert.reverts(
        handler.deposit(USDC.address, 1000e6),
        "deposit: Do not support token!"
      );

      // Restore it back
      await handler.setiTokensRelation([USDC.address], [iUSDC.address]);
    });

    it("Should deposit all balance regardless of amount", async function () {
      await USDC.allocateTo(handler.address, 1000e6);
      await handler.deposit(USDC.address, 1e6);

      let balance = await USDC.balanceOf(USDC.address);
      assert.equal(balance.toString(), 0);
    });

    it("Check the actual deposit amount with interest and changing exchange rate", async function () {
      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        let amount = new BN(123456789);
        await USDC.allocateTo(handler.address, amount);

        // Mock some interest, so the exchange rate would change
        await iUSDC.updateExchangeRate(BASE.div(new BN(3)));

        let exchangeRate = await iUSDC.exchangeRate();
        console.log("      Exchange rate: " + exchangeRate);

        // Get the underlying token balance in DForceLending
        let balanceBefore = await handler.getBalance(USDC.address);
        let underlyingBalanceB = await USDC.balanceOf(handler.address);

        await handler.deposit(USDC.address, amount);

        let balanceAfter = await handler.getBalance(USDC.address);
        let underlyingBalanceA = await USDC.balanceOf(handler.address);

        let changed = balanceAfter.sub(balanceBefore);
        let underlyingChanged = underlyingBalanceB.sub(underlyingBalanceA);

        //console.log(changed.toString(), underlyingChanged.toString());
        // assert.equal(changed.toString(), underlyingChanged.toString());

        // The diff could be 1 due to accuracy loss
        let diff = changed.sub(underlyingChanged).abs();
        assert.equal(diff.lte(new BN(1)), true);
      }
    });

    it("Should check the mint result from DForceLending", async function () {
      // Prepare the mock error
      await iERC20E.mock.mint.reverts();
      await iERC20E.mock.balanceOfUnderlying.returns(0);

      await ERC20E.allocateTo(handler.address, 1000e6);
      await truffleAssert.reverts(
        handler.deposit(ERC20E.address, 1000e6),
        "revert Mock revert"
      );
    });
  });

  describe("withdraw", function () {
    beforeEach(async function () {
      await resetContracts();
      await USDC.allocateTo(handler.address, 100000e6);
      await handler.deposit(USDC.address, 10000e6);
    });

    it("Should only allow auth to withdraw", async function () {
      let amount = await handler.withdraw(USDC.address, 10000e6);

      await truffleAssert.reverts(
        handler.withdraw(USDC.address, 1000e6, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not withdraw with disabled token", async function () {
      await truffleAssert.reverts(
        handler.withdraw(dUSDC_address, 1000e6),
        "withdraw: Do not support token!"
      );
    });

    it("Should not withdraw when paused", async function () {
      await handler.pause();
      await truffleAssert.reverts(
        handler.withdraw(USDC.address, 1000e6),
        "whenNotPaused: paused"
      );
    });

    it("Should not withdraw 0 amount", async function () {
      await truffleAssert.reverts(
        handler.withdraw(USDC.address, 0),
        "withdraw: Withdraw amount should be greater than 0!"
      );
    });

    it("Should not withdraw if the underlying token has no corresponding iToken", async function () {
      // Unset the iUSDC
      await handler.setiTokensRelation([USDC.address], [ZERO_ADDR]);
      await truffleAssert.reverts(
        handler.withdraw(USDC.address, 1000e6),
        "withdraw: Do not support token!"
      );

      // Restore it back
      await handler.setiTokensRelation([USDC.address], [iUSDC.address]);
    });

    it("Check the actual withdraw amount with some interest and changing exchange rate", async function () {
      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        // Mock some interest, so the exchange rate would change
        await iUSDC.updateExchangeRate(BASE.div(new BN(3)));

        let amount = new BN(123456789);
        await USDC.allocateTo(handler.address, amount);

        let exchangeRate = await iUSDC.exchangeRate();
        console.log("      Exchange rate: " + exchangeRate);

        // Get the underlying token balance in DForceLending
        let balanceBefore = await handler.getBalance(USDC.address);
        let underlyingBalanceB = await USDC.balanceOf(handler.address);

        await handler.withdraw(USDC.address, amount);

        let balanceAfter = await handler.getBalance(USDC.address);
        let underlyingBalanceA = await USDC.balanceOf(handler.address);

        let changed = balanceBefore.sub(balanceAfter);
        let underlyingChanged = underlyingBalanceA.sub(underlyingBalanceB);

        //console.log(changed.toString(), underlyingChanged.toString());
        //assert.equal(changed.toString(), underlyingChanged.toString());

        // The diff could be 1 due to accuracy loss
        let diff = changed.sub(underlyingChanged).abs();
        assert.equal(diff.lte(new BN(1)), true);
      }
    });

    it("Should check the withdraw result from DForceLending", async function () {
      // Prepare the mock error
      await iERC20E.mock.redeemUnderlying.reverts();
      await iERC20E.mock.balanceOfUnderlying.returns(1000e6);

      await truffleAssert.reverts(
        handler.withdraw(ERC20E.address, 1000e6),
        "revert Mock revert"
      );

      // For withdraw all
      await iERC20E.mock.balanceOf.returns(1000e6);
      await iERC20E.mock.redeem.reverts();
      await truffleAssert.reverts(
        handler.withdraw(ERC20E.address, UINT256_MAX),
        "revert Mock revert"
      );
    });
  });

  describe("getBalance", function () {
    beforeEach(async function () {
      await resetContracts();
      await USDC.allocateTo(handler.address, 100000e6, {
        from: owner,
      });
      await handler.deposit(USDC.address, 100000e6);
    });

    it("Should get some balance", async function () {
      let balance = await handler.getBalance(USDC.address);
      assert.equal(balance.toString(), 100000e6);
    });
  });

  describe("getLiquidity", function () {
    beforeEach(async function () {
      await resetContracts();
      await USDC.allocateTo(handler.address, 100000e6, {
        from: owner,
      });
    });

    it("Should get 0 as initial liquidity", async function () {
      let liquidity = await handler.getLiquidity(USDC.address);
      assert.equal(liquidity.toString(), 0);
    });

    it("Should get some liquidity", async function () {
      await handler.deposit(USDC.address, 100000e6);
      let liquidity = await handler.getLiquidity(USDC.address);
      assert.equal(liquidity.toString(), 100000e6);
    });
  });

  describe("getRealBalance", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should get some real balance", async function () {
      await USDC.allocateTo(handler.address, 1000e6, {
        from: owner,
      });
      await handler.deposit(USDC.address, 1000e6);
      let real_balance = await handler_view.getRealBalance(USDC.address);

      assert.equal(real_balance.toString(), 1000e6);
    });
  });

  describe("getRealLiquidity", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should get some real liquidity", async function () {
      await USDC.allocateTo(handler.address, 1000e6, {
        from: owner,
      });
      await handler.deposit(USDC.address, 1000e6);
      let real_liquidity = await handler_view.getRealLiquidity(USDC.address);

      assert.equal(real_liquidity.toString(), 1000e6);
    });
  });
});
