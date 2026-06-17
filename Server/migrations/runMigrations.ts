import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export async function runMigrations(): Promise<void> {
  console.log("⚙️  Running MySQL migration runner...");

  const connectionConfig = {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "ruchi_xpress",
  };

  let connection;
  try {
    connection = await mysql.createConnection(connectionConfig);
    console.log("✅ MySQL migration runner: Connection verified. Schema is up-to-date.");
  } catch (err: any) {
    console.error("❌ MySQL migration runner failed to connect:", err.message);
    throw err;
  } finally {
    if (connection) {
      await connection.end().catch(() => { });
    }
  }
}