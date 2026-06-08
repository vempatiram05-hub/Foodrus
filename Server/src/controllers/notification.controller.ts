import { Request, Response } from "express";
import { UniqueService } from "../services/unique.service";
import { normalizeSupabaseError } from "../utils/supabaseError";
import { getQueryNumber, getQueryString } from "../utils/queryParser";
import { DBconnection } from "../config/DBConnect";
import { UniqueController } from "./unique.controller";

const TABLE = "notifications";
const uniqueService = new UniqueService();
const uniqueController = new UniqueController(TABLE);

export class NotificationController {

  // ---------------- CREATE NOTIFICATION ----------------
  public static async create(req: Request, res: Response) {
    try {
      let { user_id, channel, template_code, payload } = req.body;

      if (!user_id || !channel || !payload) {
        return res.status(400).json({
          success: false,
          message: "user_id, channel and payload are required",
        });
      }

      // normalize
      channel = channel.toUpperCase();
      template_code = template_code?.toUpperCase() ?? null;

      const { data: channelRow, error: channelError } = await DBconnection
        .from("notification_channel")
        .select("id")
        .eq("name", channel)
        .single();

      if (channelError || !channelRow) {
        return res.status(400).json({
          success: false,
          message: `Invalid notification channel: ${channel}`,
        });
      }

      const notification = await uniqueService.create("notifications", {
        user_id,
        channel: channelRow.id,
        template_code,
        payload,
        status: "PENDING",
        created_at: new Date().toISOString(),
        sent_at: null,
        error_message: null,
      });

      return res.status(201).json({
        success: true,
        message: "Notification created successfully",
        data: notification,
      });

    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err?.message || "Failed to create notification",
      });
    }
  }

  public static readonly getById = (req: Request, res: Response) => uniqueController.getById(req, res);

  // ---------------- DELETE NOTIFICATION (ownership-checked) ----------------
  public static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, message: 'id is required' });

      const requestingUser = (req as any).user;
      const adminRoles = ['Admin', 'SuperAdmin'];
      const isAdmin = requestingUser && adminRoles.includes(requestingUser.role_name);

      if (!isAdmin) {
        const notification = await uniqueService.getDataById(id as string, TABLE);
        if (!notification) {
          return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        if (notification.user_id !== requestingUser?.id) {
          return res.status(403).json({ success: false, message: 'You are not authorized to delete this notification.' });
        }
      }

      await uniqueService.deleteData(TABLE, id as string);
      return res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err) || err?.message || 'Failed to delete notification' });
    }
  }

  public static async getList(req: Request, res: Response) {
    try {
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["template_code", "status"];

      let data: any[];
      let total: number;

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const result = await uniqueService.getDataWithSearch(TABLE, searchColumns, search || undefined, limit, page);
        data = result.data;
        total = result.total;

        return res.json({
          success: true,
          message: data.length ? "Notifications fetched successfully" : "No records found",
          data,
          total,
          page,
          limit,
        });
      } else {
        data = await uniqueService.getAllData(TABLE);
        if (search) {
          data = data.filter(c =>
            searchColumns.some(col => c[col]?.toString().toLowerCase().includes(search))
          );
        }
        total = data.length;

        return res.json({
          success: true,
          message: data.length ? "Notifications fetched successfully" : "No records found",
          data,
          total,
        });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch notifications" });
    }
  }

  // ---------------- GET NOTIFICATIONS BY USER ----------------
  public static async getByUser(req: Request, res: Response) {
    try {
      const { user_id } = req.params;
      if (!user_id) return res.status(400).json({ success: false, message: "user_id is required" });

      const requestingUser = (req as any).user;
      const adminRoles = ["Admin", "SuperAdmin"];
      const isAdmin = requestingUser && adminRoles.includes(requestingUser.role_name);

      if (!isAdmin && requestingUser?.id !== user_id) {
        return res.status(403).json({ success: false, message: "You are not authorized to view another user's notifications." });
      }
      const notifications = await uniqueService.getDataByField(TABLE, "user_id", user_id as string);
      return res.json({ success: true, message: "Notifications fetched successfully", data: notifications });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err) });
    }
  }

  // ---------------- GET PENDING NOTIFICATIONS ----------------
  public static async getPending(req: Request, res: Response) {
    try {
      const limit = Number(req.query.limit) || 20;

      const notifications = await uniqueService.getDataByField(TABLE, "status", "PENDING");
      const limited = notifications.slice(0, limit);

      return res.json({ success: true, message: "Pending notifications fetched successfully", data: limited });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: normalizeSupabaseError(err) });
    }
  }

  // ---------------- MARK NOTIFICATION AS SENT ----------------
  public static async markSent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, message: "id is required" });

      const requestingUser = (req as any).user;
      const adminRoles = ["Admin", "SuperAdmin"];
      const isAdmin = requestingUser && adminRoles.includes(requestingUser.role_name);

      if (!isAdmin) {
        const notification = await uniqueService.getDataById(id as string, TABLE);
        if (!notification) {
          return res.status(404).json({ success: false, message: "Notification not found" });
        }
        if (notification.user_id !== requestingUser?.id) {
          return res.status(403).json({ success: false, message: "You are not authorized to update this notification." });
        }
      }

      const updated = await uniqueService.updateById(TABLE, id as string, {
        status: "SENT",
        sent_at: new Date().toISOString(),
        error_message: null,
      });

      return res.json({ success: true, message: "Notification marked as sent", data: updated });
    } catch (err: any) {
      let msg = normalizeSupabaseError(err);
      if (typeof msg !== "string") {
        msg = err?.message || JSON.stringify(msg) || "Unknown error";
      }
      return res.status(400).json({ success: false, message: msg });
    }
  }

  // ---------------- MARK NOTIFICATION AS READ ----------------
  public static async markRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, message: "id is required" });

      const requestingUser = (req as any).user;
      const adminRoles = ["Admin", "SuperAdmin"];
      const isAdmin = requestingUser && adminRoles.includes(requestingUser.role_name);

      if (!isAdmin) {
        const notification = await uniqueService.getDataById(id as string, TABLE);
        if (!notification) {
          return res.status(404).json({ success: false, message: "Notification not found" });
        }
        if (notification.user_id !== requestingUser?.id) {
          return res.status(403).json({ success: false, message: "You are not authorized to update this notification." });
        }
      }

      const updated = await uniqueService.updateById(TABLE, id as string, {
        status: "READ",
        updated_at: new Date().toISOString(),
      });

      return res.json({ success: true, message: "Notification marked as read", data: updated });
    } catch (err: any) {
      let msg = normalizeSupabaseError(err);
      if (typeof msg !== "string") {
        msg = err?.message || JSON.stringify(msg) || "Unknown error";
      }
      return res.status(400).json({ success: false, message: msg });
    }
  }

  // ---------------- MARK NOTIFICATION AS FAILED ----------------
  public static async markFailed(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { error_message } = req.body;

      if (!id || !error_message) {
        return res.status(400).json({ success: false, message: "id and error_message are required" });
      }

      const updated = await uniqueService.updateById(TABLE, id as string, {
        status: "FAILED",
        error_message,
      });

      return res.json({ success: true, message: "Notification marked as failed", data: updated });
    } catch (err: any) {
      let msg = normalizeSupabaseError(err);
      if (typeof msg !== "string") {
        msg = err?.message || JSON.stringify(msg) || "Unknown error";
      }
      return res.status(400).json({ success: false, message: msg });
    }
  }
}

export const notificationController = {
  create: NotificationController.create,
  getById: NotificationController.getById,
  delete: NotificationController.delete,
  getList: NotificationController.getList,
  getByUser: NotificationController.getByUser,
  getPending: NotificationController.getPending,
  markSent: NotificationController.markSent,
  markRead: NotificationController.markRead,
  markFailed: NotificationController.markFailed,
};
