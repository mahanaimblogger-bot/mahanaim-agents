import "dotenv/config";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/**
 * Llama a la API de DeepSeek (compatible con el formato de OpenAI).
 *
 * IMPORTANTE: verifica el nombre exacto del modelo vigente en
 * https://api-docs.deepseek.com antes de usar esto en producción,
 * ya que DeepSeek ha renombrado modelos en el pasado (ej. "deepseek-chat"
 * vs "deepseek-v4-flash"). Ajusta DEEPSEEK_MODEL en tu archivo .env.
 *
 * @param {string} systemPrompt - El Prompt Maestro completo.
 * @param {string} userMessage - Los datos de entrada (libro, capítulo, indicaciones).
 * @param {number} maxTokens - Límite de tokens de salida (alto, porque los estudios son largos).
 * @returns {Promise<string>} El texto generado (debería ser el HTML del estudio).
 */
export async function generarConDeepSeek(
  systemPrompt,
  userMessage,
  maxTokens = 8000
) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const modelo = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  if (!apiKey) {
    throw new Error(
      "Falta DEEPSEEK_API_KEY en tu archivo .env. Revisa .env.example."
    );
  }

  const respuesta = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!respuesta.ok) {
    const textoError = await respuesta.text();
    throw new Error(
      `Error de la API de DeepSeek (${respuesta.status}): ${textoError}`
    );
  }

  const datos = await respuesta.json();
  const contenido = datos?.choices?.[0]?.message?.content;

  if (!contenido) {
    throw new Error(
      "La API de DeepSeek respondió pero sin contenido utilizable. Revisa la respuesta completa: " +
        JSON.stringify(datos)
    );
  }

  return contenido;
}
