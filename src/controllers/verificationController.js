import Credential from "../models/Credential.js";
import ShareLink from "../models/ShareLink.js";
import { verifyBlockchainCredential } from "../services/blockchain.service.js";
import { v4 as uuidv4 } from "uuid";

// @desc    Verify credential by share ID
// @route   GET /api/verify/:shareId
// @access  Public
export const verifyCredentialByShare = async (req, res) => {
  try {
    const { shareId } = req.params;

    // Find share link
    const shareLink = await ShareLink.findOne({ shareId });

    if (!shareLink) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired share link",
      });
    }

    // Check if share link is active and not expired
    if (!shareLink.isActive) {
      return res.status(400).json({
        success: false,
        message: "This share link has been revoked",
      });
    }

    if (shareLink.expiresAt < new Date()) {
      shareLink.isActive = false;
      await shareLink.save();
      return res.status(400).json({
        success: false,
        message: "This share link has expired",
      });
    }

    // Check access limit
    if (shareLink.maxAccess && shareLink.accessCount >= shareLink.maxAccess) {
      shareLink.isActive = false;
      await shareLink.save();
      return res.status(400).json({
        success: false,
        message: "Maximum number of accesses reached",
      });
    }

    // Find credential
    const credential = await Credential.findOne({
      credentialId: shareLink.credentialId,
    });

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found",
      });
    }

    if (credential.isRevoked) {
      return res.status(400).json({
        success: false,
        message: "This credential has been revoked",
        verificationStatus: "revoked",
      });
    }

    // Verify on blockchain with proper error handling
    let blockchainVerification;
    try {
      console.log(
        `🔍 Verifying credential ${credential.credentialId} on blockchain...`,
      );
      console.log(`📝 Transaction hash: ${credential.blockchainTxHash}`);
      console.log(`📝 Contract address: ${process.env.CONTRACT_ADDRESS}`);

      blockchainVerification = await verifyBlockchainCredential(
        credential.credentialId,
        credential.blockchainTxHash,
      );

      console.log("✅ Blockchain verification result:", blockchainVerification);
    } catch (blockchainError) {
      console.error("❌ Blockchain verification error:", blockchainError);

      // Don't fail the whole request if blockchain is temporarily unavailable
      // Use the credential's stored status as fallback
      blockchainVerification = {
        verified: credential.blockchainStatus === "verified",
        details: {
          error: "Blockchain verification temporarily unavailable",
          message:
            blockchainError instanceof Error
              ? blockchainError.message
              : "Unknown error",
          cached: true,
          fallbackStatus: credential.blockchainStatus,
        },
      };
    }

    // Update access count
    shareLink.accessCount += 1;
    await shareLink.save();

    // Determine verification status
    const isVerified =
      blockchainVerification.verified ||
      credential.blockchainStatus === "verified";
    const verificationStatus = isVerified
      ? "verified"
      : credential.blockchainStatus === "pending"
      ? "pending"
      : "failed";

    res.status(200).json({
      success: true,
      data: {
        credential: {
          id: credential.credentialId,
          title: credential.title,
          description: credential.description,
          studentName: credential.studentName,
          studentEmail: credential.studentEmail,
          institutionName: credential.institutionName,
          institutionId: credential.institutionId,
          issueDate: credential.issueDate,
          expiryDate: credential.expiryDate,
          credentialType: credential.credentialType,
          metadata: credential.metadata,
        },
        verification: {
          status: verificationStatus,
          timestamp: new Date(),
          blockchainTxHash: credential.blockchainTxHash,
          ipfsHash: credential.ipfsHash,
          verifiedOnChain: blockchainVerification.verified || false,
          blockchainNetwork:
            process.env.BLOCKCHAIN_NETWORK ||
            (process.env.SEPOLIA_RPC_URL?.includes("sepolia")
              ? "sepolia"
              : "unknown"),
          details: blockchainVerification.details || {},
          isCached: blockchainVerification.details?.cached || false,
        },
        shareInfo: {
          shareId: shareLink.shareId,
          sharedBy: shareLink.studentName,
          sharedAt: shareLink.createdAt,
          shareType: shareLink.shareType,
          accessNumber: shareLink.accessCount,
          expiresAt: shareLink.expiresAt,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error verifying credential:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying credential",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// @desc    Verify credential directly (for QR scan redirect)
// @route   GET /api/verify/direct/:credentialId
// @access  Public
export const verifyCredentialDirect = async (req, res) => {
  try {
    const { credentialId } = req.params;

    const credential = await Credential.findOne({ credentialId });

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found",
      });
    }

    if (credential.isRevoked) {
      return res.status(400).json({
        success: false,
        message: "This credential has been revoked",
        verificationStatus: "revoked",
      });
    }

    // Verify on blockchain with proper error handling
    let blockchainVerification;
    try {
      console.log(
        `🔍 Direct verification for credential ${credential.credentialId}`,
      );
      blockchainVerification = await verifyBlockchainCredential(
        credential.credentialId,
        credential.blockchainTxHash,
      );
    } catch (blockchainError) {
      console.error(
        "❌ Blockchain verification error (direct):",
        blockchainError,
      );
      blockchainVerification = {
        verified: credential.blockchainStatus === "verified",
        details: {
          error: "Blockchain verification temporarily unavailable",
          cached: true,
        },
      };
    }

    const isVerified =
      blockchainVerification.verified ||
      credential.blockchainStatus === "verified";

    res.status(200).json({
      success: true,
      data: {
        credential: {
          id: credential.credentialId,
          title: credential.title,
          description: credential.description,
          studentName: credential.studentName,
          institutionName: credential.institutionName,
          issueDate: credential.issueDate,
          credentialType: credential.credentialType,
        },
        verification: {
          status: isVerified ? "verified" : "pending",
          timestamp: new Date(),
          blockchainTxHash: credential.blockchainTxHash,
          verifiedOnChain: blockchainVerification.verified || false,
          isCached: blockchainVerification.details?.cached || false,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error verifying credential:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying credential",
    });
  }
};

// @desc    Get credential by ID (for preview before verification)
// @route   GET /api/verify/preview/:credentialId
// @access  Public
export const getCredentialPreview = async (req, res) => {
  try {
    const { credentialId } = req.params;

    const credential = await Credential.findOne({
      credentialId,
      isRevoked: false,
    }).select(
      "title description institutionName issueDate credentialType studentName",
    );

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: credential.credentialId,
        title: credential.title,
        description: credential.description,
        studentName: credential.studentName,
        institutionName: credential.institutionName,
        issueDate: credential.issueDate,
        credentialType: credential.credentialType,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching credential preview:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching credential preview",
    });
  }
};

// @desc    Get blockchain status for frontend
// @route   GET /api/verify/status
// @access  Public
export const getBlockchainStatus = async (req, res) => {
  try {
    const { getBlockchainStatus } = await import(
      "../services/blockchain.service.js"
    );
    const status = await getBlockchainStatus();

    res.status(200).json({
      success: true,
      data: {
        ...status,
        network: process.env.BLOCKCHAIN_NETWORK || "sepolia",
        contractAddress: process.env.CONTRACT_ADDRESS,
      },
    });
  } catch (error) {
    console.error("❌ Error getting blockchain status:", error);
    res.status(500).json({
      success: false,
      message: "Error getting blockchain status",
    });
  }
};