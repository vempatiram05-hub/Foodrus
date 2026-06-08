import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { UniqueController } from "./unique.controller";
import { generateAndSendOrderInvoice } from "../services/invoice.service";
import { logger } from "../utils/logger";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { createHelcimPayment } from "../services/helcim.service";
import { getQueryString, getQueryNumber } from "../utils/queryParser";
import type { JwtPayload } from "../utils/token";
import { DBconnection } from "../config/DBConnect";
import { notifyOrderPlaced, notifyOrderStatusChange } from "../services/menuNotification.service";
import path from "node:path";
import fs from "node:fs";

const ORDERS_TABLE = "orders";
const ORDER_ITEMS_TABLE = "order_items";
const uniqueService = new UniqueService();
const uniqueOrderController = new UniqueController(ORDERS_TABLE);

const isValidUUID = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

export class OrderController {


   /* GET ORDERS WITH SEARCH + PAGINATION */
  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  async getList(req: Request, res: Response) {
    try {
      const callerUser = req.user as JwtPayload | undefined;
      const role = callerUser?.role_name;
      const search = (getQueryString(req.query, "search") || "").trim();
      const userId = (getQueryString(req.query, "user_id") || "").trim();
      const storeId = (getQueryString(req.query, "store_id") || "").trim();
      const approvalStatus = (getQueryString(req.query, "approval_status") || "").trim().toUpperCase();
      
      const page = getQueryNumber(req.query, 'page', 1);
      const limit = getQueryNumber(req.query, 'limit', 10);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Start building the query
      let query = DBconnection.from(ORDERS_TABLE).select("*", { count: "exact" });

      console.log('Order getList - Role:', role);
      console.log('Order getList - Caller ID:', callerUser?.id, callerUser!.id);

      /* 1. Role-based scoping applied at query level */
      if (role === "Customer") {
        console.log('Filtering by Customer user_id:', callerUser!.id);
        query = query.eq("user_id", callerUser?.id);
      } else if (role === "Employee") {
        // Employees see orders for their directly assigned store (store_id) or all stores via store_admin_id
        if (callerUser?.store_id) {
          query = query.eq("store_id", callerUser.store_id);
        } else if (callerUser?.store_admin_id) {
          const stores = await uniqueService.getDataByField("stores", "store_admin_id", callerUser.store_admin_id);
          const sIds = stores.map((s: any) => s.id);
          if (sIds.length > 0) {
            query = query.in("store_id", sIds);
          } else {
            return res.json({ success: true, message: 'No records found', data: [], total: 0, page, limit });
          }
        } else {
          return res.json({ success: true, message: 'No records found', data: [], total: 0, page, limit });
        }
      } else if (role === "StoreAdmin") {
        const stores = await uniqueService.getDataByField("stores", "store_admin_id", callerUser!.id);
        const sIds = stores.map((s: any) => s.id);
        if (sIds.length > 0) {
          query = query.in("store_id", sIds);
        } else {
          return res.json({ success: true, message: 'No records found', data: [], total: 0, page, limit });
        }
      } else if (role === "SuperAdmin" || role === "SubAdmin") {
        const hierarchyField = role === "SuperAdmin" ? "superadmin_id" : "sub_admin_id";
        const managedUsers = await uniqueService.getDataByField("users", hierarchyField, callerUser!.id);
        const storeAdminIds = managedUsers.filter((u: any) => u.role_name === "StoreAdmin").map((u: any) => u.id);
        
        const storeArrays = await Promise.all(
          storeAdminIds.map((id: string) => uniqueService.getDataByField("stores", "store_admin_id", id))
        );
        const sIds = storeArrays.flat().map((s: any) => s.id);
        if (sIds.length > 0) {
          query = query.in("store_id", sIds);
        } else {
          return res.json({ success: true, message: 'No records found', data: [], total: 0, page, limit });
        }
      }

      /* 2. Query-param filters */
      if (userId) {
        query = query.eq("user_id", userId);
      }
      if (storeId) {
        const ids = storeId.split(",").map((s: string) => s.trim()).filter(Boolean);
        if (ids.length > 0) query = query.in("store_id", ids);
      }
      if (approvalStatus) {
        const statuses = approvalStatus.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (statuses.length > 0) query = query.in("approval_status", statuses);
      }
      if (search) {
        query = query.or(`order_number.ilike.%${search}%,payment_status.ilike.%${search}%,order_status.ilike.%${search}%`);
      }

      // Order by newest first
      query = query.order("created_at", { ascending: false });

      // Apply Pagination
      query = query.range(from, to);

      const { data: orders, count, error } = await query;
      if (error) throw error;

      if (!orders || orders.length === 0) {
        return res.json({
          success: true,
          message: 'No records found',
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      /* 3. Batch enrichment (Users + Addresses + Items) */
      const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))];
      const addressIds = [...new Set(orders.map((o: any) => o.address_id).filter(Boolean))];
      const orderIds = orders.map((o: any) => o.id);

      const [usersRes, addressesRes, itemsRes] = await Promise.all([
        userIds.length ? DBconnection.from('users').select('id,full_name,phone').in('id', userIds) : { data: [] },
        addressIds.length ? DBconnection.from('addresses').select('id,line1,line2,postal_code').in('id', addressIds) : { data: [] },
        DBconnection.from(ORDER_ITEMS_TABLE).select('*').in('order_id', orderIds)
      ]);

      const userMap = new Map((usersRes.data ?? []).map((u: any) => [u.id, u]));
      const addressMap = new Map((addressesRes.data ?? []).map((a: any) => [a.id, a]));
      const itemsMap = new Map();
      
      (itemsRes.data ?? []).forEach((item: any) => {
        if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
        itemsMap.get(item.order_id).push(item);
      });

      const enrichedData = orders.map((order: any) => {
        const user = userMap.get(order.user_id);
        const addr = addressMap.get(order.address_id);
        const parts = [addr?.line1, addr?.line2, addr?.postal_code].filter(Boolean);
        
        return {
          ...order,
          customer_name: user?.full_name,
          customer_phone: user?.phone,
          delivery_address: parts.length ? parts.join(', ') : undefined,
          items: itemsMap.get(order.id) || []
        };
      });

      return res.json({
        success: true,
        message: 'Orders fetched successfully',
        data: enrichedData,
        total: count ?? 0,
        page,
        limit,
      });

    } catch (err: any) {
      logger.error('Order getList failed:', { error: err.message, stack: err.stack });
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch orders' });
    }
  }

