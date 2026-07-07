import { DBconnection } from "../config/DBConnect";
import { logger } from "../utils/logger";
import dotenv from "dotenv";

dotenv.config();

interface CountryIdRow { id: string }

export async function bootCountry(): Promise<string | null> {
  try {
    logger.info("Checking Country ...");
    const countryName = process.env.COUNTRY_NAME!;

    const { data: existingCountry, error: countryCheckError } = await DBconnection
      .from("country")
      .select("id")
      .ilike("name", countryName)
      .maybeSingle<CountryIdRow>();

    if (countryCheckError) throw countryCheckError;

    if (existingCountry) {
      logger.info("Country already exists — skipping seed");
      return existingCountry.id;
    }

    logger.info("Country not found — creating country...");

    const { data, error } = await DBconnection.from("country")
      .insert({
        name: countryName
      }) as any;

    if (error) throw error;
    const countryId = data.id;
    logger.info("Country created successfully");
    return countryId;

  } catch (err: any) {
    console.error("bootCountry ERROR:", err);

    logger.error("Error in bootCountry", {
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
      code: err?.code,
    });

    return null;
  }
}
