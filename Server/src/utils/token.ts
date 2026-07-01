import jwt,{ SignOptions }  from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET as string;
const ACCESS_TOKEN_EXPIRES_IN =(process.env.ACCESS_TOKEN_EXPIRY as SignOptions["expiresIn"])  || "24h"; // short-lived
const REFRESH_TOKEN_EXPIRES_IN = (process.env.REFRESH_TOKEN_EXPIRY as SignOptions["expiresIn"]) || "7d"; // long-lived


export interface JwtPayload {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;

  role_name: 'Admin' | 'SuperAdmin' | 'SubAdmin' | 'StoreAdmin' | 'Employee' | 'Customer';
  account_status: 'active' | 'inactive' | 'pending' | 'suspended';

  permissions?: any;
  is_active: boolean;
  token_version?: number;
  admin_id?: string | null;
  superadmin_id?: string | null;
  sub_admin_id?: string | null;
  store_admin_id?: string | null;
  store_id?: string | null;
  images?: any;
}

export const generateToken = (user: JwtPayload): { accessToken: string; refreshToken: string } => {
  if (!user.id) {
    throw new Error("User ID missing when generating token");
  }
  if (!JWT_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new Error("JWT secret is not defined in environment variables");
  }

  const basePayload: any = {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    full_name: user.full_name,
    role_name: user.role_name,
    permissions: user.permissions ?? null,
    is_active: user.is_active,
    account_status: user.account_status,
    token_version: user.token_version ?? 1,
    ...(user.images ? { images: user.images } : {})

  };

  // Only include hierarchy IDs if user is NOT Customer
  if (user.role_name !== "Customer") {
    basePayload.admin_id = user.admin_id ?? null;
    basePayload.superadmin_id = user.superadmin_id ?? null;
    basePayload.sub_admin_id = user.sub_admin_id ?? null;
    basePayload.store_admin_id = user.store_admin_id ?? null;
    basePayload.store_id = user.store_id ?? null;
  }


  const accessToken = jwt.sign(
    basePayload,
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    basePayload,
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  return {
    accessToken,
    refreshToken
  };
};

/* ---------------- GENERATE ONLY ACCESS TOKEN (REFRESH API---------------- */

export const generateAccessToken = (user: JwtPayload): string => {
  const payload: any = {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    full_name: user.full_name,
    role_name: user.role_name,
    permissions: user.permissions ?? null,
    is_active: user.is_active,
    account_status: user.account_status,
    token_version: user.token_version ?? 1,
  };

  if (user.role_name !== "Customer") {
    payload.admin_id = user.admin_id ?? null;   
    payload.superadmin_id = user.superadmin_id ?? null;
    payload.sub_admin_id = user.sub_admin_id ?? null;
    payload.store_admin_id = user.store_admin_id ?? null;
    payload.store_id = user.store_id ?? null;
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
};


/* ---------------- VERIFY ACCESS TOKEN ---------------- */

export const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  return decoded as JwtPayload;
};


/* ---------------- VERIFY REFRESH TOKEN ---------------- */

export const verifyRefreshToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);

  if (typeof decoded === "string") {
    throw new Error("Invalid refresh token");
  }

  return decoded as JwtPayload;
};

