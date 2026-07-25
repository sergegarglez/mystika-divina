// api/check-premium.js
// El frontend llama a este endpoint para verificar si un email tiene premium activo
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  // Solo GET
  if (req.method !== "GET") return res.status(405).end();

  const { email } = req.query;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Email requerido" });

  try {
    const data = await kv.get(`premium:${email.toLowerCase()}`);
    return res.json({ isPremium: !!data, activatedAt: data?.activatedAt || null });
  } catch (e) {
    console.error("check-premium error:", e);
    return res.status(500).json({ isPremium: false });
  }
}
