import mongoose from "mongoose";
import dotenv from "dotenv";
import Credential from "./src/models/Credential.js";
import User from "./src/models/User.js";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const createTestData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find your user
    const user = await User.findOne({ 
      walletAddress: "0xcF004C24ce231EDED0e65e95d7479dA14be6623B" 
    });

    if (!user) {
      console.error("❌ User not found");
      process.exit(1);
    }

    // Update user with studentId if not set
    if (!user.studentId) {
      user.studentId = "STU2024001";
      user.role = "student";
      user.name = user.name || "Test Student";
      await user.save();
      console.log("✅ Updated user with studentId");
    }

    // Create test credentials with unique txHash values
    const testCredentials = [
      {
        credentialId: uuidv4(),
        studentId: user.studentId,
        studentName: user.name,
        studentEmail: user.email,
        institutionId: "MIT001",
        institutionName: "Massachusetts Institute of Technology",
        title: "Bachelor of Science in Computer Science",
        description: "Undergraduate degree in Computer Science with focus on Blockchain Technology",
        issueDate: new Date("2024-05-15"),
        credentialType: "degree",
        ipfsHash: "QmTest123456789",
        blockchainTxHash: `0x${Date.now()}${Math.random().toString(36).substring(2, 15)}`,
        blockchainStatus: "verified",
        signature: uuidv4(),
        metadata: {
          grade: "First Class Honours",
          gpa: 3.8,
          field: "Computer Science"
        },
        isRevoked: false
      },
      {
        credentialId: uuidv4(),
        studentId: user.studentId,
        studentName: user.name,
        studentEmail: user.email,
        institutionId: "STAN001",
        institutionName: "Stanford University",
        title: "Master of Science in Data Science",
        description: "Graduate degree in Data Science with specialization in Machine Learning",
        issueDate: new Date("2025-01-20"),
        credentialType: "degree",
        ipfsHash: "QmTest987654321",
        blockchainTxHash: `0x${Date.now() + 1}${Math.random().toString(36).substring(2, 15)}`,
        blockchainStatus: "verified",
        signature: uuidv4(),
        metadata: {
          grade: "Distinction",
          gpa: 3.9,
          field: "Data Science"
        },
        isRevoked: false
      },
      {
        credentialId: uuidv4(),
        studentId: user.studentId,
        studentName: user.name,
        studentEmail: user.email,
        institutionId: "CERT001",
        institutionName: "Coursera",
        title: "Blockchain Specialization",
        description: "Comprehensive blockchain development certification",
        issueDate: new Date("2025-03-10"),
        credentialType: "certificate",
        ipfsHash: "QmTest456789123",
        blockchainTxHash: `0x${Date.now() + 2}${Math.random().toString(36).substring(2, 15)}`,
        blockchainStatus: "pending",
        signature: uuidv4(),
        metadata: {
          grade: "Pass",
          credits: 12,
          field: "Blockchain"
        },
        isRevoked: false
      }
    ];

    // Clear existing credentials for this student
    await Credential.deleteMany({ studentId: user.studentId });
    console.log("✅ Cleared existing credentials");

    // Insert one by one to avoid bulk write issues
    const created = [];
    for (const cred of testCredentials) {
      try {
        const newCred = await Credential.create(cred);
        created.push(newCred);
        console.log(`  ✅ Created: ${cred.title}`);
      } catch (err) {
        console.error(`  ❌ Failed to create ${cred.title}:`, err.message);
      }
    }

    console.log(`\n📋 Successfully created ${created.length} test credentials:`);
    created.forEach((cred, i) => {
      console.log(`\n${i + 1}. ${cred.title}`);
      console.log(`   ID: ${cred.credentialId}`);
      console.log(`   Status: ${cred.blockchainStatus}`);
      console.log(`   Institution: ${cred.institutionName}`);
      console.log(`   TxHash: ${cred.blockchainTxHash.substring(0, 20)}...`);
    });

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
};

createTestData();