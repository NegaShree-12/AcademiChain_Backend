// backend/src/routes/studentRoutes.js

import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  getStudentCredentials,
  getCredentialById,
  generateShareLink,
  getStudentShares,
  revokeShareLink,
  getStudentDashboardStats,
} from "../controllers/credentialController.js";

const router = express.Router();

// All routes are protected and only accessible by students
router.use(protect);
router.use(authorize("student"));

// Dashboard stats
router.get("/dashboard/stats", getStudentDashboardStats);

// Credentials routes
router.get("/credentials", getStudentCredentials);
router.get("/credentials/:id", getCredentialById);
router.post("/credentials/:id/share", generateShareLink); // <-- This endpoint needs to be implemented

// Share links routes
router.get("/shares", getStudentShares);
router.put("/shares/:shareId/revoke", revokeShareLink);

export default router;