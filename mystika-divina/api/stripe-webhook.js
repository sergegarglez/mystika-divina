// api/stripe-webhook.js — Vercel serverless function
// Recibe eventos de Stripe y activa/revoca premium en Vercel KV
import Stripe from "stripe";
import { kv } from "@vercel/kv";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function emailFromCustomer(customerId) {
  if (!customerId) return null;
  try { const c = await stripe.customers.retrieve(customerId); return c.email || null; }
  catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Verificar firma — bloquea webhooks falsos
  let event;
  try {
    const raw = await getRawBody(req);
    event = stripe.webhooks.constructEvent(raw, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error("Webhook signature invalid:", e.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  const obj = event.data.object;

  if (event.type === "checkout.session.completed" || event.type === "invoice.payment_succeeded") {
    const email = (obj.customer_details?.email || obj.customer_email || await emailFromCustomer(obj.customer))?.toLowerCase();
    if (email) {
      await kv.set(`premium:${email}`, { isPremium: true, activatedAt: Date.now(), customerId: obj.customer || null });
      if (obj.customer) await kv.set(`customer:${obj.customer}`, email);
      console.log("Premium ON:", email);
    }
  }

  if (event.type === "customer.subscription.deleted" || event.type === "invoice.payment_failed") {
    const email = await kv.get(`customer:${obj.customer}`);
    if (email) { await kv.del(`premium:${email}`); console.log("Premium OFF:", email); }
  }

  return res.json({ received: true });
}
