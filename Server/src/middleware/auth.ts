import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload as JsonWebTokenJwtPayload } from "jsonwebtoken";
import { DBconnection } from "../config/DBConnect";
import type { JwtPayload } from "../utils/token";
import { logger } from "../utils/logger";

const JWT_SECRET = process.env.JWT_SECRET;

type RoleName = 'Admin' | 'SuperAdmin' | 'SubAdmin' | 'StoreAdmin' | 'Employee' | 'Customer';

// Extend Express Request type to include user
declare module "express-serve-static-core" {
  interface Request {
    user?: string | JsonWebTokenJwtPayload;
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({
        success: false,
        code: "AUTH_ERROR",
        message: "Unauthorized: Token missing or malformed",
      });
  }

  if (!JWT_SECRET) {
    logger.error("JWT_SECRET is not configured", { requestId: req.id });
    return res
      .status(500)
      .json({ success: false, code: "INTERNAL_ERROR", message: "Server configuration error" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ success: false, code: "AUTH_ERROR", message: "Unauthorized: Token missing" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;

    const tokenVersion = decoded.token_version;
    if (tokenVersion !== undefined) {
      const { data: userRow, error } = await DBconnection
        .from("users")
        .select("token_version")
        .eq("id", decoded.id)
        .maybeSingle();

      if (error) {
        if ((error as { code?: string }).code === "42703") {
          // Column does not exist yet (migration pending) — skip enforcement
        } else {
          logger.error("Token version DB error", { requestId: req.id, error });
          return res.status(401).json({
            success: false,
            message: "Unauthorized: Session validation failed.",
          });
        }
      } else if (userRow && (userRow as { token_version?: number }).token_version !== undefined) {
        const dbVersion = (userRow as { token_version: number }).token_version;
        if (dbVersion !== tokenVersion) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized: Session invalidated. Please log in again.",
          });
        }
      }
    }
    next();
  } catch (err) {
    logger.warn("JWT verification failed", {
      requestId: req.id,
      ip: req.ip,
      error: err instanceof Error ? err.message : String(err),
    });
    return res
      .status(401)
      .json({
        success: false,
        code: "AUTH_ERROR",
        message: "Unauthorized: Invalid or expired token",
      });
  }
};

/**
 * ✅ Allowed Roles
 */
const ALLOWED_ROLES = [
  "Admin",
  "SubAdmin",
  "StoreAdmin",
  "Customer",
  "SuperAdmin",
  "Employee",
] as const;

type Role = (typeof ALLOWED_ROLES)[number];


export const optionalAuthMiddlewares = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  /**
   * ✅ Case 1: No token → public request (unauthenticated)
   */
  if (!authHeader?.startsWith("Bearer ")) {
    req.user = undefined;
    return next();
  }

  /**
   * 🔹 Check JWT secret
   */
  if (!process.env.JWT_SECRET) {
    logger.error("JWT_SECRET is not configured", { requestId: req.id });
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Server configuration error",
    });
  }

  const token = authHeader.split(" ")[1];

  /**
   * ❌ Invalid token format
   */
  if (!token) {
    return res.status(401).json({
      success: false,
      code: "AUTH_ERROR",
      message: "Unauthorized: Token missing",
    });
  }

  try {
    /**
     * ✅ Verify token
     */
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    ) as JwtPayload;

    /**
     * 🔹 Validate role exists and is allowed
     */
    const role = decoded.role_name as Role;

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Invalid role in token",
      });
    }

    req.user = decoded;

    /**
     * 🔹 Token version validation
     */
    const tokenVersion = decoded.token_version;

    if (tokenVersion !== undefined) {
      const { data: userRow, error } = await DBconnection
        .from("users")
        .select("token_version")
        .eq("id", decoded.id)
        .maybeSingle();

      if (error) {
        if ((error as { code?: string }).code !== "42703") {
          logger.error("Token version DB error", {
            requestId: req.id,
            error,
          });
          return res.status(401).json({
            success: false,
            message: "Unauthorized: Session validation failed.",
          });
        }
      } else if (
        userRow &&
        (userRow as { token_version?: number }).token_version !== undefined
      ) {
        const dbVersion = (userRow as { token_version: number }).token_version;

        if (dbVersion !== tokenVersion) {
          return res.status(401).json({
            success: false,
            message:
              "Unauthorized: Session invalidated. Please log in again.",
          });
        }
      }
    }

    /**
     * ✅ All checks passed
     */
    return next();
  } catch (err) {
    logger.warn("JWT verification failed", {
      requestId: req.id,
      ip: req.ip,
      error: err instanceof Error ? err.message : String(err),
    });

    return res.status(401).json({
      success: false,
      code: "AUTH_ERROR",
      message: "Unauthorized: Invalid or expired token",
    });
  }
};
/* ===============================
   ROLE-BASED ACCESS CONTROL
================================ */
export const requireRole = (...allowedRoles: RoleName[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JwtPayload | undefined;
    const roleName = user?.role_name as RoleName | undefined;

    if (!roleName) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Forbidden: No role information found",
      });
    }

    if (!allowedRoles.includes(roleName)) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: `Forbidden: Role '${roleName}' is not permitted to perform this action`,
      });
    }

    next();
  };
};

/* ===============================
   PERMISSION-BASED ACCESS CONTROL
================================ */
export const requirePermission = (module: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JwtPayload | undefined;

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "AUTH_ERROR",
        message: "Unauthorized: No user found in request",
      });
    }

    // ✅ Role-based bypass for Admin/SuperAdmin on Admin-controlled modules (Store, Categories, Subcategories)
    if (user.role_name === "Admin" || user.role_name === "SuperAdmin") {
      if (["Store", "Categories", "Subcategories"].includes(module)) {
        return next();
      }
    }

    const permissions = user.permissions;

    if (!permissions) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Forbidden: No permissions found for this user",
      });
    }

    // Module-level check
    let modulePerms = permissions[module];

    // ✅ Fallback for Menu/Menus and Party/Parties renaming consistency
    if (!modulePerms) {
      if (module === "Menu" && permissions["Menus"]) {
        modulePerms = permissions["Menus"];
      } else if (module === "Menus" && permissions["Menu"]) {
        modulePerms = permissions["Menu"];
      } else if (module === "Party" && permissions["Parties"]) {
        modulePerms = permissions["Parties"];
      } else if (module === "Parties" && permissions["Party"]) {
        modulePerms = permissions["Party"];
      }
    }

    if (!modulePerms) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: `Forbidden: No permissions defined for module '${module}'`,
      });
    }

    // Action-level check
    const actionConfig = modulePerms[action];
    if (!actionConfig || actionConfig.allowed !== true) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: `Forbidden: You do not have permission to '${action}' in module '${module}'`,
      });
    }

    next();
  };
};
