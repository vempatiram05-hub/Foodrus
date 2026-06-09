export function getSessionConnectionString(databaseUrl: string): {
  url: string;
  isPooler: boolean;
} | null {
  return null;
}

export async function notifyPostgrestReload(
  log: (msg: string, meta?: object) => void,
  warn: (msg: string, meta?: object) => void
): Promise<"session" | "pooler" | "failed"> {
  log("notifyPostgrestReload: No-op for MySQL migration");
  return "session";
}
