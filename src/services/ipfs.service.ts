import { Web3Storage } from "web3.storage";

export class IPFSService {
  private client: Web3Storage;

  constructor() {
    this.client = new Web3Storage({
      token: process.env.WEB3_STORAGE_TOKEN!,
    });
  }

  async uploadCredential(credentialData: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(credentialData);
      const blob = new Blob([jsonString], { type: "application/json" });
      const file = new File([blob], "credential.json");

      const cid = await this.client.put([file], {
        name: `credential-${Date.now()}`,
        wrapWithDirectory: false,
      });

      return cid;
    } catch (error) {
      console.error("IPFS upload error:", error);
      throw new Error("Failed to upload to IPFS");
    }
  }

  async getCredential(cid: string): Promise<any> {
    try {
      const res = await this.client.get(cid);
      if (!res?.ok) {
        throw new Error("Failed to fetch from IPFS");
      }

      const files = await res.files();
      const file = files[0];
      const text = await file.text();

      return JSON.parse(text);
    } catch (error) {
      console.error("IPFS fetch error:", error);
      throw new Error("Failed to fetch from IPFS");
    }
  }
}

export const ipfsService = new IPFSService();
