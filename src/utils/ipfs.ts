// /utils/ipfs.ts - Real IPFS upload
export const uploadToIPFS = async (credentialData: any): Promise<string> => {
  try {
    // Convert to JSON and upload
    const data = JSON.stringify(credentialData);
    const blob = new Blob([data], { type: "application/json" });

    const formData = new FormData();
    formData.append("file", blob, "credential.json");

    const response = await axios.post(
      "https://api.web3.storage/upload",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.WEB3_STORAGE_TOKEN}`,
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return response.data.cid;
  } catch (error) {
    console.error("IPFS upload error:", error);
    throw error;
  }
};
