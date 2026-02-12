import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";

import { roleBasedRateLimit, authLimiter } from "./src/middleware/rateLimit.js";
import SocketService from "./src/services/socketService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

// Initialize Socket.IO
const socketService = new SocketService(server);
export { socketService };

// ================= Middleware =================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(roleBasedRateLimit);
app.use("/api/auth", authLimiter);

mongoose.connect(process.env.MONGODB_URI, {
  tls: true,
  tlsAllowInvalidCertificates: true,
  tlsAllowInvalidHostnames: true,
  serverSelectionTimeoutMS: 5000,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err.message));

// ================= Schemas =================
const CredentialSchema = new mongoose.Schema(
  {
    title: String,
    type: String,
    institution: String,
    description: String,
    issueDate: Date,
    txHash: String,
    blockNumber: Number,
    status: { type: String, default: "issued" },
    studentName: String,
    studentEmail: String,
    issuerName: String,
    ipfsHash: String,
    metadata: Object,
  },
  { timestamps: true }
);

const StudentSchema = new mongoose.Schema({
  name: String,
  email: String,
  walletAddress: String,
  status: String,
  enrollmentDate: String,
  program: String,
});

const Credential = mongoose.model("Credential", CredentialSchema);
const Student = mongoose.model("Student", StudentSchema);

// ================= Routes =================

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

app.get("/api/credentials", async (req, res) => {
  const credentials = await Credential.find().sort({ createdAt: -1 });
  res.json({ success: true, data: credentials });
});

app.post("/api/credentials", async (req, res) => {
  const credential = await Credential.create({
    ...req.body,
    issueDate: new Date(),
    txHash: `0x${Math.random().toString(16).slice(2)}`,
    blockNumber: Math.floor(Math.random() * 20000000),
  });

  socketService.broadcast("credential-created", credential);

  res.json({ success: true, credential });
});

app.post("/api/auth/wallet-login", (req, res) => {
  const { walletAddress } = req.body;
  
  console.log("📝 Wallet login attempt:", walletAddress);

  // Return user with EMPTY role to trigger role selection
  res.json({
    success: true,
    token: "mock_jwt_token_" + Math.random().toString(36).substring(2),
    user: {
      id: "1",
      email: `user-${walletAddress?.slice(2, 8) || "test"}@example.com`,
      name: `User ${walletAddress?.slice(2, 8) || "Test"}`,
      walletAddress: walletAddress || "0x0000000000000000000000000000000000000000",
      role: "",  // ← EMPTY ROLE - THIS IS CRITICAL!
      institution: null
    }
  });
});

// 404 handler (Express 5 compatible)
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});



server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
