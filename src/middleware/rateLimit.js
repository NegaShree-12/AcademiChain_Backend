import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increase from 20 to 100
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const studentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

export const institutionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
});

export const verifierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

export const roleBasedRateLimit = (req, res, next) => {
  const user = req.user;
  if (!user) return next();
  next();
};