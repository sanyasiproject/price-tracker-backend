import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { signToken, ensureAuth, AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/signup", async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: "Email, password, and name are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const user = await User.create({ email, password, name });
  const token = signToken(String(user._id));

  res.status(201).json({
    token,
    user: { id: user._id, email: user.email, name: user.name },
  });
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken(String(user._id));

  res.json({
    token,
    user: { id: user._id, email: user.email, name: user.name },
  });
});

router.get("/me", ensureAuth, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId).select("-password");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: user._id, email: user.email, name: user.name });
});

export default router;
