// api/_auth.js — utilidades compartidas de autenticación (server-side)
import { createHmac, randomBytes, pbkdf2Sync, timingSafeEqual } from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-env";

// ── Hash de contraseña: PBKDF2-SHA256, 120k iteraciones, sal por usuario ──
export function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return saltHex ? hash : `${salt.toString("hex")}:${hash}`;
}
export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const computed = hashPassword(password, saltHex);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(hashHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Token de sesión firmado (HMAC) — sin librerías externas ──
export function makeToken(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    // Sesión válida por 30 días
    if (Date.now() - data.t > 30 * 24 * 60 * 60 * 1000) return null;
    return data.u;
  } catch { return null; }
}

// ── Validaciones ──
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validPassword(p) {
  return typeof p === "string" && p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p);
}

// ── Rate limit en memoria (por instancia) ──
const buckets = new Map();
export function rateLimited(key, max = 10, windowMs = 60000) {
  const now = Date.now();
  const e = buckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > e.reset) { e.count = 0; e.reset = now + windowMs; }
  e.count++;
  buckets.set(key, e);
  if (buckets.size > 5000) buckets.clear();
  return e.count > max;
}

export function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}
