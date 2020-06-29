const truffleAssert = require("truffle-assertions");
const DTokenController = artifacts.require("DTokenController");

const MOCK_TOKEN = "0x0000000000000000000000000000000000000001";
const MOCK_DTOKEN = "0x0000000000000000000000000000000000000002";
const MOCK_DTOKEN_NEW = "0x0000000000000000000000000000000000000003";
const UNKNOWN_TOKEN = "0x0000000000000000000000000000000000000004";

describe("DTokenController Contract", function () {
  let dtoken_controller;
  let owner, account1, account2, account3, account4;

  before(async function () {
    [
      owner,
      account1,
      account2,
      account3,
      account4,
    ] = await web3.eth.getAccounts();
  });

  async function resetContracts(handler_num, proportions) {
    dtoken_controller = await DTokenController.new();
  }

  describe("Deployment", function () {
    it("Should deployed and only initialized once", async function () {
      await resetContracts();

      await truffleAssert.reverts(
        dtoken_controller.initialize(),
        "initialize: Already initialized!"
      );
    });
  });

  describe("setdTokensRelation", function () {
    it("Should allow only owner to set dTokenController relation", async function () {
      let tokens = [MOCK_TOKEN];
      let dTokenController = [MOCK_DTOKEN];
      await dtoken_controller.setdTokensRelation(tokens, dTokenController);

      await truffleAssert.reverts(
        dtoken_controller.setdTokensRelation(tokens, dTokenController, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not set dTokenController relation with mismatched length mappings", async function () {
      let tokens = [MOCK_TOKEN];
      let dTokenController = [];

      await truffleAssert.reverts(
        dtoken_controller.setdTokensRelation(tokens, dTokenController),
        "setdTokensRelation: Array length do not match!"
      );
    });

    it("Should not set dTokenController relation which has been set", async function () {
      let tokens = [MOCK_TOKEN];
      let dTokenController = [MOCK_DTOKEN];

      await truffleAssert.reverts(
        dtoken_controller.setdTokensRelation(tokens, dTokenController),
        "_setdTokenRelation: Has set!"
      );
    });
  });

  describe("updatedTokenRelation", function () {
    it("Should allow only owner to update dTokenController relation", async function () {
      await dtoken_controller.updatedTokenRelation(MOCK_TOKEN, MOCK_DTOKEN_NEW);

      await truffleAssert.reverts(
        dtoken_controller.updatedTokenRelation(MOCK_TOKEN, MOCK_DTOKEN_NEW, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not update dTokenController relation with unknown token", async function () {
      await truffleAssert.reverts(
        dtoken_controller.updatedTokenRelation(UNKNOWN_TOKEN, MOCK_DTOKEN),
        "updatedTokenRelation: token does not exist!"
      );
    });
  });

  describe("getdToken", function () {
    it("Should get dTokenController relation and 0 by default", async function () {
      assert.equal(
        MOCK_DTOKEN_NEW,
        await dtoken_controller.getdToken(MOCK_TOKEN)
      );
      assert.equal(0, await dtoken_controller.getdToken(UNKNOWN_TOKEN));
    });
  });
});
