const truffleAssert = require("truffle-assertions");
const dTokenAddresses = artifacts.require("dTokenAddresses");

const MOCK_TOKEN = "0x0000000000000000000000000000000000000001";
const MOCK_DTOKEN = "0x0000000000000000000000000000000000000002";
const MOCK_DTOKEN_NEW = "0x0000000000000000000000000000000000000003";
const UNKNOWN_TOKEN = "0x0000000000000000000000000000000000000004";

describe("dTokenAddresses Contract", function () {
  let dtoken_addresses;
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
    dtoken_addresses = await dTokenAddresses.new();
  }

  describe("Deployment", function () {
    it("Should deployed and only initialized once", async function () {
      await resetContracts();

      await truffleAssert.reverts(
        dtoken_addresses.initialize(),
        "initialize: Already initialized!"
      );
    });
  });

  describe("setdTokensRelation", function () {
    it("Should allow only owner to set dTokens relation", async function () {
      let tokens = [MOCK_TOKEN];
      let dTokens = [MOCK_DTOKEN];
      await dtoken_addresses.setdTokensRelation(tokens, dTokens);

      await truffleAssert.reverts(
        dtoken_addresses.setdTokensRelation(tokens, dTokens, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not set dTokens relation with mismatched length mappings", async function () {
      let tokens = [MOCK_TOKEN];
      let dTokens = [];

      await truffleAssert.reverts(
        dtoken_addresses.setdTokensRelation(tokens, dTokens),
        "setdTokensRelation: Array length do not match!"
      );
    });

    it("Should not set dTokens relation which has been set", async function () {
      let tokens = [MOCK_TOKEN];
      let dTokens = [MOCK_DTOKEN];

      await truffleAssert.reverts(
        dtoken_addresses.setdTokensRelation(tokens, dTokens),
        "_setdTokenRelation: Has set!"
      );
    });
  });

  describe("updatedTokenRelation", function () {
    it("Should allow only owner to update dTokens relation", async function () {
      await dtoken_addresses.updatedTokenRelation(MOCK_TOKEN, MOCK_DTOKEN_NEW);

      await truffleAssert.reverts(
        dtoken_addresses.updatedTokenRelation(MOCK_TOKEN, MOCK_DTOKEN_NEW, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not update dTokens relation with unknown token", async function () {
      await truffleAssert.reverts(
        dtoken_addresses.updatedTokenRelation(UNKNOWN_TOKEN, MOCK_DTOKEN),
        "updatedTokenRelation: token does not exist!"
      );
    });
  });

  describe("getdToken", function () {
    it("Should get dTokens relation and 0 by default", async function () {
      assert.equal(
        MOCK_DTOKEN_NEW,
        await dtoken_addresses.getdToken(MOCK_TOKEN)
      );
      assert.equal(0, await dtoken_addresses.getdToken(UNKNOWN_TOKEN));
    });
  });
});
