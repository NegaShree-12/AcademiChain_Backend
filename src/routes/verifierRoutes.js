import express from "express";
import { authenticate, requireVerifier } from "../middleware/authMiddleware.js";
import {
  verifyByDocument,
  verifyByQR,
  verifyById,
  getVerificationHistory,
  generateVerificationReport,
} from "../controllers/verifierController.js";

const router = express.Router();

// All routes require verifier role
router.use(authenticate);
router.use(requireVerifier);

router.post("/verify/document", verifyByDocument);
router.post("/verify/qr", verifyByQR);
router.post("/verify/id", verifyById);
router.get("/history", getVerificationHistory);
router.post("/report", generateVerificationReport);

export default router;