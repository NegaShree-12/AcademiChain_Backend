// backend/src/controllers/verifierController.ts
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import Credential from "../models/Credential";
import Verification from "../models/Verification";
import { blockchainService } from "../services/blockchainService";
import { ipfsService } from "../services/ipfsService";

export const verifyByDocument = async (req: AuthRequest, res: Response) => {
  try {
    const verifierId = req.user!.id;
    const { fileHash, documentType } = req.body;

    // Hash the uploaded document and compare with blockchain
    const credential = await Credential.findOne({ fileHash });

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found",
      });
    }

    // Verify on blockchain
    const blockchainResult = await blockchainService.verifyCredential(
      credential.txHash,
    );

    // Create verification record
    const verification = new Verification({
      credentialId: credential._id,
      verifierId,
      method: "upload",
      result: blockchainResult.isValid,
      blockchainConfirmation: blockchainResult,
      metadata: { documentType },
    });

    await verification.save();

    res.json({
      success: true,
      isValid: blockchainResult.isValid,
      credential,
      verification: {
        id: verification._id,
        timestamp: verification.verifiedAt,
      },
    });
  } catch (error) {
    console.error("Document verification error:", error);
    res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
};

export const verifyByQR = async (req: AuthRequest, res: Response) => {
  try {
    const verifierId = req.user!.id;
    const { qrData } = req.body;

    // Parse QR data to get credential ID or hash
    const credential = await Credential.findOne({
      $or: [{ _id: qrData }, { txHash: qrData }, { shareId: qrData }],
    });

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found",
      });
    }

    // Verify on blockchain
    const blockchainResult = await blockchainService.verifyCredential(
      credential.txHash,
    );

    // Create verification record
    const verification = new Verification({
      credentialId: credential._id,
      verifierId,
      method: "qr",
      result: blockchainResult.isValid,
      blockchainConfirmation: blockchainResult,
    });

    await verification.save();

    res.json({
      success: true,
      isValid: blockchainResult.isValid,
      credential,
      verification: {
        id: verification._id,
        timestamp: verification.verifiedAt,
      },
    });
  } catch (error) {
    console.error("QR verification error:", error);
    res.status(500).json({
      success: false,
      message: "QR verification failed",
    });
  }
};

export const verifyById = async (req: AuthRequest, res: Response) => {
  try {
    const verifierId = req.user!.id;
    const { credentialId, verificationId } = req.body;

    let credential;

    if (credentialId) {
      credential = await Credential.findById(credentialId);
    } else if (verificationId) {
      credential = await Credential.findOne({ shareId: verificationId });
    } else {
      return res.status(400).json({
        success: false,
        message: "Credential ID or verification ID required",
      });
    }

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found",
      });
    }

    // Verify on blockchain
    const blockchainResult = await blockchainService.verifyCredential(
      credential.txHash,
    );

    // Create verification record
    const verification = new Verification({
      credentialId: credential._id,
      verifierId,
      method: "id",
      result: blockchainResult.isValid,
      blockchainConfirmation: blockchainResult,
    });

    await verification.save();

    res.json({
      success: true,
      isValid: blockchainResult.isValid,
      credential,
      verification: {
        id: verification._id,
        timestamp: verification.verifiedAt,
      },
    });
  } catch (error) {
    console.error("ID verification error:", error);
    res.status(500).json({
      success: false,
      message: "ID verification failed",
    });
  }
};

export const getVerificationHistory = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const verifierId = req.user!.id;
    const { limit = 50, page = 1 } = req.query;

    const verifications = await Verification.find({ verifierId })
      .populate("credentialId")
      .sort({ verifiedAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await Verification.countDocuments({ verifierId });

    res.json({
      success: true,
      data: verifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get verification history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification history",
    });
  }
};

export const generateVerificationReport = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const verifierId = req.user!.id;
    const { verificationId, format = "pdf" } = req.body;

    const verification = await Verification.findById(verificationId)
      .populate("credentialId")
      .populate("verifierId");

    if (!verification || verification.verifierId.toString() !== verifierId) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    // Generate report data
    const reportData = {
      verificationId: verification._id,
      credential: verification.credentialId,
      result: verification.result,
      verifiedAt: verification.verifiedAt,
      method: verification.method,
      blockchainInfo: verification.blockchainConfirmation,
      verifier: verification.verifierId,
    };

    // Return report data (frontend can format as PDF)
    res.json({
      success: true,
      report: reportData,
      format,
    });
  } catch (error) {
    console.error("Generate report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
};
