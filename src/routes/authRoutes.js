import express from "express";
import { walletLogin, updateRole, getProfile, logout } from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/wallet-login", walletLogin);

// Protected routes (require authentication)
router.get("/me", authenticate, getProfile);
router.post("/logout", authenticate, logout);
router.put("/role", authenticate, updateRole);

export default router;