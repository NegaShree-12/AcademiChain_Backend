import mongoose from "mongoose";

const ShareLinkSchema = new mongoose.Schema(
  {
    shareId: { 
      type: String, 
      required: true, 
      unique: true 
      // REMOVE index: true from here
    },
    credentialId: { 
      type: String, 
      required: true 
      // REMOVE index: true from here
    },
    credentialTitle: { 
      type: String, 
      required: true 
    },
    studentId: { 
      type: String, 
      required: true 
      // REMOVE index: true from here
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
  },
  { 
    timestamps: true 
  }
);

// Define indexes here - ONCE
ShareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ShareLinkSchema.index({ studentId: 1, createdAt: -1 });
ShareLinkSchema.index({ credentialId: 1 });

// Check if model exists before creating
const ShareLink = mongoose.models.ShareLink || mongoose.model("ShareLink", ShareLinkSchema);

export default ShareLink;