import { Request, Response } from "express";
import * as reportsService from "../services/reports.service";
import { parseFilterParams } from "../utils/filterParams";

export const getStoreReport = async (req: Request, res: Response) => {
  const result = parseFilterParams(req.query as Record<string, unknown>);

  if (!result.ok) {
    return res.status(result.status).json({ message: result.message });
  }

  const { from, to, region } = result.filters;

  try {
    const data = await reportsService.getStoreReportService({ region, from, to });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching reports", error });
  }
};
