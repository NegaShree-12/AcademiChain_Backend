import { ethers, network } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("🚀 Starting AcademicCredential contract deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  // ✅ FIXED BALANCE METHOD (Ethers v6)
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy contract
  const AcademicCredential = await ethers.getContractFactory(
    "AcademicCredential",
  );
  const contract = await AcademicCredential.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("\n✅ Contract deployed successfully!");
  console.log("📌 Contract address:", address);
  console.log("👑 Admin address:", await contract.admin());
  console.log("🌐 Network:", network.name);

  // Save deployment info
  const deploymentInfo = {
    contractAddress: address,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    network: network.name,
    chainId: network.config.chainId,
  };

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2),
  );

  console.log("📄 Deployment info saved!");

  return address;
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
