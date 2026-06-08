import { DBconnection } from "../config/DBConnect";
import { FilterParams } from "../utils/filterParams";

function addDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function applyDateFilter(query: any, from?: string, to?: string) {
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", addDay(to));
  return query;
}

export const getSummaryService = async (filters: FilterParams = {}) => {
  const { from, to } = filters;
  let q = DBconnection.from("orders").select("total_amount, eta_minutes, order_status");
  q = applyDateFilter(q, from as string | undefined, to as string | undefined);
  const { data: rows } = await q;
  const orders = rows ?? [];

  const totalRevenue = orders.reduce((s: number, o: any) => s + (parseFloat(o.total_amount) || 0), 0);
  const totalOrders = orders.length;
  const withEta = orders.filter((o: any) => o.eta_minutes != null);
  const avgDeliveryTime = withEta.length
    ? withEta.reduce((s: number, o: any) => s + (o.eta_minutes || 0), 0) / withEta.length
    : 0;
  const delivered = orders.filter((o: any) => (o.order_status || "").toLowerCase() === "delivered").length;
  const pending = orders.filter((o: any) =>
    ["confirmed", "out_for_delivery", "pending"].includes((o.order_status || "").toLowerCase())
  ).length;
  const deliveryRate = totalOrders > 0 ? (delivered * 100.0) / totalOrders : 0;
  const pendingRate = totalOrders > 0 ? (pending * 100.0) / totalOrders : 0;

  return { totalRevenue, totalOrders, avgDeliveryTime, deliveryRate, pendingRate };
};

