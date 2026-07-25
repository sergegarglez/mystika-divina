// api/interpret.js — Vercel serverless function
// Llama a la API de xAI (Grok) para generar interpretaciones astrológicas.
// La API key vive SOLO en variables de entorno (XAI_API_KEY), nunca en el frontend.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Falta configurar XAI_API_KEY" });

  const { mode, chartSummary, question, history } = req.body || {};
  if (!chartSummary) return res.status(400).json({ error: "Falta la carta" });

  // System prompt según el modo (intérprete natal vs guía diaria Lúa)
  const systemPrompt = mode === "lua"
    ? `Eres Lúa, una astróloga de cabecera cálida y cercana. Traduces astrología técnica en orientación diaria clara y accionable, en español. Usa párrafos cortos. Nunca uses lenguaje fatalista ni catastrófico: los tránsitos son climas, no sentencias. Sé específico para esta carta y estos tránsitos, nunca genérico. No das consejo médico, legal ni financiero (si preguntan, recomienda un profesional).`
    : `Eres un astrólogo profesional cálido que explica cartas natales en español sencillo, sin tecnicismos innecesarios. Usa párrafos cortos y ejemplos cotidianos. Sé específico para esta carta, nunca genérico. Aclara que la astrología es simbólica/interpretativa.`;

  // Construir mensajes con contexto de la carta + historial
  const messages = [
    { role: "system", content: systemPrompt + "\n\nDATOS DE LA CARTA:\n" + chartSummary },
  ];
  if (Array.isArray(history)) {
    for (const m of history.slice(-6)) {
      if (m && m.role && m.content) messages.push({ role: m.role === "user" ? "user" : "assistant", content: String(m.content).slice(0, 1500) });
    }
  }
  messages.push({ role: "user", content: String(question || "Dame una interpretación general de mi carta.").slice(0, 800) });

  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages,
        max_tokens: 900,
        temperature: 0.8,
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("xAI error:", r.status, errText);
      return res.status(502).json({ error: "El servicio de IA no respondió. Intenta de nuevo." });
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return res.status(502).json({ error: "Respuesta vacía de la IA." });

    return res.json({ text });
  } catch (e) {
    console.error("interpret handler error:", e);
    return res.status(500).json({ error: "Error al generar la interpretación." });
  }
}
