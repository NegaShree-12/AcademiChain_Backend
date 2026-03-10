// backend/src/routes/institutionRoutes.js

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import Credential from "../models/Credential.js";
import bcrypt from 'bcryptjs';

const router = express.Router();

// Protect all routes
router.use(protect);

// Allow both institution and verifier for now
router.use((req, res, next) => {
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

// @desc    Get all students (UNIQUE - NO DUPLICATES)
// @route   GET /api/institution/students
router.get("/students", async (req, res) => {
  try {
    console.log("📋 Fetching students for user:", req.user.id);
    
    // Get all users with role "student" from database
    const users = await User.find({ role: "student" })
      .select("-password")
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${users.length} students in users table`);
    
    // Create a map to store unique students by email
    const studentMap = new Map();
    
    // Add users from database first (these are the source of truth)
    users.forEach(user => {
      const key = user.email;
      studentMap.set(key, {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        walletAddress: user.walletAddress || '',
        program: user.program || 'Undeclared',
        status: user.status || 'pending',
        enrollmentDate: user.createdAt || new Date(),
        credentials: user.credentials || 0,
        phone: user.phone || '',
        studentId: user.studentId || `STU${user._id.toString().slice(-6)}`
      });
    });
    
    // Also check credentials for any students that might not be in users table
    const credentials = await Credential.aggregate([
      {
        $group: {
          _id: "$studentEmail",
          studentName: { $first: "$studentName" },
          studentEmail: { $first: "$studentEmail" },
          studentId: { $first: "$studentId" },
          credentialCount: { $sum: 1 },
          programs: { $addToSet: "$metadata.program" },
          latestCredential: { $max: "$createdAt" }
        }
      }
    ]);
    
    // Add students from credentials that aren't in the map
    for (const cred of credentials) {
      const key = cred.studentEmail;
      if (!studentMap.has(key) && cred.studentEmail) {
        // Get the best program from their credentials
        const bestProgram = cred.programs?.filter(p => p && p !== 'Undeclared')[0] || 'Undeclared';
        
        studentMap.set(key, {
          _id: cred.studentId || `cred-${key}`,
          id: cred.studentId || `cred-${key}`,
          name: cred.studentName || "Unknown Student",
          email: cred.studentEmail,
          walletAddress: '',
          program: bestProgram,
          status: 'active',
          enrollmentDate: cred.latestCredential || new Date(),
          credentials: cred.credentialCount || 0,
          phone: '',
          studentId: cred.studentId || `STU${Date.now().toString().slice(-6)}`
        });
      }
    }
    
    // Convert map to array
    const transformedStudents = Array.from(studentMap.values());
    
    console.log(`✅ Total unique students: ${transformedStudents.length}`);
    console.log("📋 Student list:", transformedStudents.map(s => ({ 
      name: s.name, 
      email: s.email, 
      program: s.program,
      credentials: s.credentials 
    })));
    
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

// @desc    Update a student
// @route   PUT /api/institution/students/:id
router.put("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, program, status, walletAddress, phone } = req.body;
    
    console.log("📝 Updating student:", id);
    console.log("   New data:", { name, email, program, status, walletAddress });

    // Create update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (program !== undefined) updateData.program = program;
    if (status !== undefined) updateData.status = status;
    if (walletAddress !== undefined) updateData.walletAddress = walletAddress;
    if (phone !== undefined) updateData.phone = phone;
    updateData.updatedAt = new Date();

    console.log("📦 Update data being sent to DB:", updateData);

    // Find and update the student with { new: true } to return updated document
    const student = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    console.log("✅ Student updated successfully:", student._id);
    
    // IMPORTANT: Also update all credentials for this student with the new name
    if (name && name !== student.name) {
      const credentialUpdate = await Credential.updateMany(
        { studentId: student._id.toString() },
        { $set: { studentName: name } }
      );
      console.log(`✅ Updated ${credentialUpdate.modifiedCount} credentials with new student name`);
    }
    
    // Return updated student with ALL fields properly mapped
    const updatedStudent = {
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
    };
    
    console.log("📤 Sending response with updated student:", updatedStudent);
    
    res.json({
      success: true,
      data: updatedStudent,
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

// @desc    Add a new student
// @route   POST /api/institution/students
router.post("/students", async (req, res) => {
  try {
    const { name, email, walletAddress, program, phone } = req.body;
    
    console.log("📝 Adding new student:", { name, email });
    
    const existingStudent = await User.findOne({ email });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student with this email already exists"
      });
    }
    
    const randomPassword = Math.random().toString(36).slice(-8) + "A1!";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(randomPassword, salt);
    
    const student = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "student",
      walletAddress: walletAddress || '',
      program: program || 'Undeclared',
      phone: phone || '',
      status: 'pending',
      studentId: `STU${Date.now().toString().slice(-6)}`,
      isVerified: true,
      credentials: 0
    });
    
    console.log("✅ Student created:", student._id);
    
    const studentResponse = student.toObject();
    delete studentResponse.password;
    
    res.status(201).json({
      success: true,
      data: studentResponse,
      message: "Student added successfully"
    });
  } catch (error) {
    console.error("❌ Error creating student:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add student",
      error: error.message
    });
  }
});

// @desc    Delete a student
// @route   DELETE /api/institution/students/:id
router.delete("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await User.findByIdAndDelete(id);
    
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
router.get("/credentials", async (req, res) => {
  try {
    const credentials = await Credential.find().sort({ createdAt: -1 });
    
    const transformedCredentials = credentials.map(cred => ({
      _id: cred._id,
      credentialId: cred.credentialId,
      title: cred.title,
      credentialType: cred.credentialType,
      studentName: cred.studentName,
      studentEmail: cred.studentEmail,
      institutionName: cred.institutionName,
      issueDate: cred.issueDate,
      blockchainTxHash: cred.blockchainTxHash,
      blockchainStatus: cred.blockchainStatus,
      description: cred.description,
      metadata: cred.metadata,
      isRevoked: cred.isRevoked || false
    }));
    
    res.json({
      success: true,
      data: transformedCredentials
    });
  } catch (error) {
    console.error("❌ Error fetching credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch credentials"
    });
  }
});

// Helper function to generate consistent transaction hash
const generateTxHash = (studentId, timestamp) => {
  const base = studentId.toString().slice(-16) + timestamp.toString(16);
  return "0x" + base.padEnd(64, "0").slice(0, 64);
};

// @desc    Issue a new credential
// @route   POST /api/institution/credentials
router.post("/credentials", async (req, res) => {
  try {
    const credentialData = req.body;
    
    console.log("📝 Issuing credential:", credentialData);

    // Find the student by ID
    let student = null;
    
    if (credentialData.studentId) {
      student = await User.findById(credentialData.studentId);
    } else if (credentialData.studentEmail) {
      student = await User.findOne({ email: credentialData.studentEmail });
    } else if (credentialData.studentName) {
      student = await User.findOne({ name: credentialData.studentName });
    }
    
    // If student doesn't exist in users table, CREATE THEM
    if (!student) {
      console.log("⚠️ Student not found in users table, creating new student...");
      
      // Create a new student user
      const randomPassword = Math.random().toString(36).slice(-8) + "A1!";
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);
      
      student = await User.create({
        name: credentialData.studentName || "New Student",
        email: credentialData.studentEmail || `${Date.now()}@temp.user`,
        password: hashedPassword,
        role: "student",
        walletAddress: credentialData.walletAddress || '',
        program: credentialData.program || 'Undeclared',
        status: 'active',
        studentId: `STU${Date.now().toString().slice(-6)}`,
        isVerified: true,
        credentials: 0
      });
      
      console.log("✅ Created new student:", student._id);
    }

    console.log("📋 Found/Created student:", {
      id: student._id,
      name: student.name,
      email: student.email,
      walletAddress: student.walletAddress
    });

    // Generate a consistent transaction hash
    const txHash = credentialData.blockchainTxHash || 
                   generateTxHash(student._id, Date.now());

    // CRITICAL: Always use the student's email from the database
    const studentEmail = student.email;

    const credential = await Credential.create({
      credentialId: `CRED-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      studentId: student._id.toString(),
      studentName: student.name,
      studentEmail: studentEmail,
      institutionId: req.user.id,
      institutionName: credentialData.institution || req.user.institutionName || "Unknown Institution",
      title: credentialData.title,
      description: credentialData.description || '',
      issueDate: credentialData.issueDate || new Date(),
      credentialType: credentialData.type || 'certificate',
      ipfsHash: credentialData.documentHash || `ipfs-${Date.now()}`,
      blockchainTxHash: txHash,
      blockchainStatus: 'verified',
      signature: 'institutional-signature',
      metadata: {
        grade: credentialData.metadata?.grade || credentialData.grade,
        gpa: credentialData.metadata?.gpa || credentialData.gpa,
        credits: credentialData.metadata?.credits || credentialData.credits,
        program: credentialData.metadata?.program || credentialData.program,
        major: credentialData.metadata?.major || credentialData.major,
        ...credentialData.metadata
      },
      isRevoked: false
    });
    
    // Update student's credential count
    await User.findByIdAndUpdate(student._id, {
      $inc: { credentials: 1 }
    });
    
    console.log("✅ Credential issued:", credential._id);
    console.log("✅ For student email:", studentEmail);
    console.log("✅ Transaction Hash:", txHash);
    
    res.status(201).json({
      success: true,
      data: credential,
      message: "Credential issued successfully"
    });
  } catch (error) {
    console.error("❌ Error issuing credential:", error);
    res.status(500).json({
      success: false,
      message: "Failed to issue credential"
    });
  }
});

