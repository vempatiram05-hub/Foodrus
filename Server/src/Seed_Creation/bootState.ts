import { DBconnection } from "../config/DBConnect";
import { logger } from "../utils/logger";
import dotenv from "dotenv";

dotenv.config();

interface StateIdRow { id: string }
export async function bootState(countryId: string): Promise<string | null> {
  try {
    logger.info("Checking State ...");
    const stateName = process.env.STATE_NAME!;

    const { data: existingState, error: stateCheckError } = await DBconnection
      .from("state")
      .select("id")
      .ilike("name", stateName)
      .maybeSingle<StateIdRow>();

    if (stateCheckError) throw stateCheckError;

    if (existingState) {
      logger.info("State already exists — skipping seed");
      return existingState.id;
    }

    logger.info("State not found — creating state...");

    const { data, error } = await DBconnection.from("state")
      .insert({
        name: stateName,
        country_id: countryId
      }) as any;

    if (error) throw error;
    const newStateId = data.id;
    logger.info("State created successfully");
    return newStateId;

  } catch (err: any) {
    console.error("bootState ERROR:", err);

    logger.error("Error in bootState", {
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
      code: err?.code,
    });

    return null;
  }
}
