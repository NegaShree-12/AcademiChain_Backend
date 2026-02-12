// backend/src/routes/studentRoutes.ts
import express from "express";
import { authenticate, requireStudent } from "../middleware/authMiddleware";
import {
  getStudentCredentials,
  shareCredential,
  getVerificationHistory,
  requestVerification,
} from "../controllers/studentController";

const router = express.Router();

// All routes require student role
router.use(authenticate, requireStudent);

router.get("/credentials", getStudentCredentials);
router.post("/credentials/:id/share", shareCredential);
router.get("/verifications", getVerificationHistory);
router.post("/verifications/request", requestVerification);

export default router;

// backend/src/routes/institutionRoutes.ts
import express from "express";
import { authenticate, requireInstitution } from "../middleware/authMiddleware";
import {
  uploadCredential,
  bulkUpload,
  getIssuedCredentials,
  revokeCredential,
  getInstitutionStats,
} from "../controllers/institutionController";

const router = express.Router();

// All routes require institution role
router.use(authenticate, requireInstitution);

router.post("/credentials/upload", uploadCredential);
router.post("/credentials/bulk-upload", bulkUpload);
router.get("/credentials/issued", getIssuedCredentials);
router.post("/credentials/:id/revoke", revokeCredential);
router.get("/stats", getInstitutionStats);

export default router;

// backend/src/routes/verifierRoutes.ts
import express from "express";
import { authenticate, requireVerifier } from "../middleware/authMiddleware";
import {
  verifyByDocument,
  verifyByQR,
  verifyById,
  getVerificationHistory,
  generateVerificationReport,
} from "../controllers/verifierController";

const router = express.Router();

// All routes require verifier role
router.use(authenticate, requireVerifier);

router.post("/verify/document", verifyByDocument);
router.post("/verify/qr", verifyByQR);
router.post("/verify/id", verifyById);
router.get("/history", getVerificationHistory);
router.post("/report", generateVerificationReport);

export default router;
