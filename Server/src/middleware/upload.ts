import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

/* ---------------- IMAGE FILTER ---------------- */

const imageFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

/* ---------------- DISK UPLOADER ---------------- */

export const createUploader = (folderName: string) => {
  const uploadPath = path.join(process.cwd(), "src", "uploads", folderName);

  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  let lastTimestamp = 0;

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadPath);
    },

    filename: (req: any, file, cb) => {
      const ext = path.extname(file.originalname);

      const rawName = req.body.name || req.body.full_name || "file";
      const cleanEntity = rawName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const cleanOriginal = path
        .basename(file.originalname, ext)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      let now = Date.now();
      if (now <= lastTimestamp) now = lastTimestamp + 1;
      lastTimestamp = now;

      cb(null, `${now}-${cleanEntity}-${cleanOriginal}${ext}`);
    },
  });

  return multer({
    storage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });
};

/* ---------------- MEMORY UPLOADER ---------------- */

export const memoryUploader = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
