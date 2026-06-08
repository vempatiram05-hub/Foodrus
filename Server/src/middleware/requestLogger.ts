import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * HTTP access logger middleware.
 * Logs method, URL, status code, duration, user ID, and correlation ID
 * for every completed request. Uses Winston so log output goes to both
 * the console and the daily-rotating file transports.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger[level]("HTTP request", {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: (req.user as any)?.id ?? null,
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });
  });

  next();
}
