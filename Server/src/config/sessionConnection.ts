import { Pool } from "pg";

const POOLER_PORT = "6543";
const SESSION_PORT = "5432";

/**
 * Given a DATABASE_URL, returns a session-mode connection string (port 5432).
 * If the URL is already on port 5432, returns it unchanged.
 * If the URL is on port 6543 (PgBouncer transaction mode), replaces the port
 * with 5432 so NOTIFY can reach PostgREST through a persistent session.
 * Returns null if the URL cannot be parsed.
 */
export function getSessionConnectionString(databaseUrl: string): {
  url: string;
  isPooler: boolean;
} | null {
  try {
    const parsed = new URL(databaseUrl);
    const isPooler = parsed.port === POOLER_PORT;
    if (isPooler) {
      parsed.port = SESSION_PORT;
    }
    return { url: parsed.toString(), isPooler };
  } catch {
    return null;
  }
}

async function notifyViaPool(connectionString: string): Promise<void> {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  try {
    await pool.query(`NOTIFY pgrst, 'reload schema'`);
  } finally {
    await pool.end();
  }
}

/**
 * Sends `NOTIFY pgrst, 'reload schema'` over a session-mode Postgres connection
 * so PostgREST receives the signal reliably (bypassing PgBouncer transaction mode).
 *
 * Logs whether the connection used is a session-mode URL derived from a pooler URL,
 * or already a direct connection string.
 *
 * @returns "session" if NOTIFY was sent over port 5432, "pooler" if it fell back to
 *          the original pooler URL, or "failed" if the NOTIFY could not be sent.
 */
export async function notifyPostgrestReload(
  log: (msg: string, meta?: object) => void,
  warn: (msg: string, meta?: object) => void
): Promise<"session" | "pooler" | "failed"> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    warn("DATABASE_URL is not set — cannot send NOTIFY to PostgREST");
    return "failed";
  }

  const resolved = getSessionConnectionString(rawUrl);

  if (!resolved) {
    warn(
      "DATABASE_URL could not be parsed as a URL — attempting NOTIFY over raw connection string"
    );
    try {
      await notifyViaPool(rawUrl);
      warn(
        "NOTIFY pgrst sent over raw connection string (port unknown). " +
        "If this is a PgBouncer transaction-mode URL, the signal may not reach PostgREST."
      );
      return "pooler";
    } catch (err: unknown) {
      warn("NOTIFY pgrst failed on raw connection string", {
        message: err instanceof Error ? err.message : String(err),
      });
      return "failed";
    }
  }

  const { url, isPooler } = resolved;

  try {
    await notifyViaPool(url);

    if (isPooler) {
      log(
        "NOTIFY pgrst sent over session-mode connection (port 5432 derived from pooler URL). " +
        "PostgREST should reload schema promptly."
      );
    } else {
      log(
        "NOTIFY pgrst sent over direct session connection (port 5432). " +
        "PostgREST should reload schema promptly."
      );
    }
    return "session";
  } catch (err: unknown) {
    if (!isPooler) {
      warn("NOTIFY pgrst failed on direct session connection", {
        message: err instanceof Error ? err.message : String(err),
      });
      return "failed";
    }

    warn(
      "Failed to send NOTIFY pgrst over session-mode connection — falling back to original pooler URL",
      { message: err instanceof Error ? err.message : String(err) }
    );

    try {
      await notifyViaPool(rawUrl);
      warn(
        "NOTIFY pgrst sent over original pooler URL (port 6543). " +
        "This may not reach PostgREST if PgBouncer is in transaction mode. " +
        "PostgREST will auto-reload within ~10 minutes."
      );
      return "pooler";
    } catch (fallbackErr: unknown) {
      warn("NOTIFY pgrst failed on both session and pooler connections", {
        message: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
      });
      return "failed";
    }
  }
}
