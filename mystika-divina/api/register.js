// api/register.js — Crea una cuenta en Vercel KV
import { kv } from "./_kv.js";
import { hashPassword, makeToken, USERNAME_RE, EMAIL_RE, validPassword, rateLimited, clientIp } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (rateLimited("reg:" + clientIp(req), 5, 60000)) return res.status(429).json({ error: "Demasiados intentos. Espera un momento." });

  const { username, email, password } = req.body || {};
  if (!USERNAME_RE.test(username || "")) return res.status(400).json({ error: "Usuario: 3–20 caracteres, solo letras, números y _" });
  if (!EMAIL_RE.test(email || "")) return res.status(400).json({ error: "Email inválido." });
  if (!validPassword(password)) return res.status(400).json({ error: "La contraseña debe tener 8+ caracteres, una mayúscula y un número." });

  const uKey = `user:${username.toLowerCase()}`;
  try {
    // ¿Ya existe el usuario o el email?
    const exists = await kv.get(uKey);
    if (exists) return res.status(409).json({ error: "Ese usuario ya está en uso." });
    const emailOwner = await kv.get(`email:${email.toLowerCase()}`);
    if (emailOwner) return res.status(409).json({ error: "Ese email ya está registrado." });

    const user = {
      username,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),   // salt:hash
      createdAt: Date.now(),
    };
    await kv.set(uKey, user);
    await kv.set(`email:${email.toLowerCase()}`, username.toLowerCase());

    // ¿El email ya tenía premium (pagó antes de registrarse)?
    const premium = await kv.get(`premium:${email.toLowerCase()}`);

    const token = makeToken(username.toLowerCase());
    // Nunca devolvemos el hash al cliente
    return res.json({
      token,
      user: { username, email: user.email, isPremium: !!premium },
    });
  } catch (e) {
    console.error("register error:", e?.message);
    return res.status(500).json({ error: "No se pudo crear la cuenta. Intenta de nuevo." });
  }
}
