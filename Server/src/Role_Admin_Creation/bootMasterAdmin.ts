import dotenv from "dotenv";
import { DBconnection } from "../config/DBConnect";
import argon2 from "argon2";
import { logger } from "../utils/logger";

dotenv.config();

/**
 * Ensures the master Admin user exists in public.users.
 * Returns the Admin user's ID (useful for subsequent backfills that need a valid FK target).
 * Returns null if the Admin could not be found or created.
 */
interface AdminIdRow { id: string }

export async function bootMasterAdmin(): Promise<string | null> {
  try {
    logger.info("Checking Admin user...");
    const email = process.env.ADMIN_EMAIL;

    const { data: existingUser, error: userCheckError } = await DBconnection
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle<AdminIdRow>();

    if (userCheckError) throw userCheckError;

    if (existingUser) {
      logger.info("Admin user already exists — skipping seed");
      return existingUser.id;
    }

    logger.info("Admin not found — creating Admin user...");
    const phone = process.env.ADMIN_PHONE;
    const passwordPlain = process.env.ADMIN_PASSWORD;
    const permissionsRaw = process.env.ADMIN_PERMISSIONS;

    if (!passwordPlain) {
      throw new Error("ADMIN_PASSWORD env var is not set");
    }

    if (!permissionsRaw) throw new Error("ADMIN_PERMISSIONS is not set");

    const hashedPassword = await argon2.hash(passwordPlain);

    let permissions;
    try {
      permissions = JSON.parse(permissionsRaw);
    } catch (err) {
      throw new Error("Invalid ADMIN_PERMISSIONS JSON format");
    }

    const { data, error } = await DBconnection.from("users")
      .insert({
        role_name: "Admin",
        account_status: "active",
        admin_id: null,
        superadmin_id: null,
        sub_admin_id: null,
        store_admin_id: null,
        email,
        phone,
        password: hashedPassword,
        full_name: "Admin",
        is_active: true,
        permissions,
      })
      .select("id");

    if (error) throw error;
    const adminId = data[0].id;
    logger.info("Admin user created successfully");
    return adminId;


  } catch (err: any) {
  console.error("bootMasterAdmin ERROR:", err);

  logger.error("Error in bootMasterAdmin", {
    message: err?.message,
    details: err?.details,
    hint: err?.hint,
    code: err?.code,
  });

  return null;
}
}
