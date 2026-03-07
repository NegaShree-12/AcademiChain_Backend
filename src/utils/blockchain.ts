import { ethers } from "ethers";
import AcademicCredentialABI from "../artifacts/contracts/AcademicCredential.sol/AcademicCredential.json" assert { type: "json" };

// Use environment variables directly - NO FALLBACKS that override real values
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

let provider: ethers.providers.JsonRpcProvider;
let contract: ethers.Contract;
let signer: ethers.Wallet | null = null;

const initializeBlockchain = () => {
  try {
    if (!CONTRACT_ADDRESS) {
      throw new Error(
        "CONTRACT_ADDRESS is not defined in environment variables",
      );
    }

    if (!RPC_URL) {
      throw new Error("RPC_URL is not defined in environment variables");
    }

    console.log("Initializing blockchain with:", {
      contractAddress: CONTRACT_ADDRESS,
      network: "sepolia",
      rpcUrl: RPC_URL.substring(0, 30) + "...", // Log partial for security
    });

    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      AcademicCredentialABI.abi,
      provider,
    );

    // Initialize signer if private key is available
    if (PRIVATE_KEY) {
      signer = new ethers.Wallet(PRIVATE_KEY, provider);
      contract = contract.connect(signer);
      console.log("Blockchain signer initialized");
    }

    console.log(
      "✅ Blockchain service initialized successfully with contract:",
      CONTRACT_ADDRESS,
    );
  } catch (error) {
    console.error("❌ Failed to initialize blockchain service:", error);
  }
};

// Initialize on module load
initializeBlockchain();

export const verifyBlockchainCredential = async (
  credentialId: string,
  transactionHash: string,
): Promise<{ verified: boolean; details?: any }> => {
  try {
    console.log(
      `🔍 Verifying credential ${credentialId} with tx: ${transactionHash}`,
    );

    if (!provider) {
      initializeBlockchain();
    }

    // First, try to verify using the smart contract
    if (contract && contract.verifyCredential) {
      try {
        const isValid = await contract.verifyCredential(credentialId);
        console.log("Smart contract verification result:", isValid);

        if (isValid) {
          return {
            verified: true,
            details: {
              method: "smart-contract",
              verified: true,
              timestamp: new Date().toISOString(),
            },
          };
        }
      } catch (contractError) {
        console.error("Smart contract verification failed:", contractError);
        // Fall back to transaction verification
      }
    }

    // Fallback: Verify by checking transaction
    if (
      transactionHash &&
      transactionHash !== "0x0" &&
      transactionHash.length > 10
    ) {
      const tx = await provider.getTransaction(transactionHash);

      if (!tx) {
        return {
          verified: false,
          details: { error: "Transaction not found on blockchain" },
        };
      }

      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        return {
          verified: false,
          details: { error: "Transaction receipt not found" },
        };
      }

      if (receipt.status === 0) {
        return {
          verified: false,
          details: { error: "Transaction failed on blockchain" },
        };
      }

      // Check if transaction is from our contract
      if (
        receipt.contractAddress?.toLowerCase() !==
          CONTRACT_ADDRESS?.toLowerCase() &&
        receipt.to?.toLowerCase() !== CONTRACT_ADDRESS?.toLowerCase()
      ) {
        console.warn("Transaction not related to our contract");
      }

      return {
        verified: true,
        details: {
          method: "transaction-verification",
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash,
          confirmations: await receipt.confirmations(),
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status === 1 ? "success" : "failed",
        },
      };
    }

    // If no transaction hash, try to fetch credential directly
    if (contract && contract.getCredential) {
      try {
        const credential = await contract.getCredential(credentialId);
        if (credential && credential.isValid) {
          return {
            verified: true,
            details: {
              method: "direct-fetch",
              credential: credential,
            },
          };
        }
      } catch (error) {
        console.error("Direct credential fetch failed:", error);
      }
    }

    return {
      verified: false,
      details: { error: "Unable to verify credential on blockchain" },
    };
  } catch (error) {
    console.error("Error verifying credential on blockchain:", error);
    return {
      verified: false,
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};

export const issueCredentialOnBlockchain = async (
  credentialId: string,
  studentAddress: string,
  ipfsHash: string,
  metadata: any,
): Promise<string> => {
  try {
    if (!contract || !signer) {
      throw new Error("Blockchain contract or signer not initialized");
    }

    console.log(`📝 Issuing credential ${credentialId} on blockchain...`);

    // Call your smart contract's issueCredential function
    // Adjust this based on your actual contract ABI
    const tx = await contract.issueCredential(
      credentialId,
      studentAddress,
      ipfsHash,
      JSON.stringify(metadata),
    );

    console.log("Transaction submitted:", tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);

    return receipt.transactionHash;
  } catch (error) {
    console.error("Error issuing credential on blockchain:", error);
    throw error;
  }
};

export const revokeCredentialOnBlockchain = async (
  credentialId: string,
  reason: string,
): Promise<boolean> => {
  try {
    if (!contract || !signer) {
      throw new Error("Blockchain contract or signer not initialized");
    }

    console.log(`🔴 Revoking credential ${credentialId} on blockchain...`);

    const tx = await contract.revokeCredential(credentialId, reason);
    const receipt = await tx.wait();

    console.log("Credential revoked, tx:", receipt.transactionHash);
    return true;
  } catch (error) {
    console.error("Error revoking credential on blockchain:", error);
    return false;
  }
};

export const getBlockchainStatus = async (): Promise<{
  connected: boolean;
  contractAddress: string;
  network: string;
  blockNumber?: number;
}> => {
  try {
    if (!provider || !contract) {
      initializeBlockchain();
    }

    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();

    return {
      connected: true,
      contractAddress: CONTRACT_ADDRESS || "Not set",
      network: network.name === "sepolia" ? "Sepolia" : network.name,
      blockNumber,
    };
  } catch (error) {
    console.error("Error getting blockchain status:", error);
    return {
      connected: false,
      contractAddress: CONTRACT_ADDRESS || "Not set",
      network: "Unknown",
    };
  }
};
