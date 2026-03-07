import express from "express";
import {
  verifyCredentialByShare,
  verifyCredentialDirect,
  getCredentialPreview,
  getBlockchainStatus,
} from "../controllers/verificationController.js";

const router = express.Router();

// Public routes for verification
router.get("/status", getBlockchainStatus);
router.get("/:shareId", verifyCredentialByShare);
router.get("/direct/:credentialId", verifyCredentialDirect);
router.get("/preview/:credentialId", getCredentialPreview);

export default router;