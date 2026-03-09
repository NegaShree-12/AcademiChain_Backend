// backend/src/models/Credential.js
import mongoose from "mongoose";

const CredentialSchema = new mongoose.Schema(
  {
    credentialId: { 
      type: String, 
      required: true, 
      unique: true 
    },
    studentId: { 
      type: String, 
      required: true 
    },
    studentName: { 
      type: String, 
      required: true 
    },
    studentEmail: { 
      type: String 
    },
    institutionId: { 
      type: String, 
      required: true 
    },
    institutionName: { 
      type: String, 
      required: true 
    },
    title: { 
      type: String, 
      required: true 
    },
    description: { 
      type: String 
    },
    issueDate: { 
      type: Date, 
      required: true, 
      default: Date.now 
    },
    expiryDate: { 
      type: Date 
    },
    credentialType: {
      type: String,
      enum: ["degree", "diploma", "certificate", "transcript", "other"],
      default: "certificate",
    },
    ipfsHash: { 
      type: String 
    },
    blockchainTxHash: { 
      type: String 
    },
    blockchainStatus: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },
    signature: { 
      type: String 
    },
    metadata: {
      grade: { type: String },
      gpa: { type: Number },
      credits: { type: Number },
      duration: { type: String },
      field: { type: String },
      additionalInfo: { type: mongoose.Schema.Types.Mixed },
    },
    isRevoked: { 
      type: Boolean, 
      default: false 
    },
    revocationReason: { 
      type: String 
    },
    revokedAt: { 
      type: Date 
    },
    revokedBy: { 
      type: String 
    },
  },
  { 
    timestamps: true 
  }
);

// Define indexes - ONCE
CredentialSchema.index({ studentId: 1, createdAt: -1 });
CredentialSchema.index({ institutionId: 1, credentialType: 1 });
CredentialSchema.index({ credentialId: 1, isRevoked: 1 });

// Check if model exists before creating
const Credential = mongoose.models.Credential || mongoose.model("Credential", CredentialSchema);

export default Credential;