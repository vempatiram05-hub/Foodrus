import { PhoneNumberUtil, PhoneNumberFormat } from "google-libphonenumber";

const phoneUtil = PhoneNumberUtil.getInstance();

/**
 * Format and validate phone number to E164 format
 * Example output: +919876543210
 */
export const formatPhoneNumber = (
  phone: string,
  countryCode?: string
): string => {
  let formattedPhone = phone.trim();

  // Add country code if missing
  if (!formattedPhone.startsWith("+")) {
    const dialCode = countryCode?.startsWith("+") ? countryCode : "+91";
    formattedPhone = `${dialCode}${formattedPhone}`;
  }

  let parsed;

  try {
    parsed = phoneUtil.parse(formattedPhone);
  } catch {
    throw new Error("Invalid phone number");
  }

  if (!phoneUtil.isValidNumber(parsed) && !phoneUtil.isPossibleNumber(parsed)) {
    throw new Error("Invalid phone number");
  }

  // Convert to E164 format
  return phoneUtil.format(parsed, PhoneNumberFormat.E164);
};

/**
 * Validate phone digit count.
 * Strips non-digits and checks the total digit count against the valid range
 * for a number that includes a country code (1–5 digits) + 10 local digits.
 *
 * @throws Error with a user-facing message if the count is out of range.
 */
export const validatePhoneDigitCount = (phone: string): void => {
  const digits = (String(phone).match(/\d/g) || []).length;
  if (digits < 11) {
    throw new Error(
      "Phone number must include a country code and a 10-digit local number (e.g. +14163571234)"
    );
  }
  if (digits > 15) {
    throw new Error("Phone number is too long");
  }
};
