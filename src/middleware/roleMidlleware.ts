// backend/src/middleware/roleMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    institutionId?: string;
  };
}

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

export const requireInstitution = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user || req.user.role !== "institution") {
    return res.status(403).json({
      success: false,
      message: "Only institutions can perform this action",
    });
  }

  if (!req.user.institutionId) {
    return res.status(400).json({
      success: false,
      message: "Institution account not properly configured",
    });
  }

  next();
};

export const requireStudent = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user || req.user.role !== "student") {
    return res.status(403).json({
      success: false,
      message: "Only students can perform this action",
    });
  }

  next();
};

export const requireVerifier = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (
    !req.user ||
    (req.user.role !== "employer" && req.user.role !== "university")
  ) {
    return res.status(403).json({
      success: false,
      message: "Only verified organizations can perform this action",
    });
  }

  next();
};
