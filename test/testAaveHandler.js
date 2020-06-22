const FiatToken = artifacts.require("FiatTokenV1");
const LendingPoolCore = artifacts.require("AaveLendingPoolCoreMock");
const LendPool = artifacts.require("AaveLendPoolMock");
const aTokenMock = artifacts.require("aTokenMock");
const AaveHandler = artifacts.require("AaveHandler");
const dTokenAddresses = artifacts.require("dTokenAddresses");

describe("Aave handler contract", function () {
  let accounts;
  let usdc;
  let aUSDC;
  let lendingPoolCore;
  let lendingPool;
  let aaveHandler;
  let dTokenMappingContract;

  before(async function () {
    // Gets accounts
    accounts = await web3.eth.getAccounts();

    // Deploys underlying assets
    usdc = await FiatToken.new();

    // Deploys dToken mapping contract
    dTokenMappingContract = await dTokenAddresses.new();

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

    // Faucets assets:
    await usdc.initialize(
      "USDC", // _name
      "USDC", // _symbol
      "USD", // _currency
      6, // _decimals
      accounts[0], // _masterMinter
      accounts[1], // _pauser
      accounts[0], // _blacklister
      accounts[0] // _owner
    );
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
      aaveHandler = await AaveHandler.new(
        dTokenMappingContract.address,
        lendingPool.address,
        lendingPoolCore.address
      );
      console.log(
        "before enable usdc, aave handler supports it: ",
        await aaveHandler.tokenIsEnabled(usdc.address)
      );
      await aaveHandler.enableTokens([usdc.address]);
      console.log(
        "after enable usdc, aave handler supports it: ",
        await aaveHandler.tokenIsEnabled(usdc.address)
      );

      await dTokenMappingContract.setdTokensRelation(
        [usdc.address],
        [dUSDC.address]
      );

      await aaveHandler.approve(usdc.address);

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
