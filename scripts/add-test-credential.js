// scripts/add-test-credential.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Credential from '../src/models/Credential.js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const testHash = '0x8f7d3a2c1e4b5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f';

const testCredential = {
  credentialId: uuidv4(),
  studentId: 'student123',
  studentName: 'John Doe',
  studentEmail: 'john.doe@example.com',
  institutionId: 'inst456',
  institutionName: 'Massachusetts Institute of Technology',
  title: 'Bachelor of Computer Science',
  description: 'Awarded with Honors',
  issueDate: new Date('2023-06-15'),
  credentialType: 'degree',
  ipfsHash: 'QmTest123',
  blockchainTxHash: testHash,
  blockchainStatus: 'verified',
  signature: 'test-signature',
  metadata: {
    grade: 'A',
    gpa: 3.85,
    credits: 120
  }
};

async function addTestCredential() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if credential already exists
    const existing = await Credential.findOne({ blockchainTxHash: testHash });
    if (existing) {
      console.log('⚠️ Test credential already exists');
      process.exit(0);
    }

    await Credential.create(testCredential);
    console.log('✅ Test credential added successfully');
    console.log('📝 Hash:', testHash);
    console.log('📝 Credential ID:', testCredential.credentialId);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addTestCredential();