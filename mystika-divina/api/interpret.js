// api/interpret.js — Vercel serverless function
// Llama a la API de xAI (Grok). La API key vive SOLO en process.env, nunca en el frontend.

// ── Rate limiting simple en memoria (por instancia) ──────────────────────────
const rateMap = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;      // ventana de 1 minuto
  const maxReq = 12;            // máx 12 peticiones por minuto por IP
  const entry = rateMap.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
  entry.count++;
  rateMap.set(ip, entry);
  // Limpieza ocasional para no crecer sin límite
  if (rateMap.size > 5000) rateMap.clear();
  return entry.count > maxReq;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limit por IP
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "Demasiadas solicitudes. Espera un momento." });

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Servicio no disponible temporalmente." });

  const { mode, chartSummary, question, history } = req.body || {};
  if (!chartSummary || typeof chartSummary !== "string") return res.status(400).json({ error: "Solicitud inválida." });

  // Límites de tamaño para evitar abuso de tokens
  const summary = chartSummary.slice(0, 3000);
  const q = String(question || "Dame una interpretación general de mi carta.").slice(0, 800);

  const systemPrompt = mode === "lua"
    ? `Eres Lúa, una astróloga de cabecera cálida y cercana. Traduces astrología técnica en orientación diaria clara y accionable, en español. Usa párrafos cortos. Nunca uses lenguaje fatalista ni catastrófico: los tránsitos son climas, no sentencias. Sé específico para esta carta y estos tránsitos, nunca genérico. No das consejo médico, legal ni financiero (si preguntan, recomienda un profesional).`
    : `Eres un astrólogo profesional cálido que explica cartas natales en español sencillo, sin tecnicismos innecesarios. Usa párrafos cortos y ejemplos cotidianos. Sé específico para esta carta, nunca genérico. Aclara que la astrología es simbólica/interpretativa.`;

  const messages = [{ role: "system", content: systemPrompt + "\n\nDATOS DE LA CARTA:\n" + summary }];
  if (Array.isArray(history)) {
    for (const m of history.slice(-6)) {
      if (m && m.role && m.content) messages.push({ role: m.role === "user" ? "user" : "assistant", content: String(m.content).slice(0, 1500) });
    }
  }
  messages.push({ role: "user", content: q });

  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "grok-3-mini", messages, max_tokens: 900, temperature: 0.8 }),
    });
    if (!r.ok) {
      console.error("xAI upstream error:", r.status); // no exponer detalle al cliente
      return res.status(502).json({ error: "El servicio de interpretación no respondió. Intenta de nuevo." });
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return res.status(502).json({ error: "No se pudo generar la interpretación." });
    return res.json({ text });
  } catch (e) {
    console.error("interpret handler error:", e?.message); // solo a logs del servidor
    return res.status(500).json({ error: "Error al generar la interpretación." });
  }
}
