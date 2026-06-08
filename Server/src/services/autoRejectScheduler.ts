import cron from "node-cron";
import { DBconnection } from "../config/DBConnect";
import { logger } from "../utils/logger";
import { autoRejectDeadline } from "../utils/submissionWindow";
import { notifyStoreOfDecision } from "./menuNotification.service";

async function runAutoReject(): Promise<void> {
  try {
    const now = new Date();

    const { data: pendingMenus, error } = await DBconnection
      .from("menus")
      .select("id, date, store_id, submitted_by, time_slot_id, status")
      .eq("status", "PENDING")
      .not("date", "is", null);

    if (error) {
      logger.error("[AutoReject] Failed to fetch pending menus", { error: error.message });
      return;
    }

    if (!pendingMenus?.length) return;

    for (const menu of pendingMenus) {
      if (!menu.date) continue;

      const deadline = autoRejectDeadline(menu.date as string);
      if (now < deadline) continue;

      logger.info("[AutoReject] Auto-rejecting menu", { id: menu.id, date: menu.date });

      const { error: updateError } = await DBconnection
        .from("menus")
        .update({
          status: "REJECTED",
          rejected_at: now.toISOString(),
          notes: "Auto-rejected: no SubAdmin action taken within required window.",
        })
        .eq("id", menu.id);

      if (updateError) {
        logger.error("[AutoReject] Failed to reject menu", { id: menu.id, error: updateError.message });
        continue;
      }

      if (menu.submitted_by) {
        const { data: store } = await DBconnection.from("stores").select("name").eq("id", menu.store_id).single();
        const { data: slot } = await DBconnection.from("time_slots").select("name").eq("id", menu.time_slot_id).single();

        notifyStoreOfDecision({
          submittedByUserId: menu.submitted_by,
          decision: "REJECTED",
          storeName: store?.name ?? "Your Store",
          targetDate: menu.date as string,
          slotName: slot?.name ?? "—",
          comment: "Auto-rejected: no SubAdmin action was taken within the required window.",
        }).catch((e: any) =>
          logger.warn("[AutoReject] Notification failed", { id: menu.id, err: e.message })
        );
      }
    }
  } catch (err: any) {
    logger.error("[AutoReject] Unexpected error", { err: err.message });
  }
}

export function startAutoRejectScheduler(): void {
  cron.schedule("*/15 * * * *", () => {
    logger.info("[AutoReject] Running auto-reject check");
    runAutoReject();
  });
  logger.info("[AutoReject] Scheduler started (every 15 minutes)");
}
