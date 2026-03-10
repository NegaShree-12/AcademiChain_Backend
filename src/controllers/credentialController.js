// backend/src/controllers/credentialController.js

import Credential from "../models/Credential.js";
import ShareLink from "../models/ShareLink.js";
import { generateQRCode } from '../utils/qrCode.js';
import { v4 as uuidv4 } from "uuid";

// @desc    Get all credentials for a student
// @route   GET /api/student/credentials
// @access  Private (Student)
export const getStudentCredentials = async (req, res) => {
  try {
    // Get the actual MongoDB _id from the user object
    const userId = req.user?.id; // This is the MongoDB _id
    const studentEmail = req.user?.email;

    console.log("📋 Fetching credentials for student:", { userId, studentEmail });

    if (!userId && !studentEmail) {
      return res.status(400).json({
        success: false,
        message: "Student information not found",
      });
    }

    // Build query using MongoDB _id as studentId
    const query = {
      $or: []
    };

    if (userId) {
      query.$or.push({ studentId: userId.toString() });
    }
    
    if (studentEmail) {
      query.$or.push({ studentEmail: studentEmail });
    }

    console.log("🔍 Query:", JSON.stringify(query));

    const credentials = await Credential.find(query)
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${credentials.length} credentials for student`);

    const stats = {
      total: credentials.length,
      verified: credentials.filter((c) => c.blockchainStatus === "verified").length,
      pending: credentials.filter((c) => c.blockchainStatus === "pending").length,
      revoked: credentials.filter((c) => c.isRevoked).length,
    };

    res.status(200).json({
      success: true,
      data: credentials,
      stats,
    });
  } catch (error) {
    console.error("Error fetching credentials:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching credentials",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// @desc    Get single credential by ID
// @route   GET /api/student/credentials/:id
// @access  Private (Student)
export const getCredentialById = async (req, res) => {
  try {
    const { id } = req.params;
    // Get the actual MongoDB _id from the user object
    const userId = req.user?.id;
    const studentEmail = req.user?.email;

    console.log("🔍 Looking for credential:", id);
    console.log("👤 User ID (MongoDB _id):", userId);
    console.log("👤 Student Email:", studentEmail);

    if (!userId && !studentEmail) {
      return res.status(400).json({
        success: false,
        message: "Student information not found",
      });
    }

    // Build query - use the MongoDB _id as studentId
    const query = {
      $or: []
    };

    if (userId) {
      query.$or.push({ studentId: userId.toString() });
    }

    if (studentEmail) {
      query.$or.push({ studentEmail: studentEmail });
    }

    console.log("📋 Query:", JSON.stringify(query));

    let credential = null;

    // Try to find by credentialId first (this is the CRED-xxxxx format)
    credential = await Credential.findOne({
      credentialId: id,
      ...query
    });

    // If not found, try by _id (only if it looks like an ObjectId)
    if (!credential && id.match(/^[0-9a-fA-F]{24}$/)) {
      credential = await Credential.findOne({
        _id: id,
        ...query
      });
    }

    // If not found, try by blockchainTxHash
    if (!credential) {
      credential = await Credential.findOne({
        blockchainTxHash: id,
        ...query
      });
    }

    if (!credential) {
      // For debugging, list all credentials for this user
      const allCredentials = await Credential.find({
        $or: [
          { studentId: userId?.toString() },
          { studentEmail: studentEmail }
        ]
      }).select('credentialId title studentId studentEmail');
      
      console.log("📋 All credentials for this user:", allCredentials);
      
      return res.status(404).json({
        success: false,
        message: "Credential not found",
        debug: {
          searchedId: id,
          userId: userId,
          studentEmail: studentEmail,
          availableCredentials: allCredentials
        }
      });
    }

    console.log("✅ Credential found:", credential.credentialId);
    
    // Get share links for this credential
    const shareLinks = await ShareLink.find({
      credentialId: credential.credentialId,
      studentId: userId?.toString(),
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: credential,
      shareLinks,
    });
  } catch (error) {
    console.error("Error fetching credential:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching credential",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// @desc    Generate share link and QR code for credential
// @route   POST /api/student/credentials/:id/share
// @access  Private (Student)
export const generateShareLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { shareType = "public", expiresInDays = 7, maxAccess } = req.body;
    const userId = req.user?.id; // MongoDB _id
    const studentName = req.user?.name;

    console.log("📤 Generating share link for credential:", id);
    console.log("👤 User ID:", userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found",
      });
    }

    // Find credential
    const credential = await Credential.findOne({
      $or: [
        { credentialId: id },
        { _id: id },
        { blockchainTxHash: id }
      ],
      $or: [
        { studentId: userId.toString() },
        { studentEmail: req.user?.email }
      ]
    });

    if (!credential) {
      console.log("❌ Credential not found:", id);
      return res.status(404).json({
        success: false,
        message: "Credential not found",
      });
    }

    if (credential.isRevoked) {
      return res.status(400).json({
        success: false,
        message: "Cannot share revoked credential",
      });
    }

    // Check if a share link already exists for this credential
    const existingShare = await ShareLink.findOne({
      credentialId: credential.credentialId,
      studentId: userId.toString(),
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (existingShare) {
      console.log("✅ Using existing share link:", existingShare.shareId);
      
      // Generate QR code for existing share
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const existingQrCode = await generateQRCode(`${baseUrl}/verify?shareId=${existingShare.shareId}`);
      
      return res.status(200).json({
        success: true,
        data: {
          shareId: existingShare.shareId,
          shareUrl: `${baseUrl}/verify?shareId=${existingShare.shareId}`,
          expiresAt: existingShare.expiresAt,
          shareLink: existingShare,
          qrCode: existingQrCode,
        },
      });
    }

    // Generate unique share ID
    const shareId = uuidv4();

    // Create share link URL
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/verify?shareId=${shareId}`;

    console.log("🔗 Share URL:", shareUrl);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays.toString()));

    // Generate QR code
    console.log("📱 Generating QR code for:", shareUrl);
    const qrCode = await generateQRCode(shareUrl);
    console.log("✅ QR Code generated:", qrCode ? "Success" : "Failed");

    // Create new share link record
    const shareLink = await ShareLink.create({
      shareId,
      credentialId: credential.credentialId,
      credentialTitle: credential.title,
      studentId: userId.toString(),
      studentName,
      shareType,
      expiresAt,
      maxAccess: maxAccess ? parseInt(maxAccess.toString()) : undefined,
      isActive: true,
      accessCount: 0,
      qrCode,
    });

    console.log("✅ New share link created:", shareId);

    res.status(201).json({
      success: true,
      data: {
        shareId,
        shareUrl,
        expiresAt,
        shareLink,
        qrCode,
      },
    });
  } catch (error) {
    console.error("❌ Error generating share link:", error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A share link for this credential already exists",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Error generating share link",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// @desc    Get all share links for a student
// @route   GET /api/student/shares
// @access  Private (Student)
export const getStudentShares = async (req, res) => {
  try {
    const userId = req.user?.id;

    const shareLinks = await ShareLink.find({
      studentId: userId?.toString(),
    }).sort({ createdAt: -1 });

    const activeShares = shareLinks.filter(
      (s) => s.isActive && new Date(s.expiresAt) > new Date(),
    );
    const expiredShares = shareLinks.filter(
      (s) => !s.isActive || new Date(s.expiresAt) <= new Date(),
    );

    res.status(200).json({
      success: true,
      data: shareLinks,
      stats: {
        total: shareLinks.length,
        active: activeShares.length,
        expired: expiredShares.length,
        totalAccesses: shareLinks.reduce((sum, s) => sum + (s.accessCount || 0), 0),
      },
    });
  } catch (error) {
    console.error("Error fetching share links:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching share links",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// @desc    Revoke a share link
// @route   PUT /api/student/shares/:shareId/revoke
// @access  Private (Student)
export const revokeShareLink = async (req, res) => {
  try {
    const { shareId } = req.params;
    const userId = req.user?.id;

    const shareLink = await ShareLink.findOne({ 
      shareId, 
      studentId: userId?.toString() 
    });

    if (!shareLink) {
      return res.status(404).json({
        success: false,
        message: "Share link not found",
      });
    }

    shareLink.isActive = false;
    await shareLink.save();

    res.status(200).json({
      success: true,
      message: "Share link revoked successfully",
      data: shareLink,
    });
  } catch (error) {
    console.error("Error revoking share link:", error);
    res.status(500).json({
      success: false,
      message: "Error revoking share link",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// @desc    Get student dashboard statistics
// @route   GET /api/student/dashboard/stats
// @access  Private (Student)
export const getStudentDashboardStats = async (req, res) => {
  try {
    const userId = req.user?.id;

    const [credentials, shares, recentActivity] = await Promise.all([
      Credential.find({ 
        $or: [
          { studentId: userId?.toString() },
          { studentEmail: req.user?.email }
        ] 
      }).sort({ createdAt: -1 }),
      ShareLink.find({ studentId: userId?.toString() }).sort({ createdAt: -1 }),
      getRecentActivity(userId?.toString(), req.user?.email),
    ]);

    const stats = {
      totalCredentials: credentials.length,
      verifiedCredentials: credentials.filter(
        (c) => c.blockchainStatus === "verified",
      ).length,
      pendingCredentials: credentials.filter(
        (c) => c.blockchainStatus === "pending",
      ).length,
      activeShares: shares.filter((s) => s.isActive && new Date(s.expiresAt) > new Date())
        .length,
      totalVerifications: shares.reduce((sum, s) => sum + (s.accessCount || 0), 0),
      recentActivity,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Helper function to get recent activity
async function getRecentActivity(studentId, studentEmail) {
  const recentShares = await ShareLink.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(5);

  const recentCredentials = await Credential.find({
    $or: [
      { studentId },
      { studentEmail }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(5);

  const activity = [
    ...recentShares.map((s) => ({
      type: "share_created",
      title: `Shared: ${s.credentialTitle}`,
      timestamp: s.createdAt,
      metadata: { shareId: s.shareId, accessCount: s.accessCount },
    })),
    ...recentCredentials.map((c) => ({
      type: "credential_issued",
      title: `Received: ${c.title}`,
      timestamp: c.createdAt,
      metadata: {
        credentialId: c.credentialId,
        institution: c.institutionName,
      },
    })),
  ];

  return activity
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}