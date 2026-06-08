import { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { UniqueService } from "../services/unique.service";
import { generateOTP, sendOTPToEmail, sendForgotPasswordEmail, sendSMS } from "../utils/mailer";
import { generateToken, verifyRefreshToken, generateAccessToken, JwtPayload } from "../utils/token";
import { generateImageName } from "../utils/file.util";
import { generateLocalSignedUrl } from "../utils/localSignedUrl";
import { deleteFile } from "../utils/deleteFile";
import argon2 from "argon2";
import { DBconnection } from "../config/DBConnect";
import { formatPhoneNumber, validatePhoneDigitCount } from "../utils/phone.util";
import { logger } from "../utils/logger";
import { getQueryString, getQueryNumber } from "../utils/queryParser";
import { isValidEmail } from "../utils/validators";
import { DEFAULT_PERMISSIONS, mergeWithDefaults } from "../constants/permissions";

const uniqueService = new UniqueService();
const TABLE = "users";
const OTP_TABLE = "user_otps";

//----------------- OTP HELPERS ----------------

export async function createUserOtp(
  userId: string,
  otpCode: string,
  minutes = 1
) {
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  //Delete old OTPs (single query — faster)
  const oldOtps = await uniqueService.getDataByField(OTP_TABLE, "user_id", userId);

  for (const record of oldOtps || []) {
    await uniqueService.deleteData(OTP_TABLE, record.id);
  }

  // Hash OTP before storing — never save plaintext OTPs
  const otpHash = await argon2.hash(otpCode);

  //Create new OTP
  const createdOtp = await uniqueService.create(OTP_TABLE, {
    user_id: userId,
    otp: otpHash,
    expires_at: expiresAt,
  });

  return createdOtp;
}

export async function getUserOtp(userId: string, otpCode: string) {
  // Fetch all OTP records for this user — query by user_id only (OTP is hashed, can't query by value)
  const records = await uniqueService.getDataByField(OTP_TABLE, "user_id", userId);
  if (!records || records.length === 0) return null;

  // Sort latest first
  const sorted = Array.isArray(records)
    ? records.slice().sort((a: {created_at?: string}, b: {created_at?: string}) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    : [];

  // Verify the plaintext OTP against the stored hash
  for (const record of sorted) {
    const isMatch = await argon2.verify(record.otp, otpCode);
    if (isMatch) return record;
  }

  return null;
}

export async function deleteUserOtp(id: string) {
  return await uniqueService.deleteData(OTP_TABLE, id);
}

// ---------------- TYPE ----------------
interface User {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role_name: 'Admin' | 'SuperAdmin' | 'SubAdmin' | 'StoreAdmin' | 'Employee' | 'Customer';
  password: string;
  permissions: any;
  is_active: boolean;
  account_status: "active" | "inactive" | "pending" | "suspended";
  token_version?: number;

  admin_id: string | null;
  superadmin_id: string | null;
  sub_admin_id: string | null;
  store_admin_id: string | null;
  store_id: string | null;

  created_at?: string;
  images?: string[];
  otp?: string | null;
  otp_expires_at?: string | null;
}

export const rolePermissions: Record<string, string[]> = {
  Admin: ["SuperAdmin"],
  SuperAdmin: ["SubAdmin"],
  SubAdmin: ["StoreAdmin"],
  StoreAdmin: ["Employee"],
  Employee: ["Customer"],
  Customer: [],
};

const getAllSubRoles = (role: string, visited = new Set<string>()): string[] => {
  const children = rolePermissions[role] || [];

  for (const child of children) {
    if (!visited.has(child)) {
      visited.add(child);
      getAllSubRoles(child, visited);
    }
  }

  return Array.from(visited);
};
const UPLOAD_DIR = path.join(process.cwd(), "src/uploads/users");
// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------- HELPERS ----------------
const mapImages = (images?: string[]) =>
  Array.isArray(images) ? images.map(generateLocalSignedUrl) : [];

const saveFiles = (files: Express.Multer.File[], name: string): string[] => {
  const lastTimestampRef = { value: 0 };
  return files.map(file => {
    const filename1 = generateImageName(name, file.originalname, lastTimestampRef);
    const filepath = path.join(UPLOAD_DIR, filename1);
    fs.writeFileSync(filepath, file.buffer);
    return `/uploads/users/${filename1}`;
  });
};
const sanitizeUser = (user: User | null) => {
  if (!user) return null;
  const { password, otp, otp_expires_at, ...rest } = user;
  return {
    ...rest,
    images: mapImages(user.images),
  };

};

/**
 * Helper to extract navigation menu items based on permissions.
 * Modules with showInMenu.allowed = true are included.
 */
const buildNavigationMenu = (permissions: any) => {
  if (!permissions) return [];
  const menuList: any[] = [];
  for (const [module, actions] of Object.entries(permissions)) {
    const actionObj = actions as any;
    if (actionObj.showInMenu?.allowed === true) {
      const allowedActions = Object.entries(actionObj)
        .filter(([_, val]: [string, any]) => val?.allowed === true)
        .map(([key]) => key);
      menuList.push({
        module,
        actions: allowedActions
      });
    }
  }
  return menuList;
};

type SanitizedUser = NonNullable<ReturnType<typeof sanitizeUser>>;


// ---------------- REGISTER ----------------
export const register = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      full_name,
      phone,
      role_name,
      permissions: inputPermissions,
      latitude,
      longitude,
      store_admin_id: bodyStoreAdminId,
      store_id: bodyStoreId,
    } = req.body;

    if (!email || !password || !full_name || !role_name) {
      return res.status(400).json({
        success: false,
        message: "email, password, full_name, role_name required",
      });
    }

    /* ================= EMAIL FORMAT VALIDATION ================= */
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    /* ================= PHONE VALIDATION ================= */
    let formattedPhone: string | null = null;

    if (phone) {
      try {
        validatePhoneDigitCount(phone);
        formattedPhone = formatPhoneNumber(phone);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: err.message || "Invalid phone number",
        });
      }
    }

    /* ================= DUPLICATE CHECK ================= */
    const emailExists =
      (await uniqueService.getDataByField(TABLE, "email", email)).length > 0;
    const phoneExists =
      formattedPhone &&
      (await uniqueService.getDataByField(TABLE, "phone", formattedPhone)).length > 0;

    if (emailExists || phoneExists) {
      return res.status(400).json({
        success: false,
        message:
          (emailExists ? "Email already exists. " : "") +
          (phoneExists ? "Phone already exists." : ""),
      });
    }

    /* ================= ROLE FETCH ================= */
    const validRoles = [
      "Admin",
      "SuperAdmin",
      "SubAdmin",
      "StoreAdmin",
      "Employee",
      "Customer",
    ];

    if (!validRoles.includes(role_name)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role_name",
      });
    }

    const isCustomerRole = role_name === "Customer";

    /* ================= CREATOR ================= */
    const creator = req.user as any | null;

    /* ================= HIERARCHY RULE ================= */
    const hierarchyMap: any = {
      Admin: ["SuperAdmin"],
      SuperAdmin: ["SubAdmin"],
      SubAdmin: ["StoreAdmin"],
      StoreAdmin: ["Employee"],
    };

    if (isCustomerRole) {
      // Customers can ONLY self-register — no authenticated user can create a Customer
      if (creator) {
        return res.status(403).json({
          success: false,
          message: "Customers can only self-register. No admin role can create a Customer.",
        });
      }
    } else {
      // Non-Customer roles always require an authenticated creator
      if (!creator) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const userPermissions = creator.permissions;

      // Explicit permission check: Must have Users.create to create non-Customer roles
      if (
        !userPermissions ||
        !userPermissions["Users"] ||
        !userPermissions["Users"]["create"] ||
        userPermissions["Users"]["create"].allowed !== true
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You do not have permission to 'create' in module 'Users'",
        });
      }

      const allowedRoles = hierarchyMap[creator.role_name] || [];

      if (!allowedRoles.includes(role_name)) {
        return res.status(403).json({
          success: false,
          message: `${creator.role_name} cannot create ${role_name}`,
        });
      }
    }

    /* ================= AUTO PARENT ASSIGN ================= */
    const isValidUUID = (val: any): boolean =>
      typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(val);

    let admin_id = null;
    let superadmin_id = null;
    let sub_admin_id = null;
    let store_admin_id = null;

    if (creator) {
      switch (creator.role_name) {
        case "Admin":
          admin_id = isValidUUID(creator.id) ? creator.id : null;
          break;

        case "SuperAdmin":
          admin_id = isValidUUID(creator.admin_id) ? creator.admin_id : null;
          superadmin_id = isValidUUID(creator.id) ? creator.id : null;
          break;

        case "SubAdmin":
          admin_id = isValidUUID(creator.admin_id) ? creator.admin_id : null;
          superadmin_id = isValidUUID(creator.superadmin_id) ? creator.superadmin_id : null;
          sub_admin_id = isValidUUID(creator.id) ? creator.id : null;

          break;

        case "StoreAdmin":
          admin_id = isValidUUID(creator.admin_id) ? creator.admin_id : null;
          superadmin_id = isValidUUID(creator.superadmin_id) ? creator.superadmin_id : null;
          sub_admin_id = isValidUUID(creator.sub_admin_id) ? creator.sub_admin_id : null;
          store_admin_id = isValidUUID(creator.id) ? creator.id : null;
          break;
      }
    }

    /* ================= STORE_ID (StoreAdmin creating Employee) ================= */
    let employee_store_id: string | null = null;

    if (creator && creator.role_name === "StoreAdmin" && role_name === "Employee") {
      if (!bodyStoreId || !isValidUUID(bodyStoreId)) {
        return res.status(400).json({
          success: false,
          message: "store_id is required when a StoreAdmin creates an Employee",
        });
      }
      // Verify the store belongs to the creating StoreAdmin
      const { data: storeRecord } = await DBconnection
        .from("stores")
        .select("id, store_admin_id")
        .eq("id", bodyStoreId)
        .single();
      if (!storeRecord || storeRecord.store_admin_id !== creator.id) {
        return res.status(403).json({
          success: false,
          message: "The provided store does not belong to you",
        });
      }
      employee_store_id = bodyStoreId;
    }

    /* ================= FIND CIRCLE (CUSTOMER ONLY) ================= */
    let circle_id: string | null = null;

    if (isCustomerRole && latitude && longitude) {
      const { data: circleData, error: circleError } = await DBconnection.rpc(
        "find_circle_by_location",
        {
          user_long: longitude,
          user_lat: latitude,
        }
      );

      if (circleError) {
        return res.status(500).json({
          success: false,
          message: circleError.message,
        });
      }

      if (!circleData || circleData.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Service not available in your area",
        });
      }

      circle_id = circleData[0].id;
    }

    /* ================= PERMISSIONS ================= */
    let permissions: any = {};
    if (inputPermissions) {
      try {
        const parsed =
          typeof inputPermissions === "string"
            ? JSON.parse(inputPermissions)
            : inputPermissions;
        // Merge with defaults — unknown modules/actions in parsed are silently dropped
        permissions = mergeWithDefaults(role_name, parsed);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid permissions format",
        });
      }
    } else {
      // Assign default permissions based on role (via helper for a single canonical path)
      permissions = mergeWithDefaults(role_name);
    }

    /* ================= PASSWORD HASH ================= */
    const passwordHash = await argon2.hash(password);

    /* ================= CREATE USER ================= */
    let user: any = await uniqueService.create(TABLE, {
      email,
      phone: formattedPhone ?? null,
      full_name,
      role_name,
      password: passwordHash,
      permissions,
      is_active: !isCustomerRole,// admins active, customer inactive
      account_status: isCustomerRole ? "pending" : "active",
      admin_id,
      superadmin_id,
      sub_admin_id,
      store_admin_id,
      ...(employee_store_id !== null ? { store_id: employee_store_id } : {}),
      circle_id,
      images: [],
    });

    // fallback fetch if service doesn't return id
    if (!user?.id) {
      const fetched = await uniqueService.getDataByField(TABLE, "email", email);
      user = fetched[0];
    }

    user.role_name = role_name;

    /* ================= IMAGE UPLOAD ================= */
    if (req.files?.length) {
      const images = saveFiles(req.files, user.full_name);
      await uniqueService.updateById(TABLE, user.id, { images });
      user.images = images;
    }

    /* ================= CUSTOMER OTP ================= */
    if (isCustomerRole) {
      const { otp } = generateOTP(6); // reuse function
      await createUserOtp(user.id, otp, 1);
      let emailSent = true;
      try {
        await sendOTPToEmail(user.email, otp);
      } catch (emailErr: any) {
        emailSent = false;
        logger.error("OTP email failed to send", { error: emailErr?.response?.data || emailErr?.message });
      }

      return res.status(201).json({
        success: true,
        message: emailSent ? "Customer registered. OTP sent." : "Customer registered. OTP email could not be sent — check server logs.",
        data: sanitizeUser(user),
      });
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: sanitizeUser(user),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const validateOTP = async (req: Request, res: Response) => {
  try {
    const { emailOrPhone, otp } = req.body;

    if (!emailOrPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email/Phone and OTP required",
      });
    }

    // ---------- FIND USER ----------
    const loginValue = emailOrPhone.trim();

    let user;

    if (loginValue.includes("@")) {

      if (!isValidEmail(loginValue)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      const users = await uniqueService.getDataByField(TABLE, "email", loginValue);
      user = users?.[0];

    } else {

      let formattedPhone;

      try {
        formattedPhone = formatPhoneNumber(loginValue);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: err.message || "Invalid phone number",
        });
      }

      const users = await uniqueService.getDataByField(TABLE, "phone", formattedPhone);
      user = users?.[0];
    }
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // ---------- FIND OTP ----------
    const otpRecord = await getUserOtp(user.id, otp);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // ---------- FIX TIMEZONE ISSUE ----------
    const expiryString = String(otpRecord.expires_at);

    // Convert DB format → ISO with local timezone
    const expiryDate = new Date(expiryString.replace(" ", "T"));

    const now = new Date();

    if (now.getTime() > expiryDate.getTime()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    // ---------- ACTIVATE USER ----------
    await uniqueService.updateById(TABLE, user.id, {
      is_active: true,
      account_status: "active",
    });

    // ---------- DELETE OTP ----------
    await deleteUserOtp(otpRecord.id);

    return res.json({
      success: true,
      message: "OTP verified successfully",
    });

  } catch (err: any) {
    logger.error("validateOTP error", { message: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { emailOrPhone, password } = req.body; // email or phone

    if (!emailOrPhone || !password)
      return res.status(400).json({
        success: false,
        message: "Email or Phone & password required"
      });

    const loginValue = emailOrPhone.trim();

    let user;

    if (loginValue.includes("@")) {
      if (!isValidEmail(loginValue)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      const users = await uniqueService.getDataByField<User>(TABLE, "email", loginValue);
      user = users?.[0];

    } else {
      let formattedPhone;

      try {
        formattedPhone = formatPhoneNumber(loginValue);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: err.message || "Invalid phone number",
        });
      }

      const users = await uniqueService.getDataByField<User>(TABLE, "phone", formattedPhone);
      user = users?.[0];
    }

    if (!user)
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });

    // Password verify
    if (!(await argon2.verify(user.password, password)))
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });

    // Check account_status
    // 1️⃣ Account lifecycle check
    if (user.account_status === "pending") {
      return res.status(403).json({
        success: false,
        message: "Account not verified. Please validate OTP.",
      });
    }

    if (user.account_status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Account suspended by admin. Contact support.",
      });
    }

    // 2️⃣ Temporary disable check
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account temporarily disabled. Contact support.",
      });
    }

    /* -------- TOKEN PAYLOAD -------- */

    const tokenPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role_name: user.role_name,   // ✅ directly from users table
      phone: user.phone ?? "",

      permissions: mergeWithDefaults(user.role_name, user.permissions ?? {}),
      is_active: user.is_active,
      account_status: user.account_status,
      token_version: user.token_version ?? 1,
      admin_id: user.admin_id ?? "",
      superadmin_id: user.superadmin_id ?? "",
      sub_admin_id: user.sub_admin_id ?? "",
      store_admin_id: user.store_admin_id ?? "",
      store_id: user.store_id ?? null,
    };

    const token = generateToken(tokenPayload);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      // menuList: buildNavigationMenu(user.permissions),
      // user: sanitizeUser(user)
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export const sendLoginOtp = async (req: Request, res: Response) => {
  try {
    const { emailOrPhone, countryCode } = req.body;

    if (!emailOrPhone) {
      return res.status(400).json({
        success: false,
        message: "Email or Phone required",
      });
    }

    const login = emailOrPhone.trim();


    let isEmail = false;
    let formattedPhone: string | null = null;

    // Check if user tried email
    if (login.includes("@")) {
      if (!isValidEmail(login)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      isEmail = true;
    } else {
      // Use reusable phone utility
      try {
        formattedPhone = formatPhoneNumber(login, countryCode);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
    }

    // Find user
    const users = isEmail
      ? await uniqueService.getDataByField(TABLE, "email", login)
      : await uniqueService.getDataByField(TABLE, "phone", formattedPhone);

    const user = users?.[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate OTP
    const { otp } = generateOTP(6);

    await createUserOtp(user.id, otp, 1);

    // Send OTP
    if (isEmail) {
      await sendOTPToEmail(login, otp);
    } else {
      await sendSMS(
        formattedPhone!,
        `Your login OTP is ${otp}. It will expire in 5 minutes.`
      );
    }

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (err: any) {
    logger.error("Send OTP error", { message: err.message, stack: err.stack });

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to send OTP",
    });
  }
};

export const verifyLoginOtp = async (req: Request, res: Response) => {
  try {
    const { emailOrPhone, otp } = req.body;

    if (!emailOrPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email/Phone and OTP required",
      });
    }

    const loginValue = emailOrPhone.trim();

    let user: User | undefined;

    if (loginValue.includes("@")) {
      if (!isValidEmail(loginValue)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }
      const users = await uniqueService.getDataByField<User>(TABLE, "email", loginValue);
      user = users?.[0];
    } else {
      let formattedPhone: string;
      try {
        formattedPhone = formatPhoneNumber(loginValue);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: err.message || "Invalid phone number",
        });
      }
      const users = await uniqueService.getDataByField<User>(TABLE, "phone", formattedPhone);
      user = users?.[0];
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // ---------- VERIFY OTP ----------
    const otpRecord = await getUserOtp(user.id, otp);

    if (!otpRecord) {
      return res.status(401).json({ success: false, message: "Invalid OTP" });
    }

    const expiryDate = new Date(String(otpRecord.expires_at).replace(" ", "T"));
    if (new Date().getTime() > expiryDate.getTime()) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    // ---------- ACCOUNT CHECKS ----------
    if (user.account_status === "pending") {
      return res.status(403).json({
        success: false,
        message: "Account not verified. Please validate OTP.",
      });
    }

    if (user.account_status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Account suspended by admin. Contact support.",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account temporarily disabled. Contact support.",
      });
    }

    // ---------- DELETE OTP ----------
    await deleteUserOtp(otpRecord.id);

    // ---------- GENERATE TOKENS ----------
    const tokenPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role_name: user.role_name,
      phone: user.phone ?? "",
      permissions: mergeWithDefaults(user.role_name, user.permissions ?? {}),
      is_active: user.is_active,
      account_status: user.account_status,
      token_version: user.token_version ?? 1,
      admin_id: user.admin_id ?? "",
      superadmin_id: user.superadmin_id ?? "",
      sub_admin_id: user.sub_admin_id ?? "",
      store_admin_id: user.store_admin_id ?? "",
      store_id: user.store_id ?? null,
    };

    const token = generateToken(tokenPayload);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      menuList: buildNavigationMenu(mergeWithDefaults(user.role_name, user.permissions ?? {})),
      user: sanitizeUser(user)
    });

  } catch (err: any) {
    logger.error("verifyLoginOtp error", { message: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const forgotPasswordController = async (req: Request, res: Response) => {
  try {

    const { emailOrPhone } = req.body;

    if (!emailOrPhone) {
      return res.status(400).json({
        success: false,
        message: "Email or Phone is required",
      });
    }

    const login = emailOrPhone.trim();

    // If input looks like an email but is malformed, reject immediately
    if (login.includes("@") && !isValidEmail(login)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    // Detect type
    const isEmail = isValidEmail(login);

    let users;

    if (isEmail) {
      users = await uniqueService.getDataByField(TABLE, "email", login);
    } else {
      let formattedPhone: string;
      try {
        formattedPhone = formatPhoneNumber(login);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: err.message || "Invalid phone number",
        });
      }
      users = await uniqueService.getDataByField(TABLE, "phone", formattedPhone);
    }

    const user = users?.[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const { otp } = generateOTP(6);

    await createUserOtp(user.id, otp, 1);

    // Send OTP
    if (isEmail) {
      await sendForgotPasswordEmail(user.email, otp);
    } else {
      await sendSMS(user.phone, `Your login OTP is ${otp}. It will expire in 5 minutes.`);
    }

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


export const getUsersBySuperAdmin = async (req: Request, res: Response) => {
  try {
    const { superadminId } = req.params;
    if (!superadminId) return res.status(400).json({ success: false, message: 'superadminId is required' });

    const search = (getQueryString(req.query, 'search') || '').trim();
    const role = getQueryString(req.query, 'role') || undefined;
    const storeId = getQueryString(req.query, 'store_id') || undefined;
    const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
    const searchColumns = ['full_name', 'email', 'phone'];
    const extraFilters: Record<string, string> = { superadmin_id: superadminId };
    if (role) extraFilters.role_name = role;
    if (storeId) extraFilters.store_id = storeId;

    if (isPaginated || search || role || storeId) {
      const page = getQueryNumber(req.query, 'page', 1)!;
      const limit = getQueryNumber(req.query, 'limit', 10)!;
      const result = await uniqueService.getDataWithSearch<User>(TABLE, searchColumns, search || undefined, limit, page, extraFilters);
      const sanitized = result.data.map(sanitizeUser).filter((u): u is SanitizedUser => u !== null);
      return res.json({ success: true, message: 'Users fetched successfully', users: sanitized, total: result.total, page, limit });
    }

    const users = await uniqueService.getDataByField<User>(TABLE, 'superadmin_id', superadminId as string);
    const sanitized = users.map(sanitizeUser).filter((u): u is SanitizedUser => u !== null).sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    return res.json({ success: true, message: 'Users fetched successfully', users: sanitized, total: sanitized.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- VERIFY FORGOT PASSWORD OTP ----------------
export const verifyForgotPasswordOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }
    if (!isValidEmail(email.trim())) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const users = await uniqueService.getDataByField(TABLE, "email", email.trim());
    const user = users?.[0];

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const otpRecord = await getUserOtp(user.id, otp);

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const expiryDate = new Date(String(otpRecord.expires_at).replace(" ", "T"));
    if (new Date() > expiryDate) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    return res.json({ success: true, message: "OTP verified successfully" });

  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- RESEND OTP ----------------
export const resendOtp = async (req: Request, res: Response) => {
  try {
    const { emailOrPhone } = req.body;

    const loginValue = emailOrPhone?.trim();

    let users;

    if (loginValue?.includes("@")) {
      if (!isValidEmail(loginValue)) {
        return res.status(400).json({ success: false, message: "Invalid email format" });
      }
      users = await uniqueService.getDataByField(TABLE, "email", loginValue);
    } else {
      let formattedPhone: string;
      try {
        formattedPhone = formatPhoneNumber(loginValue);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Invalid phone number" });
      }
      users = await uniqueService.getDataByField(TABLE, "phone", formattedPhone);
    }

    const user = users?.[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Only allow resend for pending / unverified accounts (registration OTP)
    // and active accounts that need a new OTP (forgot-password flow)
    if (user.account_status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Account suspended. Contact support.",
      });
    }

    // Generate a fresh 6-digit OTP (expires in 1 min)
    const { otp } = generateOTP(6);

    // createUserOtp() deletes old OTPs, hashes the new one, then saves
    await createUserOtp(user.id, otp, 1);

    // Attempt to send email — OTP is already saved, so it's safe to
    // return partial success if email delivery fails
    let emailSent = true;
    try {
      await sendOTPToEmail(user.email, otp);
    } catch (mailErr: any) {
      emailSent = false;
      logger.error("Resend OTP email failed", {
        error: mailErr?.response?.data || mailErr?.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: emailSent
        ? "OTP sent to your email"
        : "OTP generated but email failed to send — check server logs",
    });
  } catch (err: any) {
    logger.error("resendOtp error", { message: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};

// ---------------- UPDATE PASSWORD ----------------
export const updatePasswordController = async (req: Request, res: Response) => {
  try {
    const { email, newPassword, otp } = req.body;

    if (!email || !newPassword || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP and newPassword are required",
      });
    }
    if (!isValidEmail(email.trim())) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    // ✅ password strength check (ADD HERE)
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }
    // find user
    const users = await uniqueService.getDataByField(TABLE, "email", email);
    const user = users?.[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // verify OTP
    const otpRecord = await getUserOtp(user.id, otp);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // check expiry
    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    // hash new password
    const hashedPassword = await argon2.hash(newPassword);

    // update password
    await uniqueService.updateById(TABLE, user.id, {
      password: hashedPassword,
    });

    // delete OTP after success (important)
    await deleteUserOtp(otpRecord.id);

    return res.json({
      success: true,
      message: "Password updated successfully",
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
export const getList = async (req: Request, res: Response) => {
  try {
    // ── Customer restriction: can only view their own profile ──
    const caller = req.user as { id?: string; role_name?: string } | undefined;
    if (caller?.role_name === "Customer") {
      if (!caller.id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      const ownUser = await uniqueService.getDataById<User>(caller.id, TABLE);
      if (!ownUser) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      return res.json({
        success: true,
        message: "User fetched successfully",
        data: [sanitizeUser(ownUser)],
        total: 1,
      });
    }

    const search = (getQueryString(req.query, "search") || "").trim();
    const role = getQueryString(req.query, "role") || undefined;
    const storeId = getQueryString(req.query, "store_id") || undefined;
    const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

    const searchColumns = ["email", "phone", "full_name"];
    const extraFilters: Record<string, string> = {};
    if (role) extraFilters.role_name = role;
    if (storeId) extraFilters.store_id = storeId;

    let data: any[];
    let total: number;

    if (isPaginated) {
      const page = getQueryNumber(req.query, "page", 1);
      const limit = getQueryNumber(req.query, "limit", 10);
      const result = await uniqueService.getDataWithSearch<User>(TABLE, searchColumns, search || undefined, limit, page, extraFilters);
      data = result.data;
      total = result.total;

      return res.json({
        success: true,
        message: data.length ? "Users fetched successfully" : "No records found",
        data: data.map(sanitizeUser),
        total,
        page,
        limit,
      });
    } else {
      data = await uniqueService.getAllData(TABLE);
      if (search) {
        const lowerSearch = search.toLowerCase();
        data = data.filter((c: any) =>
          searchColumns.some(col => c[col]?.toString().toLowerCase().includes(lowerSearch))
        );
      }
      if (role) {
        data = data.filter((c: any) => c.role_name === role);
      }
      if (storeId) {
        data = data.filter((c: any) => c.store_id === storeId);
      }
      total = data.length;

      return res.json({
        success: true,
        message: data.length ? "Users fetched successfully" : "No records found",
        data: data.map(sanitizeUser),
        total,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to fetch users" });
  }
};

// ---------------- GET USER BY ID ----------------
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await uniqueService.getDataById<User>(req.params.id as string, TABLE);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, message: "User fetched successfully", data: sanitizeUser(user) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- GET USERS BY STORE ADMIN ----------------
export const getUsersByStoreAdmin = async (req: Request, res: Response) => {
  try {
    const { storeAdminId } = req.params;
    if (!storeAdminId) return res.status(400).json({ success: false, message: "storeAdminId is required" });

    const search = (getQueryString(req.query, 'search') || '').trim();
    const storeId = getQueryString(req.query, 'store_id') || undefined;
    const role = getQueryString(req.query, 'role') || undefined;
    const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
    const searchColumns = ['full_name', 'email', 'phone'];
    const extraFilters: Record<string, string> = { store_admin_id: storeAdminId };
    if (storeId) extraFilters.store_id = storeId;
    if (role) extraFilters.role_name = role;

    if (isPaginated || search || storeId || role) {
      const page = getQueryNumber(req.query, 'page', 1)!;
      const limit = getQueryNumber(req.query, 'limit', 10)!;
      const result = await uniqueService.getDataWithSearch<User>(TABLE, searchColumns, search || undefined, limit, page, extraFilters);
      const sanitized = result.data.map(sanitizeUser).filter((u): u is SanitizedUser => u !== null);
      return res.json({ success: true, message: "Users fetched successfully", users: sanitized, total: result.total, page, limit });
    }

    const users = await uniqueService.getDataByField<User>(TABLE, "store_admin_id", storeAdminId as string);
    const sanitized = users.map(sanitizeUser).filter((u): u is SanitizedUser => u !== null).sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    return res.json({ success: true, message: "Users fetched successfully", users: sanitized, total: sanitized.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};




// ---------------- GET USERS BY SUB ADMIN ----------------
export const getUsersBySubAdmin = async (req: Request, res: Response) => {
  try {
    const { subAdminId } = req.params;
    if (!subAdminId) return res.status(400).json({ success: false, message: 'subAdminId is required' });

    const search = (getQueryString(req.query, 'search') || '').trim();
    const role = getQueryString(req.query, 'role') || undefined;
    const storeId = getQueryString(req.query, 'store_id') || undefined;
    const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
    const searchColumns = ['full_name', 'email', 'phone'];
    const extraFilters: Record<string, string> = { sub_admin_id: subAdminId };
    if (role) extraFilters.role_name = role;
    if (storeId) extraFilters.store_id = storeId;

    if (isPaginated || search || role || storeId) {
      const page = getQueryNumber(req.query, 'page', 1)!;
      const limit = getQueryNumber(req.query, 'limit', 10)!;
      const result = await uniqueService.getDataWithSearch<User>(TABLE, searchColumns, search || undefined, limit, page, extraFilters);
      const sanitized = result.data.map(sanitizeUser).filter((u): u is SanitizedUser => u !== null);
      return res.json({ success: true, message: 'Users fetched successfully', users: sanitized, total: result.total, page, limit });
    }

    const users = await uniqueService.getDataByField<User>(TABLE, 'sub_admin_id', subAdminId as string);
    const sanitized = users.map(sanitizeUser).filter((u): u is SanitizedUser => u !== null).sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    return res.json({ success: true, message: 'Users fetched successfully', users: sanitized, total: sanitized.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- GET USERS BY ROLE ----------------
export const getUsersByRole = async (req: Request, res: Response) => {
  try {
    const { roleId: roleName } = req.params;

    if (!roleName) {
      return res.status(400).json({
        success: false,
        message: "roleName is required",
      });
    }

    const users = await uniqueService.getDataByField<User>(
      TABLE,
      "role_name",   // ✅ correct column
      roleName as string
    );

    return res.json({
      success: true,
      message: "Users fetched successfully",
      data: users.map(sanitizeUser),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ---------------- UPDATE USER ----------------
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const existingUser = await uniqueService.getDataById<User>(userId, TABLE);
    if (!existingUser) return res.status(404).json({ success: false, message: "User not found" });

    const DIRECT_REPORT: Record<string, string> = {
      Admin: 'SuperAdmin',
      SuperAdmin: 'SubAdmin',
      SubAdmin: 'StoreAdmin',
      StoreAdmin: 'Employee',
    };
    const actor = req.user as { id: string; role_name: string } | undefined;
    if (actor?.role_name) {
      const requiredRole = DIRECT_REPORT[actor.role_name];
      if (!requiredRole || existingUser.role_name !== requiredRole) {
        return res.status(403).json({
          success: false,
          message: `You can only manage users with role '${requiredRole || 'none'}'`,
        });
      }
    }

    const incomingStoreId: string | undefined = req.body.store_id;
    if (incomingStoreId !== undefined) {
      if (existingUser.role_name !== 'Employee') {
        return res.status(400).json({
          success: false,
          message: "store_id can only be set for Employee users",
        });
      }
      if (actor?.role_name === 'StoreAdmin') {
        const { data: storeRecord, error: storeError } = await DBconnection
          .from("stores")
          .select("id, store_admin_id")
          .eq("id", incomingStoreId)
          .single();
        if (storeError || !storeRecord) {
          return res.status(400).json({
            success: false,
            message: "Store not found",
          });
        }
        if (storeRecord.store_admin_id !== actor.id) {
          return res.status(403).json({
            success: false,
            message: "You can only assign employees to your own stores",
          });
        }
      }
    }

    const permissions = req.body.permissions !== undefined
      ? (typeof req.body.permissions === "string" ? JSON.parse(req.body.permissions) : req.body.permissions)
      : existingUser.permissions ?? {};
    let images: string[] = existingUser.images ?? [];

    // Handle uploaded files safely
    const files = Array.isArray(req.files) ? req.files : [];
    const uploadDir = path.join(process.cwd(), "src", "uploads", "users");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const lastTimestampRef = { value: 0 };
    if (files?.length) {
      existingUser.images?.forEach(deleteFile);
      images = [];
      for (const file of files) {
        const filename = generateImageName(existingUser.full_name, file.originalname, lastTimestampRef);
        const filepath = path.join(uploadDir, filename);
        await fs.promises.writeFile(filepath, file.buffer);
        images.push(`/uploads/users/${filename}`);
      }
    }

    if (req.body.phone !== undefined && req.body.phone !== null && req.body.phone !== '') {
      try {
        validatePhoneDigitCount(req.body.phone);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const permissionsChanged = JSON.stringify(permissions) !== JSON.stringify(existingUser.permissions ?? {});
    const currentVersion = existingUser.token_version ?? 1;
    const newTokenVersion = permissionsChanged ? currentVersion + 1 : currentVersion;
    const payload = { ...req.body, permissions, images, ...(permissionsChanged ? { token_version: newTokenVersion } : {}) };
    const updatedUser = await uniqueService.updateById<typeof existingUser>(TABLE, userId, payload);

    return res.json({ success: true, message: "User updated successfully", data: sanitizeUser(updatedUser) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- DELETE USER ----------------
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;

    // 1️⃣ Fetch user first
    const existingUser = await uniqueService.getDataById(userId, TABLE);
    if (!existingUser) return res.status(404).json({ success: false, message: "User not found" });

    const DIRECT_REPORT_DEL: Record<string, string> = {
      Admin: 'SuperAdmin',
      SuperAdmin: 'SubAdmin',
      SubAdmin: 'StoreAdmin',
      StoreAdmin: 'Employee',
    };
    const actor = req.user as { id: string; role_name: string } | undefined;
    if (actor?.role_name) {
      const requiredRole = DIRECT_REPORT_DEL[actor.role_name];
      if (!requiredRole || existingUser.role_name !== requiredRole) {
        return res.status(403).json({
          success: false,
          message: `You can only delete users with role '${requiredRole || 'none'}'`,
        });
      }
    }

    // 2️⃣ Delete user images
    existingUser.images?.forEach(deleteFile);

    // 3️⃣ Delete user row
    await uniqueService.deleteData(TABLE, userId);

    return res.json({ success: true, message: "User deleted successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};



// ------------------------- UPDATE USER STATUS -------------------------
export const updateStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      return res.status(400).json({ success: false, message: "is_active must be boolean" });
    }

    const user = await uniqueService.getDataById(userId, TABLE);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const DIRECT_REPORT_STATUS: Record<string, string> = {
      Admin: 'SuperAdmin',
      SuperAdmin: 'SubAdmin',
      SubAdmin: 'StoreAdmin',
      StoreAdmin: 'Employee',
    };
    const actorStatus = req.user as { id: string; role_name: string } | undefined;
    if (actorStatus?.role_name) {
      const requiredRole = DIRECT_REPORT_STATUS[actorStatus.role_name];
      if (!requiredRole || user.role_name !== requiredRole) {
        return res.status(403).json({
          success: false,
          message: `You can only update status for users with role '${requiredRole || 'none'}'`,
        });
      }
    }

    const updatedUser = await uniqueService.updateById<User>(
      TABLE,
      userId,
      { is_active } as Partial<User>
    );

    return res.json({
      success: true,
      message: "User status updated successfully",
      data: sanitizeUser(updatedUser),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ------------------------- UPDATE OWN PROFILE (self-service) -------------------------
export const updateOwnProfile = async (req: Request, res: Response) => {
  try {
    const caller = req.user as { id: string; role_name: string } | undefined;
    if (!caller?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const existingUser = await uniqueService.getDataById<User>(caller.id, TABLE);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let images: string[] = existingUser.images ?? [];
    const files = Array.isArray(req.files) ? req.files : [];
    const uploadDir = path.join(process.cwd(), "src", "uploads", "users");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const lastTimestampRef = { value: 0 };
    if (files.length) {
      existingUser.images?.forEach(deleteFile);
      images = [];
      for (const file of files) {
        const filename = generateImageName(existingUser.full_name, file.originalname, lastTimestampRef);
        const filepath = path.join(uploadDir, filename);
        await fs.promises.writeFile(filepath, file.buffer);
        images.push(`/uploads/users/${filename}`);
      }
    }

    const { full_name, phone } = req.body;

    if (phone !== undefined && phone !== null && phone !== '') {
      try {
        validatePhoneDigitCount(phone);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const updatePayload: Partial<User> = { images };
    if (full_name !== undefined) updatePayload.full_name = full_name;
    if (phone !== undefined) updatePayload.phone = phone || null;

    const updatedUser = await uniqueService.updateById<User>(TABLE, caller.id, updatePayload);
    return res.json({ success: true, message: "Profile updated successfully", user: sanitizeUser(updatedUser) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ------------------------- CHANGE PASSWORD -------------------------
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: "current_password and new_password are required"
      });
    }

    const user = await uniqueService.getDataById(userId, TABLE);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify current password before allowing change
    const isCurrentPasswordValid = await argon2.verify(user.password, current_password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Hash new password
    const hashedPassword = await argon2.hash(new_password);

    // Update password
    const updatedUser = await uniqueService.updateById<User>(
      TABLE,
      userId,
      { password: hashedPassword } as Partial<User>
    );

    return res.json({
      success: true,
      message: "Password changed successfully",
      data: sanitizeUser(updatedUser)
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


export const updateAccountStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;   // ✅ FIXED
    const { account_status } = req.body;

    // Properly typed user (avoid TS error)
    const actor = req.user as { id: string; role_name: string } | undefined;

    if (!actor?.id || !actor?.role_name) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // ❌ Customers cannot update anyone
    if (actor.role_name === "Customer") {
      return res.status(403).json({
        success: false,
        message: "Customers are not allowed to update account status",
      });
    }

    // Validate input
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required",
      });
    }

    if (!["active", "suspended"].includes(account_status)) {
      return res.status(400).json({
        success: false,
        message: "account_status must be 'active' or 'suspended'",
      });
    }

    // ❌ Prevent self-suspension
    if (actor.id === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own account status",
      });
    }

    // Get target user
    const targetUser = await uniqueService.getDataById(userId, "users");

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const targetRole = targetUser.role_name;

    // --- DIRECT PARENT CHECK ---
    const DIRECT_REPORT: Record<string, string> = {
      Admin: 'SuperAdmin',
      SuperAdmin: 'SubAdmin',
      SubAdmin: 'StoreAdmin',
      StoreAdmin: 'Employee',
    };

    const requiredRole = DIRECT_REPORT[actor.role_name];
    if (!requiredRole || targetRole !== requiredRole) {
      return res.status(403).json({
        success: false,
        message: `You are only allowed to modify ${requiredRole || 'none'} accounts`,
      });
    }

    // --- OWNERSHIP CHECK (Must be direct parent) ---
    const parentFieldMap: Record<string, string> = {
      Admin: 'admin_id',
      SuperAdmin: 'superadmin_id',
      SubAdmin: 'sub_admin_id',
      StoreAdmin: 'store_admin_id',
    };

    const parentField = parentFieldMap[actor.role_name];
    if (parentField && targetUser[parentField] !== actor.id) {
      return res.status(403).json({
        success: false,
        message: `You can only manage ${targetRole}s within your own direct hierarchy`,
      });
    }
    // 1️⃣ Update the target user (e.g. StoreAdmin) account status and activity
    const updatePayload: any = {
      account_status,
    };

    if (account_status === "suspended") {
      // is_active remains unchanged as per latest requirement
      updatePayload.prev_account_status = targetUser.account_status;
    } else if (account_status === "active") {
      // Restore previous account status if available, otherwise default to "active"
      // is_active remains unchanged
      updatePayload.account_status = targetUser.prev_account_status ?? "active";
    }

    await uniqueService.updateById("users", userId, updatePayload);

    // 2️⃣ Cascading logic for StoreAdmin
    if (targetRole === "StoreAdmin") {
      if (account_status === "suspended") {
        // --- SUSPENSION ---
        // Fetch all stores of this admin to preserve their current is_active state
        const { data: stores, error: fetchError } = await DBconnection
          .from("stores")
          .select("id, is_active")
          .eq("store_admin_id", userId);

        if (!fetchError && stores) {
          for (const s of stores) {
            await DBconnection
              .from("stores")
              .update({ prev_is_active: s.is_active, is_active: false })
              .eq("id", s.id);
          }
        }

        // Snapshot each employee's current status, then suspend them
        const { data: employees, error: empFetchError } = await DBconnection
          .from("users")
          .select("id, is_active, account_status")
          .eq("store_admin_id", userId)
          .eq("role_name", "Employee");

        if (!empFetchError && employees) {
          for (const emp of employees) {
            await DBconnection
              .from("users")
              .update({
                prev_account_status: emp.account_status,
                account_status: "suspended",
                // is_active remains unchanged
              })
              .eq("id", emp.id);
          }
        }

      } else if (account_status === "active") {
        // --- REACTIVATION ---
        // Restore stores that were active before suspension
        const { data: stores, error: fetchError } = await DBconnection
          .from("stores")
          .select("id, prev_is_active")
          .eq("store_admin_id", userId);

        if (!fetchError && stores) {
          for (const s of stores) {
            if (s.prev_is_active === true) {
              await DBconnection
                .from("stores")
                .update({ is_active: true })
                .eq("id", s.id);
            }
          }
        }

        // Restore each employee's pre-suspension account status
        const { data: employees, error: empFetchError } = await DBconnection
          .from("users")
          .select("id, prev_account_status")
          .eq("store_admin_id", userId)
          .eq("role_name", "Employee");

        if (!empFetchError && employees) {
          for (const emp of employees) {
            await DBconnection
              .from("users")
              .update({
                account_status: emp.prev_account_status ?? "active",
                // is_active remains unchanged
              })
              .eq("id", emp.id);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Account ${account_status} successfully`,
    });

  } catch (error: any) {
    logger.error("Update account status error", { message: error.message, stack: error.stack });

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const sendOtpForForgotIdentifier = async (req: Request, res: Response) => {
  try {
    const { emailOrPhone, countryCode } = req.body;

    if (!emailOrPhone) {
      return res.status(400).json({
        success: false,
        message: "Email or Phone required",
      });
    }

    const login = emailOrPhone.trim();


    let isEmail = false;
    let formattedPhone: string | null = null;
    let user;

    // Detect email
    if (login.includes("@")) {
      if (!isValidEmail(login)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      isEmail = true;
    } else {
      // Use reusable phone utility
      try {
        formattedPhone = formatPhoneNumber(login, countryCode);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
    }

    // Find user
    if (isEmail) {
      const users = await uniqueService.getDataByField(TABLE, "email", login);
      user = users?.[0];

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.phone) {
        return res.status(400).json({
          success: false,
          message: "No phone registered",
        });
      }

      const { otp } = generateOTP(6);
      await createUserOtp(user.id, otp, 1);

      await sendForgotPasswordEmail(user.email, otp);

    } else {
      const users = await uniqueService.getDataByField(TABLE, "phone", formattedPhone);
      user = users?.[0];

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.email) {
        return res.status(400).json({
          success: false,
          message: "No email registered",
        });
      }

      const { otp } = generateOTP(6);
      await createUserOtp(user.id, otp, 1);

      await sendSMS(
        formattedPhone!,
        `Your OTP is ${otp}. It will expire in 1 minute.`
      );
    }

    return res.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (err: any) {
    logger.error("Forgot OTP error", { message: err.message, stack: err.stack });

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to send OTP",
    });
  }
};

export const validateOtpForForgotIdentifier = async (req: Request, res: Response) => {
  try {
    const { emailOrPhone, otp, countryCode } = req.body;

    if (!emailOrPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Identifier and OTP required",
      });
    }

    const login = emailOrPhone.trim();

    let isEmail = false;
    let formattedPhone: string | null = null;
    let user;

    // Detect email
    if (login.includes("@")) {
      if (!isValidEmail(login)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      isEmail = true;
    } else {
      // Use reusable phone utility
      try {
        formattedPhone = formatPhoneNumber(login, countryCode);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
    }

    // Find user
    if (isEmail) {
      const users = await uniqueService.getDataByField(TABLE, "email", login);
      user = users?.[0];

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.phone) {
        return res.status(400).json({
          success: false,
          message: "No phone registered",
        });
      }

    } else {
      const users = await uniqueService.getDataByField(TABLE, "phone", formattedPhone);
      user = users?.[0];

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.email) {
        return res.status(400).json({
          success: false,
          message: "No email registered",
        });
      }
    }

    // Verify OTP
    const otpRecord = await getUserOtp(user.id, otp);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    // Delete OTP after success
    await deleteUserOtp(otpRecord.id);

    // Mask response data
    const responseData = isEmail
      ? {
        phone: user.phone.replace(/(\d{3})\d{4}(\d{3})/, "$1******$2"),
      }
      : {
        email: user.email.replace(/(.{3}).+(@.+)/, "$1****$2"),
      };

    return res.json({
      success: true,
      message: "OTP verified successfully",
      ...responseData,
    });

  } catch (err: any) {
    logger.error("Validate OTP error", { message: err.message, stack: err.stack });

    return res.status(500).json({
      success: false,
      message: err.message || "OTP validation failed",
    });
  }
};


// ---------------- REFRESH TOKEN ----------------
export const refreshTokenController = async (req: Request, res: Response) => {
  try {
    // Accept token from body or cookie
    const token: string | undefined = req.body?.refreshToken ?? req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    // 1️⃣ Verify the refresh token signature & expiry
    const decoded = verifyRefreshToken(token);

    // 2️⃣ Fetch latest user data from DB
    const user = await uniqueService.getDataById<User>(decoded.id, TABLE);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 3️⃣ Guard: account must be active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    if (user.account_status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Account is suspended",
      });
    }

    // 4️⃣ Guard: token_version must match (detects revoked tokens)
    const decodedVersion = decoded.token_version ?? 1;
    const currentVersion = user.token_version ?? 1;
    if (decodedVersion !== currentVersion) {
      return res.status(403).json({
        success: false,
        message: "Refresh token has been revoked",
      });
    }

    // 5️⃣ Build payload with fresh DB values and issue new access token
    const accessToken = generateAccessToken(user as unknown as JwtPayload);

    return res.json({
      success: true,
      message: "Token refreshed successfully",
      data: { accessToken },
    });
  } catch {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
};




















export const getUserStats = async (req: Request, res: Response) => {
  try {
    const caller = req.user as { id?: string; role_name?: string } | undefined;
    if (!caller?.role_name) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (caller.role_name === 'Customer') return res.status(403).json({ success: false, message: 'Forbidden' });

    const storeId = getQueryString(req, 'store_id') || null;

    const ROLES = ['Admin', 'SuperAdmin', 'SubAdmin', 'StoreAdmin', 'Employee', 'Customer'] as const;

    const applyScope = (query: any) => {
      if (caller.role_name === 'SuperAdmin' && caller.id) return query.eq('superadmin_id', caller.id);
      if (caller.role_name === 'SubAdmin' && caller.id) return query.eq('sub_admin_id', caller.id);
      if (caller.role_name === 'StoreAdmin' && caller.id) return query.eq('store_admin_id', caller.id);
      return query;
    };

    const countQuery = (extra?: (q: any) => any) => {
      let q = DBconnection.from(TABLE).select('*', { count: 'exact', head: true }) as any;
      q = applyScope(q);
      if (storeId) q = q.eq('store_id', storeId);
      if (extra) q = extra(q);
      return q;
    };

    const [totalResult, activeResult, ...roleResults] = await Promise.all([
      countQuery(),
      countQuery((q) => q.eq('is_active', true).eq('account_status', 'active')),
      ...ROLES.map((role) => countQuery((q) => q.eq('role_name', role))),
    ]);

    if (totalResult.error) throw totalResult.error;
    if (activeResult.error) throw activeResult.error;
    for (const r of roleResults) {
      if (r.error) throw r.error;
    }

    const byRole: Record<string, number> = {};
    ROLES.forEach((role, i) => {
      const c = roleResults[i].count ?? 0;
      if (c > 0) byRole[role] = c;
    });

    return res.json({
      success: true,
      data: {
        total: totalResult.count ?? 0,
        active: activeResult.count ?? 0,
        byRole,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyMenu = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { data: userRow, error } = await DBconnection
      .from(TABLE)
      .select("permissions")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !userRow) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const menuList = buildNavigationMenu(userRow.permissions);

    return res.json({
      success: true,
      message: "Menu fetched successfully",
      data: menuList
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
