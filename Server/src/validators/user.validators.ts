import { z } from "zod";

const ROLES = ["Admin", "SuperAdmin", "SubAdmin", "StoreAdmin", "Employee", "Customer"] as const;

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
const passwordMessage = "Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a special character";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
const emailSchema = z.string().trim().email("Invalid email format").regex(emailRegex, "Invalid email domain extension").max(254);

const phoneRegex = /^\+[1-9]\d{0,2}\d{10}$/;
const phoneMessage = "Phone number must include a country code (e.g., +91) followed by exactly 10 digits";
const phoneSchema = z.string().trim().regex(phoneRegex, phoneMessage);

const emailOrPhoneSchema = z.string().trim().min(1, "Email or phone is required").max(254).superRefine((val, ctx) => {
  if (val.includes("@")) {
    if (!emailRegex.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid email domain extension",
      });
    }
  } else {
    if (!phoneRegex.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: phoneMessage,
      });
    }
  }
});

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(128).regex(passwordRegex, passwordMessage),
  full_name: z.string().trim().min(1, "full_name is required").max(100),
  phone: phoneSchema.optional(),
  role_name: z.enum(ROLES),
  permissions: z.any().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  store_admin_id: z.uuid("store_admin_id must be a valid UUID").optional(),
  store_id: z.string().uuid("Invalid store_id").optional(),
});

export const loginSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
  password: z.string().min(1, "password is required").max(128),
});

export const sendLoginOtpSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
  countryCode: z.string().trim().max(10).optional(),
});

export const validateOTPSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
  otp: z.string().trim().min(4).max(8),
});

export const forgotPasswordSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
});

export const verifyForgotPasswordOtpSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
  otp: z.string().trim().min(4, "OTP is required").max(10),
});

export const updatePasswordSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
  otp: z.string().trim().min(1, "otp is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128).regex(passwordRegex, passwordMessage),
});

export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  full_name: z.string().trim().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  role_name: z.enum(ROLES).optional(),
  permissions: z.any().optional(),
  store_id: z.string().uuid("Invalid store_id").optional(),
}).strict();

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "current_password is required").max(128),
  new_password: z.string().min(8, "new_password must be at least 8 characters").max(128).regex(passwordRegex, passwordMessage),
});

export const sendForgotIdentifierOtpSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
  countryCode: z.string().trim().max(10).optional(),
});

export const validateForgotIdentifierOtpSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
  otp: z.string().trim().min(4).max(8),
  countryCode: z.string().trim().max(10).optional(),
});

export const verifyLoginOtpSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
  otp: z.string().trim().min(4).max(8),
});

export const resendOtpSchema = z.object({
  emailOrPhone: emailOrPhoneSchema,
});
