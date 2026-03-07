import mongoose from "mongoose";

const CredentialSchema = new mongoose.Schema(
  {
    credentialId: { 
      type: String, 
      required: true, 
      unique: true 
      // REMOVE index: true from here
    },
    studentId: { 
      type: String, 
      required: true 
      // REMOVE index: true from here
    },
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    institutionId: { 
      type: String, 
      required: true 
      // REMOVE index: true from here
    },
    institutionName: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    issueDate: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date },
    credentialType: {
      type: String,
      enum: ["degree", "diploma", "certificate", "transcript", "other"],
      default: "certificate",
    },
    ipfsHash: { type: String, required: true },
    blockchainTxHash: { type: String, required: true },
    blockchainStatus: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },
    signature: { type: String, required: true },
    metadata: {
      grade: { type: String },
      gpa: { type: Number },
      credits: { type: Number },
      duration: { type: String },
      field: { type: String },
      additionalInfo: { type: mongoose.Schema.Types.Mixed },
    },
    isRevoked: { type: Boolean, default: false },
    revocationReason: { type: String },
    revokedAt: { type: Date },
    revokedBy: { type: String },
  },
  { timestamps: true }
);

// Define indexes here - ONCE
CredentialSchema.index({ studentId: 1, createdAt: -1 });
CredentialSchema.index({ institutionId: 1, credentialType: 1 });
CredentialSchema.index({ credentialId: 1, isRevoked: 1 });

// Check if model exists before creating
const Credential = mongoose.models.Credential || mongoose.model("Credential", CredentialSchema);

export default Credential;