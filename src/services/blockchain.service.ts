import { ethers } from "ethers";
import AcademicCredentialABI from "../contracts/AcademicCredential.json";

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(
      process.env.ISSUER_PRIVATE_KEY!,
      this.provider,
    );

    this.contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS!,
      AcademicCredentialABI,
      this.wallet,
    );
  }

  async issueCredential(studentAddress: string, ipfsHash: string) {
    try {
      const tx = await this.contract.issueCredential(studentAddress, ipfsHash);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        credentialHash: this.getCredentialHash(tx.hash),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Blockchain issue error:", error);
      throw new Error("Failed to issue credential on blockchain");
    }
  }

  async verifyCredential(txHash: string) {
    try {
      const tx = await this.provider.getTransactionReceipt(txHash);

      if (!tx) {
        return { isValid: false, error: "Transaction not found" };
      }

      // Parse logs to get credential hash
      const eventTopic = ethers.id(
        "CredentialIssued(bytes32,address,address,string,uint256)",
      );
      const log = tx.logs.find((log) => log.topics[0] === eventTopic);

      if (!log) {
        return { isValid: false, error: "Credential event not found" };
      }

      const credentialHash = log.topics[1];
      const isValid = await this.contract.verifyCredential(credentialHash);

      return {
        isValid,
        txHash,
        blockNumber: tx.blockNumber,
        confirmations: (await this.provider.getBlockNumber()) - tx.blockNumber,
        credentialHash,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Blockchain verify error:", error);
      return { isValid: false, error: "Verification failed" };
    }
  }

  private getCredentialHash(txHash: string): string {
    // Generate deterministic credential hash
    return ethers.keccak256(ethers.toUtf8Bytes(txHash));
  }
}

export const blockchainService = new BlockchainService();
