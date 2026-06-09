import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger";
import dotenv from "dotenv";

dotenv.config();

export async function initDB(): Promise<void> {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "ruchi_xpress",
    multipleStatements: true,
    connectionLimit: 1,
  });

  try {
    const sqlPath = path.join(process.cwd(), "migrations", "init.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    await pool.query(sql);
    logger.info("Database tables initialized successfully");

    const [rows]: any = await pool.query("SHOW TABLES");
    const dbName = process.env.MYSQL_DATABASE || "ruchi_xpress";
    const tables = rows.map((r: any) => Object.values(r)[0]);
    logger.info("Tables in database", {
      tables,
    });

  } catch (err: any) {
    if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
      logger.warn("initDB: MySQL connection unavailable from this host — skipping schema bootstrap", {
        host: err.hostname ?? process.env.MYSQL_HOST,
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
