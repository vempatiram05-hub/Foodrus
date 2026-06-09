import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { JwtPayload } from "../utils/token";

const service = new UniqueService();

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Order {
  id: string;
  order_number: string;
  user_id: string;
  store_id: string;
  order_status: string;
  approval_status: string;
  total_amount: number;
  created_at: string;
}

interface User {
  id: string;
  role_name: string;
  is_active: boolean;
  admin_id: string | null;
  sub_admin_id: string | null;
  superadmin_id: string | null;
  store_admin_id: string | null;
}

interface Store {
  id: string;
  store_admin_id: string;
}

interface Product {
  id: string;
  change_type: string;
  approval_status: string;
}

interface Menu {
  id: string;
  store_id: string;
  status: string;
}

interface AuditLog {
  id: string;
  created_at: string;
  action?: string;
  entity_type?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

function sumRevenue(orders: Order[]): number {
  return orders.reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);
}

function buildOrderStats(orders: Order[]) {
  const prefix = todayPrefix();
  const byStatus: Record<string, number> = {};
  for (const o of orders) {
    byStatus[o.order_status] = (byStatus[o.order_status] || 0) + 1;
  }
  const todayOrders = orders.filter((o) => o.created_at?.startsWith(prefix));
  return {
    total: orders.length,
    pending_approval: orders.filter((o) => o.approval_status === "PENDING").length,
    revenue_total: sumRevenue(orders),
    today_count: todayOrders.length,
    today_revenue: sumRevenue(todayOrders),
    by_status: byStatus,
  };
}

/**
 * Returns the last 10 audit log entries only when the fetched rows contain
 * both `action` and `entity_type` columns (runtime column-presence guard).
 * Returns undefined when those columns are absent OR the table is empty
 * (column presence cannot be confirmed from zero rows).
 */
function buildRecentAuditLogs(
  auditLogs: AuditLog[]
): { id: string; action: string; entity_type: string; created_at: string }[] | undefined {
  if (auditLogs.length === 0) return undefined;

  const firstRow = auditLogs[0];
  if (
    typeof firstRow.action === "undefined" ||
    typeof firstRow.entity_type === "undefined"
  ) {
    return undefined;
  }

  return auditLogs
    .slice()
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 10)
    .map((l) => ({
      id: l.id,
      action: l.action as string,
      entity_type: l.entity_type as string,
      created_at: l.created_at,
    }));
}

// ─── SuperAdmin: global view ──────────────────────────────────────────────────

async function getSuperAdminStats() {
  const [users, orders, stores, products, menus, auditLogs] = await Promise.all([
    service.getData<User>("users"),
    service.getData<Order>("orders"),
    service.getData<Store>("stores"),
    service.getData<Product>("products"),
    service.getData<Menu>("menus"),
    service.getData<AuditLog>("audit_logs"),
  ]);

  const byRole: Record<string, number> = {};
  for (const u of users) {
    byRole[u.role_name] = (byRole[u.role_name] || 0) + 1;
  }

  const prefix = todayPrefix();
  const recentAuditLogs = buildRecentAuditLogs(auditLogs);

  const result: Record<string, any> = {
    users: {
      total: users.length,
      active: users.filter((u) => u.is_active === true).length,
      by_role: byRole,
    },
    orders: buildOrderStats(orders),
    stores: { total: stores.length },
    products: {
      total: products.length,
      pending_approval: products.filter(
        (p) => (p.approval_status ?? "").toUpperCase() === "PENDING"
      ).length,
    },
    menus: {
      total: menus.length,
      pending_approval: menus.filter((m) => m.status === "PENDING").length,
    },
    audit_logs: {
      total_today: auditLogs.filter((l) => l.created_at?.startsWith(prefix)).length,
    },
  };

  if (recentAuditLogs !== undefined) {
    result.recent_audit_logs = recentAuditLogs;
  }

  return result;
}

// ─── SuperAdmin / SubAdmin: hierarchy-scoped view ─────────────────────────────
// SuperAdmin → filter by superadmin_id = userId
// SubAdmin   → filter by sub_admin_id = userId

