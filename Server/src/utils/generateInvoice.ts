import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import bwipjs from "bwip-js";
import { logger } from "./logger";

/** Helper to generate barcode buffer using Code 128 */
const generateBarcode = (text: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128", // Barcode type
        text: text, // Text to encode
        scale: 2, // Scaling factor
        height: 10, // Bar height, in millimeters
        includetext: true, // Show human-readable text
        textxalign: "center", // Center text
      },
      (err, png) => {
        if (err) reject(err);
        else resolve(png);
      }
    );
  });
};

export const generateInvoice = (
  order: any,
  orderItems: any[],
  customer?: any,
  address?: any
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    const invoicesDir = path.join(process.cwd(), "invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const invoicePath = path.join(
      invoicesDir,
      `invoice-${order.order_number}.pdf`
    );

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(invoicePath);
    doc.pipe(stream);

    // Font setup
    const boldFont = path.join(process.cwd(), "src/fonts/NotoSans-Bold.ttf");
    const regularFont = path.join(process.cwd(), "src/fonts/NotoSans-Regular.ttf");

    const activeFont = fs.existsSync(regularFont) ? regularFont : "Helvetica";
    const activeBoldFont = fs.existsSync(boldFont) ? boldFont : "Helvetica-Bold";

    // --- LOGO / PLATFORM NAME ---
    doc.font(activeBoldFont).fontSize(26).fillColor("#ff5722").text("HiFoode", 50, 40);
    doc.font(activeFont).fontSize(9).fillColor("#666").text("Smart Food Delivery Platform", 50, 70);
    doc.text("support@hifoode.com", 50, 83);

    // --- INVOICE HEADER (Top Right) ---
    doc.font(activeBoldFont).fontSize(24).fillColor("#2b2b2b").text("INVOICE", 400, 40, { align: "right" });
    
    // --- TOP RIGHT: BARCODE ---
    try {
      const barcodeBuffer = await generateBarcode(order.order_number);
      doc.image(barcodeBuffer, 460, 75, { width: 90 });
    } catch (err) {
      logger.error("Barcode generation failed", { error: (err as Error).message });
      // Fallback: draw a simple line or just skip
      doc.fontSize(8).text(order.order_number, 460, 75);
    }

    // --- SEPARATOR LINE ---
    doc.moveTo(50, 115).lineTo(550, 115).lineWidth(0.5).strokeColor("#eee").stroke();

    // --- INFO SECTION (Bill To & Order Details) ---
    // Left: Bill To
    const col1X = 50;
    const infoY = 135;
    doc.font(activeBoldFont).fontSize(10).fillColor("#2b2b2b").text("BILL TO", col1X, infoY);
    doc.font(activeBoldFont).fontSize(11).fillColor("#000").text(customer?.full_name || "Customer", col1X, infoY + 18);
    
    doc.font(activeFont).fontSize(9).fillColor("#444");
    let currentAddressY = infoY + 34;
    if (address) {
      doc.text(address.line1 || "", col1X, currentAddressY, { width: 220 });
      currentAddressY += (doc.heightOfString(address.line1 || "", { width: 220 }) || 10) + 2;
      if (address.line2) {
        doc.text(address.line2, col1X, currentAddressY, { width: 220 });
        currentAddressY += 12;
      }
      doc.text(`${address.city || ""}, ${address.state || ""} ${address.postal_code || ""}`, col1X, currentAddressY);
      currentAddressY += 12;
    }
    doc.text(customer?.email || "", col1X, currentAddressY);
    if (customer?.phone) {
      doc.text(customer.phone, col1X, currentAddressY + 12);
    }

    // Right: From & Order Info
    const col2X = 420;

    doc.font(activeBoldFont).fontSize(10).fillColor("#2b2b2b").text("FROM", col2X, infoY);
    doc.font(activeFont).fontSize(9).fillColor("#444");
    doc.text("HiFoode Platform", col2X, infoY + 18);
    doc.text("HiFoodie Tech Solutions", col2X, infoY + 31);
    doc.text("Hyderabad, Telangana", col2X, infoY + 44);
    doc.text("India - 500081", col2X, infoY + 57);
    doc.text("Phone: 7864356864", col2X, infoY + 70);

    const orderDetailsY = infoY + 95;
    doc.font(activeBoldFont).fontSize(10).fillColor("#2b2b2b").text("ORDER DETAILS", col2X, orderDetailsY);
    
    doc.font(activeBoldFont).fontSize(9).fillColor("#444").text("Invoice No:", col2X, orderDetailsY + 18, { continued: true });
    doc.font(activeFont).text(`  ${order.order_number.split('-')[1] || order.order_number}`);
    
    doc.font(activeBoldFont).text("Order Date:", col2X, orderDetailsY + 31, { continued: true });
    const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString() : new Date().toLocaleDateString();
    doc.font(activeFont).text(`  ${orderDate}`);
    
    doc.font(activeBoldFont).text("Payment Status:", col2X, orderDetailsY + 44, { continued: true });
    doc.font(activeFont).text(`  ${(order.payment_status || "PENDING").toUpperCase()}`);
    
    doc.font(activeBoldFont).text("Order Status:", col2X, orderDetailsY + 57, { continued: true });
    doc.font(activeFont).text(`  ${(order.order_status || "confirmed").toUpperCase()}`);

    // --- TABLE HEADER ---
    const tableTop = Math.max(currentAddressY + 40, orderDetailsY + 90);
    doc.save();
    doc.rect(50, tableTop, 500, 25).fill("#c1e3dfcf");
    doc.font(activeBoldFont).fontSize(10).fillColor("#2b2b2b");
    doc.text("S.No", 50, tableTop + 8, { width: 40, align: "center" });
    doc.text("Product", 100, tableTop + 8);
    doc.text("Qty", 350, tableTop + 8, { width: 50, align: "center" });
    doc.text("Unit Price", 420, tableTop + 8, { width: 60, align: "right" });
    doc.text("Total", 500, tableTop + 8, { width: 50, align: "right" });
    doc.restore();

    doc.moveTo(50, tableTop + 25).lineTo(550, tableTop + 25).lineWidth(1).strokeColor("#000").stroke();

    // --- TABLE ROWS ---
    let y = tableTop + 33;
    doc.font(activeFont).fontSize(9.5).fillColor("#333");
    
    orderItems.forEach((item, index) => {
      const name = item.name || item.product_name || item.menu_name || "";
      const qty = item.quantity || 0;
      const price = item.unit_price || item.price || 0;
      const total = qty * price;

      const nameHeight = doc.heightOfString(name, { width: 230 }) || 12;
      
      doc.text((index + 1).toString(), 50, y, { width: 40, align: "center" });
      doc.text(name, 100, y, { width: 230 });
      doc.text(qty.toString(), 350, y, { width: 50, align: "center" });
      doc.text(`$${price.toFixed(2)}`, 410, y, { width: 70, align: "right" });
      doc.text(`$${total.toFixed(2)}`, 500, y, { width: 50, align: "right" });

      const rowStep = Math.max(22, nameHeight + 12);
      y += rowStep;
      
      doc.moveTo(50, y - 6).lineTo(550, y - 6).lineWidth(0.2).strokeColor("#eee").stroke();
      
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
    });

    // --- TOTALS SECTION ---
    const totalsTop = y + 10;
    const subtotal = order.subtotal_amount || 0;
    const tax = order.tax_amount || 0;
    const deliveryFee = order.delivery_fee || 0;
    const discount = order.discount_amount || 0;
    const finalTotal = order.total_amount || 0;

    doc.font(activeFont).fontSize(10).fillColor("#666");
    doc.text("Subtotal", 380, totalsTop, { width: 100, align: "left" });
    doc.text(`$${subtotal.toFixed(2)}`, 480, totalsTop, { width: 70, align: "right" });

    doc.text("Tax", 380, totalsTop + 18, { width: 100, align: "left" });
    doc.text(`$${tax.toFixed(2)}`, 480, totalsTop + 18, { width: 70, align: "right" });

    doc.text("Delivery Fee", 380, totalsTop + 36, { width: 100, align: "left" });
    doc.text(`$${deliveryFee.toFixed(2)}`, 480, totalsTop + 36, { width: 70, align: "right" });

    doc.text("Discount", 380, totalsTop + 54, { width: 100, align: "left" });
    doc.font(activeBoldFont).fillColor("#ff5722");
    doc.text(`- $${discount.toFixed(2)}`, 480, totalsTop + 54, { width: 70, align: "right" });

    doc.moveTo(380, totalsTop + 72).lineTo(550, totalsTop + 72).lineWidth(1).strokeColor("#2b2b2b").stroke();

    doc.font(activeBoldFont).fontSize(13).fillColor("#000");
    doc.text("Total", 380, totalsTop + 85, { width: 100, align: "left" });
    doc.text(`$${finalTotal.toFixed(2)}`, 480, totalsTop + 85, { width: 70, align: "right" });
    
    // "Thank you" next to Total
    doc.font(activeBoldFont).fontSize(12).fillColor("#ff5722");
    doc.text("Thank you for ordering with us!", 50, totalsTop + 125, { width: 500, align: "center" });

    doc.end();
    stream.on("finish", () => resolve(invoicePath));
    stream.on("error", reject);
  });
};

