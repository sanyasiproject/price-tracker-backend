import mongoose, { Document, Schema } from "mongoose";

export interface IPriceRecord {
  price: number;
  checkedAt: Date;
}

export interface IProduct extends Document {
  userId: mongoose.Types.ObjectId;
  url: string;
  platform: "amazon" | "flipkart";
  title: string;
  imageUrl: string;
  currentPrice: number;
  targetPrice: number;
  checkInterval: "6h" | "12h" | "24h" | "2d" | "5d";
  priceHistory: IPriceRecord[];
  paused: boolean;
  notified: boolean;
  lastChecked: Date | null;
  createdAt: Date;
}

const priceRecordSchema = new Schema<IPriceRecord>(
  {
    price: { type: Number, required: true },
    checkedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  url: { type: String, required: true },
  platform: { type: String, enum: ["amazon", "flipkart"], required: true },
  title: { type: String, default: "Unknown Product" },
  imageUrl: { type: String, default: "" },
  currentPrice: { type: Number, default: 0 },
  targetPrice: { type: Number, required: true },
  checkInterval: { type: String, enum: ["6h", "12h", "24h", "2d", "5d"], default: "12h" },
  priceHistory: { type: [priceRecordSchema], default: [] },
  paused: { type: Boolean, default: false },
  notified: { type: Boolean, default: false },
  lastChecked: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

productSchema.index({ userId: 1 });
productSchema.index({ lastChecked: 1, checkInterval: 1 });

export const Product = mongoose.model<IProduct>("Product", productSchema);
