
import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { logger } from "../utils/logger";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UniqueController {
  private readonly service: UniqueService;
  private readonly table: string;

  constructor(table: string) {
    this.service = new UniqueService();
    this.table = table;
  }

  // GET ALL
  // public readonly getAll = async (_req: Request, res: Response) => {
  //   try {
  //     const data = await this.service.getData(this.table);
  //     return res.status(200).json({ success: true, data });
  //   } catch (err: any) {
  //     logger.error(`UniqueController.getAll error [${this.table}]:`, err);
  //     return res.status(500).json({
  //       success: false,
  //       message: "Failed to fetch records",
  //     });
  //   }
  // };


  public readonly getAll = async (_req: Request, res: Response) => {
    try {
      const data = await this.service.getData(this.table);
      return res.status(200).json({ success: true, message: "Records fetched successfully", data });
    } catch (err: any) {
      logger.error(`UniqueController.getAll error [${this.table}]:`, err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch records",
      });
    }
  };

  // GET BY ID
  public readonly getById = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ success: false, message: "id is required" });
    }
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid UUID format",
      });
    }
    try {
      const data = await this.service.getDataById(id as string, this.table);
      return res.status(200).json({ success: true, message: "Record fetched successfully", data });
    } catch (err: any) {
      logger.error(`UniqueController.getById error [${this.table}]:`, err);
      return res.status(404).json({
        success: false,
        message: err.message || `${this.table} not found`,
      });
    }
  };

  /**
   * DELETE BY ID 
   * @param req Express Request
   * @param res Express Response
   * @param references */
  public readonly deleteById = async (
    req: Request,
    res: Response,
    references?: Array<{ table: string; column: string; message?: string }>
  ) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ success: false, message: "id is required" });
    }
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid UUID format",
      });
    }
    try {
      // Referential integrity check
      if (Array.isArray(references) && references.length > 0) {
        for (const ref of references) {
          const related = await this.service.getDataByField(ref.table, ref.column, id as string);
          if (related && related.length > 0) {
            return res.status(409).json({
              success: false,
              message: ref.message || `Cannot delete: This record is referenced in table '${ref.table}'.`
            });
          }
        }
      }
      await this.service.deleteData(this.table, id as string);
      return res.status(200).json({
        success: true,
        message: `${this.table} deleted successfully`,
      });
    } catch (err: any) {
      logger.error(`UniqueController.deleteById error [${this.table}]:`, err);
      return res.status(404).json({
        success: false,
        message: err.message || `${this.table} not found`,
      });
    }
  };
}






