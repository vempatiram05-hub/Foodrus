import { z } from "zod";
import dotenv from "dotenv";

// WHY override: true?
//
// Replit manages DATABASE_URL as a runtime-controlled variable for its built-in
// Helium/Neon database ("Don't modify runtime-managed variables — DATABASE_URL
// for Helium DBs" — Replit environment-secrets documentation).  This means the
// container process already has DATABASE_URL=postgresql://postgres:...@helium/...
// set in its environment BEFORE any application code runs.
//
// Standard dotenv.config() does not overwrite variables that are already set,
// so without `override: true` the Helium URL always wins and we can never use
// the Supabase DATABASE_URL from .env.
//
// Setting DATABASE_URL as a Replit Secret is explicitly prohibited for
// runtime-managed variables; the only supported method to point pg connections
// at Supabase is to override the runtime value at application boot with dotenv.
dotenv.config({ override: true });

/**
 * Validates all required environment variables at startup using Zod.
 * The process exits immediately if any required variable is missing or malformed,
 * preventing a partially-configured server from serving traffic.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().min(1).max(65535).default(5000),

  // Database — DATABASE_URL must point at Supabase (see override comment above)
  SUPABASE_URL: z.url({ message: "SUPABASE_URL must be a valid URL" }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(10, "SUPABASE_SERVICE_ROLE_KEY is too short"),
  DATABASE_URL: z
    .string()
    .min(10, "DATABASE_URL is required for migrations"),

  // JWT
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters for security"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters for security"),
  ACCESS_TOKEN_EXPIRY: z.string().default("24h"),
  REFRESH_TOKEN_EXPIRY: z.string().default("7d"),

  // App
  APP_VERSION: z.string().default("1.0.0"),
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "debug"])
    .default("info"),

  // Admin bootstrap
  ADMIN_EMAIL: z.email({ message: "ADMIN_EMAIL must be a valid email" }),
  ADMIN_PHONE: z.string().min(5, "ADMIN_PHONE is required"),
  ADMIN_PASSWORD: z
    .string()
    .min(6, "ADMIN_PASSWORD must be at least 6 characters"),

  // Email (at least one provider required — validated at runtime in mailer)
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILGUN_FROM_EMAIL: z.string().optional(),

  // SMS
  CLICKSEND_USERNAME: z.string().optional(),
  CLICKSEND_API_KEY: z.string().optional(),

  // Payments
  HELCIM_API_TOKEN: z.string().optional(),
  HELCIM_API_URL: z.string().optional(),

  // Security
  ALLOWED_ORIGINS: z.string().optional(),
  LOCAL_URL_SECRET: z.string().optional(),
  BCRYPT_SALT_ROUNDS: z.coerce.number().min(10).max(20).default(12),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX_GENERAL: z.coerce.number().default(500),
  RATE_LIMIT_MAX_AUTH: z.coerce.number().default(10),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(
      `\n❌ Environment validation failed — fix these variables before starting:\n${issues}\n`
    );
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
