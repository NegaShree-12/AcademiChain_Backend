import { run } from "hardhat";

async function main() {
  // Read deployment info
  const fs = require("fs");
  const deploymentInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
  
  console.log("🔍 Verifying contract on Etherscan...");
  console.log("Contract address:", deploymentInfo.contractAddress);
  console.log("Network:", deploymentInfo.network);
  
  try {
    await run("verify:verify", {
      address: deploymentInfo.contractAddress,
      constructorArguments: [],
    });
    
    console.log("✅ Contract verified successfully!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract is already verified");
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });