import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      walletAddress: user.walletAddress, 
      role: user.role,
      email: user.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

// ✅ Wallet Login with Signature Verification
export const walletLogin = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    console.log("📝 Wallet login attempt:", { walletAddress, messageLength: message?.length });

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ 
        success: false, 
        message: "walletAddress, signature, and message are required" 
      });
    }

    // Normalize address to lowercase
    const normalizedAddress = walletAddress.toLowerCase();

    try {
      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      console.log("🔐 Recovered address:", recoveredAddress);
      console.log("🔐 Expected address:", normalizedAddress);
      
      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid signature - address mismatch" 
        });
      }
    } catch (sigError) {
      console.error("❌ Signature verification error:", sigError.message);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid signature format", 
        error: sigError.message 
      });
    }

    // Find or create user
    let user = await User.findOne({ walletAddress: normalizedAddress });

    if (!user) {
      // Create new user with empty role (triggers role selection)
      user = await User.create({
        walletAddress: normalizedAddress,
        name: `User ${normalizedAddress.slice(2, 8)}`,
        email: `${normalizedAddress.slice(2, 8)}@academichain.user`,
        role: "",
        isVerified: true,
        lastLogin: new Date()
      });
      console.log("✅ New user created:", user._id);
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
      console.log("✅ Existing user logged in:", user._id);
    }

    // Generate JWT
    const token = generateToken(user);
    console.log("✅ JWT generated, length:", token.length);

    // Return user data (EXCLUDE password)
    const userData = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role || "",
      institution: user.institution || null,
      isVerified: user.isVerified
    };

    res.json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error("❌ Wallet login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Login failed", 
      error: error.message 
    });
  }
};

// ✅ Update User Role (after role selection)

// ✅ Update User Role (after role selection)
export const updateRole = async (req, res) => {
  try {
    const { role, institution } = req.body;
    const userId = req.user.id;

    console.log("📝 Update role attempt:", { userId, role, institution });

    const validRoles = ["student", "institution", "verifier", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid role" 
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        role, 
        institution: institution || null,
        updatedAt: Date.now() 
      },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Generate new token with updated role
    const token = generateToken(user);

    console.log("✅ Role updated successfully:", user.role);
    console.log("✅ New token generated, length:", token.length);

    // ✅ IMPORTANT: Return EXACT format frontend expects
    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
        institution: user.institution,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error("❌ Update role error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update role" 
    });
  }
};

// ✅ Get Current User Profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    res.json({ 
      success: true, 
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
        institution: user.institution,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error("❌ Get profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch profile" 
    });
  }
};

// ✅ Logout
export const logout = (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
};