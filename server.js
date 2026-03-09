import dotenv from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables FIRST with explicit path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force load .env from the correct path
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug: Check if env vars are loaded
console.log('🔍 Environment check:');
console.log('   SEPOLIA_RPC_URL:', process.env.SEPOLIA_RPC_URL ? '✅ Found' : '❌ Missing');
console.log('   CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS ? '✅ Found' : '❌ Missing');
console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Found' : '❌ Missing');
console.log('   USE_REAL_BLOCKCHAIN:', process.env.USE_REAL_BLOCKCHAIN);

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
import institutionRoutes from "./src/routes/institutionRoutes.js";


const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

// Initialize Socket.IO
const socketService = new SocketService(server);
export { socketService };

// ================= CORS Configuration =================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://c0d4e85db19593.lhr.life',
  process.env.FRONTEND_URL,
  process.env.FRONTEND_PUBLIC_URL
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
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, {
  tls: true,
  tlsAllowInvalidCertificates: true,
  tlsAllowInvalidHostnames: true,
  serverSelectionTimeoutMS: 5000,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// ================= ROUTES =================
app.get("/api/health", (req, res) => {
  res.json({ 
    success: true, 
    status: "OK", 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL,
    blockchain: {
      mode: process.env.USE_REAL_BLOCKCHAIN === 'true' ? 'REAL' : 'MOCK',
      contract: process.env.CONTRACT_ADDRESS,
      network: 'sepolia'
    }
  });
});

// Auth Routes

app.use("/api/institution", institutionRoutes);
console.log('✅ Institution routes registered at /api/institution');

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

  // Issue credential
  app.post("/api/blockchain/issue", async (req, res) => {
    try {
      const { studentAddress, studentName, degree, institution } = req.body;
      
      // Validate required fields
      if (!studentAddress || !studentName || !degree || !institution) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields' 
        });
      }

      const result = await realBlockchainService.issueCredential(
        studentAddress,
        studentName,
        degree,
        institution
      );
      
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('❌ Blockchain issue error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Get credentials for an address
  app.get("/api/blockchain/credentials/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      if (!address) {
        return res.status(400).json({ 
          success: false, 
          error: 'Address is required' 
        });
      }

      const credentials = await realBlockchainService.getCredentials(address);
      res.json({ success: true, credentials });
    } catch (error) {
      console.error('❌ Get credentials error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Verify credential by transaction hash
  app.get("/api/blockchain/verify/:txHash", async (req, res) => {
    try {
      const { txHash } = req.params;
      
      if (!txHash) {
        return res.status(400).json({ 
          success: false, 
          error: 'Transaction hash is required' 
        });
      }

      const result = await realBlockchainService.verifyCredential(txHash);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('❌ Verify error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Get network info
  app.get("/api/blockchain/network", async (req, res) => {
    try {
      const info = await realBlockchainService.getNetworkInfo();
      res.json({ success: true, ...info });
    } catch (error) {
      console.error('❌ Network info error:', error);
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
      credentials: [
        {
          studentName: "John Doe",
          degree: "Bachelor of Computer Science",
          institution: "Massachusetts Institute of Technology",
          issueDate: new Date().toISOString()
        },
        {
          studentName: "Jane Smith",
          degree: "Master of Data Science",
          institution: "Stanford University",
          issueDate: new Date().toISOString()
        }
      ],
      mock: true
    });
  });

  app.get("/api/blockchain/verify/:txHash", (req, res) => {
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
      contractAddress: process.env.CONTRACT_ADDRESS || "0xB6bBF827561e9004b6120B3777E6B8343EeF73c8",
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
  console.log('\n' + '='.repeat(50));
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log('='.repeat(50));
  console.log(`🔗 Blockchain mode: ${process.env.USE_REAL_BLOCKCHAIN === 'true' ? 'REAL' : 'MOCK'}`);
  console.log(`📄 Contract address: ${process.env.CONTRACT_ADDRESS || 'Not set'}`);
  console.log(`🌐 Network: Sepolia`);
  console.log('\n📡 Endpoints:');
  console.log(`   🔐 Auth: http://localhost:${PORT}/api/auth/wallet-login`);
  console.log(`   ✅ Health: http://localhost:${PORT}/api/health`);
  console.log(`   🔍 Verify status: http://localhost:${PORT}/api/verify/status`);
  console.log(`   🔍 Verify hash: http://localhost:${PORT}/api/verify/hash/:hash`);
  console.log(`   🔍 Verify share: http://localhost:${PORT}/api/verify/share/:shareId`);
  console.log(`   🔗 Blockchain: http://localhost:${PORT}/api/blockchain/network`);
  console.log('\n🌐 CORS allowed origins:');
  allowedOrigins.forEach(origin => {
    console.log(`   - ${origin}`);
  });
  console.log('='.repeat(50) + '\n');
});