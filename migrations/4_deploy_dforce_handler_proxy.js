
// Right click on the script name and hit "Run" to execute
(async () => {
    try {
      console.log("Running deployWithEthers script...");

      const contractName = "DTokenProxy"; // Change this for other contract

      // Note that the script needs the ABI which is generated from the compilation artifact.
      // Make sure contract is compiled and artifacts are generated
      const artifactsPath = `browser/build/contracts/${contractName}.json`; // Change this for different path
      const dforce_handler_implementation = "0xBAdAe913fA64F8c11040b334BD2bEbfbE14F8e17";

      const constructorArgs = [dforce_handler_implementation];

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

      let contract = await factory.deploy(...constructorArgs);

      console.log("Contract Address: ", contract.address);

      // The contract is NOT deployed yet; we must wait until it is mined
      await contract.deployed();
      console.log("Deployment successful.");
    } catch (e) {
      console.log(e.message);
    }
  })();
