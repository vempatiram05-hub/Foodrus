import { UniqueService } from "./unique.service";
import { generateInvoice, generateStoreInvoice } from "../utils/generateInvoice";
import { sendInvoiceEmail } from "../utils/mailer";
import { logger } from "../utils/logger";

const uniqueService = new UniqueService();

/**
 * Generates and sends invoice PDFs (customer + per-store) for a given order.
 *
 * Designed to be called right after an order's payment_status is set to 'paid',
 * regardless of which controller path triggered the payment (order.controller or
 * payment.controller). All email/PDF failures are caught and logged — none will
 * bubble up to the caller, so the payment response is never broken by an invoice error.
 */
export async function generateAndSendOrderInvoice(orderId: string): Promise<void> {
  // 1. Fetch order
  const order = await uniqueService.getDataById(orderId, "orders");
  if (!order) throw new Error(`[Invoice] Order ${orderId} not found`);

  // 2. Fetch customer
  const user = await uniqueService.getDataById(order.user_id, "users");
  if (!user) throw new Error(`[Invoice] User ${order.user_id} not found for order ${orderId}`);

  // 3. Fetch delivery address (optional)
  let addressData: any = null;
  try {
    if (order.address_id) {
      addressData = await uniqueService.getDataById(order.address_id, "addresses");
    }
  } catch (addrErr: any) {
    logger.warn("[Invoice] Could not fetch address:", { orderId, error: addrErr.message });
  }

  // 4. Fetch order items, resolve names and store IDs
  const rawItems: any[] = (await uniqueService.getDataByField("order_items", "order_id", orderId)) || [];
  const orderItems: any[] = [];
  const storeItemMap: Map<string, any[]> = new Map();

  for (const item of rawItems) {
    // Use stored product_name first; fall back to live lookup
    if (item.product_name) {
      item.name = item.product_name;
    } else if (!item.name) {
      try {
        if (item.product_id) {
          const product = await uniqueService.getDataById(item.product_id, "products");
          item.name = product?.name || "";
        } else if (item.menus_id) {
          const menu = await uniqueService.getDataById(item.menus_id, "menus");
          if (menu?.product_id) {
            const pIds: string[] = Array.isArray(menu.product_id) ? menu.product_id : [menu.product_id];
            const pNames: string[] = [];
            for (const pid of pIds) {
              const p = await uniqueService.getDataById(pid, "products");
              if (p?.name) pNames.push(p.name);
            }
            item.name = pNames.join(", ");
          }
        }
      } catch (nameErr: any) {
        logger.warn("[Invoice] Failed to resolve item name:", { itemId: item.id, error: nameErr.message });
      }
    }

    // Use store_id persisted on the row at order creation time
    const sid: string | null = item.store_id || null;

    orderItems.push(item);
    if (sid) {
      if (!storeItemMap.has(sid)) storeItemMap.set(sid, []);
      storeItemMap.get(sid)!.push(item);
    }
  }

  // 5. Generate customer invoice PDF
  let invoicePath: string | null = null;
  try {
    invoicePath = await generateInvoice(order, orderItems, user, addressData);
    logger.info("[Invoice] Customer PDF generated:", { orderId, invoicePath });
  } catch (pdfErr: any) {
    logger.warn("[Invoice] Customer PDF generation failed:", { orderId, error: pdfErr.message });
  }

  // 6. Email customer invoice
  try {
    if (user.email && invoicePath) {
      await sendInvoiceEmail([user.email], order, orderItems, invoicePath, addressData, user);
      logger.info("[Invoice] Customer invoice email sent:", { orderId, email: user.email });
    }
  } catch (emailErr: any) {
    logger.warn("[Invoice] Customer email failed:", { orderId, error: emailErr.message });
  }

  // 7. Per-store invoices
  for (const [sid, sItems] of storeItemMap) {
    try {
      const store = await uniqueService.getDataById(sid, "stores");
      if (!store) continue;

      const storeAdmin = store.store_admin_id
        ? await uniqueService.getDataById(store.store_admin_id, "users")
        : null;
      const adminEmail: string | undefined = storeAdmin?.email;

      const storePdfPath = await generateStoreInvoice(
        order, sItems, sid, { name: store.name || "Store" }, user, addressData
      );
      logger.info(`[Invoice] Store PDF generated for store ${sid}`);

      if (adminEmail) {
        const storeSubtotal = sItems.reduce(
          (sum: number, i: any) => sum + (i.quantity || 0) * (i.unit_price || i.price || 0),
          0
        );
        const orderSubtotal = order.subtotal_amount || 1;
        const ratio = storeSubtotal / orderSubtotal;
        const storeTax        = parseFloat(((order.tax_amount     || 0) * ratio).toFixed(2));
        const storeDeliveryFee = parseFloat(((order.delivery_fee  || 0) * ratio).toFixed(2));
        const storeDiscount   = parseFloat(((order.discount_amount || 0) * ratio).toFixed(2));
        const storeTotal      = parseFloat((storeSubtotal + storeTax + storeDeliveryFee - storeDiscount).toFixed(2));

        await sendInvoiceEmail([adminEmail], order, sItems, storePdfPath, addressData, user, {
          subtotal:    storeSubtotal,
          tax:         storeTax,
          deliveryFee: storeDeliveryFee,
          discount:    storeDiscount,
          total:       storeTotal,
        });
        logger.info(`[Invoice] Store invoice email sent to ${adminEmail} for store ${sid}`);
      }
    } catch (storeInvoiceErr: any) {
      logger.warn(`[Invoice] Failed to process store ${sid}:`, { orderId, error: storeInvoiceErr.message });
    }
  }

  logger.info(`[Invoice] generateAndSendOrderInvoice complete for order ${orderId}`);
}
