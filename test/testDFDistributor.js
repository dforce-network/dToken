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
      await USDC.approve(dUSDC.address, UINT256_MAX, {from: account});
    }

    dUSDC = await IDToken.at(dUSDC.address);
  }

  async function setupDFDistributor() {
    DF = await TetherToken.new("0", "DF", "DF", 18);
    console.log("\t DF: ", DF.address);

    df_distributor = await DFDistributor.new();

    await DF.allocateTo(df_distributor.address, expandTo18Decimals(1e9));
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

  describe("Deployment", function () {
    it("Should deploy", async function () {
      await setupDFDistributor();
    });
  });

  describe("Add DTokens", function () {
    it("Should add some dToken into distribution", async function () {
      await df_distributor.addDTokens([dUSDC.address]);

      let dToken = await df_distributor.dTokens(0);
      assert.equal(dToken, dUSDC.address);
    });
  });

  describe("set DToken DFDistributor", function () {
    it("Should set DToken DF Distributor", async function () {
      await dUSDC.setDFDistributor(df_distributor.address);

      let distributor = await dUSDC.dfDistributor();
      assert.equal(distributor, df_distributor.address);
    });
  });

  describe("Set total distribution speed", function () {
    it("Should set total speed", async function () {
      let speed = expandTo18Decimals(10);
      await df_distributor.setTotalSpeed(speed);

      let token_speed = await df_distributor.tokenSpeed(dUSDC.address);
      assert.equal(speed.toString(), token_speed.toString());
    });

    it("Should claim some DF according to global speed", async function () {
      let tx1 = await dUSDC.mint(account1, 10000e6, {from: account1});
      let tx2 = await dUSDC.mint(account2, 10000e6, {from: account2});

      await df_distributor.claimDF(dUSDC.address, account1);
      await df_distributor.claimDF(dUSDC.address, account2);

      let tx3 = await df_distributor.claimDF(dUSDC.address, account1);
      let tx4 = await df_distributor.claimDF(dUSDC.address, account2);

      let df_claimed1 = await DF.balanceOf(account1);
      let df_claimed2 = await DF.balanceOf(account2);

      console.log(
        "\tAfter ",
        tx3.receipt.blockNumber - tx1.receipt.blockNumber,
        " blocks, claimed ",
        df_claimed1.div(expandTo18Decimals(1)).toString()
      );
      console.log(
        "\tAfter ",
        tx4.receipt.blockNumber - tx2.receipt.blockNumber,
        " blocks, claimed ",
        df_claimed2.div(expandTo18Decimals(1)).toString()
      );
    });
  });

  describe("Set distribution speed respectively", function () {
    it("Should update DToken speed", async function () {});
  });
});