// @desc    Update a credential (status, etc.)
// @route   PUT /api/institution/credentials/:id
router.put("/credentials/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { blockchainStatus, title, description, metadata } = req.body;
    
    console.log("📝 Updating credential:", id);
    console.log("   New data:", { blockchainStatus, title });

    // Build update object with only provided fields
    const updateData = {};
    if (blockchainStatus !== undefined) updateData.blockchainStatus = blockchainStatus;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (metadata !== undefined) updateData.metadata = metadata;
    updateData.updatedAt = new Date();
    
    // Find and update the credential
    const credential = await Credential.findOneAndUpdate(
      { credentialId: id },
      { $set: updateData },
      { new: true } // Return the updated document
    );
    
    if (!credential) {
      console.log("❌ Credential not found:", id);
      return res.status(404).json({
        success: false,
        message: "Credential not found"
      });
    }
    
    console.log("✅ Credential updated successfully:", credential.credentialId);
    console.log("   New status:", credential.blockchainStatus);
    
    res.json({
      success: true,
      data: credential,
      message: "Credential updated successfully"
    });
    
  } catch (error) {
    console.error("❌ Error updating credential:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update credential",
      error: error.message
    });
  }
});

// @desc    Revoke a credential
// @route   PUT /api/institution/credentials/:id/revoke
router.put("/credentials/:id/revoke", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const credential = await Credential.findOneAndUpdate(
      { credentialId: id },
      { 
        isRevoked: true, 
        revocationReason: reason || "No reason provided",
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

// ================= DASHBOARD STATS =================

// @desc    Get dashboard statistics
// @route   GET /api/institution/dashboard/stats
router.get("/dashboard/stats", async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const activeStudents = await User.countDocuments({ role: "student", status: "active" });
    const pendingStudents = await User.countDocuments({ role: "student", status: "pending" });
    
    const totalCredentials = await Credential.countDocuments();
    const verifiedToday = await Credential.countDocuments({
      createdAt: { $gte: new Date().setHours(0,0,0,0) }
    });
    
    // Get pending and failed credentials count
    const pendingCredentials = await Credential.countDocuments({ blockchainStatus: "pending" });
    const failedCredentials = await Credential.countDocuments({ blockchainStatus: "failed" });
    
    res.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        pendingStudents,
        totalCredentials,
        verifiedToday,
        pendingCredentials,
        failedCredentials
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