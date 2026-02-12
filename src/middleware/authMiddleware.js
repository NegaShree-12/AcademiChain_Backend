import jwt from "jsonwebtoken";
import User from "../models/User.js";

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
      name: user.name
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Please authenticate"
    });
  }
};

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
        message: "Insufficient permissions"
      });
    }

    next();
  };
};