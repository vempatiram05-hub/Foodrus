
import { normalizeSupabaseError } from "../utils/supabaseError";
import { Request, Response, NextFunction } from "express";
import { UniqueService } from "../services/unique.service";
import { UniqueController } from "./unique.controller";
import { createHelcimPayment, initHelcimSession, tokenizeCard } from "../services/helcim.service";
import type { JwtPayload } from "../utils/token";
import { logger } from "../utils/logger";
import { generateAndSendOrderInvoice } from "../services/invoice.service";

import { getQueryNumber, getQueryString } from "../utils/queryParser";

const TABLE = "payments";
const PAYMENT_METHOD_TABLE = "payment_methods";
const uniquePaymentController = new UniqueController(TABLE);
const uniqueService = new UniqueService();

export default class PaymentController {

  /* CREATE PAYMENT */

  static async create(req: Request, res: Response, next: NextFunction) {
    try {

      const allowedFields = [
        "order_id",
        "payment_method_id",
        "amount",
        "currency",
        "status",
        "provider_payment_id",
        "notes"
      ];

      const payload: Record<string, any> = {};

      for (const field of allowedFields) {
        if (Object.hasOwn(req.body, field)) {
          payload[field] = req.body[field];
        }
      }

      // Required validation
      if (!payload.order_id || !payload.payment_method_id || !payload.amount) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: order_id, payment_method_id, amount."
        });
      }

      // Get payment method
      const paymentMethods = await uniqueService.getDataByField(
        PAYMENT_METHOD_TABLE,
        "id",
        payload.payment_method_id
      );

      const paymentMethod = paymentMethods?.[0];
      logger.info("Payment Method:", paymentMethod);

      if (!paymentMethod) {
        return res.status(404).json({
          success: false,
          message: "Payment method not found"
        });
      }

      // Get user for name
      const users = await uniqueService.getDataByField("users", "id", paymentMethod.user_id);
      const user = users?.[0];

      // Get user's address for billing
      const addresses = await uniqueService.getDataByField("addresses", "user_id", paymentMethod.user_id);
      const userAddress = addresses.find((a: any) => a.is_default) || addresses[0];

      const billingAddress = {
        name: user?.full_name || "Guest Customer",
        street1: userAddress?.line1 || "123 Main St",
        city: userAddress?.city || "New York",
        province: userAddress?.state || "NY",
        postalCode: userAddress?.postal_code || "10001",
        country: "USA", // ✅ FIXED
      };
      let helcimResponse: any;
      try {
        // 🔥 Helcim API call
        helcimResponse = await createHelcimPayment({
          amount: payload.amount,
          currency: payload.currency || "USD",
          cardData: { cardToken: paymentMethod.token_reference },
          billingAddress,
        });
      } catch (paymentErr: any) {
        logger.error("Payment Error:", paymentErr);
        // Update order to failed
        await uniqueService.updateById("orders", payload.order_id, {
          order_status: "CANCELLED",
          payment_status: "failed"
        });

        return res.status(500).json({
          success: false,
          message: paymentErr.message || "Payment failed",
        });
      }

      logger.info("Helcim Response:", helcimResponse);

      const isApproved = helcimResponse.status === "APPROVED";

      if (isApproved) {
        // Update order to paid
        await uniqueService.updateById("orders", payload.order_id, {
          order_status: "PENDING",
          payment_status: "paid"
        });
      } else {
        // Update order to failed
        await uniqueService.updateById("orders", payload.order_id, {
          order_status: "CANCELLED",
          payment_status: "failed"
        });
      }

      // Fill response values
      payload.provider_payment_id = helcimResponse.transactionId;
      payload.status = helcimResponse.status || (isApproved ? "APPROVED" : "FAILED");
      payload.currency = payload.currency || "USD";

      const created = await uniqueService.create(TABLE, payload);
      logger.info("Created Payment Record:", created);

      if (!isApproved) {
        return res.status(400).json({
          success: false,
          message: "Payment was not approved",
          data: created
        });
      }

      // Generate and send invoice now that payment is confirmed
      try {
        await generateAndSendOrderInvoice(payload.order_id);
      } catch (invoiceErr: any) {
        logger.warn("[Invoice] Invoice generation failed after payment:", { error: invoiceErr.message });
      }

      return res.status(201).json({
        success: true,
        message: "Payment processed successfully",
        data: created
      });

    } catch (err: any) {
      logger.error("FULL ERROR:", err);

      return res.status(500).json({
        success: false,
        message: err.message || "An unexpected error occurred",
      });
    }
  }


  /* UPDATE PAYMENT */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ success: false, message: "Invalid or missing payment id." });
      }
      // Only allow specific fields
      const allowedFields = [
        "order_id",
        "payment_method_id",
        "amount",
        "currency",
        "status",
        "provider_payment_id",
        "notes"
      ];
      const payload: Record<string, any> = {};
      for (const field of allowedFields) {
        if (Object.hasOwn(req.body, field)) {
          payload[field] = req.body[field];
        }
      }
      const updated = await uniqueService.updateById(TABLE, id, payload);
      return res.json({
        success: true,
        message: "Payment updated successfully",
        data: updated,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(err.message === "Record not found" ? 404 : 400).json({
        success: false,
        message:
          error.message === "Record not found"
            ? "Sorry, we couldn't find a payment to update with that ID."
            : error?.message ||
            "Unable to update payment. Please check your input and try again.",
      });
    }
  }
  /* GET PAYMENT BY ID */
  static getById(req: Request, res: Response, next: NextFunction) {
    return uniquePaymentController.getById(req, res);
  }
  /* DELETE PAYMENT */
  static delete(req: Request, res: Response, next: NextFunction) {
    return uniquePaymentController.deleteById(req, res);
  }

  /* GET LIST — supports optional search, paginated if page/limit provided, otherwise returns all records */
  static async getList(req: Request, res: Response) {
    try {
      const callerUser = req.user as JwtPayload | undefined;
      const role = callerUser?.role_name;
      const search = (getQueryString(req.query, "search") || "").trim().toLowerCase();
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

      const searchColumns = ["status", "currency", "provider_payment_id"];

      // Fetch all payments, then apply role-based scoping
      let allData = await uniqueService.getAllData(TABLE);

      if (role === "Customer") {
        // Only payments whose order belongs to this customer
        const customerOrders = await uniqueService.getDataByField("orders", "user_id", callerUser!.id);
        const orderIds = new Set(customerOrders.map((o: any) => o.id));
        allData = allData.filter((p: any) => orderIds.has(p.order_id));
      } else if (role === "StoreAdmin" || role === "Employee") {
        // Only payments whose order belongs to this store
        const storeAdminId = role === "StoreAdmin" ? callerUser!.id : callerUser!.store_admin_id;
        if (!storeAdminId) {
          allData = [];
        } else {
          const stores = await uniqueService.getDataByField("stores", "store_admin_id", storeAdminId);
          const storeIds = stores.map((s: any) => s.id);
          if (storeIds.length === 0) {
            allData = [];
          } else {
            const orderArrays = await Promise.all(
              storeIds.map((sid: string) => uniqueService.getDataByField("orders", "store_id", sid))
            );
            const orderIds = new Set(orderArrays.flat().map((o: any) => o.id));
            allData = allData.filter((p: any) => orderIds.has(p.order_id));
          }
        }
      }
      // Admin/SuperAdmin: no additional filtering

      if (search) {
        allData = allData.filter((c: any) =>
          searchColumns.some(col => c[col]?.toString().toLowerCase().includes(search))
        );
      }

      const total = allData.length;

      if (isPaginated) {
        const page = getQueryNumber(req.query, "page", 1);
        const limit = getQueryNumber(req.query, "limit", 10);
        const from = (page - 1) * limit;
        const data = allData.slice(from, from + limit);

        return res.json({
          success: true,
          message: data.length ? "Payments fetched successfully" : "No records found",
          data,
          total,
          page,
          limit,
        });
      }

      return res.json({
        success: true,
        message: total ? "Payments fetched successfully" : "No records found",
        data: allData,
        total,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Failed to fetch payments" });
    }
  }


  /* TOKENIZE CARD — accepts raw card data, returns a Helcim card token */
  static async tokenizeCard(req: Request, res: Response) {
    try {
      const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName } = req.body;
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: cardNumber, expiryMonth, expiryYear, cvv.",
        });
      }
      const result = await tokenizeCard({ cardNumber, expiryMonth, expiryYear, cvv, cardholderName });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      logger.error("tokenizeCard error", { message: err.message });
      return res.status(500).json({
        success: false,
        message: err.message || "Card verification failed.",
      });
    }
  }

  /* INIT HELCIM PAY SESSION */
  static async helcimSession(req: Request, res: Response) {
    try {
      const {
        paymentType = "verify",
        amount = 0,
        currency = "USD",
      } = req.body;
      const session = await initHelcimSession({ paymentType, amount, currency });
      return res.json({ success: true, data: session });
    } catch (err: any) {
      logger.error("helcimSession error", { message: err.message });
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to initialize Helcim payment session",
      });
    }
  }

  /* GET BY ORDER ID */
  static async getByOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      if (!orderId || typeof orderId !== "string") {
        return res.status(400).json({ success: false, message: "orderId is required and must be a string" });
      }
      const payments = await uniqueService.getDataByField(TABLE, "order_id", orderId);
      return res.json({
        success: true,
        message: "Payments retrieved successfully for this order",
        data: payments,
      });
    } catch (err: any) {
      const error = normalizeSupabaseError(err);
      return res.status(500).json({
        success: false,
        message: error.message || "Unable to retrieve payments for this order. Please try again later.",
      });
    }
  }
}

