import mongoose from "mongoose";

export interface IShareLink extends mongoose.Document {
  credentialId: mongoose.Types.ObjectId;
  shareId: string; // Unique share identifier
  createdBy: mongoose.Types.ObjectId;
  link: string;
  expiresAt?: Date;
  isActive: boolean;
  viewCount: number;
  lastViewedAt?: Date;
  settings: {
    requiresPassword: boolean;
    passwordHash?: string;
    oneTimeUse: boolean;
    allowDownload: boolean;
    maxViews?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const shareLinkSchema = new mongoose.Schema(
  {
    credentialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Credential",
      required: true,
    },
    shareId: {
      type: String,
      required: true,
      unique: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    link: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    lastViewedAt: {
      type: Date,
    },
    settings: {
      requiresPassword: {
        type: Boolean,
        default: false,
      },
      passwordHash: {
        type: String,
      },
      oneTimeUse: {
        type: Boolean,
        default: false,
      },
      allowDownload: {
        type: Boolean,
        default: true,
      },
      maxViews: {
        type: Number,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Generate shareId before saving
shareLinkSchema.pre("save", function (next) {
  if (!this.shareId) {
    this.shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Indexes
shareLinkSchema.index({ shareId: 1 }, { unique: true });
shareLinkSchema.index({ credentialId: 1 });
shareLinkSchema.index({ createdBy: 1 });
shareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

export default mongoose.model<IShareLink>("ShareLink", shareLinkSchema);