  /** CREATE ORDER + PAYMENT METHOD + PAYMENT */
  async create(req: Request, res: Response) {
    try {
      const payload: any = req.body;
      const { items = [], ...orderPayload } = payload;

      /* ---------------- VALIDATION ---------------- */

      if (!orderPayload.user_id || !orderPayload.address_id) {
        return res.status(400).json({ success: false, message: "user_id and address_id are required" });
      }

      /* CHECK USER */
      const user = await uniqueService.getDataById(orderPayload.user_id, "users");
      if (!user) {
        return res.status(400).json({ success: false, message: "User not found" });
      }

      /* ---------------- PRODUCT AVAILABILITY CHECK ---------------- */
      {
        const productIds = items.filter((i: any) => i.product_id).map((i: any) => i.product_id);
        const menuIds    = items.filter((i: any) => i.menus_id).map((i: any) => i.menus_id);

        const [productsCheckRes, menusCheckRes] = await Promise.all([
          productIds.length ? DBconnection.from("products").select("id, is_active").in("id", productIds) : { data: [] },
          menuIds.length    ? DBconnection.from("menus").select("id, unavailable_items").in("id", menuIds) : { data: [] },
        ]);

        const productActiveMap = new Map((productsCheckRes.data ?? []).map((p: any) => [p.id, p.is_active]));
        const menuUnavailMap   = new Map((menusCheckRes.data ?? []).map((m: any) => [m.id, m.unavailable_items ?? []]));

        const unavailableProductIds: string[] = [];
        for (const item of items) {
          if (item.product_id) {
            const isActive = productActiveMap.get(item.product_id);
            if (isActive === false) {
              unavailableProductIds.push(item.product_id);
              continue;
            }
          }
          if (item.menus_id && item.product_id) {
            const unavail: string[] = menuUnavailMap.get(item.menus_id) ?? [];
            if (unavail.includes(item.product_id)) {
              unavailableProductIds.push(item.product_id);
            }
          }
        }

        if (unavailableProductIds.length > 0) {
          return res.status(400).json({
            success: false,
            message: "One or more items in your cart are no longer available. Please remove them and try again.",
            data: { unavailable_product_ids: unavailableProductIds },
          });
        }
      }

      /* RESOLVE store_id FOR EACH ITEM — detect multi-store orders */
      const itemStoreMap: Map<string, string> = new Map(); // itemIndex → store_id
      const storeIds = new Set<string>();

      try {
        const productIds = items.filter((i: any) => i.product_id).map((i: any) => i.product_id);
        const menuIds    = items.filter((i: any) => i.menus_id).map((i: any) => i.menus_id);

        const [productsRes, menusRes] = await Promise.all([
          productIds.length ? DBconnection.from("products").select("id,store_id").in("id", productIds) : { data: [] },
          menuIds.length    ? DBconnection.from("menus").select("id,store_id").in("id", menuIds)       : { data: [] },
        ]);

        const productStoreMap = new Map((productsRes.data ?? []).map((p: any) => [p.id, p.store_id]));
        const menuStoreMap    = new Map((menusRes.data    ?? []).map((m: any) => [m.id, m.store_id]));

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let sid: string | null = null;
          if (item.product_id) {
            sid = productStoreMap.get(item.product_id) ?? null;
          } else if (item.menus_id) {
            sid = menuStoreMap.get(item.menus_id) ?? null;
          }
          if (sid) {
            itemStoreMap.set(String(i), sid);
            storeIds.add(sid);
          }
        }

        if (storeIds.size === 0) {
          logger.warn('[OrderNotification] storeIds resolved to empty — no product/menu store mapping found', {
            itemCount: items.length,
            frontendStoreId: orderPayload.store_id ?? null,
          });
        }
      } catch (storeResErr: any) {
        logger.warn('[OrderNotification] storeIds resolution failed — proceeding without store mapping', {
          err: storeResErr?.message ?? storeResErr,
        });
      }

      // Prefer the store resolved from product/menu records; fall back to frontend-provided value
      if (storeIds.size === 1) {
        orderPayload.store_id = [...storeIds][0];
      } else if (storeIds.size === 0 && !orderPayload.store_id) {
        // Last resort: pick the first active store from the DB so the NOT NULL constraint is satisfied
        const { data: anyStore } = await DBconnection
          .from("stores")
          .select("id")
          .limit(1)
          .single();
        orderPayload.store_id = anyStore?.id ?? null;
      }
      // storeIds.size > 1 → multi-store order; keep whatever the frontend sent (may be null)

      /* VALIDATE store_id exists */
      if (orderPayload.store_id) {
        const store = await uniqueService.getDataById(orderPayload.store_id, "stores");
        if (!store) {
          // store_id came from frontend but isn't in DB — clear it so insertion doesn't fail
          orderPayload.store_id = null;
        }
      }

      /* ---------------- PAYMENT METHOD (optional) ---------------- */

      const hasNewCard = orderPayload.last4 && orderPayload.method_type && orderPayload.provider && orderPayload.token_reference;
      let paymentMethod: any = null;

      if (orderPayload.payment_method_id) {
        // Use existing payment method
        const methods = await uniqueService.getDataByField("payment_methods", "id", orderPayload.payment_method_id);
        paymentMethod = methods?.[0];
        if (!paymentMethod) {
          return res.status(404).json({ success: false, message: "Payment method not found" });
        }
      } else if (hasNewCard) {
        // Create new payment method
        const { last4, method_type, provider, token_reference } = orderPayload;
        paymentMethod = await uniqueService.create("payment_methods", {
          user_id: orderPayload.user_id,
          last4: last4.trim(),
          method_type: method_type.trim(),
          provider: provider.trim(),
          token_reference: token_reference.trim(),
        });
      }

      /* ---------------- COMPUTE TOTALS ---------------- */

      const subtotal = items.reduce((sum: number, item: any) => sum + item.unit_price * item.quantity, 0);
      const total = subtotal + (payload.tax_amount || 0) + (payload.delivery_fee || 0) - (payload.discount_amount || 0);

      /* ---------------- CREATE: order -> items -> payment ---------------- */

      let order: any;
      const orderItems: any[] = [];
      let paymentRecord: any = null;
      let helcimResponse: any;

      /* CREATE ORDER */
      const { data: createdOrder, error: orderErr } = await DBconnection
        .from('orders')
        .insert({
          user_id: orderPayload.user_id,
          address_id: orderPayload.address_id,
          store_id: orderPayload.store_id ?? null,
          tax_amount: orderPayload.tax_amount ?? null,
          delivery_fee: orderPayload.delivery_fee ?? null,
          discount_amount: orderPayload.discount_amount ?? null,
          order_number: `ORD-${Date.now()}`,
          subtotal_amount: subtotal,
          total_amount: total,
          order_status: 'PENDING',
          payment_status: 'unpaid',
        })
        .select()
        .single();
      if (orderErr) throw new Error(orderErr.message);
      order = createdOrder;
      order.subtotal_amount  = parseFloat(order.subtotal_amount)  || 0;
      order.total_amount     = parseFloat(order.total_amount)     || 0;
      order.tax_amount       = parseFloat(order.tax_amount)       || 0;
      order.delivery_fee     = parseFloat(order.delivery_fee)     || 0;
      order.discount_amount  = parseFloat(order.discount_amount)  || 0;

      /* PRE-FETCH names for all items in two queries (for invoice/email) */
      const allProductIds = items.filter((i: any) => i.product_id).map((i: any) => i.product_id);
      const allMenuIds    = items.filter((i: any) => i.menus_id).map((i: any) => i.menus_id);

      const [itemProductsRes, itemMenusRes] = await Promise.all([
        allProductIds.length ? DBconnection.from('products').select('id,name').in('id', allProductIds) : { data: [] },
        allMenuIds.length    ? DBconnection.from('menus').select('id,product_id').in('id', allMenuIds) : { data: [] },
      ]);

      const itemProductNameMap = new Map((itemProductsRes.data ?? []).map((p: any) => [p.id, p.name]));
      const itemMenuMap        = new Map((itemMenusRes.data    ?? []).map((m: any) => [m.id, m]));

      const menuLinkedProductIds: string[] = [];
      for (const menu of (itemMenusRes.data ?? [])) {
        if (menu.product_id) {
          const pIds = Array.isArray(menu.product_id) ? menu.product_id : [menu.product_id];
          menuLinkedProductIds.push(...pIds);
        }
      }
      const menuLinkedProductsRes = menuLinkedProductIds.length
        ? await DBconnection.from('products').select('id,name').in('id', menuLinkedProductIds)
        : { data: [] };
      const menuLinkedProductNameMap = new Map((menuLinkedProductsRes.data ?? []).map((p: any) => [p.id, p.name]));

      /* CREATE ORDER ITEMS */
      for (const item of items) {
        // Resolve the display name before inserting so it can be persisted as product_name
        let resolvedName = '';
        if (item.product_id) {
          resolvedName = itemProductNameMap.get(item.product_id) || '';
        } else if (item.menus_id) {
          const menu = itemMenuMap.get(item.menus_id);
          if (menu?.product_id) {
            const pIds = Array.isArray(menu.product_id) ? menu.product_id : [menu.product_id];
            resolvedName = pIds.map((pid: string) => menuLinkedProductNameMap.get(pid) || '').filter(Boolean).join(', ');
          }
        }
        // Fall back to the name sent by the frontend (e.g. from the cart item) when no FK resolves a name
        if (!resolvedName && item.name) resolvedName = item.name;

        const itemStoreId = itemStoreMap.get(String(orderItems.length)) ?? null;

        const { data: insertedItem, error: itemErr } = await DBconnection
          .from('order_items')
          .insert({
            order_id: order.id,
            product_id: item.product_id ?? null,
            menus_id: item.menus_id ?? null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            product_name: resolvedName || null,
            store_id: itemStoreId,
          })
          .select()
          .single();
        if (itemErr) {
          await DBconnection.from('orders').delete().eq('id', order.id);
          throw new Error(itemErr.message);
        }
        insertedItem.unit_price  = parseFloat(insertedItem.unit_price)  || 0;
        insertedItem.total_price = parseFloat(insertedItem.total_price) || 0;
        insertedItem.quantity    = parseInt(insertedItem.quantity, 10)  || 0;
        insertedItem.name = resolvedName || '';
        orderItems.push(insertedItem);
      }

      /* PROCESS PAYMENT (only if payment method provided) */
      if (paymentMethod) {
        const addresses = await uniqueService.getDataByField('addresses', 'user_id', orderPayload.user_id);
        const userAddress = addresses?.find((a: any) => a.is_default) || addresses?.[0];
        const billingAddress = {
          name: user.full_name || 'Guest Customer',
          street1: userAddress?.line1 || '123 Main St',
          city: userAddress?.city || 'New York',
          province: userAddress?.state || 'NY',
          postalCode: userAddress?.postal_code || '10001',
          country: 'USA',
        };
        try {
          helcimResponse = await createHelcimPayment({
            amount: payload.amount ?? total,
            currency: payload.currency || 'USD',
            cardData: { cardToken: paymentMethod.token_reference },
            billingAddress,
          });
        } catch (paymentErr: any) {
          logger.error('Payment Error:', paymentErr);
          await DBconnection.from('orders').delete().eq('id', order.id);
          return res.status(500).json({ success: false, message: paymentErr.message || 'Payment failed' });
        }
        const isApproved = helcimResponse.status === 'APPROVED';
        await DBconnection.from('orders').update({
          order_status: isApproved ? 'PENDING' : 'CANCELLED',
          payment_status: isApproved ? 'paid' : 'failed',
          updated_at: new Date().toISOString(),
        }).eq('id', order.id);
        const { data: payResult } = await DBconnection.from('payments').insert({
          order_id: order.id,
          payment_method_id: paymentMethod.id,
          amount: payload.amount ?? total,
          currency: payload.currency || 'USD',
          status: helcimResponse.status || (isApproved ? 'APPROVED' : 'FAILED'),
          provider_payment_id: helcimResponse.transactionId,
        }).select().single();
        paymentRecord = payResult;
        if (!isApproved) {
          return res.status(400).json({ success: false, message: 'Payment was not approved' });
        }
      }

      /* ---------------- POST-COMMIT: INVOICE + EMAILS ---------------- */

      if (paymentMethod && helcimResponse?.status === "APPROVED") {
        try {
          await generateAndSendOrderInvoice(order.id);
        } catch (invoiceErr: any) {
          logger.warn("[Invoice] Invoice generation failed after order create:", { error: invoiceErr.message });
        }
      }

      /* ---------------- NOTIFY STORE STAFF (all orders: COD + paid) ---------------- */

      {
        const notifyStoreIds = storeIds.size > 0
          ? [...storeIds]
          : orderPayload.store_id ? [orderPayload.store_id] : [];

        if (notifyStoreIds.length > 0) {
          notifyOrderPlaced({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: user.full_name || 'Customer',
            itemCount: orderItems.length,
            totalAmount: total,
            storeIds: notifyStoreIds,
          }).catch((e: any) => logger.error('[OrderNotification] notifyOrderPlaced failed:', { err: e?.message ?? e }));
        } else {
          logger.warn('[OrderNotification] No resolvable storeIds — notification skipped', { orderId: order.id });
        }
      }

      /* ---------------- RESPONSE ---------------- */

      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: {
          order: paymentMethod
            ? { ...order, order_status: "PENDING", payment_status: "paid" }
            : order,
          items: orderItems,
          ...(paymentMethod && { payment_method: paymentMethod }),
          ...(paymentRecord && { payment: paymentRecord }),
        },
      });

    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

 

  /** GET ORDER BY ID (use generic controller) */
  getById = (req: Request, res: Response) => uniqueOrderController.getById(req, res);

  /** GET ORDERS BY USER ID */
  async getOrdersByUserId(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const { data: orders, error: ordersError } = await DBconnection
        .from(ORDERS_TABLE)
        .select("*")
        .eq("user_id", userId as string)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        return res.json({ success: true, message: "No orders found", data: [] });
      }

      // Batch-fetch ALL items for all orders in one query
      const orderIds = orders.map((o: any) => o.id);
      const { data: allItems } = await DBconnection
        .from(ORDER_ITEMS_TABLE)
        .select("*")
        .in("order_id", orderIds);

      const rawItems: any[] = allItems ?? [];

      // Collect unique product_ids and menus_ids across all items
      const productIds = [...new Set(rawItems.filter((i) => i.product_id).map((i) => i.product_id))];
      const menuIds    = [...new Set(rawItems.filter((i) => i.menus_id).map((i) => i.menus_id))];

      const [productsRes, menusRes] = await Promise.all([
        productIds.length ? DBconnection.from("products").select("id,name,store_id").in("id", productIds) : { data: [] },
        menuIds.length    ? DBconnection.from("menus").select("id,product_id,store_id").in("id", menuIds)    : { data: [] },
      ]);

      const productMap = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));
      const menuMap    = new Map((menusRes.data    ?? []).map((m: any) => [m.id, m]));

      // Collect linked product_ids from all menus (menus table has no name column — resolve via products)
      const menuLinkedProductIds: string[] = [];
      for (const menu of (menusRes.data ?? [])) {
        if (menu.product_id) {
          const pIds = Array.isArray(menu.product_id) ? menu.product_id : [menu.product_id];
          menuLinkedProductIds.push(...pIds);
        }
      }
      const menuLinkedProductsRes = menuLinkedProductIds.length
        ? await DBconnection.from("products").select("id,name").in("id", menuLinkedProductIds)
        : { data: [] };
      const menuLinkedProductMap = new Map((menuLinkedProductsRes.data ?? []).map((p: any) => [p.id, p.name]));

      // Enrich each item with a resolved name and store_id
      const enrichItem = (item: any) => {
        let name = "";
        let storeId: string | null = null;

        // 1. Use the persisted product_name column first — most reliable, covers all cases
        if (item.product_name) {
          name = item.product_name;
        }

        // 2. Try FK joins to fill name / storeId (also fills storeId even when name is already known)
        if (item.product_id) {
          const product = productMap.get(item.product_id);
          if (!name) name = product?.name || "";
          storeId = product?.store_id ?? null;
        } else if (item.menus_id) {
          const menu = menuMap.get(item.menus_id);
          storeId = menu?.store_id ?? null;
          if (!name && menu?.product_id) {
            const pIds = Array.isArray(menu.product_id) ? menu.product_id : [menu.product_id];
            name = pIds.map((pid: string) => menuLinkedProductMap.get(pid) || "").filter(Boolean).join(", ");
          }
        }

        return {
          ...item,
          name: name || "Item",
          store_id: storeId,
          unit_price: parseFloat(item.unit_price) || 0,
          quantity:   parseInt(item.quantity, 10)  || 0,
        };
      };

      // Group enriched items by order_id
      const itemsByOrder = new Map<string, any[]>();
      for (const item of rawItems) {
        if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
        itemsByOrder.get(item.order_id)!.push(enrichItem(item));
      }

      // Attach items to each order
      for (const order of orders) {
        (order as any).items = itemsByOrder.get(order.id) ?? [];
      }

      return res.status(200).json({
        success: true,
        message: "Orders fetched successfully",
        data: orders,
      });

    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to fetch orders"
      });
    }
  }


  /** UPDATE ORDER */
  update=async (req: Request, res: Response)=> {
    try {
      const { id } = req.params;

      // Prevent order_number from being updated
      const updatePayload = { ...req.body };
      delete updatePayload.order_number;

      const data = await uniqueService.updateById(ORDERS_TABLE, String(id), updatePayload);

      // When payment_status is set to 'paid', generate invoice and send email
      if (updatePayload.payment_status === "paid") {
        try {
          await generateAndSendOrderInvoice(String(id));
        } catch (invoiceErr: any) {
          logger.warn("[Invoice] Invoice generation failed after order update:", { error: invoiceErr.message });
        }
      }

      return res.status(200).json({ success: true, message: "Order updated successfully", data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /** DELETE ORDER */
  delete = (req: Request, res: Response) => uniqueOrderController.deleteById(req, res);
  /* ================= APPROVE ================= */
  approve = async (req: Request, res: Response) => {
    try {
      const { approved_by } = req.body;

      const updated = await uniqueService.updateById(ORDERS_TABLE, String(req.params.id), {
        approval_status: "APPROVED",
        order_status: "APPROVED",
        approved_by,
        approved_at: new Date().toISOString(),
      });

      notifyOrderStatusChange({ orderId: String(req.params.id), status: "APPROVED" }).catch((err: any) =>
        logger.warn("[OrderController] Failed to send ORDER_CONFIRMED notification", { err: err.message })
      );

      return res.json({
        success: true,
        message: "Order approved successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }

  /* ================= REJECT ================= */
  reject = async (req: Request, res: Response) => {
    try {
    const { rejected_by } = req.body;

      const updated = await uniqueService.updateById(ORDERS_TABLE, String(req.params.id), {
        approval_status: "REJECTED",
        order_status: "REJECTED",
        rejected_by,
        rejected_at: new Date().toISOString(),
      });

      notifyOrderStatusChange({ orderId: String(req.params.id), status: "REJECTED" }).catch((err: any) =>
        logger.warn("[OrderController] Failed to send ORDER_REJECTED notification", { err: err.message })
      );

      return res.json({
        success: true,
        message: "Order rejected successfully",
        data: updated,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: normalizeSupabaseError(err).message,
      });
    }
  }
  /** DOWNLOAD INVOICE PDF — authenticated; enforces role-based order scope */
  downloadInvoice = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const caller = req.user as JwtPayload | undefined;
      const role = caller?.role_name;

      const order = await uniqueService.getDataById(id, ORDERS_TABLE);
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      const invoicesDir = path.join(process.cwd(), "invoices");

      // Admin: full access, no scope check needed
      if (role === "Admin") {
        const filename = `invoice-${order.order_number}.pdf`;
        const filePath = path.join(invoicesDir, filename);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({
            success: false,
            message: "Invoice PDF not yet available. It is generated once the order payment is confirmed.",
          });
        }
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return fs.createReadStream(filePath).pipe(res);
      }

      // Resolve managed store IDs — mirrors the scoping logic used in getList
      let managedStoreIds: string[] = [];

      if (role === "StoreAdmin") {
        const stores = await uniqueService.getDataByField("stores", "store_admin_id", caller!.id);
        managedStoreIds = stores.map((s: any) => s.id);
      } else if (role === "Employee") {
        if (caller?.store_id) {
          managedStoreIds = [caller.store_id];
        } else if (caller?.store_admin_id) {
          const stores = await uniqueService.getDataByField("stores", "store_admin_id", caller.store_admin_id);
          managedStoreIds = stores.map((s: any) => s.id);
        }
      } else if (role === "SuperAdmin" || role === "SubAdmin") {
        const hierarchyField = role === "SuperAdmin" ? "superadmin_id" : "sub_admin_id";
        const managedUsers = await uniqueService.getDataByField("users", hierarchyField, caller!.id);
        const storeAdminIds = managedUsers
          .filter((u: any) => u.role_name === "StoreAdmin")
          .map((u: any) => u.id);
        const storeArrays = await Promise.all(
          storeAdminIds.map((saId: string) => uniqueService.getDataByField("stores", "store_admin_id", saId))
        );
        managedStoreIds = storeArrays.flat().map((s: any) => s.id);
      }

      if (managedStoreIds.length === 0) {
        return res.status(403).json({ success: false, message: "No managed stores found for your account" });
      }

      // Verify at least one item in this order belongs to a managed store
      const { data: scopedItems, error: scopeErr } = await DBconnection
        .from(ORDER_ITEMS_TABLE)
        .select("store_id")
        .eq("order_id", id)
        .in("store_id", managedStoreIds);

      if (scopeErr) {
        logger.warn("[OrderController] downloadInvoice scope check error:", { error: scopeErr.message });
      }

      if (!scopedItems || scopedItems.length === 0) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this order's invoice",
        });
      }

      // StoreAdmin/Employee/SuperAdmin/SubAdmin: serve the store-scoped invoice
      // Only Admin receives the full-order PDF. All other roles get a per-store PDF
      // limited to their managed stores, preventing exposure of data from other stores.
      const matchedStoreId = (scopedItems as Array<{ store_id: string }>).find((i) => i.store_id)?.store_id;
      if (!matchedStoreId) {
        return res.status(404).json({
          success: false,
          message: "Store invoice PDF not yet available.",
        });
      }

      const filename = `invoice-${order.order_number}-store-${matchedStoreId}.pdf`;
      const filePath = path.join(invoicesDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "Store invoice PDF not yet available. It is generated once the order payment is confirmed.",
        });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err: any) {
      logger.error("[OrderController] downloadInvoice error:", { error: err.message });
      return res.status(500).json({ success: false, message: "Failed to download invoice" });
    }
  };
}
export const orderController = new OrderController();