async function getScopedAdminStats(
  userId: string,
  hierarchyField: "superadmin_id" | "admin_id" | "sub_admin_id"
) {
  // 1. Managed users under this admin
  const managedUsers = await service.getDataByField<User>(
    "users",
    hierarchyField,
    userId
  );

  // 2. Store admins among managed users → their stores
  const storeAdminIds = managedUsers
    .filter((u) => u.role_name === "StoreAdmin")
    .map((u) => u.id);

  const storeArrays = await Promise.all(
    storeAdminIds.map((id) =>
      service.getDataByField<Store>("stores", "store_admin_id", id)
    )
  );
  const stores = storeArrays.flat();
  const storeIds = stores.map((s) => s.id);

  // 3. Orders, menus, and products for those stores (all scoped to managed store IDs)
  const [orderArrays, menuArrays, productArrays, auditLogs] = await Promise.all([
    Promise.all(
      storeIds.map((id) => service.getDataByField<Order>("orders", "store_id", id))
    ),
    Promise.all(
      storeIds.map((id) => service.getDataByField<Menu>("menus", "store_id", id))
    ),
    storeIds.length > 0
      ? Promise.all(
          storeIds.map((id) => service.getDataByField<Product>("products", "store_id", id))
        )
      : Promise.resolve([[]]),
    service.getData<AuditLog>("audit_logs"),
  ]);

  const orders = orderArrays.flat();
  const menus = menuArrays.flat();
  const products = productArrays.flat();

  const byRole: Record<string, number> = {};
  for (const u of managedUsers) {
    byRole[u.role_name] = (byRole[u.role_name] || 0) + 1;
  }

  const prefix = todayPrefix();
  const recentAuditLogs = buildRecentAuditLogs(auditLogs);

  const result: Record<string, any> = {
    users: {
      total: managedUsers.length,
      active: managedUsers.filter((u) => u.is_active === true).length,
      by_role: byRole,
    },
    orders: buildOrderStats(orders),
    stores: { total: stores.length },
    products: {
      total: products.length,
      pending_approval: products.filter(
        (p) => (p.approval_status ?? "").toUpperCase() === "PENDING"
      ).length,
    },
    menus: {
      total: menus.length,
      pending_approval: menus.filter((m) => m.status === "PENDING").length,
    },
    audit_logs: {
      total_today: auditLogs.filter((l) => l.created_at?.startsWith(prefix)).length,
    },
  };

  if (recentAuditLogs !== undefined) {
    result.recent_audit_logs = recentAuditLogs;
  }

  return result;
}

// ─── StoreAdmin: scoped to their store ───────────────────────────────────────

async function getStoreAdminStats(userId: string) {
  const stores = await service.getDataByField<Store>(
    "stores",
    "store_admin_id",
    userId
  );

  if (!stores || stores.length === 0) {
    return {
      store: null,
      orders: {
        total: 0,
        revenue_total: 0,
        today_count: 0,
        today_revenue: 0,
        pending_approval: 0,
        by_status: {},
      },
      menus: { total: 0, pending_approval: 0 },
      recent_orders: [],
    };
  }

  const storeId = stores[0].id;

  const [orders, menus] = await Promise.all([
    service.getDataByField<Order>("orders", "store_id", storeId),
    service.getDataByField<Menu>("menus", "store_id", storeId),
  ]);

  const recentOrders = orders
    .slice()
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 10)
    .map((o) => ({
      id: o.id,
      order_number: o.order_number,
      total_amount: Number(o.total_amount) || 0,
      order_status: o.order_status,
      created_at: o.created_at,
    }));

  return {
    store: { id: storeId },
    orders: buildOrderStats(orders),
    menus: {
      total: menus.length,
      pending_approval: menus.filter((m) => m.status === "PENDING").length,
    },
    recent_orders: recentOrders,
  };
}

// ─── Employee: order overview scoped to their store ──────────────────────────

async function getEmployeeStats(userId: string) {
  // 1. Look up the employee to find their StoreAdmin
  const employee = await service.getDataById<User>(userId, "users");
  const storeAdminId = employee?.store_admin_id ?? null;

  // 2. Find the store that belongs to their StoreAdmin
  let orders: Order[] = [];
  if (storeAdminId) {
    const stores = await service.getDataByField<Store>("stores", "store_admin_id", storeAdminId);
    if (stores && stores.length > 0) {
      const storeId = stores[0].id;
      orders = await service.getDataByField<Order>("orders", "store_id", storeId);
    }
  }

  const byStatus: Record<string, number> = {};
  for (const o of orders) {
    byStatus[o.order_status] = (byStatus[o.order_status] || 0) + 1;
  }
  return { orders: { total: orders.length, by_status: byStatus } };
}

// ─── Customer: own orders only ────────────────────────────────────────────────

async function getCustomerStats(userId: string) {
  const orders = await service.getDataByField<Order>("orders", "user_id", userId);
  return {
    orders: {
      total: orders.length,
      pending: orders.filter(
        (o) => ["PENDING", "placed", "confirmed"].includes(o.order_status)
      ).length,
      completed: orders.filter((o) => o.order_status === "delivered").length,
    },
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const getStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as JwtPayload;
    const role: string = user?.role_name ?? "";
    const userId: string = user?.id ?? "";

    let stats: Record<string, any>;

    switch (role) {
      case "Admin":
        stats = await getSuperAdminStats();
        break;
      case "SuperAdmin":
        stats = await getScopedAdminStats(userId, "superadmin_id");
        break;
      case "SubAdmin":
        stats = await getScopedAdminStats(userId, "sub_admin_id");
        break;
      case "StoreAdmin":
        stats = await getStoreAdminStats(userId);
        break;
      case "Employee":
        stats = await getEmployeeStats(userId);
        break;
      case "Customer":
        stats = await getCustomerStats(userId);
        break;
      default:
        return res.status(403).json({
          success: false,
          message: `Stats not available for role '${role}'`,
        });
    }

    return res.status(200).json({
      success: true,
      message: "Stats fetched successfully",
      data: { role, ...stats },
    });
  } catch (error: any) {
    const { message } = normalizeSupabaseError(error, "read");
    return res.status(500).json({ success: false, message });
  }
};
