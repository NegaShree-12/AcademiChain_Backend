// backend/src/routes/verificationRoutes.js
import express from "express";
import {
  verifyByHash,
  verifyByShareId,
  getBlockchainStatus,
} from "../controllers/verificationController.js";

const router = express.Router();

/**
 * @route   GET /api/verify/status
 * @desc    Get blockchain network status
 * @access  Public
 */
router.get("/status", getBlockchainStatus);

/**
 * @route   GET /api/verify/hash/:hash
 * @desc    Verify credential by transaction hash or credential ID
 * @access  Public
 * @param   {string} hash - Transaction hash (0x...) or credential ID
 */
router.get("/hash/:hash", verifyByHash);

/**
 * @route   GET /api/verify/share/:shareId
 * @desc    Verify credential by share ID (from shared link)
 * @access  Public
 * @param   {string} shareId - Unique share identifier
 */
router.get("/share/:shareId", verifyByShareId);

// Optional: Keep backward compatibility with old routes
router.get("/:shareId", verifyByShareId); // Maps old /:shareId to new verifyByShareId
router.get("/direct/:credentialId", verifyByHash); // Maps old /direct/:id to hash verification

export default router;