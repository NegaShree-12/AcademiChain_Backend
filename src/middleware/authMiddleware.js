import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Export as authenticate (for verifier routes)
export const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get fresh user data from database
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      throw new Error();
    }

    req.user = {
      id: user._id,
      walletAddress: user.walletAddress,
      role: user.role,
      email: user.email,
      name: user.name,
      studentId: user.studentId,
      institutionId: user.institutionId,
      institutionName: user.institutionName
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Please authenticate"
    });
  }
};

// Alias for authenticate (for student/institution routes)
export const protect = authenticate;

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Allow empty role (new users) to access role selection
    if (req.user.role === "" && roles.includes("")) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required roles: ${roles.join(", ")}. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

// For verifier-specific routes
export const requireVerifier = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  const verifierRoles = ["verifier", "employer", "university"];
  
  if (!verifierRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Verifier access required"
    });
  }

  next();
};

// For admin-only routes
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  next();
};