import { Request, Response } from "express";
import * as analyticsService from "../services/analytics.service";
import { parseFilterParams } from "../utils/filterParams";

function validateFilters(req: Request, res: Response) {
  const result = parseFilterParams(req.query as Record<string, unknown>);
  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return null;
  }
  return result.filters;
}

export const getSummary = async (req: Request, res: Response) => {
  const filters = validateFilters(req, res);
  if (filters === null) return;
  try {
    const data = await analyticsService.getSummaryService(filters);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching summary", error });
  }
};

export const getRevenueByRegion = async (req: Request, res: Response) => {
  const filters = validateFilters(req, res);
  if (filters === null) return;
  try {
    const data = await analyticsService.getRevenueByRegionService(filters);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching revenue by region", error });
  }
};

export const getMenuComplianceByStore = async (_req: Request, res: Response) => {
  try {
    const data = await analyticsService.getMenuComplianceByStoreService();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching menu compliance by store", error });
  }
};

export const getMenuComplianceByRegion = async (_req: Request, res: Response) => {
  try {
    const data = await analyticsService.getMenuComplianceByRegionService();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching menu compliance by region", error });
  }
};

export const getOrderTrends = async (req: Request, res: Response) => {
  const filters = validateFilters(req, res);
  if (filters === null) return;
  try {
    const data = await analyticsService.getOrderTrendsService(filters);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching order trends", error });
  }
};

export const getRevenueByCategory = async (req: Request, res: Response) => {
  const filters = validateFilters(req, res);
  if (filters === null) return;
  try {
    const data = await analyticsService.getRevenueByCategoryService(filters);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching revenue by category", error });
  }
};

export const getDeliveryDistribution = async (req: Request, res: Response) => {
  const filters = validateFilters(req, res);
  if (filters === null) return;
  try {
    const data = await analyticsService.getDeliveryDistributionService(filters);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching delivery distribution", error });
  }
};
