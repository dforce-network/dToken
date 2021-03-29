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

      const constructorArgs = [dTokenController, rewardToken];

      const metadata = JSON.parse(
        await remix.call("fileManager", "getFile", artifactsPath)
      );

      // 'web3Provider' is a remix global variable object
      const signer = new ethers.providers.Web3Provider(web3Provider).getSigner();

      let factory = new ethers.ContractFactory(
        metadata.abi,
        metadata.bytecode,
        signer
      );

      let contract = await factory.deploy(...constructorArgs);

      console.log("Contract Address: ", contract.address);

      // The contract is NOT deployed yet; we must wait until it is mined
      await contract.deployed();
      console.log("Deployment successful.");
    } catch (e) {
      console.log(e.message);
    }
  })();
