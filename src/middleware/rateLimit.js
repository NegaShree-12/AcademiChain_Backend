import rateLimit from "express-rate-limit";

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

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

export const roleBasedRateLimit = (req, res, next) => {
  const user = req.user;

  if (!user) return authLimiter(req, res, next);

  switch (user.role) {
    case "student":
      return studentLimiter(req, res, next);
    case "institution":
      return institutionLimiter(req, res, next);
    case "employer":
    case "university":
      return verifierLimiter(req, res, next);
    default:
      return studentLimiter(req, res, next);
  }
};
