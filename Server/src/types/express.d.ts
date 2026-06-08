import { Request } from "express";
 export interface Multer {
    File: any;
  };

declare module "express-serve-static-core" {
  interface Request {
    file?: Express.Multer.File;
    files?: Express.Multer.File[];
  }
}
