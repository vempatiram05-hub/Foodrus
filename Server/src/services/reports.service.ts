import { DBconnection } from "../config/DBConnect";
import { logger } from "../utils/logger";

export const getStoreReportService = async (filters: any) => {
  const { region, from, to } = filters;

  const { data: regions } = await DBconnection.from("regions").select("id, name");
  const { data: stores } = await DBconnection.from("stores").select("id, name, region_id");

  let orderQ = DBconnection.from("orders").select("store_id, total_amount, created_at");
  if (from && to) {
    orderQ = orderQ.gte("created_at", from).lte("created_at", to);
  }
  const { data: orders } = await orderQ;

  logger.debug("getStoreReport filters", { region, from, to });

  const regionMap = new Map<string, string>();
  for (const r of regions ?? []) regionMap.set(r.id, r.name);

  return (stores ?? [])
    .filter((s: any) => {
      if (!region) return true;
      return regionMap.get(s.region_id) === region;
    })
    .map((s: any) => {
      const storeOrders = (orders ?? []).filter((o: any) => o.store_id === s.id);
      const revenue = storeOrders.reduce((sum: number, o: any) => sum + (parseFloat(o.total_amount) || 0), 0);
      return {
        storeId: s.id,
        storeName: s.name,
        region: regionMap.get(s.region_id) ?? null,
        orders: storeOrders.length,
        revenue,
      };
    })
    .sort((a: any, b: any) => b.revenue - a.revenue);
};
