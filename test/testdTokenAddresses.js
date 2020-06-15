const truffleAssert = require("truffle-assertions");
const dTokenAddresses = artifacts.require("dTokenAddresses");

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
      let tokens = [];
      let dTokens = [];
      await dtoken_addresses.setdTokensRelation(tokens, dTokens);

      await truffleAssert.reverts(
        dtoken_addresses.setdTokensRelation(tokens, dTokens, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });
  });

  describe("getdToken", function () {
    it("Should get dTokens relation and 0 by default", async function () {
      let tokens = [account1];
      let dTokens = [account2];
      await dtoken_addresses.setdTokensRelation(tokens, dTokens);

      assert.equal(dTokens[0], await dtoken_addresses.getdToken(tokens[0]));
      assert.equal(0, await dtoken_addresses.getdToken(account2));
    });
  });
});
