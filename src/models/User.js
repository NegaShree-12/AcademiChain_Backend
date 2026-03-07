import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      sparse: true,
      lowercase: true,
      trim: true,
      // REMOVE index: true from here
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // REMOVE index: true from here
    },
    password: {
      type: String,
      required: function() {
        return !this.walletAddress;
      },
    },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["student", "institution", "verifier", "admin", ""],
      default: "",
      // required: true,
    },
    institutionId: { type: String },
    institutionName: { type: String },
    studentId: { 
      type: String, 
      sparse: true
      // REMOVE index: true from here
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    profileImage: { type: String },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    settings: {
      notifications: { type: Boolean, default: true },
      darkMode: { type: Boolean, default: false },
      language: { type: String, default: "en" },
    },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function(next) {
  try {
    if (!this.isModified("password") || !this.password) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Define indexes here - ONCE
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ walletAddress: 1 }, { sparse: true });
UserSchema.index({ studentId: 1 }, { sparse: true });
UserSchema.index({ role: 1 });

const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;