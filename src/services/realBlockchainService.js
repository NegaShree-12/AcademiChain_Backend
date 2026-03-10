// backend/src/services/realBlockchainService.js
import dotenv from "dotenv";
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables FIRST
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug logging
console.log('🔍 Environment check in realBlockchainService:');
console.log('   SEPOLIA_RPC_URL:', process.env.SEPOLIA_RPC_URL ? '✅ Found' : '❌ Missing');
console.log('   CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS ? '✅ Found' : '❌ Missing');
console.log('   PRIVATE_KEY:', process.env.PRIVATE_KEY ? '✅ Found' : '❌ Missing');
console.log('   USE_REAL_BLOCKCHAIN:', process.env.USE_REAL_BLOCKCHAIN);

// Load ABI
let AcademicCredentialABI;
try {
  const contractJsonPath = path.join(__dirname, '../../contracts/AcademicCredential.json');
  console.log(`📁 Looking for ABI at: ${contractJsonPath}`);
  
  if (fs.existsSync(contractJsonPath)) {
    const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
    AcademicCredentialABI = contractJson.abi;
    console.log('✅ Contract ABI loaded successfully');
  } else {
    throw new Error('Contract JSON file not found');
  }
} catch (error) {
  console.error('❌ Failed to load contract ABI:', error.message);
  console.log('⚠️ Using fallback ABI definition');
  AcademicCredentialABI = [
    "function issueCredential(address student, string ipfsHash) returns (bytes32)",
    "function verifyCredential(bytes32 credentialHash) view returns (bool)",
    "function revokeCredential(bytes32 credentialHash, string reason)",
    "function getCredential(bytes32 credentialHash) view returns (tuple(address student, address issuer, string ipfsHash, uint256 issueDate, bool isValid))",
    "event CredentialIssued(bytes32 indexed credentialHash, address indexed student, address indexed issuer, string ipfsHash, uint256 issueDate)"
  ];
}

export class RealBlockchainService {
  constructor() {
    // Check if we should use mock mode
    this.useMock = process.env.USE_REAL_BLOCKCHAIN !== 'true';
    
    if (this.useMock) {
      console.log('🔄 Using MOCK blockchain service');
      return;
    }

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
      console.log('⚠️ Falling back to MOCK mode');
      this.useMock = true;
    }
  }

  async verifyCredential(txHash) {
    // First, import Credential model dynamically
    const Credential = (await import('../models/Credential.js')).default;
    
    try {
      // Try to find credential by transaction hash or credential ID
      const credential = await Credential.findOne({ 
        $or: [
          { blockchainTxHash: txHash },
          { credentialId: txHash }
        ]
      });

      // If credential not found in database, it's automatically invalid
      if (!credential) {
        console.log(`❌ Credential not found in database: ${txHash}`);
        return { 
          isValid: false, 
          error: "Credential not found in our system",
          txHash,
          mock: this.useMock
        };
      }

      // Check if credential is revoked
      if (credential.isRevoked) {
        return { 
          isValid: false, 
          error: "Credential has been revoked",
          txHash,
          credential: {
            title: credential.title,
            studentName: credential.studentName,
            institutionName: credential.institutionName,
          }
        };
      }

      // MOCK MODE - but we already found credential in DB
      if (this.useMock) {
        console.log(`🔄 [MOCK] Found credential in database: ${credential.credentialId}`);
        return {
          isValid: true,
          txHash,
          blockNumber: 18234567,
          confirmations: 1000,
          timestamp: Date.now(),
          from: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD45",
          to: process.env.CONTRACT_ADDRESS || "0xB6bBF827561e9004b6120B3777E6B8343EeF73c8",
          credential: {
            title: credential.title,
            studentName: credential.studentName,
            institutionName: credential.institutionName,
            issueDate: credential.issueDate,
            credentialType: credential.credentialType,
            description: credential.description,
            metadata: credential.metadata
          },
          mock: true
        };
      }

      // REAL BLOCKCHAIN MODE
      console.log(`🔍 Verifying transaction: ${txHash}`);
      
      const tx = await this.provider.getTransactionReceipt(txHash);

      if (!tx) {
        return { 
          isValid: false, 
          error: "Transaction not found on blockchain",
          txHash,
          credential: {
            title: credential.title,
            studentName: credential.studentName,
            institutionName: credential.institutionName,
          }
        };
      }

      if (tx.status === 0) {
        return { 
          isValid: false, 
          error: "Transaction failed on blockchain",
          txHash,
          blockNumber: tx.blockNumber,
          credential: {
            title: credential.title,
            studentName: credential.studentName,
            institutionName: credential.institutionName,
          }
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

      const currentBlock = await this.provider.getBlockNumber();
      
      return {
        isValid: true,
        txHash,
        blockNumber: tx.blockNumber,
        confirmations: currentBlock - tx.blockNumber,
        credentialHash,
        from: tx.from,
        to: tx.to,
        gasUsed: tx.gasUsed.toString(),
        timestamp: Date.now(),
        credential: {
          title: credential.title,
          studentName: credential.studentName,
          institutionName: credential.institutionName,
          issueDate: credential.issueDate,
          credentialType: credential.credentialType,
          description: credential.description,
          metadata: credential.metadata
        }
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
    // First, import Credential model dynamically
    const Credential = (await import('../models/Credential.js')).default;
    
    try {
      // Find credential in database
      const credential = await Credential.findOne({ credentialId });
      
      if (!credential) {
        return { 
          isValid: false, 
          error: "Credential not found in our system",
          credentialId
        };
      }

      if (credential.isRevoked) {
        return { 
          isValid: false, 
          error: "Credential has been revoked",
          credentialId
        };
      }

      // MOCK MODE
      if (this.useMock) {
        return {
          isValid: true,
          credentialId,
          timestamp: Date.now(),
          credential: {
            title: credential.title,
            studentName: credential.studentName,
            institutionName: credential.institutionName,
            issueDate: credential.issueDate,
            credentialType: credential.credentialType,
            description: credential.description
          },
          mock: true
        };
      }

      // REAL BLOCKCHAIN MODE
      if (this.contract.verifyCredentialById) {
        const isValid = await this.contract.verifyCredentialById(credentialId);
        return {
          isValid,
          credentialId,
          timestamp: Date.now(),
          credential: {
            title: credential.title,
            studentName: credential.studentName,
            institutionName: credential.institutionName,
          }
        };
      }
      
      if (this.contract.getCredential) {
        try {
          const onChainCredential = await this.contract.getCredential(credentialId);
          return {
            isValid: onChainCredential && onChainCredential.isValid !== false,
            credentialId,
            credential: {
              title: credential.title,
              studentName: credential.studentName,
              institutionName: credential.institutionName,
            },
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
        isValid: true, // Default to true if we found in DB
        credentialId,
        timestamp: Date.now(),
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

  async issueCredential(studentAddress, ipfsHash, metadata = {}) {
    // MOCK MODE
    if (this.useMock) {
      console.log(`🔄 [MOCK] Issuing credential for student ${studentAddress}...`);
      
      const mockTxHash = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      const mockBlockNumber = Math.floor(Math.random() * 1000000) + 18000000;
      
      return {
        success: true,
        txHash: mockTxHash,
        blockNumber: mockBlockNumber,
        credentialHash: this.getCredentialHash(mockTxHash),
        timestamp: Date.now(),
        mock: true
      };
    }

    // REAL BLOCKCHAIN MODE
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

  async revokeCredential(credentialId, reason = "") {
    // MOCK MODE
    if (this.useMock) {
      console.log(`🔄 [MOCK] Revoking credential ${credentialId}...`);
      return {
        success: true,
        txHash: `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        blockNumber: 18234567,
        credentialId,
        timestamp: Date.now(),
        mock: true
      };
    }

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
    // MOCK MODE
    if (this.useMock) {
      return {
        name: "sepolia",
        chainId: 11155111,
        blockHeight: 19543210,
        gasPrice: "10 Gwei",
        status: "connected",
        adminBalance: "0.5",
        adminAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD45",
        contractAddress: process.env.CONTRACT_ADDRESS || "0xB6bBF827561e9004b6120B3777E6B8343EeF73c8",
        mock: true
      };
    }

    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const balance = await this.provider.getBalance(this.wallet.address);
      const feeData = await this.provider.getFeeData();

      return {
        name: network.name || "sepolia",
        chainId: Number(network.chainId),
        blockHeight: blockNumber,
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : "0",
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
    return ethers.keccak256(ethers.toUtf8Bytes(txHash));
  }
}

// Create and export a SINGLETON instance
let realBlockchainService;
try {
  realBlockchainService = new RealBlockchainService();
} catch (error) {
  console.error('❌ Failed to create blockchain service:', error);
  // Create a fallback service that ALWAYS checks database first
  realBlockchainService = {
    useMock: true,
    verifyCredential: async (txHash) => {
      const Credential = (await import('../models/Credential.js')).default;
      const credential = await Credential.findOne({ 
        $or: [{ blockchainTxHash: txHash }, { credentialId: txHash }]
      });
      
      if (!credential) {
        return { isValid: false, error: 'Credential not found in our system', txHash };
      }
      
      if (credential.isRevoked) {
        return { isValid: false, error: 'Credential has been revoked', txHash };
      }
      
      return { 
        isValid: true, 
        txHash, 
        blockNumber: 18234567, 
        confirmations: 1000,
        credential: {
          title: credential.title,
          studentName: credential.studentName,
          institutionName: credential.institutionName,
          issueDate: credential.issueDate,
          credentialType: credential.credentialType,
          description: credential.description
        },
        mock: true
      };
    },
    verifyCredentialById: async (id) => {
      const Credential = (await import('../models/Credential.js')).default;
      const credential = await Credential.findOne({ credentialId: id });
      if (!credential) return { isValid: false, error: 'Credential not found' };
      return { isValid: true, credentialId: id, credential, mock: true };
    },
    issueCredential: async () => ({ success: true, txHash: '0xmock', blockNumber: 18234567 }),
    revokeCredential: async () => ({ success: true }),
    getNetworkInfo: async () => ({ 
      name: 'sepolia', 
      chainId: 11155111, 
      blockHeight: 19543210,
      status: 'connected',
      contractAddress: process.env.CONTRACT_ADDRESS || "0xB6bBF827561e9004b6120B3777E6B8343EeF73c8",
      mock: true 
    })
  };
}

export { realBlockchainService };
export default RealBlockchainService;