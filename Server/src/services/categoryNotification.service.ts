import { DBconnection } from "../config/DBConnect";
import { sendHtmlEmail } from "../utils/mailer";
import { logger } from "../utils/logger";
import { UniqueService } from "./unique.service";

const uniqueService = new UniqueService();

async function getInAppChannelId(): Promise<string | null> {
  const { data } = await DBconnection.from("notification_channel")
    .select("id")
    .eq("name", "IN_APP")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function getAdminAndSuperAdminUsers(): Promise<Array<{ id: string; email: string; full_name: string | null }>> {
  const { data } = await DBconnection
    .from("users")
    .select("id, email, full_name")
    .in("role_name", ["Admin", "SuperAdmin"])
    .eq("is_active", true);
  return (data ?? []) as Array<{ id: string; email: string; full_name: string | null }>;
}

export async function notifyAdminsOfCategoryPromotion(params: {
  categoryId: string;
  categoryName: string;
  triggeredByUserId: string;
  triggeredByName: string;
  originalStoreId: string;
  originalStoreName: string;
}): Promise<void> {
  const { categoryId, categoryName, triggeredByUserId, triggeredByName, originalStoreId, originalStoreName } = params;

  try {
    const [channelId, admins] = await Promise.all([
      getInAppChannelId(),
      getAdminAndSuperAdminUsers(),
    ]);

    if (admins.length === 0) {
      logger.warn("[CategoryNotification] No Admin/SuperAdmin users found — skipping promotion notification");
      return;
    }

    const notificationPayload = {
      type: "CATEGORY_PROMOTED_TO_GLOBAL",
      category_id: categoryId,
      category_name: categoryName,
      triggered_by_user_id: triggeredByUserId,
      triggered_by_name: triggeredByName,
      original_store_id: originalStoreId,
      original_store_name: originalStoreName,
    };

    if (channelId) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        channel: channelId,
        template_code: "CATEGORY_PROMOTED_TO_GLOBAL",
        payload: notificationPayload,
        status: "PENDING",
      }));

      const { error } = await DBconnection.from("notifications").insert(notifications);
      if (error) {
        logger.error("[CategoryNotification] Failed to insert in-app notifications", { err: error.message });
      } else {
        logger.info(`[CategoryNotification] In-app notifications sent to ${admins.length} admin(s) for category promotion: "${categoryName}"`);
      }
    } else {
      logger.warn("[CategoryNotification] IN_APP channel not found — skipping in-app notifications");
    }

    const subject = `Category Promoted to Global – "${categoryName}"`;
    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;color:#333;">
        <h2 style="color:#ff5722;">HiFoodie – Category Promoted to Global</h2>
        <p>A store-specific category has been automatically promoted to a <strong>global shared category</strong>.</p>
        <ul>
          <li><strong>Category Name:</strong> ${categoryName}</li>
          <li><strong>Promoted From Store:</strong> ${originalStoreName} (ID: ${originalStoreId})</li>
          <li><strong>Triggered By:</strong> ${triggeredByName} (ID: ${triggeredByUserId})</li>
        </ul>
        <p>This category is now visible and available to all stores. It can no longer be modified by SubAdmins or StoreAdmins.</p>
        <p>Please review this change in the admin portal if needed.</p>
        <p>Regards,<br/><strong>HiFoodie Team</strong></p>
      </div>`;

    for (const admin of admins) {
      sendHtmlEmail(admin.email, subject, html).catch((e: any) =>
        logger.warn("[CategoryNotification] Email failed", { to: admin.email, err: e.message })
      );
    }
  } catch (err: any) {
    logger.error("[CategoryNotification] notifyAdminsOfCategoryPromotion failed", { err: err.message });
  }
}

export async function createCategoryPromotionAuditLog(params: {
  categoryId: string;
  categoryName: string;
  triggeredByUserId: string;
  triggeredByName: string;
  originalStoreId: string;
  originalStoreName: string;
}): Promise<void> {
  const { categoryId, categoryName, triggeredByUserId, triggeredByName, originalStoreId, originalStoreName } = params;

  try {
    await uniqueService.create("audit_logs", {
      user_id: triggeredByUserId,
      entity_type: "category",
      entity_id: categoryId,
      action: "PROMOTED_TO_GLOBAL",
      metadata: {
        category_name: categoryName,
        triggered_by_name: triggeredByName,
        original_store_id: originalStoreId,
        original_store_name: originalStoreName,
        promoted_at: new Date().toISOString(),
      },
    });
    logger.info(`[CategoryNotification] Audit log created for category promotion: "${categoryName}" (ID: ${categoryId})`);
  } catch (err: any) {
    logger.error("[CategoryNotification] createCategoryPromotionAuditLog failed", { err: err.message });
  }
}
