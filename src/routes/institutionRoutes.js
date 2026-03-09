// backend/src/routes/institutionRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import Credential from "../models/Credential.js";
import bcrypt from 'bcryptjs';

const router = express.Router();

// Protect all routes - TEMPORARILY allow both institution and verifier for testing
router.use(protect);

// TEMPORARY: Allow both roles for testing
router.use((req, res, next) => {
  // Allow both institution and verifier for now
  if (req.user && (req.user.role === "institution" || req.user.role === "verifier")) {
    console.log(`✅ Access granted for role: ${req.user.role}`);
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: `Access denied. Your role: ${req.user?.role}`
  });
});

// ================= STUDENT MANAGEMENT =================

// @desc    Get all students
// @route   GET /api/institution/students
// @access  Private (Temporarily allows verifier)
router.get("/students", async (req, res) => {
  try {
    console.log("📋 Fetching students for user:", req.user.id, "role:", req.user.role);
    
    // Find all users with role 'student'
    const students = await User.find({ 
      role: "student"
    }).select("-password").sort({ createdAt: -1 });
    
    console.log(`✅ Found ${students.length} students`);
    
    // Transform data for frontend
    const transformedStudents = students.map(student => ({
      _id: student._id,
      id: student._id,
      name: student.name,
      email: student.email,
      walletAddress: student.walletAddress || '',
      program: student.program || 'Undeclared',
      status: student.status || 'pending',
      enrollmentDate: student.createdAt || new Date(),
      credentials: student.credentials || 0,
      phone: student.phone || '',
      studentId: student.studentId || `STU${student._id.toString().slice(-6)}`
    }));
    
    res.json({
      success: true,
      data: transformedStudents
    });
  } catch (error) {
    console.error("❌ Error fetching students:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load students",
      error: error.message
    });
  }
});

// @desc    Get student by ID
// @route   GET /api/institution/students/:id
// @access  Private
router.get("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await User.findOne({ 
      _id: id,
      role: "student"
    }).select("-password");
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    console.error("❌ Error fetching student:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch student"
    });
  }
});

// @desc    Add a new student
// @route   POST /api/institution/students
// @access  Private
router.post("/students", async (req, res) => {
  try {
    const { name, email, walletAddress, program, phone } = req.body;
    
    console.log("=".repeat(50));
    console.log("📝 Adding new student:");
    console.log("   Name:", name);
    console.log("   Email:", email);
    console.log("   Wallet:", walletAddress);
    console.log("   Program:", program);
    console.log("   Phone:", phone);
    
    // Validate required fields
    if (!name || !email) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Name and email are required"
      });
    }
    
    // Check if user already exists
    console.log("🔍 Checking for existing user with email:", email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("❌ User already exists with this email");
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists"
      });
    }
    
    // Generate a random password
    const randomPassword = Math.random().toString(36).slice(-8) + "A1!";
    console.log("🔑 Generated password for student");
    
    // Hash the password
    console.log("🔐 Hashing password...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(randomPassword, salt);
    
    // Create new student
    console.log("📤 Creating student in database...");
    const studentData = {
      name,
      email,
      password: hashedPassword,
      role: "student",
      walletAddress: walletAddress || '',
      program: program || 'Undeclared',
      phone: phone || '',
      status: 'active',
      studentId: `STU${Date.now().toString().slice(-6)}`,
      isVerified: true,
      credentials: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log("📦 Student data:", JSON.stringify(studentData, null, 2));
    
    const student = await User.create(studentData);
    
    console.log("✅ Student created successfully! ID:", student._id);
    
    // Remove password from response
    const studentResponse = student.toObject();
    delete studentResponse.password;
    
    res.status(201).json({
      success: true,
      data: studentResponse,
      message: "Student added successfully"
    });
    
  } catch (error) {
    console.error("❌ ERROR CREATING STUDENT:");
    console.error("   Error name:", error.name);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
    
    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate key error. Email or wallet address already exists."
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to add student",
      error: error.message
    });
  }
});

// @desc    Update a student
// @route   PUT /api/institution/students/:id
// @access  Private
router.put("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated
    delete updates.password;
    delete updates._id;
    delete updates.id;
    
    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select("-password");
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    res.json({
      success: true,
      data: student,
      message: "Student updated successfully"
    });
  } catch (error) {
    console.error("❌ Error updating student:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update student"
    });
  }
});

// @desc    Delete a student
// @route   DELETE /api/institution/students/:id
// @access  Private
router.delete("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await User.findOneAndDelete({ 
      _id: id, 
      role: "student" 
    });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    res.json({
      success: true,
      message: "Student deleted successfully"
    });
  } catch (error) {
    console.error("❌ Error deleting student:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete student"
    });
  }
});

// ================= CREDENTIAL MANAGEMENT =================

