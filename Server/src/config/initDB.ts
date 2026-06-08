import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger";

import dotenv from "dotenv";
dotenv.config();

export async function initDB(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    const sqlPath = path.join(process.cwd(), "migrations", "init.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    await pool.query(sql);
    logger.info("Database tables initialized successfully");

    const result = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    logger.info("Tables in database", {
      tables: result.rows.map((r: any) => r.tablename),
    });

  } catch (err: any) {
    if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
      logger.warn("initDB: Supabase direct connection unavailable from this host — skipping schema bootstrap (tables already exist in Supabase)", {
        host: err.hostname ?? process.env.DATABASE_URL,
      });
      return;
    }
    logger.error("Failed to initialize database tables", {
      message: err.message,
      stack: err.stack,
    });
    throw err;
  } finally {
    await pool.end().catch(() => {});
  }
}
