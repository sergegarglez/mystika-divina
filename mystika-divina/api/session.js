// api/session.js — Valida el token guardado y devuelve el perfil + estado premium fresco
import { kv } from "./_kv.js";
import { verifyToken, clientIp, rateLimited } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (rateLimited("sess:" + clientIp(req), 30, 60000)) return res.status(429).json({ error: "rate" });

  const { token } = req.body || {};
  const uname = verifyToken(token);
  if (!uname) return res.status(401).json({ error: "Sesión inválida." });

  try {
    const user = await kv.get(`user:${uname}`);
    if (!user) return res.status(401).json({ error: "Sesión inválida." });
    // Premium SIEMPRE se lee fresco desde KV → respeta pagos y cancelaciones
    const premium = await kv.get(`premium:${user.email}`);
    return res.json({ user: { username: user.username, email: user.email, isPremium: !!premium } });
  } catch (e) {
    console.error("session error:", e?.message);
    return res.status(500).json({ error: "Error de sesión." });
  }
}
