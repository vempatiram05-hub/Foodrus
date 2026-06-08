import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import FormData from "form-data";
import { logger } from "./logger";

/* ============================================================
   MAILGUN REST API — NO SMTP, NO NODEMAILER
   Env vars required: MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM_EMAIL
   ============================================================ */

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || "";
const MAILGUN_DOMAIN  = process.env.MAILGUN_DOMAIN  || "";
const MAILGUN_FROM    = process.env.MAILGUN_FROM_EMAIL || `noreply@${MAILGUN_DOMAIN}`;
const MAILGUN_BASE    = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`;

/* ---- Core sender: posts a FormData payload to Mailgun Messages API ---- */
async function mailgunPost(form: FormData): Promise<any> {
  const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");
  const res = await axios.post(MAILGUN_BASE, form, {
    headers: { Authorization: `Basic ${auth}`, ...form.getHeaders() },
  });
  return res.data;
}

/* ---- Simple HTML send (no attachment) ---- */
export async function sendHtmlEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<any> {
  const form = new FormData();
  form.append("from",    MAILGUN_FROM);
  form.append("to",      Array.isArray(to) ? to.join(",") : to);
  form.append("subject", subject);
  form.append("html",    html);
  const result = await mailgunPost(form);
  logger.info(`[Mailgun] "${subject}" sent`, { messageId: result.id });
  return result;
}

/* ============================================================
   OTP UTILITIES
   ============================================================ */

export const generateOTP = (expiryMinutes = 15) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otp_expires_at = new Date(Date.now() + expiryMinutes * 60 * 1000);
  return { otp, otp_expires_at };
};

export const sendOTPToEmail = async (to: any, otp: any) => {
  const html = `
    <div style="font-family:'Poppins',Arial,sans-serif; color:#2b2b2b; background:#fafafa; padding:20px; border-radius:10px;">
      <h2 style="color:#ff5722; margin-bottom:10px;">HiFoode – Email Verification</h2>
      <p>Thank you for joining <strong>HiFoode</strong>! To verify your email, please use the OTP given below:</p>
      <div style="font-size:2em; font-weight:700; margin:25px 0; color:#2977d0; letter-spacing:3px;">${otp}</div>
      <p>If you didn't request this OTP, please ignore this email — your account is safe.</p>
      <p>Need help? Just reply to <strong>${MAILGUN_FROM}</strong>. Our support team is always here for you!</p>
      <p style="margin-top:20px;">Warm regards,<br/><strong>The HiFoode Team</strong></p>
    </div>`;
  await sendHtmlEmail(to, "HiFoode Registration OTP – Verify Your Email", html);
};

export const sendForgotPasswordEmail = async (to: any, otp: any) => {
  const html = `
    <div style="font-family:'Poppins',Arial,sans-serif; color:#2b2b2b; background:#fafafa; padding:20px; border-radius:10px;">
      <h2 style="color:#ff5722; margin-bottom:10px;">Forgot your password? No worries!</h2>
      <p>We received a request to reset your <strong>HiFoode</strong> account password. Use the OTP below:</p>
      <div style="font-size:2em; font-weight:700; margin:25px 0; color:#2261ff; letter-spacing:3px;">${otp}</div>
      <p>This OTP is valid for <strong>1 minute</strong>.</p>
      <p>If you didn't request a password reset, simply ignore this email — your account remains secure.</p>
      <p style="margin-top:20px;">With best regards,<br/><strong>The HiFoode Team</strong></p>
    </div>`;
  await sendHtmlEmail(to, "HiFoode Password Reset – We're Here to Help!", html);
};

/* ============================================================
   ORDER PLACED — ROLE-BASED NOTIFICATION
   ============================================================ */

export const sendOrderPlacedEmail = async ({
  to,
  role,
  orderNumber,
  totalAmount,
  items,
}: {
  to: string;
  role: "customer" | "store_admin" | "master_admin";
  orderNumber: string;
  totalAmount: number;
  items?: { name: string; quantity: number; price: number }[];
}) => {
  let subject = "";
  let message = "";

  switch (role) {
    case "customer":
      subject = `Your Order ${orderNumber} is Confirmed 🎉`;
      message = `
        <p>Your order <strong>${orderNumber}</strong> has been placed successfully.</p>
        <p>Total Amount: <strong>$${totalAmount}</strong></p>
      `;
      break;
    case "store_admin":
      subject = `New Order Received – ${orderNumber}`;
      message = `
        <p>You have received a new order for your store.</p>
        <p>Order Number: <strong>${orderNumber}</strong></p>
        <ul>
          ${items?.map(i => `<li>${i.name} x ${i.quantity} = $${i.price * i.quantity}</li>`).join("") ?? ""}
        </ul>
        <p>Subtotal for your store: <strong>$${totalAmount}</strong></p>
      `;
      break;
    case "master_admin":
      subject = `New Order Placed – ${orderNumber}`;
      message = `
        <p>A new order has been placed on the platform.</p>
        <p>Order Number: <strong>${orderNumber}</strong></p>
        <p>Total Amount: <strong>$${totalAmount}</strong></p>
      `;
      break;
  }

  const html = `
    <div style="font-family:Poppins,Arial,sans-serif; padding:10px;">
      <h2 style="color:#ff5722;">HiFoode</h2>
      ${message}
      <p style="margin-top:20px;">Regards,<br/><strong>HiFoode Team</strong></p>
    </div>`;

  await sendHtmlEmail(to, subject, html);
};

/* ============================================================
   SMS — ClickSend (unchanged)
   ============================================================ */

export async function sendSMS(phone: string, message: string) {
  try {
    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
    const auth = Buffer.from(
      `${process.env.CLICKSEND_USERNAME}:${process.env.CLICKSEND_API_KEY}`
    ).toString("base64");

    logger.info("Sending SMS", { to: formattedPhone });
    const response = await axios.post(
      "https://rest.clicksend.com/v3/sms/send",
      {
        messages: [{ source: "nodejs", body: message, to: formattedPhone }],
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );
    logger.info("SMS sent successfully", { status: response.data?.response_code });
  } catch (error: any) {
    logger.error("SMS send failed", { error: error.response?.data || error.message });
  }
}

/* ============================================================
   INVOICE EMAIL — Mailgun API with PDF attachment
   ============================================================ */

export const sendInvoiceEmail = async (
  emails: string[],
  order: any,
  orderItems: any[],
  invoicePath: string,
  address?: any,
  customer?: any,
  customTotals?: { subtotal: number; tax: number; deliveryFee: number; discount: number; total: number }
) => {
  try {
    /* --- Validate emails --- */
    const validEmails = emails.filter((e) => e && e.includes("@"));
    if (validEmails.length === 0) {
      logger.warn("sendInvoiceEmail: no valid email addresses provided");
      return;
    }

    /* --- Check invoice file --- */
    if (!fs.existsSync(invoicePath)) {
      logger.warn("sendInvoiceEmail: invoice file not found", { invoicePath });
      return;
    }

    /* --- Build item rows --- */
    let itemsHtmlRows = "";
    orderItems.forEach((item, index) => {
      const name      = item.name || item.product_name || item.menu_name || "";
      const qty       = item.quantity || 0;
      const unitPrice = item.unit_price || item.price || 0;
      const totalPrice = qty * unitPrice;

      itemsHtmlRows += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: center; color: #555;">${index + 1}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: left;">${name}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${qty}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: right; white-space: nowrap;">$${unitPrice.toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: right; white-space: nowrap;">$${totalPrice.toFixed(2)}</td>
        </tr>
      `;
    });

    /* --- Build cost breakdown --- */
    const subtotal    = customTotals?.subtotal    ?? order.subtotal_amount  ?? 0;
    const tax         = customTotals?.tax         ?? order.tax_amount       ?? 0;
    const deliveryFee = customTotals?.deliveryFee ?? order.delivery_fee     ?? 0;
    const discount    = customTotals?.discount    ?? order.discount_amount  ?? 0;
    const finalTotal  = customTotals?.total       ?? order.total_amount     ?? 0;

    const breakdownHtml = `
      <tr>
        <td colspan="4" style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #666;">Subtotal</td>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #666; font-weight: 500;">$${subtotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="4" style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #666;">Tax</td>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #666;">$${tax.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="4" style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #666;">Delivery Fee</td>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #666;">$${deliveryFee.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="4" style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #ff5722; font-weight: 500;">Discount</td>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #ff5722; font-weight: bold;">- $${discount.toFixed(2)}</td>
      </tr>
      <tr style="background-color: #fbfbfb; font-weight: bold;">
        <td colspan="4" style="border: 1px solid #ddd; padding: 15px; text-align: right; font-size: 1.2em; color: #000;">Total</td>
        <td style="border: 1px solid #ddd; padding: 15px; text-align: right; font-size: 1.2em; color: #000; white-space: nowrap;">$${finalTotal.toFixed(2)}</td>
      </tr>
    `;

    /* --- Build address block --- */
    let addressHtml = "";
    if (address) {
      addressHtml = `
        <div style="margin-top: 20px; font-size: 0.9em; padding: 15px; background-color: #fcfcfc; border: 1px solid #efefef; border-radius: 4px;">
          <strong style="color: #2b2b2b;">Delivery Address:</strong><br/>
          <div style="margin-top: 5px; color: #555; line-height: 1.5;">
            ${address.line1 || ""}${address.line2 ? "<br/>" + address.line2 : ""}<br/>
            ${address.city || ""}, ${address.state || ""} ${address.postal_code || ""}
          </div>
        </div>
      `;
    }

    /* --- Build HTML body --- */
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <h2 style="color: #ff5722; text-align: center; margin-bottom: 30px; font-size: 24px;">HiFoode – Order Invoice</h2>
        <p style="font-size: 16px;">Hi ${customer?.full_name || "Customer"},</p>
        <p style="font-size: 14px; color: #555;">Thank you for your order! Your invoice details are listed below for your reference.</p>
        <p style="margin-top: 20px;"><strong>Order ID:</strong> <span style="color: #2b2b2b;">${order.order_number}</span></p>
        ${addressHtml}
        <table style="width: 100%; border-collapse: collapse; margin-top: 25px; border: 1px solid #ddd; font-size: 13px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center; width: 40px; color: #2b2b2b;">S.No</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left; color: #2b2b2b;">Product</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center; width: 50px; color: #2b2b2b;">Qty</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right; width: 90px; color: #2b2b2b;">Unit Price</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right; width: 90px; color: #2b2b2b;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtmlRows}
            ${breakdownHtml}
          </tbody>
        </table>
        <p style="margin-top: 30px; font-size: 14px; text-align: center; color: #444;">Please find the PDF invoice attached to this email.</p>
        <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
          <p style="font-size: 16px; font-weight: bold; color: #ff5722; margin-bottom: 5px;">Thank you for ordering with us!</p>
          <p style="font-size: 13px; color: #888;">Warm regards, The HiFoode Team</p>
        </div>
      </div>`;

    /* --- Send via Mailgun API with PDF attachment --- */
    const form = new FormData();
    form.append("from",    MAILGUN_FROM);
    form.append("to",      validEmails.join(","));
    form.append("subject", `Invoice for Order ${order.order_number}`);
    form.append("html",    htmlBody);
    form.append(
      "attachment",
      fs.createReadStream(invoicePath),
      { filename: path.basename(invoicePath), contentType: "application/pdf" }
    );

    const result = await mailgunPost(form);
    logger.info("Invoice email sent", { messageId: result.id, orderNumber: order.order_number });
    return result;

  } catch (error: any) {
    logger.error("Invoice email failed", { error: error?.response?.data || error.message });
    throw error;
  }
};
