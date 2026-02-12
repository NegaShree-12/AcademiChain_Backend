export class MockBlockchainService {
  private mockTxHashes = new Map<string, any>();

  async issueCredential(
    studentAddress: string,
    ipfsHash: string,
    credentialData: any,
  ) {
    console.log(`📝 Mock Blockchain: Issuing credential to ${studentAddress}`);

    // Simulate blockchain delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const txHash = `0x${Math.random().toString(16).slice(2, 66)}`;
    const credentialHash = `0x${Math.random().toString(16).slice(2, 66)}`;
    const blockNumber = Math.floor(Math.random() * 20000000) + 18000000;

    const result = {
      success: true,
      txHash,
      blockNumber,
      credentialHash,
      timestamp: Date.now(),
      message: "✅ Credential issued successfully (Mock Blockchain)",
      data: {
        issuer: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD45",
        student: studentAddress,
        ipfsHash,
        credentialData,
        network: "sepolia",
        gasUsed: "0.0015 ETH",
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      },
    };

    // Store for later verification
    this.mockTxHashes.set(txHash, result);
    this.mockTxHashes.set(credentialHash, result);

    return result;
  }

  async verifyCredential(hash: string) {
    console.log(`🔍 Mock Blockchain: Verifying ${hash}`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const storedData = this.mockTxHashes.get(hash);
    if (storedData) {
      return {
        isValid: true,
        txHash: storedData.txHash,
        blockNumber: storedData.blockNumber,
        confirmations: Math.floor(Math.random() * 100000) + 1000,
        issuer: storedData.data.issuer,
        student: storedData.data.student,
        ipfsHash: storedData.data.ipfsHash,
        timestamp: storedData.timestamp,
        verifiedAt: Date.now(),
        message: "✅ Credential verified on blockchain (Mock)",
      };
    }

    // Mock verification for non-existent hashes
    return {
      isValid: Math.random() > 0.1, // 90% valid, 10% invalid for testing
      txHash: hash.startsWith("0x") ? hash : `0x${hash}`,
      blockNumber: 18234567,
      confirmations: 15234,
      issuer: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD45",
      student:
        "0x8f7d3a2c1e4b5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f",
      ipfsHash: "QmTestHash123",
      timestamp: Date.now() - 86400000, // 1 day ago
      verifiedAt: Date.now(),
      message:
        Math.random() > 0.1
          ? "✅ Valid credential"
          : "❌ Invalid or revoked credential",
    };
  }

  async verifyTransaction(txHash: string) {
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      isValid: true,
      blockNumber: 18234567,
      confirmations: Math.floor(Math.random() * 100000) + 1000,
      timestamp: Date.now(),
      from: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD45",
      to: "0xContractAddress",
      value: "0 ETH",
      gasUsed: "45000",
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
    };
  }

  async getNetworkInfo() {
    return {
      name: "sepolia",
      chainId: 11155111,
      blockHeight: 19543210,
      gasPrice: `${Math.floor(Math.random() * 20) + 10} Gwei`,
      status: "online",
      timestamp: Date.now(),
    };
  }
}

export const mockBlockchainService = new MockBlockchainService();
