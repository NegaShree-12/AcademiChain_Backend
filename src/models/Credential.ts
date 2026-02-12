import mongoose from "mongoose";

export interface ICredential extends mongoose.Document {
  studentId: mongoose.Types.ObjectId;
  issuerId: mongoose.Types.ObjectId;
  title: string;
  type: "degree" | "certificate" | "transcript" | "diploma";
  institution: string;
  issueDate: Date;
  expiryDate?: Date;
  description: string;
  ipfsHash: string; // IPFS CID where document is stored
  txHash: string; // Ethereum transaction hash
  blockNumber: number;
  metadata: {
    grade?: string;
    gpa?: number;
    credits?: number;
    program?: string;
    [key: string]: any;
  };
  status: "issued" | "verified" | "revoked" | "pending";
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const credentialSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    issuerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["degree", "certificate", "transcript", "diploma"],
      required: true,
    },
    institution: {
      type: String,
      required: true,
    },
    issueDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
    },
    description: {
      type: String,
      required: true,
    },
    ipfsHash: {
      type: String,
      required: true,
    },
    txHash: {
      type: String,
      required: true,
      unique: true,
    },
    blockNumber: {
      type: Number,
      required: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["issued", "verified", "revoked", "pending"],
      default: "issued",
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
credentialSchema.index({ studentId: 1, createdAt: -1 });
credentialSchema.index({ txHash: 1 }, { unique: true });
credentialSchema.index({ ipfsHash: 1 });
credentialSchema.index({ status: 1 });
credentialSchema.index({ institutionId: 1, issuedAt: -1 });
credentialSchema.index({ studentId: 1, createdAt: -1 });
credentialSchema.index({ txHash: 1 }, { unique: true });
credentialSchema.index({ ipfsHash: 1 });
credentialSchema.index({ status: 1 });
credentialSchema.index({ issueDate: -1 });


export default mongoose.model<ICredential>("Credential", credentialSchema);