export const generateStoreInvoice = (
  order: any,
  storeItems: any[],
  storeId: string,
  storeInfo: { name: string },
  customer?: any,
  address?: any
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    const invoicesDir = path.join(process.cwd(), "invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const invoicePath = path.join(
      invoicesDir,
      `invoice-${order.order_number}-store-${storeId}.pdf`
    );

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(invoicePath);
    doc.pipe(stream);

    const boldFont = path.join(process.cwd(), "src/fonts/NotoSans-Bold.ttf");
    const regularFont = path.join(process.cwd(), "src/fonts/NotoSans-Regular.ttf");
    const activeFont = fs.existsSync(regularFont) ? regularFont : "Helvetica";
    const activeBoldFont = fs.existsSync(boldFont) ? boldFont : "Helvetica-Bold";

    // --- LOGO / PLATFORM NAME ---
    doc.font(activeBoldFont).fontSize(26).fillColor("#ff5722").text("HiFoode", 50, 40);
    doc.font(activeFont).fontSize(9).fillColor("#666").text("Smart Food Delivery Platform", 50, 70);
    doc.text("support@hifoode.com", 50, 83);

    // --- INVOICE HEADER ---
    doc.font(activeBoldFont).fontSize(24).fillColor("#2b2b2b").text("STORE ORDER", 350, 40, { align: "right" });

    // --- BARCODE ---
    try {
      const barcodeBuffer = await generateBarcode(order.order_number);
      doc.image(barcodeBuffer, 460, 75, { width: 90 });
    } catch (err) {
      logger.error("Barcode generation failed", { error: (err as Error).message });
      doc.fontSize(8).text(order.order_number, 460, 75);
    }

    // --- SEPARATOR ---
    doc.moveTo(50, 115).lineTo(550, 115).lineWidth(0.5).strokeColor("#eee").stroke();

    // --- BILL TO ---
    const col1X = 50;
    const infoY = 135;
    doc.font(activeBoldFont).fontSize(10).fillColor("#2b2b2b").text("BILL TO", col1X, infoY);
    doc.font(activeBoldFont).fontSize(11).fillColor("#000").text(customer?.full_name || "Customer", col1X, infoY + 18);

    doc.font(activeFont).fontSize(9).fillColor("#444");
    let currentAddressY = infoY + 34;
    if (address) {
      doc.text(address.line1 || "", col1X, currentAddressY, { width: 220 });
      currentAddressY += (doc.heightOfString(address.line1 || "", { width: 220 }) || 10) + 2;
      if (address.line2) {
        doc.text(address.line2, col1X, currentAddressY, { width: 220 });
        currentAddressY += 12;
      }
      doc.text(`${address.city || ""}, ${address.state || ""} ${address.postal_code || ""}`, col1X, currentAddressY);
      currentAddressY += 12;
    }
    doc.text(customer?.email || "", col1X, currentAddressY);
    if (customer?.phone) {
      doc.text(customer.phone, col1X, currentAddressY + 12);
    }

    // --- FROM (Store) ---
    const col2X = 420;
    doc.font(activeBoldFont).fontSize(10).fillColor("#2b2b2b").text("FROM", col2X, infoY);
    doc.font(activeFont).fontSize(9).fillColor("#444");
    doc.text(storeInfo.name, col2X, infoY + 18);
    doc.text("via HiFoode Platform", col2X, infoY + 31);

    const orderDetailsY = infoY + 55;
    doc.font(activeBoldFont).fontSize(10).fillColor("#2b2b2b").text("ORDER DETAILS", col2X, orderDetailsY);

    doc.font(activeBoldFont).fontSize(9).fillColor("#444").text("Invoice No:", col2X, orderDetailsY + 18, { continued: true });
    doc.font(activeFont).text(`  ${order.order_number.split('-')[1] || order.order_number}`);

    doc.font(activeBoldFont).text("Order Date:", col2X, orderDetailsY + 31, { continued: true });
    const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString() : new Date().toLocaleDateString();
    doc.font(activeFont).text(`  ${orderDate}`);

    doc.font(activeBoldFont).text("Order Status:", col2X, orderDetailsY + 44, { continued: true });
    doc.font(activeFont).text(`  ${(order.order_status || "confirmed").toUpperCase()}`);

    // --- TABLE HEADER ---
    const tableTop = Math.max(currentAddressY + 40, orderDetailsY + 80);
    doc.save();
    doc.rect(50, tableTop, 500, 25).fill("#c1e3dfcf");
    doc.font(activeBoldFont).fontSize(10).fillColor("#2b2b2b");
    doc.text("S.No", 50, tableTop + 8, { width: 40, align: "center" });
    doc.text("Product", 100, tableTop + 8);
    doc.text("Qty", 350, tableTop + 8, { width: 50, align: "center" });
    doc.text("Unit Price", 420, tableTop + 8, { width: 60, align: "right" });
    doc.text("Total", 500, tableTop + 8, { width: 50, align: "right" });
    doc.restore();

    doc.moveTo(50, tableTop + 25).lineTo(550, tableTop + 25).lineWidth(1).strokeColor("#000").stroke();

    // --- TABLE ROWS ---
    let y = tableTop + 33;
    doc.font(activeFont).fontSize(9.5).fillColor("#333");

    storeItems.forEach((item, index) => {
      const name = item.name || item.product_name || item.menu_name || "";
      const qty = item.quantity || 0;
      const price = item.unit_price || item.price || 0;
      const total = qty * price;

      const nameHeight = doc.heightOfString(name, { width: 230 }) || 12;

      doc.text((index + 1).toString(), 50, y, { width: 40, align: "center" });
      doc.text(name, 100, y, { width: 230 });
      doc.text(qty.toString(), 350, y, { width: 50, align: "center" });
      doc.text(`$${price.toFixed(2)}`, 410, y, { width: 70, align: "right" });
      doc.text(`$${total.toFixed(2)}`, 500, y, { width: 50, align: "right" });

      const rowStep = Math.max(22, nameHeight + 12);
      y += rowStep;

      doc.moveTo(50, y - 6).lineTo(550, y - 6).lineWidth(0.2).strokeColor("#eee").stroke();

      if (y > 720) {
        doc.addPage();
        y = 50;
      }
    });

    // --- STORE SUBTOTAL ---
    const storeSubtotal = storeItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || item.price || 0), 0);
    const totalsTop = y + 10;

    doc.moveTo(380, totalsTop).lineTo(550, totalsTop).lineWidth(1).strokeColor("#2b2b2b").stroke();

    doc.font(activeBoldFont).fontSize(13).fillColor("#000");
    doc.text("Store Subtotal", 330, totalsTop + 12, { width: 150, align: "left" });
    doc.text(`$${storeSubtotal.toFixed(2)}`, 480, totalsTop + 12, { width: 70, align: "right" });

    doc.font(activeFont).fontSize(9).fillColor("#888");
    doc.text("* Tax, delivery fee, and discounts are reflected in the customer invoice.", 50, totalsTop + 45, { width: 500 });

    doc.font(activeBoldFont).fontSize(12).fillColor("#ff5722");
    doc.text("Thank you for partnering with HiFoode!", 50, totalsTop + 75, { width: 500, align: "center" });

    doc.end();
    stream.on("finish", () => resolve(invoicePath));
    stream.on("error", reject);
  });
};