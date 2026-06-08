import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const fileTransports = [
  new DailyRotateFile({
    filename: path.join(LOG_DIR, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    level: "error",
    maxFiles: "14d",
    zippedArchive: true,
  }),
  new DailyRotateFile({
    filename: path.join(LOG_DIR, "combined-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    zippedArchive: true,
  }),
];

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), simple()),
      silent: process.env.NODE_ENV === "test",
    }),
    ...fileTransports,
  ],
});
