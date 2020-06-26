const FiatTokenV1 = artifacts.require("FiatTokenV1");
const TetherToken = artifacts.require("TetherToken");
const CToken = artifacts.require("CErc20");
const AToken = artifacts.require("AToken");
const CompoundHandler = artifacts.require("CompoundHandler");
const AaveHandler = artifacts.require("AaveHandler");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const dTokenAddresses = artifacts.require("dTokenAddresses");
const DToken = artifacts.require("DToken");
const DSGuard = artifacts.require("DSGuard");
const LendingPoolCore = artifacts.require("LendingPoolCore");
const LendingPool = artifacts.require("LendingPool");
const DTokenProxy = artifacts.require("DTokenProxy");

contract("DToken", (accounts) => {
  console.log("all accounts are: ", accounts);
  let owner = accounts[0];
  let usdc, usdt;
  let dsGuard, dTokenContractsLibrary, internalHandler, compoundHandler, aaveHandler;
  let cUSDC, aUSDT;
  let dUSDC, dUSDT;
  before(async () => {
    // DSGuard
    dsGuard = await DSGuard.at("0xB1fe1B1C3F1a50cc4f28C433B4b652f5aD4C139A");
    // dToken address mapping contract
    dTokenContractsLibrary = await dTokenAddresses.at("0x0aA28320e0fF92050052c652a3B1Ab3f63E38647");
    // Compound USDC
    usdc = await FiatTokenV1.at("0xb7a4F3E9097C08dA09517b5aB877F7a917224ede");
    console.log('balance is', (await usdc.balanceOf(owner)).toString());
    // Compound cUSDC
    cUSDC = await CToken.at("0x4a92E71227D294F041BD82dd8f78591B75140d63");
    // dUSDC Token
    dUSDC = await DToken.at("0x3088cF50e1921b0CB17ed1e39f9407C8838973F1");
    // Aave USDT
    usdt = await TetherToken.at("0x13512979ade267ab5100878e2e0f485b568328a4");
    // Aave aUSDT
    aUSDT = await AToken.at("0xA01bA9fB493b851F4Ac5093A324CB081A909C34B");
    // dUSDT Token
    dUSDT = await DToken.at("0x7B061564cf07d40b9d023856Fb72cC64542DB646");
    // Internal handler
    internalHandler = await InternalHandler.at("0xF7b536d927D0d7e271ce07ED34EFCF402143cc8a");
    // Compound handler
    compoundHandler = await CompoundHandler.at("0x7016022576bf78D034400dDf9966E7F3F99e2147");
    // Aave handler
    aaveHandler = await AaveHandler.at("0x2f19Ed333Fc24ceE69AAB8dE8641afE9b121e902");
  })
  console.log('=====owner here', owner)

  it('constructor set a token (DAI) address', async function () {
    // ---------- test deployed contracts ------------
    const previousBalance = await usdc.balanceOf(owner);
    console.log('before faucet, owner usdc balance: ', previousBalance, previousBalance.toString());
    await usdc.allocateTo(owner, 500000000);

    const currentBalance = await usdc.balanceOf(owner);
    console.log('after faucet, owner usdc balance: ', currentBalance, currentBalance.toString());
    await usdc.approve(dUSDC.address, 1000000000);

    const previousDTokenBalance = await dUSDC.balanceOf(owner);
    console.log('before mint, owner dToekn balance: ', previousDTokenBalance, previousDTokenBalance.toString());
    await dUSDC.mint(owner, 50000000);

    const currentDTokenBalance = await dUSDC.balanceOf(owner);
    console.log('after mint, owner dToekn balance: ', currentDTokenBalance, currentDTokenBalance.toString());
    await dUSDC.burn(owner, 20000000);

    await dUSDC.redeem(owner, 30000000);

    const finalDTokenBalance = await dUSDC.balanceOf(owner);
    console.log('fianlly, owner dToken balance: ', finalDTokenBalance, finalDTokenBalance.toString());
    console.log('test done!');
  });
});
