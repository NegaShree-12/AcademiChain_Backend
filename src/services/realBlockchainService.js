import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ✅ Load environment variables FIRST - THIS IS CRITICAL
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Contract ABI path - goes up two levels from src/services/ to root contracts/
const contractJsonPath = path.join(__dirname, "../../contracts/AcademicCredential.json");
console.log(`🔍 Looking for contract ABI at: ${contractJsonPath}`);

// ✅ Check if contract JSON exists
if (!fs.existsSync(contractJsonPath)) {
  console.error(`❌ Contract JSON not found at: ${contractJsonPath}`);
  console.error(`   Current directory: ${__dirname}`);
  console.error(`   Please ensure the file exists at: D:\\visual studio\\AcademiChain_Backend\\contracts\\AcademicCredential.json`);
  process.exit(1);
}

// ✅ Load contract ABI
let contractJson;
try {
  contractJson = JSON.parse(fs.readFileSync(contractJsonPath, "utf8"));
  console.log(`✅ Contract ABI loaded successfully`);
} catch (error) {
  console.error(`❌ Failed to parse contract JSON: ${error.message}`);
  process.exit(1);
}

export class RealBlockchainService {
  constructor() {
    // ✅ Validate all required environment variables
    const requiredEnvVars = [
      'SEPOLIA_RPC_URL',
      'PRIVATE_KEY', 
      'CONTRACT_ADDRESS'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    try {
      // ✅ Initialize provider, wallet, and contract
      this.provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      this.contract = new ethers.Contract(
        process.env.CONTRACT_ADDRESS,
        contractJson.abi,
        this.wallet
      );

      console.log(`✅ Blockchain service initialized successfully`);
      console.log(`   📄 Contract: ${process.env.CONTRACT_ADDRESS}`);
      console.log(`   🔑 Admin: ${this.wallet.address}`);
      console.log(`   🌐 Network: Sepolia`);
      console.log(`   📡 RPC: ${process.env.SEPOLIA_RPC_URL.substring(0, 30)}...`);
    } catch (error) {
      console.error(`❌ Failed to initialize blockchain service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Issue a new credential on the blockchain
   */
  async issueCredential(
    studentAddress,
    studentName,
    degree,
    institution
  ) {
    try {
      console.log(`\n📝 Issuing credential to ${studentAddress}...`);
      console.log(`   Student: ${studentName}`);
      console.log(`   Degree: ${degree}`);
      console.log(`   Institution: ${institution}`);

      // Send transaction
      const tx = await this.contract.issueCredential(
        studentAddress,
        studentName,
        degree,
        institution
      );

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      console.log(`   View on Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      
      console.log(`✅ Credential issued successfully!`);
      console.log(`   📦 Block: ${receipt.blockNumber}`);
      console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`   🔗 Transaction: ${tx.hash}`);

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        timestamp: Date.now(),
        explorerUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`
      };
    } catch (error) {
      console.error("❌ Blockchain error:", error);
      
      // Handle specific error cases
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient funds in admin wallet. Please add Sepolia ETH to: ${this.wallet.address}`);
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error(`Transaction would fail. Check contract permissions and parameters.`);
      } else if (error.message.includes('user rejected')) {
        throw new Error(`Transaction rejected by user`);
      }
      
      throw new Error(`Failed to issue credential: ${error.message}`);
    }
  }

  /**
   * Get all credentials for a student
   */
  async getCredentials(studentAddress) {
    try {
      console.log(`\n📋 Fetching credentials for ${studentAddress}...`);
      
      const credentials = await this.contract.getCredentials(studentAddress);
      
      console.log(`✅ Found ${credentials.length} credential(s)`);
      
      // Format credentials for easier use
      return credentials.map(cred => ({
        studentName: cred.studentName,
        degree: cred.degree,
        institution: cred.institution,
        issueDate: new Date(Number(cred.issueDate) * 1000).toISOString(),
        issueTimestamp: Number(cred.issueDate)
      }));
    } catch (error) {
      console.error("❌ Failed to fetch credentials:", error);
      throw new Error(`Failed to fetch credentials: ${error.message}`);
    }
  }

  /**
   * Verify a credential by transaction hash
   */
  async verifyCredential(studentAddress, txHash) {
    try {
      console.log(`\n🔍 Verifying credential...`);
      console.log(`   Student: ${studentAddress}`);
      console.log(`   Tx Hash: ${txHash}`);

      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        console.log(`❌ Transaction not found on blockchain`);
        return { 
          isValid: false, 
          error: "Transaction not found",
          txHash,
          timestamp: Date.now()
        };
      }

      // Get credentials for this student
      const credentials = await this.getCredentials(studentAddress);
      
      const isValid = credentials.length > 0;
      
      console.log(`✅ Verification complete!`);
      console.log(`   Valid: ${isValid}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Confirmations: ${receipt.confirmations}`);

      return {
        isValid,
        txHash,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        timestamp: Date.now(),
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`
      };
    } catch (error) {
      console.error("❌ Verification failed:", error);
      return { 
        isValid: false, 
        error: error.message,
        txHash,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get blockchain network information
   */
  async getNetworkInfo() {
    try {
      console.log(`\n🌐 Fetching network information...`);
      
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const balance = await this.provider.getBalance(this.wallet.address);
      const feeData = await this.provider.getFeeData();

      const info = {
        name: network.name,
        chainId: Number(network.chainId),
        blockHeight: blockNumber,
        gasPrice: ethers.formatUnits(feeData.gasPrice || 0, 'gwei'),
        status: "connected",
        adminBalance: ethers.formatEther(balance),
        adminAddress: this.wallet.address,
        isSynced: true
      };

      console.log(`✅ Network: ${info.name} (Chain ID: ${info.chainId})`);
      console.log(`   📦 Block: ${info.blockHeight}`);
      console.log(`   💰 Balance: ${info.adminBalance} ETH`);
      console.log(`   ⛽ Gas Price: ${info.gasPrice} Gwei`);

      return info;
    } catch (error) {
      console.error("❌ Failed to fetch network info:", error);
      throw new Error(`Failed to fetch network info: ${error.message}`);
    }
  }

  /**
   * Check if the service is healthy
   */
  async healthCheck() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const balance = await this.provider.getBalance(this.wallet.address);
      
      return {
        status: 'healthy',
        network: network.name,
        chainId: Number(network.chainId),
        blockNumber,
        adminBalance: ethers.formatEther(balance),
        adminAddress: this.wallet.address,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
}

// ✅ Create and export a singleton instance
export const realBlockchainService = new RealBlockchainService();