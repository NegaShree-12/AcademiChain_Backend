import { ethers } from "ethers";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract ABI dynamically
let AcademicCredentialABI;
try {
  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, '../../artifacts/contracts/AcademicCredential.sol/AcademicCredential.json'),
    path.join(__dirname, '../../contracts/AcademicCredential.json'),
    path.join(process.cwd(), 'artifacts/contracts/AcademicCredential.sol/AcademicCredential.json'),
    path.join(process.cwd(), 'contracts/AcademicCredential.json')
  ];

  let abiFile = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      abiFile = JSON.parse(fs.readFileSync(p, 'utf8'));
      console.log(`✅ Loaded contract ABI from: ${p}`);
      break;
    }
  }

  if (!abiFile) {
    throw new Error('Could not find AcademicCredential.json ABI file');
  }

  AcademicCredentialABI = abiFile.abi || abiFile;
} catch (error) {
  console.error('❌ Failed to load contract ABI:', error.message);
  // Fallback minimal ABI for basic functions
  AcademicCredentialABI = [
    "function issueCredential(address student, string ipfsHash) returns (bytes32)",
    "function verifyCredential(bytes32 credentialHash) view returns (bool)",
    "function revokeCredential(bytes32 credentialHash, string reason)",
    "function getCredential(bytes32 credentialHash) view returns (tuple(address student, address issuer, string ipfsHash, uint256 issueDate, bool isValid))",
    "event CredentialIssued(bytes32 indexed credentialHash, address indexed student, address indexed issuer, string ipfsHash, uint256 issueDate)"
  ];
  console.log('⚠️ Using fallback ABI definition');
}

class BlockchainService {
  constructor() {
    this.initialize();
  }

