import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapedProduct {
  title: string;
  price: number;
  imageUrl: string;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function parsePrice(text: string): number {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function fetchPage(url: string): Promise<string> {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": getRandomUA(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
    timeout: 15000,
  });
  return data;
}

export async function scrapeAmazon(url: string): Promise<ScrapedProduct> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const title =
    $("#productTitle").text().trim() ||
    $("h1 span").first().text().trim() ||
    "Unknown Product";

  let price = 0;
  const priceSelectors = [
    ".a-price .a-offscreen",
    "#priceblock_dealprice",
    "#priceblock_ourprice",
    ".a-price-whole",
    "#price_inside_buybox",
    ".apexPriceToPay .a-offscreen",
  ];
  for (const sel of priceSelectors) {
    const text = $(sel).first().text().trim();
    if (text) {
      price = parsePrice(text);
      if (price > 0) break;
    }
  }

  const imageUrl =
    $("#landingImage").attr("src") ||
    $("#imgBlkFront").attr("src") ||
    $(".a-dynamic-image").first().attr("src") ||
    "";

  return { title, price, imageUrl };
}

export async function scrapeFlipkart(url: string): Promise<ScrapedProduct> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const title =
    $("h1 span").first().text().trim() ||
    $(".B_NuCI").text().trim() ||
    $("h1").first().text().trim() ||
    "Unknown Product";

  let price = 0;
  const priceSelectors = [
    "._30jeq3",
    ".Nx9bqj",
    "._16Jk6d",
    "div._30jeq3._16Jk6d",
  ];
  for (const sel of priceSelectors) {
    const text = $(sel).first().text().trim();
    if (text) {
      price = parsePrice(text);
      if (price > 0) break;
    }
  }

  const imageUrl =
    $("._396cs4").first().attr("src") ||
    $("._2r_T1I").first().attr("src") ||
    $("img._396cs4._2amPTt._3qGmMb").first().attr("src") ||
    "";

  return { title, price, imageUrl };
}

export async function scrapeProduct(url: string, platform: "amazon" | "flipkart"): Promise<ScrapedProduct> {
  if (platform === "amazon") return scrapeAmazon(url);
  return scrapeFlipkart(url);
}

export function detectPlatform(url: string): "amazon" | "flipkart" | null {
  const lower = url.toLowerCase();
  if (lower.includes("amazon.in") || lower.includes("amazon.com") || lower.includes("amzn.")) return "amazon";
  if (lower.includes("flipkart.com") || lower.includes("fkrt.it")) return "flipkart";
  return null;
}