// @desc    Get all issued credentials
// @route   GET /api/institution/credentials
// @access  Private
router.get("/credentials", async (req, res) => {
  try {
    console.log("📋 Fetching credentials for institution:", req.user.id);
    
    const credentials = await Credential.find({ 
      institutionId: req.user.institutionId || req.user.id 
    }).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${credentials.length} credentials`);
    
    res.json({
      success: true,
      data: credentials
    });
  } catch (error) {
    console.error("❌ Error fetching credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch credentials"
    });
  }
});

// @desc    Get credential by ID
// @route   GET /api/institution/credentials/:id
// @access  Private
router.get("/credentials/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const credential = await Credential.findById(id);
    
    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found"
      });
    }
    
    res.json({
      success: true,
      data: credential
    });
  } catch (error) {
    console.error("❌ Error fetching credential:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch credential"
    });
  }
});

// @desc    Issue a new credential
// @route   POST /api/institution/credentials
// @access  Private
// @desc    Issue a new credential
// @route   POST /api/institution/credentials
// @access  Private
router.post("/credentials", async (req, res) => {
  try {
    const credentialData = req.body;
    
    console.log("=".repeat(50));
    console.log("📝 Issuing new credential:");
    console.log("   Full request body:", JSON.stringify(credentialData, null, 2));
    
    // Validate required fields
    const requiredFields = ['studentId', 'studentName', 'title', 'type', 'institution'];
    const missingFields = requiredFields.filter(field => !credentialData[field]);
    
    if (missingFields.length > 0) {
      console.log("❌ Missing required fields:", missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    // Create the credential with all possible fields
    const credential = await Credential.create({
      // Core fields
      credentialId: `CRED-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      studentId: credentialData.studentId,
      studentName: credentialData.studentName,
      studentEmail: credentialData.studentEmail || '',
      institutionId: req.user.institutionId || req.user.id,
      institutionName: credentialData.institution,
      
      // Credential details
      title: credentialData.title,
      description: credentialData.description || '',
      issueDate: credentialData.issueDate ? new Date(credentialData.issueDate) : new Date(),
      credentialType: credentialData.type || 'certificate',
      
      // Blockchain data
      ipfsHash: credentialData.documentHash || `Qm${Math.random().toString(36).substring(2, 15)}`,
      blockchainTxHash: credentialData.blockchainTxHash || credentialData.txHash,
      blockchainStatus: 'verified',
      signature: 'institutional-signature',
      
      // Metadata
      metadata: {
        grade: credentialData.metadata?.grade || credentialData.grade,
        gpa: credentialData.metadata?.gpa || credentialData.gpa,
        credits: credentialData.metadata?.credits || credentialData.credits,
        program: credentialData.metadata?.program || credentialData.program,
        major: credentialData.metadata?.major || credentialData.major
      },
      
      // Status
      isRevoked: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log("✅ Credential created successfully! ID:", credential._id);
    console.log("   Transaction Hash:", credential.blockchainTxHash);
    
    // Update student's credential count
    if (credentialData.studentId) {
      await User.findByIdAndUpdate(credentialData.studentId, {
        $inc: { credentials: 1 }
      });
    }
    
    res.status(201).json({
      success: true,
      data: credential,
      message: "Credential issued successfully"
    });
    
  } catch (error) {
    console.error("❌ ERROR ISSUING CREDENTIAL:");
    console.error("   Error name:", error.name);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
    
    // Check for MongoDB validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }
    
    // Check for duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate credential ID"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to issue credential",
      error: error.message
    });
  }
});
// @desc    Revoke a credential
// @route   PUT /api/institution/credentials/:id/revoke
// @access  Private
router.put("/credentials/:id/revoke", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const credential = await Credential.findByIdAndUpdate(
      id,
      {
        isRevoked: true,
        revocationReason: reason || 'No reason provided',
        revokedAt: new Date(),
        revokedBy: req.user.id
      },
      { new: true }
    );
    
    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found"
      });
    }
    
    console.log("✅ Credential revoked:", id);
    
    res.json({
      success: true,
      data: credential,
      message: "Credential revoked successfully"
    });
  } catch (error) {
    console.error("❌ Error revoking credential:", error);
    res.status(500).json({
      success: false,
      message: "Failed to revoke credential"
    });
  }
});

// @desc    Bulk upload credentials
// @route   POST /api/institution/credentials/bulk
// @access  Private
router.post("/credentials/bulk", async (req, res) => {
  try {
    const { credentials } = req.body;
    
    if (!Array.isArray(credentials) || credentials.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials data"
      });
    }
    
    console.log(`📝 Bulk uploading ${credentials.length} credentials`);
    
    const createdCredentials = await Credential.insertMany(
      credentials.map(cred => ({
        ...cred,
        credentialId: `CRED-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        institutionId: req.user.institutionId || req.user.id,
        institutionName: req.user.institutionName || req.user.name,
        blockchainStatus: 'pending',
        isRevoked: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    );
    
    console.log(`✅ Created ${createdCredentials.length} credentials`);
    
    res.status(201).json({
      success: true,
      data: createdCredentials,
      message: "Bulk upload successful"
    });
  } catch (error) {
    console.error("❌ Error in bulk upload:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk upload credentials"
    });
  }
});

// ================= DASHBOARD STATS =================

// @desc    Get dashboard statistics
// @route   GET /api/institution/dashboard/stats
// @access  Private
router.get("/dashboard/stats", async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const activeStudents = await User.countDocuments({ role: "student", status: "active" });
    const pendingStudents = await User.countDocuments({ role: "student", status: "pending" });
    
    const totalCredentials = await Credential.countDocuments({ 
      institutionId: req.user.institutionId || req.user.id 
    });
    
    const verifiedToday = await Credential.countDocuments({
      institutionId: req.user.institutionId || req.user.id,
      createdAt: { $gte: new Date().setHours(0,0,0,0) }
    });
    
    res.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        pendingStudents,
        totalCredentials,
        verifiedToday
      }
    });
  } catch (error) {
    console.error("❌ Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load stats"
    });
  }
});

export default router;