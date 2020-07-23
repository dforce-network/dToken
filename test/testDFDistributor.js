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
const DFDistributor = artifacts.require("DFDistributor");

const BN = require("bn.js");
const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));

function expandTo18Decimals(n) {
  return new BN(n).mul(new BN(10).pow(new BN(18)));
}

describe("DF Distributor Contract", function () {
  let owner, account1, account2, account3, account4;
  let USDC, COMP;
  let dispatcher;
  let internal_handler, compound_handler;
  let dtoken_controller;
  let dUSDC;
  let ds_guard;

  let DF;
  let df_distributor;

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

  async function setupDFDistributor() {
    DF = await TetherToken.new("0", "DF", "DF", 18);
    df_distributor = await DFDistributor.new();
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

  it("Should deploy", async function () {
    setupDFDistributor();
  });
});
