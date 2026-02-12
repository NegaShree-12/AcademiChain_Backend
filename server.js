import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";

import { roleBasedRateLimit, authLimiter } from "./src/middleware/rateLimit.js";
import SocketService from "./src/services/socketService.js";
import { realBlockchainService } from "./src/services/realBlockchainService.js";
import authRoutes from "./src/routes/authRoutes.js";

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

// Rate limiting
app.use(roleBasedRateLimit);
app.use("/api/auth", authLimiter);

// ================= MongoDB Connection =================
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

// ================= Health Check =================
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ================= AUTH ROUTES - MUST COME FIRST =================
app.use("/api/auth", authRoutes);
console.log('✅ Auth routes registered at /api/auth');

// ================= Credential Routes (MongoDB) =================
app.get("/api/credentials", async (req, res) => {
  try {
    const credentials = await Credential.find().sort({ createdAt: -1 });
    res.json({ success: true, data: credentials });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/credentials", async (req, res) => {
  try {
    const credential = await Credential.create({
      ...req.body,
      issueDate: new Date(),
      txHash: `0x${Math.random().toString(16).slice(2)}`,
      blockNumber: Math.floor(Math.random() * 20000000),
    });

    socketService.broadcast("credential-created", credential);
    res.json({ success: true, credential });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= BLOCKCHAIN ROUTES =================
if (process.env.USE_REAL_BLOCKCHAIN === 'true') {
  console.log('🔗 Using REAL blockchain service');

  app.post("/api/blockchain/issue", async (req, res) => {
    try {
      const { studentAddress, studentName, degree, institution } = req.body;
      
      const result = await realBlockchainService.issueCredential(
        studentAddress,
        studentName,
        degree,
        institution
      );
      
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.get("/api/blockchain/credentials/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const credentials = await realBlockchainService.getCredentials(address);
      res.json({ success: true, credentials });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.get("/api/blockchain/verify/:address/:txHash", async (req, res) => {
    try {
      const { address, txHash } = req.params;
      const result = await realBlockchainService.verifyCredential(address, txHash);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.get("/api/blockchain/network", async (req, res) => {
    try {
      const info = await realBlockchainService.getNetworkInfo();
      res.json({ success: true, ...info });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

} else {
  console.log('🔄 Using MOCK blockchain service');
  
  app.post("/api/blockchain/issue", (req, res) => {
    res.json({
      success: true,
      txHash: `0x${Math.random().toString(16).slice(2)}`,
      blockNumber: Math.floor(Math.random() * 20000000),
      timestamp: Date.now(),
      mock: true
    });
  });

  app.get("/api/blockchain/credentials/:address", (req, res) => {
    res.json({
      success: true,
      credentials: [],
      mock: true
    });
  });

  app.get("/api/blockchain/verify/:address/:txHash", (req, res) => {
    res.json({
      success: true,
      isValid: true,
      txHash: req.params.txHash,
      blockNumber: 18234567,
      confirmations: 145678,
      timestamp: Date.now(),
      mock: true
    });
  });

  app.get("/api/blockchain/network", (req, res) => {
    res.json({
      success: true,
      name: "sepolia",
      chainId: 11155111,
      blockHeight: 19543210,
      gasPrice: "10 Gwei",
      status: "connected",
      adminBalance: "0.5",
      adminAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD45",
      mock: true
    });
  });
}

// ================= 404 Handler =================
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: "Route not found",
    path: req.path 
  });
});

// ================= Error Handler =================
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error' 
  });
});

// ================= Start Server =================
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🔗 Blockchain mode: ${process.env.USE_REAL_BLOCKCHAIN === 'true' ? 'REAL' : 'MOCK'}`);
  console.log(`🔐 Auth endpoint: http://localhost:${PORT}/api/auth/wallet-login`);
});