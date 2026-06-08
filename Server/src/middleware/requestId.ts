import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

// Augment the Express Request type to carry a correlation ID
declare module "express-serve-static-core" {
  interface Request {
    id: string;
  }
}

/**
 * Attaches a unique correlation ID to every incoming request.
 * Prefers a client-supplied X-Request-ID header so distributed systems
 * can propagate the same trace ID across service boundaries.
 * The ID is echoed back in the response header for client-side debugging.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"];
  req.id =
    typeof incoming === "string" && incoming.length > 0
      ? incoming
      : randomUUID();

  res.setHeader("X-Request-ID", req.id);
  next();
}
