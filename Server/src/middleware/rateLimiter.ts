import rateLimit from "express-rate-limit";

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10);

/**
 * General limiter — applied to all /api/* routes.
 * Default: 500 requests per 15 minutes per IP.
 * (Previous default of 100 was too low for normal browsing patterns.)
 */
export const generalLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX_GENERAL ?? "500", 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

/**
 * Auth limiter — applied to sensitive auth routes only.
 * Default: 10 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX_AUTH ?? "10", 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});
