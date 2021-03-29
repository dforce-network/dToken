
// Right click on the script name and hit "Run" to execute
(async () => {
    try {
      console.log("Running deployWithEthers script...");

      const contractName = "DForceLendingHandler"; // Change this for other contract

      // Note that the script needs the ABI which is generated from the compilation artifact.
      // Make sure contract is compiled and artifacts are generated
      const artifactsPath = `browser/build/contracts/${contractName}.json`; // Change this for different path
      const dTokenController = "0x7F15bf6D40bfEE79099bCcA893a30B72Aee6C9Eb";
      const rewardToken = "0x4A9A2b2b04549C3927dd2c9668A5eF3fCA473623";
      let dsGurad = "0x5C4365BE7a01c6f0B8709D3b619ffD26eE072bDC";
      const dforce_handler_proxy_addr = "0xc9b972fd675A0f7888dC143a2c0B32193C9B02FF";

      let dai = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";
      let idai = "0xAD5Ec11426970c32dA48f58c92b1039bC50e5492";

      // const constructorArgs = [busd_handler];

      const metadata = JSON.parse(
        await remix.call("fileManager", "getFile", artifactsPath)
      );

      // 'web3Provider' is a remix global variable object
      const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner();

      let factory = new ethers.ContractFactory(
        metadata.abi,
        metadata.bytecode,
        signer
      );

      const handler_proxy = new ethers.Contract(dforce_handler_proxy_addr, metadata.abi, signer);

      //-------------------------------
      //---- initialize contract ------
      //-------------------------------
      let current_reward_token = await handler_proxy.rewardToken();
      console.log("reward doken is: ", current_reward_token);

      let tx = await handler_proxy.initialize(dTokenController, rewardToken);
      await tx.wait(1);

      current_reward_token = await handler_proxy.rewardToken();
      console.log("reward doken is: ", current_reward_token);

      //-------------------------
      //---- enable tokens ------
      //-------------------------
      let token_has_been_enabled = await handler_proxy.tokenIsEnabled(dai);
      console.log("token has been enabled:", token_has_been_enabled);

      tx = await handler_proxy.enableTokens([dai]);
      await tx.wait(1);

      token_has_been_enabled = await handler_proxy.tokenIsEnabled(dai);
      console.log("token has been enabled:", token_has_been_enabled);

      //-------------------------
      //---- set authority ------
      //-------------------------
      let current_authority = await handler_proxy.authority();
      console.log("current authority is: ", current_authority);
      tx = await handler_proxy.setAuthority(dsGurad);
      await tx.wait(1);

      current_authority = await handler_proxy.authority();
      console.log("current authority is: ", current_authority);

      //------------------------------
      //----set iTokens relation------
      //------------------------------
      let iTokens_relation = await handler_proxy.iTokens(dai);
      console.log("iTokens relation is: ", iTokens_relation);

      tx = await handler_proxy.setiTokensRelation([dai],[idai]);
      await tx.wait(1);

      iTokens_relation = await handler_proxy.iTokens(dai);
      console.log("iTokens relation is: ", iTokens_relation);
    } catch (e) {
      console.log(e.message);
    }
  })();
