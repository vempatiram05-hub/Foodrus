import { DBconnection } from "../config/DBConnect";
import { sendHtmlEmail } from "../utils/mailer";
import { logger } from "../utils/logger";

async function getInAppChannelId(): Promise<string | null> {
  const { data } = await DBconnection.from("notification_channel")
    .select("id")
    .eq("name", "IN_APP")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function createInAppNotification(userId: string, payload: object): Promise<void> {
  try {
    const channelId = await getInAppChannelId();
    if (!channelId) {
      logger.warn("[MenuNotification] IN_APP channel not found — skipping in-app notification");
      return;
    }
    await DBconnection.from("notifications").insert({
      user_id: userId,
      channel: channelId,
      template_code: "MENU_NOTIFICATION",
      payload,
      status: "PENDING",
    });
  } catch (err: any) {
    logger.error("[MenuNotification] createInAppNotification failed", { err: err.message });
  }
}

export async function notifySubAdminsOfSubmission(params: {
  storeId: string;
  storeName: string;
  targetDate: string;
  slotName: string;
  revisionCount: number;
}): Promise<void> {
  try {
    const { storeId, storeName, targetDate, slotName, revisionCount } = params;

    // Step 1: Get the store's assigned StoreAdmin — mirrors the auth hierarchy check.
    const { data: store } = await DBconnection.from("stores")
      .select("store_admin_id")
      .eq("id", storeId)
      .single();
    if (!store?.store_admin_id) return;

    // Step 2: Get the StoreAdmin's sub_admin_id — this is the SubAdmin responsible.
    const { data: storeAdmin } = await DBconnection.from("users")
      .select("sub_admin_id")
      .eq("id", store.store_admin_id)
      .single();
    if (!storeAdmin?.sub_admin_id) return;

    // Step 3: Get the SubAdmin's contact details.
    const { data: subAdmin } = await DBconnection.from("users")
      .select("id, email, full_name")
      .eq("id", storeAdmin.sub_admin_id)
      .eq("role_name", "SubAdmin")
      .single();
    if (!subAdmin) return;

    const revLabel = revisionCount > 0 ? ` (Revision ${revisionCount + 1})` : "";
    const subject = `New Menu Submission – ${storeName}${revLabel}`;
    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;color:#333;">
        <h2 style="color:#ff5722;">HiFoode – Menu Submission</h2>
        <p><strong>${storeName}</strong> has submitted a menu plan for your review.</p>
        <ul>
          <li><strong>Date:</strong> ${targetDate}</li>
          <li><strong>Time Slot:</strong> ${slotName}</li>
          ${revisionCount > 0 ? `<li><strong>Revision:</strong> ${revisionCount + 1}</li>` : ""}
        </ul>
        <p>Please log in to the portal to review and approve or reject this submission.</p>
        <p>Regards,<br/><strong>HiFoode Team</strong></p>
      </div>`;

    const payload = {
      type: "MENU_SUBMISSION",
      store_name: storeName,
      date: targetDate,
      slot: slotName,
      revision: revisionCount + 1,
    };

    await createInAppNotification(subAdmin.id, payload);
    sendHtmlEmail(subAdmin.email, subject, html).catch((e: any) =>
      logger.warn("[MenuNotification] email failed", { to: subAdmin.email, err: e.message })
    );
  } catch (err: any) {
    logger.error("[MenuNotification] notifySubAdminsOfSubmission failed", { err: err.message });
  }
}

export async function notifyStoreAdminOfFinalRevision(params: {
  storeId: string;
  storeName: string;
  targetDate: string;
  slotName: string;
}): Promise<void> {
  try {
    const { storeId, storeName, targetDate, slotName } = params;

    const { data: store } = await DBconnection.from("stores")
      .select("store_admin_id")
      .eq("id", storeId)
      .single();
    if (!store?.store_admin_id) return;

    const { data: admin } = await DBconnection.from("users")
      .select("id, email, full_name")
      .eq("id", store.store_admin_id)
      .single();
    if (!admin) return;

    const subject = `Final Revision Attempt – ${storeName} Menu`;
    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;color:#333;">
        <h2 style="color:#e53e3e;">HiFoode – Final Revision Warning</h2>
        <p>Hi ${admin.full_name ?? "Store Admin"},</p>
        <p>Your menu plan for <strong>${storeName}</strong> has been re-submitted for the <strong>third and final time</strong>.</p>
        <ul>
          <li><strong>Date:</strong> ${targetDate}</li>
          <li><strong>Time Slot:</strong> ${slotName}</li>
          <li><strong>Revision:</strong> 3 of 3 (Final)</li>
        </ul>
        <p style="color:#e53e3e;font-weight:bold;">
          This is your last revision. If this submission is rejected, no further re-submissions will be allowed for this menu plan.
        </p>
        <p>Please ensure your menu meets all requirements before this deadline.</p>
        <p>Regards,<br/><strong>HiFoode Team</strong></p>
      </div>`;

    const payload = {
      type: "MENU_FINAL_REVISION",
      store_name: storeName,
      date: targetDate,
      slot: slotName,
      revision: 3,
    };

    await createInAppNotification(admin.id, payload);
    sendHtmlEmail(admin.email, subject, html).catch((e: any) =>
      logger.warn("[MenuNotification] final revision email failed", { to: admin.email, err: e.message })
    );
  } catch (err: any) {
    logger.error("[MenuNotification] notifyStoreAdminOfFinalRevision failed", { err: err.message });
  }
}

export async function notifyStoreOfDecision(params: {
  submittedByUserId: string;
  decision: "APPROVED" | "REJECTED" | "PARTIALLY_APPROVED";
  storeName: string;
  targetDate: string;
  slotName: string;
  comment?: string;
  removedItems?: string[];
}): Promise<void> {
  try {
    const { submittedByUserId, decision, storeName, targetDate, slotName, comment, removedItems } = params;

    const { data: user } = await DBconnection.from("users")
      .select("id, email, full_name")
      .eq("id", submittedByUserId)
      .single();
    if (!user) return;

    const decisionLabel = decision === "APPROVED" ? "Approved" : decision === "REJECTED" ? "Rejected" : "Partially Approved";
    const subject = `Menu ${decisionLabel} – ${storeName}`;
    const removedHtml = removedItems?.length
      ? `<p><strong>Removed Items:</strong> ${removedItems.join(", ")}</p>`
      : "";
    const commentHtml = comment ? `<p><strong>Comment:</strong> ${comment}</p>` : "";
    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;color:#333;">
        <h2 style="color:#ff5722;">HiFoode – Menu ${decisionLabel}</h2>
        <p>Your menu plan for <strong>${storeName}</strong> has been <strong>${decisionLabel.toLowerCase()}</strong>.</p>
        <ul>
          <li><strong>Date:</strong> ${targetDate}</li>
          <li><strong>Time Slot:</strong> ${slotName}</li>
        </ul>
        ${commentHtml}
        ${removedHtml}
        <p>Regards,<br/><strong>HiFoode Team</strong></p>
      </div>`;

    const payload = {
      type: "MENU_DECISION",
      decision,
      store_name: storeName,
      date: targetDate,
      slot: slotName,
      comment,
      removed_items: removedItems,
    };

    await createInAppNotification(user.id, payload);
    sendHtmlEmail(user.email, subject, html).catch((e: any) =>
      logger.warn("[MenuNotification] decision email failed", { to: user.email, err: e.message })
    );
  } catch (err: any) {
    logger.error("[MenuNotification] notifyStoreOfDecision failed", { err: err.message });
  }
}

export async function notifyOrderStatusChange(params: {
  orderId: string;
  status: "APPROVED" | "REJECTED";
}): Promise<void> {
  try {
    const { orderId, status } = params;

    const channelId = await getInAppChannelId();
    if (!channelId) {
      logger.warn("[OrderNotification] IN_APP channel not found — cannot notify order status change");
      return;
    }

    const { data: order } = await DBconnection.from("orders")
      .select("id, order_number, customer_id")
      .eq("id", orderId)
      .single();
    if (!order?.customer_id) return;

    const type = status === "APPROVED" ? "ORDER_CONFIRMED" : "ORDER_REJECTED";

    const payload = {
      type,
      order_id: orderId,
      order_number: order.order_number ?? null,
    };

    await DBconnection.from("notifications").insert({
      user_id: order.customer_id,
      channel: channelId,
      template_code: type,
      payload,
      status: "PENDING",
    });

    logger.info(`[OrderNotification] Notified customer ${order.customer_id} — ${type} for order ${orderId}`);
  } catch (err: any) {
    logger.error("[OrderNotification] notifyOrderStatusChange failed", { err: err.message });
  }
}

export async function notifyOrderPlaced(params: {
  orderId: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  totalAmount: number;
  storeIds: string[];
}): Promise<void> {
  try {
    const { orderId, orderNumber, customerName, itemCount, totalAmount, storeIds } = params;

    const channelId = await getInAppChannelId();
    if (!channelId) {
      logger.error("[OrderNotification] IN_APP channel not found — cannot send ORDER_PLACED notifications");
      return;
    }

    for (const storeId of storeIds) {
      try {
        const { data: store } = await DBconnection.from("stores")
          .select("id, name, store_admin_id")
          .eq("id", storeId)
          .single();
        if (!store) {
          logger.warn(`[OrderNotification] Store ${storeId} not found — skipping`);
          continue;
        }

        const recipientIds = new Set<string>();

        if (store.store_admin_id) {
          recipientIds.add(store.store_admin_id);
        }

        const { data: employees } = await DBconnection.from("users")
          .select("id")
          .eq("store_id", storeId)
          .eq("role_name", "Employee")
          .eq("is_active", true);

        for (const emp of (employees ?? [])) {
          recipientIds.add(emp.id);
        }

        if (recipientIds.size === 0) {
          logger.warn(`[OrderNotification] No recipients for store ${storeId} (no admin or active employees)`);
          continue;
        }

        const payload = {
          type: "ORDER_PLACED",
          order_id: orderId,
          order_number: orderNumber,
          customer_name: customerName,
          item_count: itemCount,
          total_amount: totalAmount,
          store_name: store.name || "Your Store",
        };

        const notifications = Array.from(recipientIds).map(userId => ({
          user_id: userId,
          channel: channelId,
          template_code: "ORDER_PLACED",
          payload,
          status: "PENDING",
        }));

        await DBconnection.from("notifications").insert(notifications);
        logger.info(`[OrderNotification] Notified ${recipientIds.size} staff for store ${storeId} — order ${orderNumber}`);
      } catch (err: any) {
        logger.error(`[OrderNotification] Failed to notify store ${storeId}`, { err: err.message });
      }
    }
  } catch (err: any) {
    logger.error("[OrderNotification] notifyOrderPlaced failed", { err: err.message });
  }
}
