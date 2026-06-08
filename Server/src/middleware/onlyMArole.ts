import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";

// This middleware assumes req.user is set by a previous auth middleware
export const onlyMAroleMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // The user payload may be a string or JwtPayload
  const user = req.user as JwtPayload | undefined;

  // Check for role_name in the JWT payload
  const roleName = user && (user as any).role_name;

  if (roleName !== "Admin") {
    return res.status(403).json({ success: false, message: "Forbidden: Only users with role 'Admin' can perform this action." });
  }

  next();
};
