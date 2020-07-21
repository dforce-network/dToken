const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const TetherToken = artifacts.require("TetherToken");
const CTokenMock = artifacts.require("CTokenMock");
const CompoundHandler = artifacts.require("CompoundHandler");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const DTokenController = artifacts.require("DTokenController");
const DToken = artifacts.require("DToken");
const IDToken = artifacts.require("IDToken");
const DSGuard = artifacts.require("DSGuard");

// Use waffle to deploy uniswap contracts
// const { loadFixture, deployContract } = require("ethereum-waffle");
// const UniswapSwapModel = artifacts.require("UniswapSwapModel");
// const WETH = require("@uniswap/v2-periphery/build/WETH9.json");
// const UniswapV2Factory = require("@uniswap/v2-core/build/UniswapV2Factory.json");
// const UniswapV2Pair = require("@uniswap/v2-core/build/UniswapV2Pair.json");
// const UniswapV2Router02 = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");

const UniswapSwapModel = artifacts.require("UniswapSwapModel");
const WETH = artifacts.require("WETH9");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Pair = artifacts.require("UniswapV2Pair");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");

const BN = require("bn.js");

const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));

function expandTo18Decimals(n) {
  return new BN(n).mul(new BN(10).pow(new BN(18)));
}

describe("RewardSwapModel Contract (Skipped in coverage)", function () {
  let owner, account1, account2, account3, account4;
  let USDC, COMP;
  let dispatcher;
  let internal_handler, compound_handler;
  let dtoken_controller;
  let dUSDC;
  let ds_guard;
  let swap_model;
  let weth;
  let uniswap_factory, uniswap_pair, uniswap_router;

  async function setupDToken() {
    USDC = await FiatToken.new("USDC", "USDC", "USD", 6, owner, owner, owner, {
      from: owner,
    });

    dtoken_controller = await DTokenController.new();
    ds_guard = await DSGuard.new();

    internal_handler = await InternalHandler.new(dtoken_controller.address);

    cUSDC = await CTokenMock.new("cUSDC", "cUSDC", USDC.address);
    COMP = await TetherToken.new("0", "COMP", "COMP", 18);

    compound_handler = await CompoundHandler.new(
      dtoken_controller.address,
      COMP.address
    );
    await compound_handler.setcTokensRelation([USDC.address], [cUSDC.address]);

    // Use internal handler and compound handler by default
    dispatcher = await Dispatcher.new(
      [internal_handler.address, compound_handler.address],
      [0, 1000000]
    );
    dUSDC = await DToken.new(
      "dUSDC",
      "dUSDC",
      USDC.address,
      dispatcher.address
    );

    await dtoken_controller.setdTokensRelation([USDC.address], [dUSDC.address]);

    await dUSDC.setAuthority(ds_guard.address);
    await dispatcher.setAuthority(ds_guard.address);

    // Initialize all handlers
    let handlers = [internal_handler, compound_handler];
    for (const handler of handlers) {
      await handler.setAuthority(ds_guard.address);
      await handler.approve(USDC.address, UINT256_MAX);
      await ds_guard.permitx(dUSDC.address, handler.address);

      await handler.enableTokens([USDC.address]);
    }

    // Allocate some token to all accounts
    let accounts = [account1, account2, account3, account4];
    for (const account of accounts) {
      await USDC.allocateTo(account, 100000e6);
      await COMP.allocateTo(account, expandTo18Decimals(100000));
      USDC.approve(dUSDC.address, UINT256_MAX, {from: account});
    }

    dUSDC = await IDToken.at(dUSDC.address);
  }

  async function setupUniswapWaffle() {
    const [owner] = waffle.provider.getWallets();

    // Deploy Uniswap contracts and create pairs
    uniswap_factory = await deployContract(owner, UniswapV2Factory);
    await uniswap_factory.deployed();
    await uniswap_factory.createPair(COMP.address, USDC.address);
    let pair = await uniswap_factory.getPair(COMP.address, USDC.address);

    uniswap_pair = await ethers.getContractAt(UniswapV2Pair.abi, pair);
    weth = await deployContract(owner, WETH);
    await weth.deployed();

    uniswap_router = await deployContract(
      owner,
      UniswapV2Router02[(uniswap_factory.address, weth.address)]
    );
    await uniswap_router.deployed();
  }

  async function setupUniswap() {
    uniswap_factory = await UniswapV2Factory.new(owner);

    await uniswap_factory.createPair(COMP.address, USDC.address);
    let pair = await uniswap_factory.getPair(COMP.address, USDC.address);

    uniswap_pair = await UniswapV2Pair.at(pair);
    weth = await WETH.new();

    // Use the last account to deploy router to get a fixed address
    let accounts = await web3.eth.getAccounts();
    let account = accounts[accounts.length - 1];
    uniswap_router = await UniswapV2Router02.new(
      uniswap_factory.address,
      weth.address,
      {from: account}
    );
  }

  async function setupUniswapAndSwapModel() {
    await setupUniswap();
    //await setupUniswapWaffle();

    console.log("\tROUTER:\t", uniswap_router.address);
    console.log("\tCOMP:\t", COMP.address);
    console.log("\tUSDC:\t", USDC.address);
    console.log("\tTOKEN0:\t", await uniswap_pair.token0());

    await COMP.approve(uniswap_router.address, UINT256_MAX, {
      from: account1,
    });
    await USDC.approve(uniswap_router.address, UINT256_MAX, {
      from: account1,
    });

    // Setting up the ratio to COMP:USDC to 1:30
    await uniswap_router.addLiquidity(
      COMP.address,
      USDC.address,
      expandTo18Decimals(1000),
      30000e6,
      0,
      0,
      account1,
      UINT256_MAX,
      {from: account1}
    );

    let swap_amount = expandTo18Decimals(1);
    await COMP.approve(uniswap_router.address, UINT256_MAX, {
      from: account2,
    });

    let comp_before = await COMP.balanceOf(account2);
    let usdc_before = await USDC.balanceOf(account2);
    await uniswap_router.swapExactTokensForTokens(
      swap_amount,
      0,
      [COMP.address, USDC.address],
      account2,
      UINT256_MAX,
      {from: account2}
    );
    let comp_after = await COMP.balanceOf(account2);
    let usdc_after = await USDC.balanceOf(account2);

    console.log(
      "\tSwapped ",
      comp_before
        .sub(comp_after)
        .div(new BN(10).pow(new BN(18)))
        .toString(),
      " COMP for ",
      usdc_after.sub(usdc_before).div(new BN(1e6)).toString(),
      " USDC"
    );

    // Reward Swap Model
    swap_model = await UniswapSwapModel.new();
  }

  before(async function () {
    [
      owner,
      account1,
      account2,
      account3,
      account4,
    ] = await web3.eth.getAccounts();

    await setupDToken();
  });

  it("Should claim some COMP", async function () {
    dUSDC.mint(account1, 1000e6, {from: account1});

    let comp_airdrop = expandTo18Decimals(10);
    await COMP.allocateTo(compound_handler.address, comp_airdrop);
    //console.log((await COMP.balanceOf(compound_handler.address)).toString());

    // mint again to claim comp
    await dUSDC.mint(account1, 10e6, {from: account1});

    let comp_claimed = await COMP.balanceOf(dUSDC.address);

    assert.equal(comp_airdrop.toString(), comp_claimed.toString());
  });

  it("Should deploy UniswapSwapModel (Skipped in coverage)", async function () {
    await setupUniswapAndSwapModel();
  });

  it("Should set the Swap Model (Skipped in coverage)", async function () {
    await dUSDC.setSwapModel(swap_model.address);
    assert.equal((await dUSDC.swapModel()).toString(), swap_model.address);
  });

  it("Can swap some COMP into underlying tokens and put them into internal handler (Skipped in coverage)", async function () {
    let exchange_rate_before = await dUSDC.getExchangeRate();
    let total_before = await dUSDC.getTotalBalance();

    let comp_balance = await COMP.balanceOf(dUSDC.address);
    let tx = await dUSDC.swap(COMP.address, comp_balance);

    let exchange_rate_after = await dUSDC.getExchangeRate();
    let total_after = await dUSDC.getTotalBalance();

    console.log(tx);

    //console.log(tx.receipt.rawLogs);

    let swapped;
    truffleAssert.eventEmitted(tx, "Swap", (ev) => {
      console.log(ev);
      swapped = ev.amountOut;

      console.log(
        "\tSwapped ",
        ev.amountIn.div(new BN(10).pow(new BN(18))).toString(),
        " COMP for ",
        ev.amountOut.div(new BN(1e6)).toString(),
        " USDC"
      );
      return true;
    });

    console.log(
      "\tExchange Rate: \t",
      exchange_rate_before.toString(),
      " to ",
      exchange_rate_after.toString()
    );

    console.log(
      "\tTotal Underlying Balance: \t",
      total_before.toString(),
      " to ",
      total_after.toString()
    );

    assert.equal(total_before.add(swapped).toString(), total_after.toString());
  });
});
