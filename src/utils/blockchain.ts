import { mockBlockchainService } from "./mockBlockchain";
import dotenv from "dotenv";

dotenv.config();

// Simple factory to switch between mock and real
export function getBlockchainService() {
  const useRealBlockchain = process.env.USE_REAL_BLOCKCHAIN === "true";

  if (useRealBlockchain) {
    console.log("🔗 Using REAL blockchain service");
    // You'll implement this later
    return {
      issueCredential: async (
        studentAddress: string,
        ipfsHash: string,
        credentialData: any,
      ) => {
        throw new Error(
          "Real blockchain not implemented yet. Set USE_REAL_BLOCKCHAIN=false",
        );
      },
      verifyCredential: mockBlockchainService.verifyCredential,
      verifyTransaction: mockBlockchainService.verifyTransaction,
      getNetworkInfo: mockBlockchainService.getNetworkInfo,
    };
  } else {
    console.log("🔄 Using MOCK blockchain service (development mode)");
    return mockBlockchainService;
  }
}

export const blockchainService = getBlockchainService();
