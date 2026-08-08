import nodemailer from "nodemailer";
import { IProduct } from "../models/Product";
import { IUser } from "../models/User";

let transporter: nodemailer.Transporter | null = null;

export function initMailer() {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const port = Number(process.env.MAIL_PORT) || 587;

  if (!host || !user || !pass) {
    console.warn("Mail credentials not set (MAIL_HOST, MAIL_USER, MAIL_PASS) — email notifications disabled");
    return;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  console.log(`Email notifier initialized (${host}:${port})`);
}

export async function sendPriceAlert(user: IUser, product: IProduct) {
  if (!transporter) {
    console.warn("Email not configured, skipping notification");
    return;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Price Drop Alert!</h2>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">
        ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.title}" style="max-width: 200px; display: block; margin: 0 auto 16px;" />` : ""}
        <h3 style="margin: 0 0 8px;">${product.title}</h3>
        <p style="margin: 4px 0;"><strong>Current Price:</strong> <span style="color: #16a34a; font-size: 1.2em;">₹${product.currentPrice.toLocaleString("en-IN")}</span></p>
        <p style="margin: 4px 0;"><strong>Your Target:</strong> ₹${product.targetPrice.toLocaleString("en-IN")}</p>
        <p style="margin: 4px 0;"><strong>Platform:</strong> ${product.platform === "amazon" ? "Amazon" : "Flipkart"}</p>
      </div>
      <a href="${product.url}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
        View Product
      </a>
      <p style="color: #6b7280; font-size: 0.85em; margin-top: 24px;">
        You received this because you set a price alert on Price Tracker.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Price Tracker" <${process.env.MAIL_USER}>`,
    to: user.email,
    subject: `Price Drop: ${product.title} is now ₹${product.currentPrice.toLocaleString("en-IN")}!`,
    html,
  });
}
