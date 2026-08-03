// api/check-premium.js
// El frontend verifica si un email tiene premium. Endurecido contra enumeración y abuso.
import { kv } from "./_kv.js";

const rateMap = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60_000; }
  entry.count++;
  rateMap.set(ip, entry);
  if (rateMap.size > 5000) rateMap.clear();
  return entry.count > 30; // máx 30/min por IP (el polling legítimo hace ~10)
}

// Validación estricta de email
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ isPremium: false });

  const { email } = req.query;
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ isPremium: false });
  }

  try {
    const data = await kv.get(`premium:${email.toLowerCase()}`);
    // Solo devolvemos el booleano — nada de datos internos (customerId, subscriptionId, etc.)
    return res.json({ isPremium: !!data });
  } catch (e) {
    console.error("check-premium error:", e?.message);
    return res.status(500).json({ isPremium: false });
  }
}
