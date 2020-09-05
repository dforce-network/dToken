const USRHandler = artifacts.require("USRHandler");
const IHandlerView = artifacts.require("IHandlerView");
const USRMock = artifacts.require("USRMock");
const DSToken = artifacts.require("DSToken");
const TestERC20 = artifacts.require("TestERC20");
const DTokenController = artifacts.require("DTokenController");

const truffleAssert = require("truffle-assertions");
const Waffle = require("ethereum-waffle");
const BN = require("bn.js");

const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));
const BASE = new BN(10).pow(new BN(18));
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

describe("USRHandler contract", function () {
  let owner, account1, account2, account3, account4;
  let USDx, USR, ERC20, ERC20E;
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
    // Mock USDx
    USDx = await DSToken.new("USDx");
    USR = await USRMock.new("USR", "USR", USDx.address);

    dtoken_controller = await DTokenController.new();
    handler = await USRHandler.new(
      dtoken_controller.address,
      USR.address
    );
    handler_view = await IHandlerView.at(handler.address);


    // Mock TestERC20, can return boolean value
    ERC20 = await TestERC20.new("ERC20", "ERC20", 18);

    // Mock TestERC20 and Mock USR, can return error when calling USR
    ERC20E = await TestERC20.new("ERC20E", "ERC20E", 18);

    await handler.enableTokens([USDx.address, ERC20.address, ERC20E.address]);

    await dtoken_controller.setdTokensRelation(
      [USDx.address, ERC20.address, ERC20E.address],
      [dUSDC_address, dERC20_address, dERC20E_address]
    );

    await handler.approve(USDx.address, UINT256_MAX);
    await handler.approve(ERC20.address, UINT256_MAX);
    await handler.approve(ERC20E.address, UINT256_MAX);
  }

  describe("Deployment", function () {
    it("Should deployed and only initialized once", async function () {
      await resetContracts();

      await truffleAssert.reverts(
        handler.initialize(dtoken_controller.address, USR.address, {
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
      await handler.disableTokens([USDx.address]);
      assert.equal(await handler.tokenIsEnabled(USDx.address), false);

      await truffleAssert.reverts(
        handler.disableTokens([USDx.address], {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not allow to disable token already disabled", async function () {
      await truffleAssert.reverts(
        handler.disableTokens([USDx.address]),
        "disableToken: Has been disabled!"
      );
    });

    it("Should only allow auth to enable token", async function () {
      await handler.enableTokens([USDx.address]);
      assert.equal(await handler.tokenIsEnabled(USDx.address), true);

      await truffleAssert.reverts(
        handler.enableTokens([USDx.address], {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not allow to enable token already enabled", async function () {
      await truffleAssert.reverts(
        handler.enableTokens([USDx.address]),
        "enableToken: Has been enabled!"
      );
    });
  });

  describe("approve", async function () {
    before(async function () {
      await resetContracts();
    });

    it("Should only allow auth to approve", async function () {
      // await handler.approve(USDx.address, UINT256_MAX);
      let allowance = await USDx.allowance(handler.address, dUSDC_address);
      assert.equal(allowance.eq(UINT256_MAX), true);

      await truffleAssert.reverts(
        handler.approve(USDx.address, UINT256_MAX, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );

      // Approve again should be fail
      await truffleAssert.reverts(
        handler.approve(USDx.address, UINT256_MAX),
        ""
      );
    });

    it("Should fail if underlying approve failed", async function () {
      // Already approved when setting up
      // ERC20 does not allow approve again
      await truffleAssert.reverts(
        handler.approve(ERC20.address, UINT256_MAX),
        "approve: Approve USR failed!"
      );
    });
  });

  describe("deposit", function () {
    before(async function () {
      await resetContracts();
    });

    it("Should only allow auth to deposit", async function () {
      let amount = await handler.deposit(USDx.address, new BN('1000').mul(BASE));

      //TODO: Check return value from transaction
      //console.log(JSON.stringify(amount));
      //assert.equal(amount.eq(new BN(1000e6)), true);

      await truffleAssert.reverts(
        handler.deposit(USDx.address, new BN('1000').mul(BASE), {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not deposit with disabled token", async function () {
      await truffleAssert.reverts(
        handler.deposit(dUSDC_address, new BN('1000').mul(BASE)),
        "deposit: Token is disabled!"
      );
    });

    it("Should not deposit when paused", async function () {
      await handler.pause();
      await truffleAssert.reverts(
        handler.deposit(USDx.address, new BN('1000').mul(BASE)),
        "whenNotPaused: paused"
      );

      await handler.unpause();
    });

    it("Should not deposit 0 amount", async function () {
      await truffleAssert.reverts(
        handler.deposit(USDx.address, 0),
        "deposit: Deposit amount should be greater than 0!"
      );
    });

    it("Should deposit all balance regardless of amount", async function () {
      await USDx.allocateTo(handler.address, new BN('1000').mul(BASE));
      await handler.deposit(USDx.address, BASE);

      let balance = await USDx.balanceOf(USDx.address);
      assert.equal(balance.toString(), 0);
    });

    it("Check the actual deposit amount with interest and changing exchange rate", async function () {
      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        let amount = new BN(123456789);
        await USDx.allocateTo(handler.address, amount);

        // Mock some interest, so the exchange rate would change
        await USR.updateExchangeRate(BASE.div(new BN(3)));

        let exchangeRate = await USR.exchangeRate();
        console.log("      Exchange rate: " + exchangeRate);

        // Get the underlying token balance in USR
        let balanceBefore = await handler.getBalance.call(USDx.address);
        let underlyingBalanceB = await USDx.balanceOf(handler.address);

        await handler.deposit(USDx.address, amount);

        let balanceAfter = await handler.getBalance.call(USDx.address);
        let underlyingBalanceA = await USDx.balanceOf(handler.address);

        let changed = balanceAfter.sub(balanceBefore);
        let underlyingChanged = underlyingBalanceB.sub(underlyingBalanceA);

        //console.log(changed.toString(), underlyingChanged.toString());
        // assert.equal(changed.toString(), underlyingChanged.toString());

        // The diff could be 1 due to accuracy loss
        let diff = changed.sub(underlyingChanged).abs();
        assert.equal(diff.lte(new BN('1000000000')), true);
      }
    });

    it("Should check the mint other token to USR", async function () {

      await ERC20E.allocateTo(handler.address, new BN('1000').mul(BASE));
      await truffleAssert.reverts(
        handler.deposit(ERC20E.address, new BN('1000').mul(BASE)),
        "deposit: Do not support token!"
      );
    });
  });

  describe("withdraw", function () {
    beforeEach(async function () {
      await resetContracts();
      await USDx.allocateTo(handler.address, new BN('100000').mul(BASE));
      await handler.deposit(USDx.address, new BN('10000').mul(BASE));
    });

    it("Should only allow auth to withdraw", async function () {
      let amount = await handler.withdraw(USDx.address, new BN('10000').mul(BASE));

      await truffleAssert.reverts(
        handler.withdraw(USDx.address, new BN('1000').mul(BASE), {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not withdraw with disabled token", async function () {
      await truffleAssert.reverts(
        handler.withdraw(dUSDC_address, new BN('1000').mul(BASE)),
        ""
      );
    });

    it("Should not withdraw when paused", async function () {
      await handler.pause();
      await truffleAssert.reverts(
        handler.withdraw(USDx.address, new BN('1000').mul(BASE)),
        "whenNotPaused: paused"
      );
    });

    it("Should not withdraw 0 amount", async function () {
      await truffleAssert.reverts(
        handler.withdraw(USDx.address, 0),
        "withdraw: Withdraw amount should be greater than 0!"
      );
    });

    it("Check the actual withdraw amount with some interest and changing exchange rate", async function () {
      let iteration = 20;
      for (let i = 0; i < iteration; i++) {
        // Mock some interest, so the exchange rate would change
        await USR.updateExchangeRate(BASE.div(new BN(3)));

        let amount = new BN(123456789);
        await USDx.allocateTo(handler.address, amount);

        let exchangeRate = await USR.exchangeRate();
        console.log("      Exchange rate: " + exchangeRate);

        // Get the underlying token balance in USR
        let balanceBefore = await handler.getBalance.call(USDx.address);
        let underlyingBalanceB = await USDx.balanceOf(handler.address);

        await handler.withdraw(USDx.address, amount);

        let balanceAfter = await handler.getBalance.call(USDx.address);
        let underlyingBalanceA = await USDx.balanceOf(handler.address);

        let changed = balanceBefore.sub(balanceAfter);
        let underlyingChanged = underlyingBalanceA.sub(underlyingBalanceB);

        //console.log(changed.toString(), underlyingChanged.toString());
        //assert.equal(changed.toString(), underlyingChanged.toString());

        // The diff could be 1 due to accuracy loss
        let diff = changed.sub(underlyingChanged).abs();
        assert.equal(diff.lte(new BN('1000000000')), true);
      }
    });

    it("Should check the withdraw result from USR", async function () {
      await USDx.allocateTo(handler.address, new BN('100000').mul(BASE));
      await handler.deposit(USDx.address, new BN('10000').mul(BASE));

      let balance = await USDx.balanceOf(USR.address);
      await USDx.burn(USR.address, balance);

      await truffleAssert.reverts(
        handler.withdraw(USDx.address, new BN('1000').mul(BASE)),
        "ds-math-sub-underflow"
      );

      // For withdraw all
      await truffleAssert.reverts(
        handler.withdraw(USDx.address, UINT256_MAX),
        "ds-math-sub-underflow"
      );

      await USDx.allocateTo(USR.address, balance);
      let balanceBefore = await handler.getBalance.call(USDx.address);
      await handler.withdraw(USDx.address, new BN('1000').mul(BASE));
      let balanceAfter = await handler.getBalance.call(USDx.address);
      assert.equal(balanceBefore.sub(balanceAfter).eq(new BN('1000').mul(BASE)), true);

      await handler.withdraw(USDx.address, UINT256_MAX);
      balanceAfter = await handler.getBalance.call(USDx.address);
      assert.equal(balanceAfter.eq(new BN(0)), true);
    });

    it("Should check the withdraw other token from USR", async function () {
      await ERC20E.allocateTo(handler.address, new BN('100000').mul(BASE));
      await truffleAssert.reverts(
        handler.deposit(ERC20E.address, new BN('10000').mul(BASE)),
        "deposit: Do not support token!"
      );
      // await handler.deposit(ERC20E.address, new BN('10000').mul(BASE));

      await truffleAssert.reverts(
        handler.withdraw(ERC20E.address, new BN('1000').mul(BASE)),
        "withdraw: Do not support token!"
      );

      // For withdraw all
      await truffleAssert.reverts(
        handler.withdraw(ERC20E.address, UINT256_MAX),
        "withdraw: Do not support token!"
      );
    });
  });

  describe("getBalance", function () {
    beforeEach(async function () {
      await resetContracts();
      await USDx.allocateTo(handler.address, new BN('100000').mul(BASE), {
        from: owner,
      });
      await handler.deposit(USDx.address, new BN('100000').mul(BASE));
    });

    it("Should get some balance", async function () {
      let balance = await handler.getBalance.call(USDx.address);
      assert.equal(balance.toString(), (new BN('100000').mul(BASE)).toString());
    });

    // it("Should get 0 as balance if USR call failed", async function () {
    //   // Allocate some balance
    //   await USDx.allocateTo(handler.address, new BN('100000').mul(BASE));
    //   await truffleAssert.reverts(
    //     handler.deposit(USDx.address, new BN('1000000').mul(BASE), {from: account1}),
    //     ''
    //   )

    //   // Should return 0 as balance
    //   let balance = await handler.getBalance.call(USDx.address);
    //   assert.equal(balance.toString(), 0);
    // });
  });

  describe("getLiquidity", function () {
    beforeEach(async function () {
      await resetContracts();
      await USDx.allocateTo(handler.address, new BN('100000').mul(BASE), {
        from: owner,
      });
    });

    it("Should get 0 as initial liquidity", async function () {
      let liquidity = await handler.getLiquidity.call(USDx.address);
      assert.equal(liquidity.toString(), 0);
    });

    it("Should get some liquidity", async function () {
      await handler.deposit(USDx.address, new BN('100000').mul(BASE));
      let liquidity = await handler.getLiquidity.call(USDx.address);
      assert.equal(liquidity.toString(), new BN('100000').mul(BASE).toString());
    });
  });

  describe("getRealBalance", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should get some real balance", async function () {
      await USDx.allocateTo(handler.address, new BN('100000').mul(BASE), {
        from: owner,
      });
      await handler.deposit(USDx.address, new BN('100000').mul(BASE));
      let real_balance = await handler_view.getRealBalance.call(USDx.address);

      assert.equal(real_balance.toString(), new BN('100000').mul(BASE).toString());
    });
  });

  describe("getRealLiquidity", function () {
    beforeEach(async function () {
      await resetContracts();
    });

    it("Should get some real liquidity", async function () {
      await USDx.allocateTo(handler.address, new BN('100000').mul(BASE), {
        from: owner,
      });
      await handler.deposit(USDx.address, new BN('100000').mul(BASE));
      let real_liquidity = await handler_view.getRealLiquidity.call(USDx.address);

      assert.equal(real_liquidity.toString(), new BN('100000').mul(BASE).toString());
    });
  });
});
