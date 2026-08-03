// api/login.js — Verifica credenciales contra Vercel KV
import { kv } from "./_kv.js";
import { verifyPassword, makeToken, rateLimited, clientIp } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Completa todos los campos." });

  // Rate limit doble: por IP y por usuario (anti fuerza bruta)
  const uname = String(username).toLowerCase();
  if (rateLimited("login-ip:" + clientIp(req), 15, 60000)) return res.status(429).json({ error: "Demasiados intentos. Espera un minuto." });
  if (rateLimited("login-u:" + uname, 5, 5 * 60000)) return res.status(429).json({ error: "Cuenta bloqueada temporalmente por seguridad." });

  try {
    const user = await kv.get(`user:${uname}`);
    // Respuesta genérica: no revelar si el usuario existe o no
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    }

    const premium = await kv.get(`premium:${user.email}`);
    const token = makeToken(uname);
    return res.json({
      token,
      user: { username: user.username, email: user.email, isPremium: !!premium },
    });
  } catch (e) {
    console.error("login error:", e?.message);
    return res.status(500).json({ error: "Error al iniciar sesión. Intenta de nuevo." });
  }
}
