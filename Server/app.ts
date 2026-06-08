import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import path from "node:path";
import { logger } from "./src/utils/logger";
import { AppError } from "./src/errors/AppError";
import { DBconnection } from "./src/config/DBConnect";
import { requestId } from "./src/middleware/requestId";
import { requestLogger } from "./src/middleware/requestLogger";

import UserRouter from "./src/routes/user.routes";
import addressRoutes from "./src/routes/address.routes";
import categoryRoutes from "./src/routes/category.routes";
import templateRoutes from "./src/routes/template.routes";
import partyRoutes from "./src/routes/party.routes";
import subcategoryRoutes from "./src/routes/subcategory.routes";
import brandRoutes from "./src/routes/brands.routes";
import Regionrouter from "./src/routes/region.routes";
import StoreRouter from "./src/routes/store.routes";
import productrouter from "./src/routes/product.routes";
import OrderRouter from "./src/routes/order.routes";
import PaymentMethodRouter from "./src/routes/paymentMethod.routes";
import PaymentRouter from "./src/routes/payment.routes";
import timeSlotRoutes from "./src/routes/timeSlot.routes";
import menuRouter from "./src/routes/menu.routes";
import variantRoutes from "./src/routes/variant.routes";
import cartRouter from "./src/routes/cart.routes";
import cartItemsRoutes from "./src/routes/cartItem.routes";
import inventoryRoutes from "./src/routes/inventory.routes";
import productChangeLogsRouter from "./src/routes/productChangeLogs.routes";
import deliveryZonesRouter from "./src/routes/delivery-zones.routes";
import subscriptionPlanRoutes from "./src/routes/subscription-plans.routes";
import userSubscriptionRoutes from "./src/routes/user-subscriptions.routes";
import subscriptionDeliveryRoutes from "./src/routes/subscription-delivery.routes";
import deliverpartnerRoutes from "./src/routes/deliveryPartner.routes";
import orderDeliveryAssignmentRoutes from "./src/routes/orderDeliveryAssignment.routes";
import deliveryLocationRoutes from "./src/routes/deliveryLocation.routes";
import NotificationChannelRouter from "./src/routes/notificationChannel.routes";
import notificationRoutes from "./src/routes/notification.routes";
import auditLogRoutes from "./src/routes/auditLog.routes";
import refundRouter from "./src/routes/refunds.routes";
import orderItemsRouter from "./src/routes/orderItems.routes";
import orderStatusHistoryRouter from "./src/routes/orderStatusHistory.route";
import statsRouter from "./src/routes/stats.routes";
import analyticsRouter from "./src/routes/analytics.routes";
import reportsRouter from "./src/routes/reports.routes";
import routes from "./src/routes/index";
import LocationRouter from "./src/routes/location.routes";
import { generalLimiter, authLimiter } from "./src/middleware/rateLimiter";
import { sanitizeBody } from "./src/middleware/sanitize";



const app = express();

const isProduction = process.env.NODE_ENV === "production";

// Trust exactly 1 proxy hop in production so req.ip reflects the real client IP.
// Without this, rate limiting counts the load balancer IP instead of the user's IP.
app.set("trust proxy", 1);

// Attach a unique correlation ID to every request (reads/propagates X-Request-ID header)
app.use(requestId);

app.use(helmet());

// Compress all JSON/text responses — reduces bandwidth 5-10x for list endpoints
app.use(compression());

if (isProduction && !process.env.ALLOWED_ORIGINS) {
  throw new Error("ALLOWED_ORIGINS env var must be set in production");
}

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "http://localhost:3000"
).split(",").map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin) only in non-production
    if (!origin) {
      return callback(null, !isProduction);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
        callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeBody);

// HTTP access log — logs method, url, status, duration, userId, requestId
app.use(requestLogger);

// General rate limiter: 500 req per 15 min per IP across all API routes
app.use(["/api"], generalLimiter);

app.use(routes);

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "src", "uploads"))
);

// Strict rate limiter on auth endpoints: 10 req per 15 min per IP
app.use(
  [
    "/api/users/login",
    "/api/users/register",
    "/api/users/forgot-password",
    "/api/users/send-login-otp",
    "/api/users/verify-login-otp",
    "/api/users/validateOTP",
    "/api/users/resend-otp",
    "/api/users/update-password",
    "/api/users/forgot-identifier/send-otp",
    "/api/users/forgot-identifier/validate-otp",
  ],
  authLimiter
);
app.use("/api/users", UserRouter);
app.use("/api/categories", categoryRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/subcategories", subcategoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/products", productrouter);
app.use("/api/addresses", addressRoutes);
app.use("/api/locations", LocationRouter);
app.use("/api/regions", Regionrouter);
app.use("/api/stores", StoreRouter);
app.use("/api/orders", OrderRouter);
app.use("/api/paymentMethods", PaymentMethodRouter);
app.use("/api/payments", PaymentRouter);
app.use("/api/time-slots", timeSlotRoutes);
app.use("/api/menus", menuRouter);
app.use("/api/party", partyRoutes);
app.use("/api/variants", variantRoutes);
app.use("/api/carts", cartRouter);
app.use("/api/cart-items", cartItemsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/product-change-logs", productChangeLogsRouter);
app.use("/api/delivery-zones", deliveryZonesRouter);
app.use("/api/subscription-plans", subscriptionPlanRoutes);
app.use("/api/user-subscriptions", userSubscriptionRoutes);
app.use("/api/subscription-deliveries", subscriptionDeliveryRoutes);
app.use("/api/delivery-partners", deliverpartnerRoutes);
app.use("/api/order-delivery-assignments", orderDeliveryAssignmentRoutes);
app.use("/api/delivery-locations", deliveryLocationRoutes);
app.use("/api/notification-channels", NotificationChannelRouter);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/refunds", refundRouter);
app.use("/api/order-items", orderItemsRouter);
app.use("/api/order-status-history", orderStatusHistoryRouter);
app.use("/api/stats", statsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/reports", reportsRouter);



// Health check — includes DB connectivity verification
app.get("/health", async (req: Request, res: Response) => {
  const checks: Record<string, string> = {};
  try {
    const { error } = await DBconnection.from("users").select("id").limit(1);
    checks.database = error ? "error" : "ok";
  } catch {
    checks.database = "error";
  }
  const allOk = Object.values(checks).every((v) => v === "ok");
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
    uptime: Math.floor(process.uptime()),
    checks,
  });
});

app.get("/liveness", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/readiness", async (_req: Request, res: Response) => {
  try {
    const { error } = await DBconnection.from("users").select("id").limit(1);
    if (error) throw error;
    res.status(200).json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not ready", reason: "database unavailable" });
  }
});

// Centralized error handler
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const isOperational = isAppError ? err.isOperational : false;
  const message = isOperational ? err.message : "Internal server error";
  const code = isAppError ? err.code : "INTERNAL_ERROR";

  logger.error("Unhandled error", {
    requestId: req.id,
    message: err.message,
    code: err.code,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: (req as any).user?.id,
  });

  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(err.errors && { errors: err.errors }),
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

export default app;
