// backend/scripts/sync-credentials-to-users.js

import mongoose from "mongoose";
import User from "../src/models/User.js";
import Credential from "../src/models/Credential.js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the parent directory's .env file
// Go up one level from scripts folder to backend root
const envPath = path.join(__dirname, '..', '.env');
console.log("📁 Looking for .env at:", envPath);

dotenv.config({ path: envPath });

console.log("🔍 Environment check:");
console.log("   MONGODB_URI:", process.env.MONGODB_URI ? "✅ Found" : "❌ Missing");

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined in .env file");
  console.log("\n📝 Please check that your .env file exists at:", envPath);
  console.log("   And contains: MONGODB_URI=mongodb+srv://...");
  process.exit(1);
}

async function syncCredentialsToUsers() {
  try {
    console.log("📦 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
    });
    console.log("✅ Connected to MongoDB");

    // Get all credentials
    const credentials = await Credential.find({});
    console.log(`📋 Found ${credentials.length} total credentials`);

    // Group by student to count credentials per student
    const studentMap = new Map();
    
    for (const cred of credentials) {
      // Create a unique key for each student
      const key = cred.studentId || cred.studentEmail || cred.studentName || "unknown";
      
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          studentId: cred.studentId,
          studentEmail: cred.studentEmail,
          studentName: cred.studentName,
          count: 1,
          credentials: [cred.credentialId]
        });
      } else {
        const existing = studentMap.get(key);
        existing.count += 1;
        existing.credentials.push(cred.credentialId);
        studentMap.set(key, existing);
      }
    }

    console.log(`📋 Found ${studentMap.size} unique students from credentials`);

    // Create or update users for each unique student
    let createdCount = 0;
    let updatedCount = 0;
    
    for (const [key, student] of studentMap) {
      console.log(`\n📝 Processing student: ${student.studentName || key}`);
      
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: student.studentEmail },
          { studentId: student.studentId },
          { name: student.studentName }
        ].filter(condition => Object.values(condition)[0]) // Remove empty conditions
      });

      if (!existingUser) {
        // Create new user
        console.log(`   ⚠️ User not found, creating new user...`);
        
        const randomPassword = Math.random().toString(36).slice(-8) + "A1!";
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(randomPassword, salt);

        // Generate email if not present
        const email = student.studentEmail || 
                     (student.studentName ? 
                      `${student.studentName.toLowerCase().replace(/\s+/g, '.')}@student.edu` : 
                      `student${Date.now()}@temp.edu`);

        const newUser = await User.create({
          name: student.studentName || "Unknown Student",
          email: email,
          password: hashedPassword,
          role: "student",
          walletAddress: '',
          program: 'Undeclared',
          status: 'active',
          studentId: student.studentId || `STU${Date.now().toString().slice(-6)}-${createdCount}`,
          isVerified: true,
          credentials: student.count
        });

        console.log(`   ✅ Created user: ${newUser.name} (${newUser.email}) with ${student.count} credentials`);
        createdCount++;
      } else {
        // Update existing user's credential count
        await User.findByIdAndUpdate(existingUser._id, {
          $set: { 
            credentials: student.count,
            name: existingUser.name || student.studentName,
            studentId: existingUser.studentId || student.studentId
          }
        });
        console.log(`   ✅ Updated user: ${existingUser.name} with ${student.count} credentials`);
        updatedCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ SYNC COMPLETE:");
    console.log(`   - Created: ${createdCount} new users`);
    console.log(`   - Updated: ${updatedCount} existing users`);
    console.log(`   - Total students now in database: ${await User.countDocuments({ role: "student" })}`);
    console.log("=".repeat(50));

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Sync failed:", error);
    process.exit(1);
  }
}

// Run the sync function
syncCredentialsToUsers();