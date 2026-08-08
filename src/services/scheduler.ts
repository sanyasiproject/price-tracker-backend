import cron from "node-cron";
import { Product } from "../models/Product";
import { User } from "../models/User";
import { scrapeProduct } from "./scraper";
import { sendPriceAlert } from "./notifier";

const INTERVAL_MS: Record<string, number> = {
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "2d": 2 * 24 * 60 * 60 * 1000,
  "5d": 5 * 24 * 60 * 60 * 1000,
};

async function checkProduct(product: any) {
  try {
    console.log(`[Scheduler] Checking: ${product.title} (${product.platform}) — ${product.url}`);
    const scraped = await scrapeProduct(product.url, product.platform);
    if (scraped.price <= 0) {
      console.log(`[Scheduler] Could not fetch price for: ${product.title}`);
      return;
    }

    const oldPrice = product.currentPrice;
    product.currentPrice = scraped.price;
    if (!product.title || product.title === "Unknown Product") {
      product.title = scraped.title;
    }
    if (!product.imageUrl && scraped.imageUrl) {
      product.imageUrl = scraped.imageUrl;
    }

    product.priceHistory.push({ price: scraped.price, checkedAt: new Date() });

    if (product.priceHistory.length > 500) {
      product.priceHistory = product.priceHistory.slice(-500);
    }

    product.lastChecked = new Date();

    console.log(`[Scheduler] ${product.title}: ₹${oldPrice} → ₹${scraped.price} (target: ₹${product.targetPrice})`);

    if (scraped.price <= product.targetPrice && !product.notified) {
      const user = await User.findById(product.userId);
      if (user) {
        console.log(`[Scheduler] PRICE DROP! Sending alert to ${user.email}`);
        await sendPriceAlert(user, product);
        product.notified = true;
      }
    }

    if (scraped.price > product.targetPrice) {
      product.notified = false;
    }

    await product.save();
  } catch (err) {
    console.error(`[Scheduler] Failed to check product ${product._id}:`, (err as Error).message);
  }
}

async function runPriceChecks() {
  const now = Date.now();

  const products = await Product.find({ paused: { $ne: true } });
  const due = products.filter((p) => {
    if (!p.lastChecked) return true;
    const elapsed = now - new Date(p.lastChecked).getTime();
    return elapsed >= (INTERVAL_MS[p.checkInterval] || INTERVAL_MS["12h"]);
  });

  console.log(`[Scheduler] ${new Date().toISOString()} — Total products: ${products.length}, Due now: ${due.length}`);

  if (due.length === 0) return;

  for (const product of due) {
    await checkProduct(product);
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  }

  console.log(`[Scheduler] Done checking ${due.length} product(s)`);
}

export function startScheduler() {
  cron.schedule("0 */1 * * *", () => {
    runPriceChecks().catch((err) => console.error("[Scheduler] Error:", err));
  });

  console.log("[Scheduler] Started — runs every hour, checks products due by their interval (6h/12h/24h)");

  setTimeout(() => {
    runPriceChecks().catch((err) => console.error("[Scheduler] Initial check error:", err));
  }, 5000);
}
