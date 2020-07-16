const FiatToken = artifacts.require("FiatTokenV1");
const LendingPoolCore = artifacts.require("AaveLendingPoolCoreMock");
const LendPool = artifacts.require("AaveLendPoolMock");
const aTokenMock = artifacts.require("aTokenMock");
const AaveHandler = artifacts.require("AaveHandler");
const DTokenController = artifacts.require("DTokenController");
const Dispatcher = artifacts.require("Dispatcher");
const DToken = artifacts.require("DToken");

const BN = require("bn.js");
const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));

describe("Aave handler contract", function () {
  let accounts;
  let usdc;
  let aUSDC, dUSDC, dispatcher;
  let lendingPoolCore;
  let lendingPool;
  let aaveHandler;
  let dTokenController;

  before(async function () {
    // Gets accounts
    accounts = await web3.eth.getAccounts();

    // Deploys underlying assets
    usdc = await FiatToken.new(
      "USDC", // _name
      "USDC", // _symbol
      "USD", // _currency
      6, // _decimals
      accounts[0], // _masterMinter
      accounts[1], // _pauser
      accounts[0] // _blacklister
    );

    // Deploys dToken mapping contract
    dTokenController = await DTokenController.new();

    // Deploys Aave system
    lendingPoolCore = await LendingPoolCore.new();
    aUSDC = await aTokenMock.new(
      "aUSDC",
      "aUSDC",
      usdc.address,
      lendingPoolCore.address
    );
    await lendingPoolCore.setReserveATokenAddress(usdc.address, aUSDC.address);
    lendingPool = await LendPool.new(lendingPoolCore.address);
    aaveHandler = await AaveHandler.new(
      dTokenController.address,
      lendingPool.address,
      lendingPoolCore.address
    );

    dispatcher = await Dispatcher.new([aaveHandler.address], [1000000]);
    dUSDC = await DToken.new(
      "dUSDC",
      "dUSDC",
      usdc.address,
      dispatcher.address
    );

    // Faucets assets:
    console.log(
      "Before faucet, usdc balance: ",
      (await usdc.balanceOf(accounts[0])).toString()
    );
    await usdc.allocateTo(accounts[0], 1000e6);
    await usdc.allocateTo(aUSDC.address, 10000e6);
    console.log(
      "After  faucet, usdc balance: ",
      (await usdc.balanceOf(accounts[0])).toString()
    );
  });

  describe("Deployment", function () {
    it("Deploy aave handler contract", async function () {
      console.log(
        "before enable usdc, aave handler supports it: ",
        await aaveHandler.tokenIsEnabled(usdc.address)
      );
      await aaveHandler.enableTokens([usdc.address]);
      console.log(
        "after enable usdc, aave handler supports it: ",
        await aaveHandler.tokenIsEnabled(usdc.address)
      );

      await dTokenController.setdTokensRelation(
        [usdc.address],
        [dUSDC.address]
      );

      await aaveHandler.approve(usdc.address, UINT256_MAX);

      await usdc.allocateTo(aaveHandler.address, 1000e6);
      console.log(
        "before deposit, aave handler usdc balance is: ",
        (await usdc.balanceOf(aaveHandler.address)).toString()
      );
      console.log(
        "before deposit, aave handler aUSDC balance is: ",
        (await aUSDC.balanceOf(aaveHandler.address)).toString()
      );

      await aaveHandler.deposit(usdc.address, 100);

      console.log(
        "after deposit, aave handler usdc balance is: ",
        (await usdc.balanceOf(aaveHandler.address)).toString()
      );
      console.log(
        "after deposit, aave handler aUSDC balance is: ",
        (await aUSDC.balanceOf(aaveHandler.address)).toString()
      );

      console.log(
        "before withdraw, aave handler usdc balance is: ",
        (await usdc.balanceOf(aaveHandler.address)).toString()
      );
      console.log(
        "before withdraw, aave handler aUSDC balance is: ",
        (await aUSDC.balanceOf(aaveHandler.address)).toString()
      );
      await aaveHandler.withdraw(usdc.address, 10);
      console.log(
        "after withdraw, aave handler usdc balance is: ",
        (await usdc.balanceOf(aaveHandler.address)).toString()
      );
      console.log(
        "after withdraw, aave handler aUSDC balance is: ",
        (await aUSDC.balanceOf(aaveHandler.address)).toString()
      );
    });
  });
});
