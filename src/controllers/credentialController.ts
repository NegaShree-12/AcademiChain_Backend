import { Request, Response } from "express";
import Credential from "../models/Credential";
import User from "../models/User";
import ShareLink from "../models/ShareLink";
import { blockchainService } from "../utils/blockchain";
import { ipfsService } from "../utils/ipfs";

export const getCredentials = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const credentials = await Credential.find({ studentId: userId })
      .sort({ createdAt: -1 })
      .populate("issuerId", "name institution")
      .lean();

    res.json(credentials);
  } catch (error) {
    console.error("Error fetching credentials:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getCredentialById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const credential = await Credential.findOne({
      _id: id,
      studentId: userId,
    })
      .populate("issuerId", "name institution")
      .lean();

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    res.json(credential);
  } catch (error) {
    console.error("Error fetching credential:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const createCredential = async (req: Request, res: Response) => {
  try {
    const issuerId = (req as any).user.id;
    const { studentWallet, title, type, institution, description, metadata } =
      req.body;

    // Find student by wallet address
    const student = await User.findOne({
      walletAddress: studentWallet.toLowerCase(),
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Create credential data
    const credentialData = {
      title,
      type,
      institution,
      description,
      metadata,
      issueDate: new Date(),
      studentName: student.name,
      studentEmail: student.email,
      issuerName: (req as any).user.name,
    };

    // Upload to IPFS
    const ipfsHash = await ipfsService.uploadCredential(credentialData);

    // Issue on blockchain
    const blockchainResult = await blockchainService.issueCredential(
      student.walletAddress,
      ipfsHash,
    );

    // Save to database
    const credential = new Credential({
      studentId: student._id,
      issuerId,
      title,
      type,
      institution,
      description,
      ipfsHash,
      txHash: blockchainResult.txHash,
      blockNumber: blockchainResult.blockNumber,
      metadata,
      status: "issued",
    });

    await credential.save();

    res.status(201).json({
      message: "Credential issued successfully",
      credential: {
        id: credential._id,
        title: credential.title,
        txHash: credential.txHash,
        ipfsHash: credential.ipfsHash,
      },
    });
  } catch (error) {
    console.error("Error creating credential:", error);
    res.status(500).json({ message: "Failed to issue credential" });
  }
};

export const shareCredential = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const { expiresAt, requiresPassword, oneTimeUse, maxViews, allowDownload } =
      req.body;

    // Verify credential ownership
    const credential = await Credential.findOne({
      _id: id,
      studentId: userId,
    });

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    // Generate share link
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const shareLink = `${baseUrl}/verify/${credential.txHash}`;

    // Create share record
    const share = new ShareLink({
      credentialId: credential._id,
      createdBy: userId,
      link: shareLink,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      settings: {
        requiresPassword: requiresPassword || false,
        oneTimeUse: oneTimeUse || false,
        allowDownload: allowDownload !== false, // Default true
        maxViews: maxViews || undefined,
      },
    });

    await share.save();

    res.json({
      message: "Share link created successfully",
      share: {
        id: share._id,
        shareId: share.shareId,
        link: share.link,
        expiresAt: share.expiresAt,
        settings: share.settings,
      },
    });
  } catch (error) {
    console.error("Error sharing credential:", error);
    res.status(500).json({ message: "Failed to create share link" });
  }
};

export const verifyCredential = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    // Check if hash is a transaction hash or credential ID
    let credential;

    if (hash.startsWith("0x")) {
      // It's a transaction hash
      credential = await Credential.findOne({ txHash: hash })
        .populate("studentId", "name email")
        .populate("issuerId", "name institution");
    } else {
      // It's a credential ID
      credential = await Credential.findById(hash)
        .populate("studentId", "name email")
        .populate("issuerId", "name institution");
    }

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    // Verify on blockchain
    const blockchainVerification = await blockchainService.verifyCredential(
      credential.txHash,
    );

    // Get credential data from IPFS
    const ipfsData = await ipfsService.getCredential(credential.ipfsHash);

    res.json({
      isValid: blockchainVerification.isValid,
      credential: {
        id: credential._id,
        title: credential.title,
        type: credential.type,
        institution: credential.institution,
        issueDate: credential.issueDate,
        description: credential.description,
        metadata: credential.metadata,
        status: credential.status,
        student: credential.studentId,
        issuer: credential.issuerId,
      },
      verification: {
        txHash: blockchainVerification.txHash,
        blockNumber: blockchainVerification.blockNumber,
        confirmations: blockchainVerification.confirmations,
        verifiedAt: new Date().toISOString(),
        issuer: {
          address: blockchainVerification.issuer,
          verified: true,
        },
      },
      ipfsData,
    });
  } catch (error) {
    console.error("Error verifying credential:", error);
    res.status(500).json({ message: "Failed to verify credential" });
  }
};
