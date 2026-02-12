import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  name: {
    type: String,
    default: ""
  },
  email: {
    type: String,
    default: ""
  },
  role: {
    type: String,
    enum: ["student", "institution", "verifier", "admin", ""],
    default: "",
    index: true
  },
  institution: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ walletAddress: 1, role: 1 });

export default mongoose.model("User", userSchema);