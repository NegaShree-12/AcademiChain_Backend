import Credential from "../models/Credential.js";
import ShareLink from "../models/ShareLink.js";
import { generateQRCode } from "../utils/qrCode.js";
import { v4 as uuidv4 } from "uuid";

// @desc    Get all credentials for a student
// @route   GET /api/student/credentials
// @access  Private (Student)
// backend/src/controllers/credentialController.js

// @desc    Get all credentials for a student
// @route   GET /api/student/credentials
// @access  Private (Student)
export const getStudentCredentials = async (req, res) => {
  try {
    // Get student info from auth token
    const studentId = req.user?.id;
    const studentEmail = req.user?.email;

    console.log("📋 Fetching credentials for student:", { studentId, studentEmail });

    if (!studentId && !studentEmail) {
      return res.status(400).json({
        success: false,
        message: "Student information not found",
      });
    }

    // Find credentials by student email OR student ID
    const credentials = await Credential.find({
      $or: [
        { studentEmail: studentEmail },
        { studentId: studentId }
      ],
      isRevoked: false,
    }).sort({ createdAt: -1 });

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
    const studentId = req.user?.studentId || req.user?.id;

    const credential = await Credential.findOne({
      credentialId: id,
      studentId,
    });

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found",
      });
    }

    // Get share links for this credential
    const shareLinks = await ShareLink.find({
      credentialId: id,
      studentId,
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
// @desc    Generate share link and QR code for credential
// @route   POST /api/student/credentials/:id/share
// @access  Private (Student)
export const generateShareLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { shareType = "public", expiresInDays = 7, maxAccess } = req.body;
    const studentId = req.user?.studentId || req.user?.id;
    const studentName = req.user?.name;

    console.log("📤 Generating share link for credential:", id);
    console.log("👤 Student ID:", studentId);

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID not found",
      });
    }

    // Find credential
    const credential = await Credential.findOne({
      credentialId: id,
      studentId,
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

    // Generate unique share ID
    const shareId = uuidv4();

    // Create share link URL - USE YOUR ACTUAL DOMAIN, NOT LOCALHOST
    const baseUrl = process.env.FRONTEND_URL || "https://yourdomain.com";
    const shareUrl = `${baseUrl}/verify?shareId=${shareId}`;

    console.log("🔗 Share URL:", shareUrl);

    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(shareUrl);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays.toString()));

    // Create share link record
    const shareLink = await ShareLink.create({
      shareId,
      credentialId: credential.credentialId,
      credentialTitle: credential.title,
      studentId,
      studentName,
      shareType,
      expiresAt,
      maxAccess: maxAccess ? parseInt(maxAccess.toString()) : undefined,
      qrCode: qrCodeDataUrl,
      isActive: true,
      accessCount: 0,
    });

    console.log("✅ Share link created:", shareId);

    res.status(201).json({
      success: true,
      data: {
        shareId,
        shareUrl,
        qrCode: qrCodeDataUrl,
        expiresAt,
        shareLink,
      },
    });
  } catch (error) {
    console.error("❌ Error generating share link:", error);
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
    const studentId = req.user?.studentId || req.user?.id;

    const shareLinks = await ShareLink.find({
      studentId,
    }).sort({ createdAt: -1 });

    const activeShares = shareLinks.filter(
      (s) => s.isActive && s.expiresAt > new Date(),
    );
    const expiredShares = shareLinks.filter(
      (s) => !s.isActive || s.expiresAt <= new Date(),
    );

    res.status(200).json({
      success: true,
      data: shareLinks,
      stats: {
        total: shareLinks.length,
        active: activeShares.length,
        expired: expiredShares.length,
        totalAccesses: shareLinks.reduce((sum, s) => sum + s.accessCount, 0),
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
    const studentId = req.user?.studentId || req.user?.id;

    const shareLink = await ShareLink.findOne({ shareId, studentId });

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
    const studentId = req.user?.studentId || req.user?.id;

    const [credentials, shares, recentActivity] = await Promise.all([
      Credential.find({ studentId }).sort({ createdAt: -1 }),
      ShareLink.find({ studentId }).sort({ createdAt: -1 }),
      getRecentActivity(studentId),
    ]);

    const stats = {
      totalCredentials: credentials.length,
      verifiedCredentials: credentials.filter(
        (c) => c.blockchainStatus === "verified",
      ).length,
      pendingCredentials: credentials.filter(
        (c) => c.blockchainStatus === "pending",
      ).length,
      activeShares: shares.filter((s) => s.isActive && s.expiresAt > new Date())
        .length,
      totalVerifications: shares.reduce((sum, s) => sum + s.accessCount, 0),
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
async function getRecentActivity(studentId) {
  const recentShares = await ShareLink.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(5);

  const recentCredentials = await Credential.find({ studentId })
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
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);
}