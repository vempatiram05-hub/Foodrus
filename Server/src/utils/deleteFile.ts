import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger";

export const deleteFile = (filePath: string | undefined | null) => {
  try {
    if (!filePath) return;

    const cleaned = filePath.replace(/^\//, "");

    const candidates = [
      path.join(process.cwd(), "src", cleaned),   // dev mode
      path.join(process.cwd(), "dist", cleaned),  // production build
      path.join(process.cwd(), cleaned),          // direct root upload
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        return;
      }
    }

    logger.warn("deleteFile: file not found in any location", { filePath });

  } catch (err) {
    logger.error("deleteFile: failed to delete file", { filePath, error: (err as Error).message });
  }
};


