const USDC = artifacts.require("FiatTokenV1");
const USDT = artifacts.require("TetherToken");
const DAI = artifacts.require("Dai");
const Vat = artifacts.require("Vat");
const Pot = artifacts.require("Pot");
const Jug = artifacts.require("Jug");
const Comptroller = artifacts.require("Comptroller");
const InterestRateModel = artifacts.require("WhitePaperInterestRateModel");
const USDTInterestRateModel = artifacts.require("JumpRateModel");
const DAIInterestRateModel = artifacts.require("DAIInterestRateModelV2");
const cToken = artifacts.require("CErc20");
const cUSDTToken = artifacts.require("CErc20Delegate");

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe("Compound handler contract", function () {
  let accounts;
  let usdc;
  let comptroller;
  let interestRate;
  let cUSDC;

  let usdt;
  let usdtInterestModel;
  let cUSDT;

  let dai;
  let vat;
  let pot;
  let jug;

  before(async function () {
    // Gets accounts
    accounts = await web3.eth.getAccounts();

    // Deploys underlying assets
    usdc = await USDC.new();
    usdt = await USDT.new("100000000000", "USDT", "USDT", 6);
    dai = await DAI.new("7545"); // chainId, 7545 only for test!!!

    // Deploys other contracts for DAI system
    vat = await Vat.new();
    pot = await Pot.new(vat.address);
    jug = await Jug.new(vat.address);

    // Faucets assets:
    await usdc.initialize(
      "USDC",
      "USDC",
      "USD",
      6,
      accounts[0],
      accounts[1],
      accounts[0],
      accounts[0]
    );
    console.log(
      "Before faucet, usdc balance: ",
      (await usdc.balanceOf(accounts[0])).toString()
    );
    console.log(
      "Before faucet, usdt balance: ",
      (await usdt.balances(accounts[0])).toString()
    );
    console.log(
      "Before faucet, dai balance: ",
      (await dai.balanceOf(accounts[0])).toString()
    );
    await usdc.allocateTo(accounts[0], 1000e6);
    await usdt.allocateTo(accounts[0], 1000e6);
    await dai.allocateTo(accounts[0], "1000000000000000000000"); // 1000e18
    console.log(
      "After  faucet, usdc balance: ",
      (await usdc.balanceOf(accounts[0])).toString()
    );
    console.log(
      "After  faucet, usdt balance: ",
      (await usdt.balances(accounts[0])).toString()
    );
    console.log(
      "After  faucet, dai balance: ",
      (await dai.balanceOf(accounts[0])).toString()
    );

    // Deploys comptroller for cToken contract
    comptroller = await Comptroller.new();

    // Deploys interest rate model for cToken contract
    interestRate = await InterestRateModel.new(
      "20000000000000000",
      "100000000000000000"
    ); // 0.02, 0.1

    usdtInterestModel = await USDTInterestRateModel.new(
      "9512937595",
      "95129375951",
      "951293759512",
      "900000000000000000"
    ); // 0.9(UR)
    // TODO: Maybe need authority to call Pot.pot()
    // daiInterestModel = await DAIInterestRateModel.new("1200000000000000000", "900000000000000000", pot.address, jug.address);

    // Deploys cToken:
    let initialExchangeRateMantissa = "200000000000000"; // 0.0002
    let cUSDTInitialExchangeRateMantissa = "200452718278656";
    cUSDC = await cToken.new(
      usdc.address,
      comptroller.address,
      interestRate.address,
      cUSDTInitialExchangeRateMantissa,
      "cUSDC",
      "cUSDC",
      8
    );

    cUSDT = await cUSDTToken.new();
    cUSDT.initialize(
      usdt.address,
      comptroller.address,
      usdtInterestModel.address,
      initialExchangeRateMantissa,
      "cUSDT",
      "cUSDT",
      8
    );
  });

  describe("Deployment", function () {
    it("Deploy USDC contract", async function () {
      // Do something
    });
  });
});
