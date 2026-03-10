// backend/src/models/ShareLink.js

import mongoose from "mongoose";

const ShareLinkSchema = new mongoose.Schema(
  {
    shareId: { 
      type: String, 
      required: true, 
      unique: true // This should be unique, not link
    },
    credentialId: { 
      type: String, 
      required: true 
    },
    credentialTitle: { 
      type: String, 
      required: true 
    },
    studentId: { 
      type: String, 
      required: true 
    },
    studentName: { 
      type: String, 
      required: true 
    },
    sharedWith: [{ 
      type: String 
    }],
    shareType: {
      type: String,
      enum: ["public", "private", "one-time"],
      default: "public",
    },
    accessCount: { 
      type: Number, 
      default: 0 
    },
    maxAccess: { 
      type: Number 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(+new Date() + 7 * 24 * 60 * 60 * 1000),
    },
    qrCode: { 
      type: String 
    },
    // Remove the link field if it exists in your schema
  },
  { 
    timestamps: true 
  }
);

// Define indexes
ShareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ShareLinkSchema.index({ studentId: 1, createdAt: -1 });
ShareLinkSchema.index({ credentialId: 1 });
ShareLinkSchema.index({ shareId: 1 }, { unique: true }); // Make sure shareId is unique

// Check if model exists before creating
const ShareLink = mongoose.models.ShareLink || mongoose.model("ShareLink", ShareLinkSchema);

export default ShareLink;