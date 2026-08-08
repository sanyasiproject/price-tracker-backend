import { Router, Response } from "express";
import { ensureAuth, AuthRequest } from "../middleware/auth";
import { Product } from "../models/Product";
import { scrapeProduct, detectPlatform } from "../services/scraper";

const router = Router();

const MAX_PRODUCTS_PER_USER = 10;

router.get("/", ensureAuth, async (req: AuthRequest, res: Response) => {
  const products = await Product.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(products);
});

router.post("/", ensureAuth, async (req: AuthRequest, res: Response) => {
  const { url, targetPrice, checkInterval } = req.body;

  if (!url || !targetPrice) {
    res.status(400).json({ error: "URL and target price are required" });
    return;
  }

  const platform = detectPlatform(url);
  if (!platform) {
    res.status(400).json({ error: "Only Amazon and Flipkart URLs are supported" });
    return;
  }

  const count = await Product.countDocuments({ userId: req.userId });
  if (count >= MAX_PRODUCTS_PER_USER) {
    res.status(400).json({ error: `Maximum ${MAX_PRODUCTS_PER_USER} products allowed` });
    return;
  }

  const existing = await Product.findOne({ userId: req.userId, url });
  if (existing) {
    res.status(400).json({ error: "You are already tracking this product" });
    return;
  }

  let scraped = { title: "Unknown Product", price: 0, imageUrl: "" };
  try {
    scraped = await scrapeProduct(url, platform);
  } catch {
    // scraping may fail on first try; we'll retry in the scheduler
  }

  const product = await Product.create({
    userId: req.userId,
    url,
    platform,
    title: scraped.title,
    imageUrl: scraped.imageUrl,
    currentPrice: scraped.price,
    targetPrice: Number(targetPrice),
    checkInterval: checkInterval || "12h",
    priceHistory: scraped.price > 0 ? [{ price: scraped.price, checkedAt: new Date() }] : [],
    lastChecked: scraped.price > 0 ? new Date() : null,
  });

  res.status(201).json(product);
});

router.patch("/:id", ensureAuth, async (req: AuthRequest, res: Response) => {
  const { targetPrice, checkInterval } = req.body;

  const product = await Product.findOne({ _id: req.params.id, userId: req.userId });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (targetPrice !== undefined) {
    product.targetPrice = Number(targetPrice);
    product.notified = false;
  }
  if (checkInterval) {
    product.checkInterval = checkInterval;
  }
  if (req.body.paused !== undefined) {
    product.paused = Boolean(req.body.paused);
  }

  await product.save();
  res.json(product);
});

router.delete("/:id", ensureAuth, async (req: AuthRequest, res: Response) => {
  const result = await Product.deleteOne({ _id: req.params.id, userId: req.userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json({ ok: true });
});

router.post("/:id/refresh", ensureAuth, async (req: AuthRequest, res: Response) => {
  const product = await Product.findOne({ _id: req.params.id, userId: req.userId });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  try {
    const scraped = await scrapeProduct(product.url, product.platform);
    if (scraped.price > 0) {
      product.currentPrice = scraped.price;
      product.priceHistory.push({ price: scraped.price, checkedAt: new Date() });
      product.lastChecked = new Date();
      if (scraped.title !== "Unknown Product") product.title = scraped.title;
      if (scraped.imageUrl) product.imageUrl = scraped.imageUrl;
      await product.save();
    }
    res.json(product);
  } catch {
    res.status(500).json({ error: "Failed to fetch price. The product page may be unavailable." });
  }
});

export default router;