  initialize() {
    try {
      if (!process.env.SEPOLIA_RPC_URL) {
        throw new Error("SEPOLIA_RPC_URL is not defined in environment variables");
      }
      if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is not defined in environment variables");
      }
      if (!process.env.CONTRACT_ADDRESS) {
        throw new Error("CONTRACT_ADDRESS is not defined in environment variables");
      }

      this.provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      this.contract = new ethers.Contract(
        process.env.CONTRACT_ADDRESS,
        AcademicCredentialABI,
        this.wallet
      );

      console.log("✅ BlockchainService initialized with contract:", process.env.CONTRACT_ADDRESS);
    } catch (error) {
      console.error("❌ Failed to initialize BlockchainService:", error);
      throw error;
    }
  }

  async issueCredential(studentAddress, ipfsHash, metadata = {}) {
    try {
      console.log(`📝 Issuing credential for student ${studentAddress}...`);
      
      const tx = await this.contract.issueCredential(
        studentAddress,
        ipfsHash
      );
      
      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        credentialHash: this.getCredentialHash(tx.hash),
        timestamp: Date.now(),
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      console.error("❌ Blockchain issue error:", error);
      throw new Error(`Failed to issue credential on blockchain: ${error.message}`);
    }
  }

  async verifyCredential(txHash) {
    try {
      console.log(`🔍 Verifying transaction: ${txHash}`);
      
      const tx = await this.provider.getTransactionReceipt(txHash);

      if (!tx) {
        return { 
          isValid: false, 
          error: "Transaction not found",
          txHash 
        };
      }

      if (tx.status === 0) {
        return { 
          isValid: false, 
          error: "Transaction failed on blockchain",
          txHash,
          blockNumber: tx.blockNumber
        };
      }

      // Parse logs to get credential hash if contract supports events
      let credentialHash = null;
      try {
        const eventTopic = ethers.id(
          "CredentialIssued(bytes32,address,address,string,uint256)",
        );
        const log = tx.logs.find((log) => log.topics[0] === eventTopic);

        if (log) {
          credentialHash = log.topics[1];
        }
      } catch (eventError) {
        console.warn("Could not parse credential event:", eventError);
      }

      // Try to verify via contract if method exists
      let isValid = true;
      try {
        if (this.contract.verifyCredential && credentialHash) {
          isValid = await this.contract.verifyCredential(credentialHash);
        } else if (this.contract.verifyTransaction) {
          isValid = await this.contract.verifyTransaction(txHash);
        }
      } catch (verifyError) {
        console.warn("Contract verification method failed:", verifyError);
        // Default to true if transaction exists and succeeded
        isValid = tx.status === 1;
      }

      const currentBlock = await this.provider.getBlockNumber();
      
      return {
        isValid,
        txHash,
        blockNumber: tx.blockNumber,
        confirmations: currentBlock - tx.blockNumber,
        credentialHash,
        from: tx.from,
        to: tx.to,
        gasUsed: tx.gasUsed.toString(),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("❌ Blockchain verify error:", error);
      return { 
        isValid: false, 
        error: error.message || "Verification failed",
        txHash 
      };
    }
  }

  async verifyCredentialById(credentialId) {
    try {
      console.log(`🔍 Verifying credential ID: ${credentialId}`);
      
      // Try to call contract method if available
      if (this.contract.verifyCredentialById) {
        const isValid = await this.contract.verifyCredentialById(credentialId);
        return {
          isValid,
          credentialId,
          timestamp: Date.now(),
        };
      }
      
      // Fallback: check if credential exists in contract
      if (this.contract.getCredential) {
        try {
          const credential = await this.contract.getCredential(credentialId);
          return {
            isValid: credential && credential.isValid !== false,
            credentialId,
            credential,
            timestamp: Date.now(),
          };
        } catch (error) {
          return {
            isValid: false,
            credentialId,
            error: "Credential not found on blockchain",
          };
        }
      }

      return {
        isValid: false,
        credentialId,
        error: "Verification method not available",
      };
    } catch (error) {
      console.error("❌ Blockchain verify by ID error:", error);
      return { 
        isValid: false, 
        error: error.message || "Verification failed",
        credentialId 
      };
    }
  }

  async revokeCredential(credentialId, reason = "") {
    try {
      console.log(`🔴 Revoking credential ${credentialId}...`);
      
      if (!this.contract.revokeCredential) {
        throw new Error("revokeCredential method not available in contract");
      }

      const tx = await this.contract.revokeCredential(credentialId, reason);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        credentialId,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("❌ Blockchain revoke error:", error);
      throw new Error(`Failed to revoke credential: ${error.message}`);
    }
  }

  async getNetworkInfo() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const balance = await this.provider.getBalance(this.wallet.address);

      return {
        name: network.name || "sepolia",
        chainId: Number(network.chainId),
        blockHeight: blockNumber,
        gasPrice: (await this.provider.getFeeData()).gasPrice?.toString() || "0",
        status: "connected",
        adminBalance: ethers.formatEther(balance),
        adminAddress: this.wallet.address,
        contractAddress: process.env.CONTRACT_ADDRESS,
      };
    } catch (error) {
      console.error("❌ Error getting network info:", error);
      return {
        name: process.env.BLOCKCHAIN_NETWORK || "sepolia",
        chainId: 11155111,
        status: "disconnected",
        error: error.message,
      };
    }
  }

  getCredentialHash(txHash) {
    // Generate deterministic credential hash from transaction hash
    return ethers.keccak256(ethers.toUtf8Bytes(txHash));
  }
}

// Export a singleton instance
export const blockchainService = new BlockchainService();

// Also export individual functions for backward compatibility
export const verifyBlockchainCredential = async (credentialId, txHash) => {
  try {
    if (txHash && txHash !== '0x0' && txHash.length > 10) {
      const result = await blockchainService.verifyCredential(txHash);
      return {
        verified: result.isValid,
        details: result,
      };
    } else {
      const result = await blockchainService.verifyCredentialById(credentialId);
      return {
        verified: result.isValid,
        details: result,
      };
    }
  } catch (error) {
    console.error("Error in verifyBlockchainCredential:", error);
    return {
      verified: false,
      details: { error: error.message },
    };
  }
};

export const issueCredentialOnBlockchain = async (credentialId, studentAddress, ipfsHash, metadata) => {
  try {
    const result = await blockchainService.issueCredential(studentAddress, ipfsHash, metadata);
    return result.txHash;
  } catch (error) {
    console.error("Error in issueCredentialOnBlockchain:", error);
    throw error;
  }
};

export const revokeCredentialOnBlockchain = async (credentialId, reason) => {
  try {
    const result = await blockchainService.revokeCredential(credentialId, reason);
    return true;
  } catch (error) {
    console.error("Error in revokeCredentialOnBlockchain:", error);
    return false;
  }
};

export const getBlockchainStatus = async () => {
  return blockchainService.getNetworkInfo();
};

export default blockchainService;