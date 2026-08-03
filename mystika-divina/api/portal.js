// api/portal.js — Genera un enlace al Customer Portal de Stripe
// El usuario gestiona/cancela su suscripción en la página segura de Stripe.
import Stripe from "stripe";
import { kv } from "./_kv.js";
import { verifyToken, rateLimited, clientIp } from "./_auth.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (rateLimited("portal:" + clientIp(req), 10, 60000)) return res.status(429).json({ error: "Espera un momento." });

  // Autenticar por token de sesión (no confiamos en un email suelto del cliente)
  const { token } = req.body || {};
  const uname = verifyToken(token);
  if (!uname) return res.status(401).json({ error: "Sesión inválida. Inicia sesión de nuevo." });

  try {
    const user = await kv.get(`user:${uname}`);
    if (!user) return res.status(401).json({ error: "Cuenta no encontrada." });

    // Buscar el customerId de Stripe guardado por el webhook al pagar
    const premium = await kv.get(`premium:${user.email}`);
    const customerId = premium?.customerId;
    if (!customerId) {
      return res.status(400).json({ error: "No encontramos una suscripción activa para tu cuenta." });
    }

    // Crear sesión del portal; al salir vuelve a la app
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: origin,
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error("portal error:", e?.message);
    return res.status(500).json({ error: "No se pudo abrir el portal. Intenta de nuevo." });
  }
}
