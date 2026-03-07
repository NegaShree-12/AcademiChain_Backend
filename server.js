import dotenv from "dotenv";
dotenv.config();
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";

import { roleBasedRateLimit, authLimiter } from "./src/middleware/rateLimit.js";
import SocketService from "./src/services/socketService.js";
import { realBlockchainService } from "./src/services/realBlockchainService.js";
import authRoutes from "./src/routes/authRoutes.js";
import studentRoutes from "./src/routes/studentRoutes.js";
import verificationRoutes from "./src/routes/verificationRoutes.js";

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

// Initialize Socket.IO
const socketService = new SocketService(server);
export { socketService };

// ================= CORS Configuration =================
// ================= CORS Configuration =================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://c0d4e85db19593.lhr.life',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('❌ CORS blocked for origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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

// ================= ROUTES =================
app.get("/api/health", (req, res) => {
  res.json({ 
    success: true, 
    status: "OK", 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL
  });
});

// Auth Routes
app.use("/api/auth", authRoutes);
console.log('✅ Auth routes registered at /api/auth');

// Student Routes
app.use("/api/student", studentRoutes);
console.log('✅ Student routes registered at /api/student');

// Verification Routes
app.use("/api/verify", verificationRoutes);
console.log('✅ Verification routes registered at /api/verify');

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
  console.log(`🌐 CORS allowed origins:`);
  allowedOrigins.forEach(origin => {
    if (origin instanceof RegExp) {
      console.log(`   - ${origin.toString()}`);
    } else {
      console.log(`   - ${origin}`);
    }
  });
});