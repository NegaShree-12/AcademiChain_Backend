// backend/src/routes/verificationRoutes.js

import express from "express";
import multer from "multer";
import {
  verifyByHash,
  verifyByShareId,
  getBlockchainStatus,
  verifyByDocument,
} from "../controllers/verificationController.js";

const router = express.Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/json'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PNG, JPG, and JSON are allowed.'));
    }
  }
});

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
 */
router.get("/hash/:hash", verifyByHash);

/**
 * @route   GET /api/verify/share/:shareId
 * @desc    Verify credential by share ID (from shared link)
 * @access  Public
 */
router.get("/share/:shareId", verifyByShareId);

/**
 * @route   POST /api/verify/document
 * @desc    Verify credential by document upload
 * @access  Public
 */
router.post("/document", upload.single('document'), verifyByDocument);

export default router;