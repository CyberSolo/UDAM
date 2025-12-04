import jwt from "jsonwebtoken";
import { query } from "./db.js";
import { v4 as uuidv4 } from "uuid";
const secret = process.env.SESSION_SECRET || "devsecret";
export const issueToken = (userId) => jwt.sign({ uid: userId, jti: uuidv4() }, secret, { expiresIn: "30d" });
export const requireAuth = async (req, res, next) => {
  const h = req.headers["authorization"] || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  const t = h.slice(7);
  try {
    const { uid, jti } = jwt.verify(t, secret);
    const r = await query("SELECT id FROM users WHERE id=$1", [uid]);
    if (!r.rows[0]) return res.status(401).json({ error: "unauthorized" });
    if (jti) {
      const rr = await query("SELECT id FROM revoked_tokens WHERE jti=$1", [jti]);
      if (rr.rows[0]) return res.status(401).json({ error: "unauthorized" });
    }
    req.userId = uid;
    req.token = t;
    req.jti = jti;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
};
