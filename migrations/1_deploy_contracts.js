var Migrations = artifacts.require("./Migrations.sol");
var FiatToken = artifacts.require("FiatTokenV1.sol");
var TetherToken = artifacts.require("TetherToken.sol");
var CErc20 = artifacts.require("CErc20.sol");
var AToken = artifacts.require("AToken.sol");
var CompoundHandler = artifacts.require("CompoundHandler.sol");
var AaveHandler = artifacts.require("AaveHandler.sol");
var InternalHandler = artifacts.require("InternalHandler.sol");
var Dispatcher = artifacts.require("Dispatcher.sol");
var DTokenController = artifacts.require("DTokenController.sol");
var DToken = artifacts.require("DToken.sol");
var DSGuard = artifacts.require("DSGuard.sol");
var LendingPoolCore = artifacts.require("LendingPoolCore.sol");
var LendingPool = artifacts.require("LendingPool.sol");
var Proxy = artifacts.require("DTokenProxy.sol");

module.exports = async function (deployer) {
  // Deploys Guard contract
  await deployer.deploy(DSGuard);
  let ds_guard = await DSGuard.deployed();
  // Deploys dToken library contract
  await deployer.deploy(DTokenController);
  let dToken_contract_library = await DTokenController.deployed();
  await dToken_contract_library.setAuthority(ds_guard.address);

  // Compound USDC
  let usdc = await FiatToken.at("0xb7a4F3E9097C08dA09517b5aB877F7a917224ede");
  // Compound cUSDC
  let cUSDC = await CErc20.at("0x4a92E71227D294F041BD82dd8f78591B75140d63");
  // Aave USDT
  let usdt = await TetherToken.at("0x13512979ade267ab5100878e2e0f485b568328a4");
  // Aave aUSDT
  let aUSDT = await AToken.at("0xA01bA9fB493b851F4Ac5093A324CB081A909C34B");

  // Aave lending pool core
  let lendingPoolCore = await LendingPoolCore.at(
    "0x95D1189Ed88B380E319dF73fF00E479fcc4CFa45"
  );
  // Aave lending pool
  let lendingPool = await LendingPool.at(
    "0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c"
  );

  // Deploys Internal contract
  await deployer.deploy(InternalHandler, dToken_contract_library.address);
  let internal_handler = await InternalHandler.deployed();
  await deployer.deploy(Proxy, internal_handler.address);
  let internal_handler_proxy = await Proxy.deployed();
  let internal_proxy = await InternalHandler.at(internal_handler_proxy.address);
  await internal_proxy.initialize(dToken_contract_library.address);
  await internal_proxy.enableTokens([usdc.address, usdt.address]);
  await internal_proxy.setAuthority(ds_guard.address);

  // Deploy Compound handler
  await deployer.deploy(CompoundHandler, dToken_contract_library.address);
  let compound_handler = await CompoundHandler.deployed();
  await deployer.deploy(Proxy, compound_handler.address);
  let compound_handler_proxy = await Proxy.deployed();
  let compound_proxy = await CompoundHandler.at(compound_handler_proxy.address);
  await compound_proxy.initialize(dToken_contract_library.address);
  await compound_proxy.enableTokens([usdc.address]);
  await compound_proxy.setAuthority(ds_guard.address);

  await compound_proxy.setcTokensRelation([usdc.address], [cUSDC.address]);

  // Deploy Aave handler
  await deployer.deploy(
    AaveHandler,
    dToken_contract_library.address,
    lendingPool.address,
    lendingPoolCore.address
  );
  let aave_handler = await AaveHandler.deployed();
  await deployer.deploy(Proxy, aave_handler.address);
  let aave_handler_proxy = await Proxy.deployed();
  let aavev_proxy = await AaveHandler.at(aave_handler_proxy.address);
  await aavev_proxy.initialize(
    dToken_contract_library.address,
    lendingPool.address,
    lendingPoolCore.address
  );
  await aavev_proxy.enableTokens([usdt.address]);
  await aavev_proxy.setAuthority(ds_guard.address);

  // Deploys usdc dispatcher
  await deployer.deploy(
    Dispatcher,
    [internal_handler_proxy.address, compound_handler_proxy.address],
    [700000, 300000]
  );
  let usdc_dispatcher = await Dispatcher.deployed();
  await usdc_dispatcher.setAuthority(ds_guard.address);

  // Deploys dUSDC
  await deployer.deploy(
    DToken,
    "dUSDC",
    "dUSDC",
    usdc.address,
    usdc_dispatcher.address
  );
  let dUSDC = await DToken.deployed();
  await deployer.deploy(Proxy, dUSDC.address);
  let dUSDC_token_proxy = await Proxy.deployed();
  let dUSDC_proxy = await DToken.at(dUSDC_token_proxy.address);
  await dUSDC_proxy.initialize(
    "dUSDC",
    "dUSDC",
    usdc.address,
    usdc_dispatcher.address
  );
  await dUSDC_proxy.setAuthority(ds_guard.address);
  await ds_guard.permitx(dUSDC_proxy.address, internal_handler_proxy.address);
  await ds_guard.permitx(dUSDC_proxy.address, compound_handler_proxy.address);

  // Deploys usdt dispatcher
  await deployer.deploy(
    Dispatcher,
    [internal_handler_proxy.address, aave_handler_proxy.address],
    [700000, 300000]
  );
  let usdt_dispatcher = await Dispatcher.deployed();
  await usdt_dispatcher.setAuthority(ds_guard.address);

  // Deploys dUSDT
  await deployer.deploy(
    DToken,
    "dUSDT",
    "dUSDT",
    usdt.address,
    usdt_dispatcher.address
  );
  let dUSDT = await DToken.deployed();
  await deployer.deploy(Proxy, dUSDT.address);
  let dUSDT_token_proxy = await Proxy.deployed();
  let dUSDT_proxy = await DToken.at(dUSDT_token_proxy.address);
  await dUSDT_proxy.initialize(
    "dUSDT",
    "dUSDT",
    usdt.address,
    usdt_dispatcher.address
  );
  await dUSDT_proxy.setAuthority(ds_guard.address);
  await ds_guard.permitx(dUSDT_proxy.address, internal_handler_proxy.address);
  await ds_guard.permitx(dUSDT_proxy.address, aave_handler_proxy.address);

  await dToken_contract_library.setdTokensRelation(
    [usdc.address, usdt.address],
    [dUSDC_proxy.address, dUSDT_proxy.address]
  );

  await internal_proxy.approve(usdc.address);
  await internal_proxy.approve(usdt.address);
  await compound_proxy.approve(usdc.address);
  await aavev_proxy.approve(usdt.address);
};