export const getRevenueByRegionService = async (filters: FilterParams = {}) => {
  const { from, to, region } = filters;

  const { data: regions } = await DBconnection.from("regions").select("id, name");
  const { data: stores } = await DBconnection.from("stores").select("id, region_id");

  let orderQ = DBconnection.from("orders").select("store_id, total_amount");
  orderQ = applyDateFilter(orderQ, from as string | undefined, to as string | undefined);
  const { data: orders } = await orderQ;

  const storesByRegion = new Map<string, string[]>();
  for (const s of stores ?? []) {
    if (!storesByRegion.has(s.region_id)) storesByRegion.set(s.region_id, []);
    storesByRegion.get(s.region_id)!.push(s.id);
  }

  return (regions ?? [])
    .filter((r: any) => !region || r.name === region)
    .map((r: any) => {
      const regionStoreIds = storesByRegion.get(r.id) ?? [];
      const regionOrders = (orders ?? []).filter((o: any) => regionStoreIds.includes(o.store_id));
      const revenue = regionOrders.reduce((s: number, o: any) => s + (parseFloat(o.total_amount) || 0), 0);
      return {
        region: r.name as string,
        revenue,
        orders: regionOrders.length,
        stores: regionStoreIds.length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
};

export const getMenuComplianceByStoreService = async () => {
  const { data: stores } = await DBconnection.from("stores").select("id, name");
  const { data: menus } = await DBconnection.from("menus").select("id, store_id, status");

  return (stores ?? [])
    .map((s: any) => {
      const storeMenus = (menus ?? []).filter((m: any) => m.store_id === s.id);
      if (storeMenus.length === 0) return null;
      const submitted = storeMenus.length;
      const approved = storeMenus.filter((m: any) => (m.status || "").toUpperCase() === "APPROVED").length;
      const rejected = storeMenus.filter((m: any) => (m.status || "").toUpperCase() === "REJECTED").length;
      const pending = storeMenus.filter((m: any) => (m.status || "").toUpperCase() === "PENDING").length;
      const successRate = submitted > 0 ? Math.round((approved * 100.0) / submitted * 10) / 10 : 0;
      return { storeId: s.id as string, storeName: s.name as string, submitted, approved, rejected, pending, successRate };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.successRate - a.successRate);
};

export const getMenuComplianceByRegionService = async () => {
  const { data: regions } = await DBconnection.from("regions").select("id, name");
  const { data: stores } = await DBconnection.from("stores").select("id, region_id");
  const { data: menus } = await DBconnection.from("menus").select("id, store_id, status");

  const storesByRegion = new Map<string, string[]>();
  for (const s of stores ?? []) {
    if (!storesByRegion.has(s.region_id)) storesByRegion.set(s.region_id, []);
    storesByRegion.get(s.region_id)!.push(s.id);
  }

  return (regions ?? [])
    .map((r: any) => {
      const regionStoreIds = storesByRegion.get(r.id) ?? [];
      const regionMenus = (menus ?? []).filter((m: any) => regionStoreIds.includes(m.store_id));
      if (regionMenus.length === 0) return null;
      const submitted = regionMenus.length;
      const approved = regionMenus.filter((m: any) => (m.status || "").toUpperCase() === "APPROVED").length;
      const rejected = regionMenus.filter((m: any) => (m.status || "").toUpperCase() === "REJECTED").length;
      const pending = regionMenus.filter((m: any) => (m.status || "").toUpperCase() === "PENDING").length;
      const successRate = submitted > 0 ? Math.round((approved * 100.0) / submitted * 10) / 10 : 0;
      return { region: r.name as string, submitted, approved, rejected, pending, successRate };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.successRate - a.successRate);
};

export const getOrderTrendsService = async (filters: FilterParams = {}) => {
  const { from, to } = filters;

  if (from !== undefined || to !== undefined) {
    let q = DBconnection.from("orders").select("order_status, total_amount");
    q = applyDateFilter(q, from as string | undefined, to as string | undefined);
    const { data: rows } = await q;
    const orders = rows ?? [];
    const periodSummary = {
      total: orders.length,
      completed: orders.filter((o: any) => (o.order_status || "").toLowerCase() === "delivered").length,
      cancelled: orders.filter((o: any) => (o.order_status || "").toLowerCase() === "cancelled").length,
      revenue: orders.reduce((s: number, o: any) => s + (parseFloat(o.total_amount) || 0), 0),
    };
    return { thisWeek: periodSummary, lastWeek: { total: 0, completed: 0, cancelled: 0, revenue: 0 } };
  }

  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const [thisWeekRes, lastWeekRes] = await Promise.all([
    DBconnection.from("orders").select("order_status, total_amount")
      .gte("created_at", thisWeekStart.toISOString())
      .lt("created_at", new Date(thisWeekStart.getTime() + 7 * 86400000).toISOString()),
    DBconnection.from("orders").select("order_status, total_amount")
      .gte("created_at", lastWeekStart.toISOString())
      .lt("created_at", thisWeekStart.toISOString()),
  ]);

  const agg = (rows: any[]) => ({
    total: rows.length,
    completed: rows.filter((o: any) => (o.order_status || "").toLowerCase() === "delivered").length,
    cancelled: rows.filter((o: any) => (o.order_status || "").toLowerCase() === "cancelled").length,
    revenue: rows.reduce((s: number, o: any) => s + (parseFloat(o.total_amount) || 0), 0),
  });

  return {
    thisWeek: agg(thisWeekRes.data ?? []),
    lastWeek: agg(lastWeekRes.data ?? []),
  };
};

export const getRevenueByCategoryService = async (filters: FilterParams = {}) => {
  const { from, to } = filters;

  const { data: categories } = await DBconnection.from("categories").select("id, name");
  const { data: products } = await DBconnection.from("products").select("id, category_id");

  let orderQ = DBconnection.from("orders").select("id");
  orderQ = applyDateFilter(orderQ, from as string | undefined, to as string | undefined);
  const { data: filteredOrders } = await orderQ;
  const orderIds = (filteredOrders ?? []).map((o: any) => o.id);

  let orderItems: any[] = [];
  if (orderIds.length > 0) {
    const { data: items } = await DBconnection
      .from("order_items").select("product_id, order_id, unit_price, quantity").in("order_id", orderIds);
    orderItems = items ?? [];
  }

  const productCategoryMap = new Map<string, string>();
  for (const p of products ?? []) productCategoryMap.set(p.id, p.category_id);

  const categoryRevenue = new Map<string, { revenue: number; orderIds: Set<string> }>();
  for (const item of orderItems) {
    const catId = productCategoryMap.get(item.product_id);
    if (!catId) continue;
    if (!categoryRevenue.has(catId)) categoryRevenue.set(catId, { revenue: 0, orderIds: new Set() });
    const entry = categoryRevenue.get(catId)!;
    entry.revenue += (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity, 10) || 0);
    entry.orderIds.add(item.order_id);
  }

  const totalRevenue = Array.from(categoryRevenue.values()).reduce((s, e) => s + e.revenue, 0);

  return (categories ?? [])
    .map((c: any) => {
      const entry = categoryRevenue.get(c.id);
      if (!entry || entry.revenue === 0) return null;
      return {
        categoryId: c.id as string,
        categoryName: c.name as string,
        revenue: entry.revenue,
        orderCount: entry.orderIds.size,
        percentage: totalRevenue > 0 ? Math.round((entry.revenue * 100.0) / totalRevenue * 10) / 10 : 0,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.revenue - a.revenue);
};

export const getDeliveryDistributionService = async (filters: FilterParams = {}) => {
  const { from, to } = filters;

  let q = DBconnection.from("orders").select("eta_minutes").not("eta_minutes", "is", null);
  q = applyDateFilter(q, from as string | undefined, to as string | undefined);
  const { data: rows } = await q;
  const orders = rows ?? [];

  const bucketLabel = (eta: number) => {
    if (eta <= 15) return { label: "0-15 min", order: 1 };
    if (eta <= 30) return { label: "16-30 min", order: 2 };
    if (eta <= 45) return { label: "31-45 min", order: 3 };
    if (eta <= 60) return { label: "46-60 min", order: 4 };
    return { label: "60+ min", order: 5 };
  };

  const buckets = new Map<string, { count: number; order: number }>();
  for (const o of orders) {
    const { label, order } = bucketLabel(o.eta_minutes || 0);
    if (!buckets.has(label)) buckets.set(label, { count: 0, order });
    buckets.get(label)!.count++;
  }

  const total = orders.length;
  return Array.from(buckets.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([label, { count }]) => ({
      label,
      count,
      percentage: total > 0 ? Math.round((count * 100.0) / total * 10) / 10 : 0,
    }));
};
