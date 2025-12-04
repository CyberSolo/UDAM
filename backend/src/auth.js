import jwt from "jsonwebtoken";
import { query } from "./db.js";
const secret = process.env.SESSION_SECRET || "devsecret";
export const issueToken = (userId) => jwt.sign({ uid: userId }, secret, { expiresIn: "30d" });
export const requireAuth = async (req, res, next) => {
  const h = req.headers["authorization"] || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  const t = h.slice(7);
  try {
    const { uid } = jwt.verify(t, secret);
    const r = await query("SELECT id FROM users WHERE id=$1", [uid]);
    if (!r.rows[0]) return res.status(401).json({ error: "unauthorized" });
    req.userId = uid;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
};
