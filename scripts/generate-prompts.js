import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import fs from "fs";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
});

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function generateGoogleMapsEmbedUrl(lat, lng, placeName = "") {
  const nameParam = placeName ? encodeURIComponent(placeName) : "";
  return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d50000!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${lat}, ${lng}!5e1!3m2!1ses!2s!4v1`;
}

function generateMapResourceHTML(titulo, ubicaciones, bookName, chapterNum) {
  let html = `
<div style="text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 3px solid #d4ac0d;">
  <h1 style="color: #1a3a5c; font-family: 'Georgia', serif; font-size: 2rem; margin-bottom: 0.5rem;">${titulo}</h1>
  <h2 style="color: #5d4037; font-family: 'Georgia', serif; font-size: 1.2rem; font-weight: normal;">${bookName} Capítulo ${chapterNum}</h2>
</div>

<div style="background: #fdfbf7; padding: 1.5rem; border-radius: 12px; border: 2px solid #d4c4a8; margin-bottom: 2rem;">
  <h3 style="color: #1a3a5c; margin-top: 0;"> Ubicaciones Bíblicas del Capítulo</h3>
  <p style="line-height: 1.8; color: #3e2723;">
    Este mapa interactivo muestra las ubicaciones geográficas mencionadas en el estudio. 
    Algunas son confirmadas arqueológicamente, otras son probables según la evidencia histórica.
  </p>
</div>
`;

  ubicaciones.forEach((ubicacion, index) => {
    const embedUrl = generateGoogleMapsEmbedUrl(
      ubicacion.latitud,
      ubicacion.longitud,
      ubicacion.nombre,
    );
    const certezaIcon =
      ubicacion.certeza === "confirmada"
        ? "✅"
        : ubicacion.certeza === "probable"
          ? "🟡"
          : "️";

    html += `
<div style="margin-bottom: 2.5rem;">
  <h3 style="color: #1a3a5c; border-left: 5px solid #d4ac0d; padding-left: 1rem; margin-bottom: 1rem;">
    ${index + 1}. ${ubicacion.nombre} ${certezaIcon}
  </h3>
  
  <div style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 1rem 0; border: 2px solid #d4c4a8;">
    <iframe src="${embedUrl}" width="100%" height="400" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>
  
  <div style="background: #f5f2eb; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
    <p style="margin: 0 0 0.5rem 0;"><strong>📖 Referencia:</strong> ${ubicacion.referencia_biblica}</p>
    <p style="margin: 0 0 0.5rem 0;"><strong>📍 Coordenadas:</strong> ${ubicacion.latitud}°N, ${ubicacion.longitud}°E</p>
    <p style="margin: 0 0 0.5rem 0;"><strong>🏛️ Contexto Histórico:</strong> ${ubicacion.contexto_historico}</p>
    <p style="margin: 0;"><strong>✝️ Importancia Teológica:</strong> ${ubicacion.importancia_teologica}</p>
  </div>
  
  <div style="background: ${ubicacion.certeza === "confirmada" ? "#d4edda" : "#fff3cd"}; padding: 0.8rem; border-radius: 6px; border-left: 4px solid ${ubicacion.certeza === "confirmada" ? "#28a745" : "#ffc107"};">
    <strong>Nivel de certeza:</strong> ${ubicacion.certeza.charAt(0).toUpperCase() + ubicacion.certeza.slice(1)}
  </div>
</div>
`;
  });

  html += `
<div style="background: #1a3a5c; color: #fdfbf7; padding: 1.5rem; border-radius: 12px; margin-top: 2rem;">
  <h3 style="color: #d4ac0d; margin-top: 0;">📚 Nota Metodológica</h3>
  <p style="line-height: 1.8; margin: 0;">
    Las ubicaciones marcadas como <strong>"confirmadas"</strong> tienen evidencia arqueológica sólida. 
    Las <strong>"probables"</strong> se basan en consenso académico y evidencia contextual. 
    Las <strong>"debatidas"</strong> o <strong>"desconocidas"</strong> reflejan incertidumbre debido a cambios geográficos históricos.
  </p>
</div>
`;
  return html;
}

function cleanHtml(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchChapterResources(bookSlug, chapterNumber) {
  console.log(
    `🔍 Buscando recursos para ${bookSlug} capítulo ${chapterNumber}...`,
  );

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, nombre, slug")
    .eq("slug", bookSlug)
    .single();

  if (bookError || !book) throw new Error(`Libro no encontrado: ${bookSlug}`);

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id, numero")
    .eq("book_id", book.id)
    .eq("numero", chapterNumber)
    .single();

  if (chapterError || !chapter)
    throw new Error(`Capítulo ${chapterNumber} no encontrado para ${bookSlug}`);

  return {
    chapterId: chapter.id,
    bookName: book.nombre,
    bookSlug: book.slug,
    chapterNumber,
  };
}

async function getResourcesForChapter(chapterId) {
  const { data: resources, error } = await supabase
    .from("resources")
    .select("tipo, contenido_html, titulo")
    .eq("chapter_id", chapterId);

  if (error) throw error;

  return {
    estudioTitulo:
      resources.find((r) => r.tipo === "estudio")?.titulo || "Estudio Bíblico",
    estudio: resources.find((r) => r.tipo === "estudio")?.contenido_html || "",
    sermon: resources.find((r) => r.tipo === "sermon")?.contenido_html || "",
    bosquejo:
      resources.find((r) => r.tipo === "bosquejo")?.contenido_html || "", // Agregado para el podcast
    infografia:
      resources.find((r) => r.tipo === "infografia")?.contenido_html || "",
    arqueologia:
      resources.find((r) => r.tipo === "contexto_arqueologico")
        ?.contenido_html || "",
    palabras:
      resources.find((r) => r.tipo === "palabras_clave")?.contenido_html || "",
    citasTeologos:
      resources.find((r) => r.tipo === "citas_teologos")?.contenido_html || "",
    citasLibros:
      resources.find((r) => r.tipo === "citas_libros")?.contenido_html || "",
  };
}

function buildPlainTextSource(bookName, chapterNum, context) {
  let source = `FUENTE CONSOLIDADA PARA NOTEBOOKLM\nLIBRO: ${bookName}\nCAPÍTULO: ${chapterNum}\n========================================\n\n`;
  if (context.estudio)
    source += `--- ESTUDIO BÍBLICO: ${context.estudioTitulo} ---\n${cleanHtml(context.estudio)}\n\n`;
  if (context.sermon)
    source += `--- SERMÓN ---\n${cleanHtml(context.sermon)}\n\n`;
  if (context.infografia)
    source += `--- INFOGRAFÍA DOCTRINAL ---\n${cleanHtml(context.infografia)}\n\n`;
  if (context.arqueologia)
    source += `--- CONTEXTO ARQUEOLÓGICO ---\n${cleanHtml(context.arqueologia)}\n\n`;
  if (context.palabras)
    source += `--- PALABRAS CLAVE ---\n${cleanHtml(context.palabras)}\n\n`;
  if (context.citasTeologos)
    source += `--- CITAS DE TEÓLOGOS ---\n${cleanHtml(context.citasTeologos)}\n\n`;
  if (context.citasLibros)
    source += `--- CITAS DE LIBROS ---\n${cleanHtml(context.citasLibros)}\n\n`;
  return source;
}

function buildPrompts(bookName, chapterNum, context) {
  const baseInfo = `
  LIBRO: ${bookName} | CAPÍTULO: ${chapterNum}
  TÍTULO DEL ESTUDIO: "${context.estudioTitulo}"
  [ESTUDIO]: ${context.estudio.substring(0, 1500)}
  [SERMÓN]: ${context.sermon.substring(0, 1500)}
  [BOSQUEJO]: ${context.bosquejo.substring(0, 1000)}
  [INFOGRAFÍA]: ${context.infografia.substring(0, 1000)}
  [ARQUEOLOGÍA]: ${context.arqueologia.substring(0, 800)}
  [PALABRAS]: ${context.palabras.substring(0, 800)}
  [CITAS]: ${context.citasTeologos.substring(0, 800)} ${context.citasLibros.substring(0, 800)}
  `;

  return [
    {
      type: "prompt_video",
      system:
        "Eres un experto en producción de contenido viral cristiano con profundidad teológica.",
      user: `Analiza esta información y genera 2 prompts para NotebookLM (Estilo Visual máx 4000 chars, Contenido Narrativo máx 4000 chars). Regla: usa solo 1 cita de autoridad. Formato JSON: { "prompt_estilo_visual": "...", "prompt_contenido_narrativo": "..." }.\n\nINFO:\n${baseInfo}`,
    },
    {
      type: "prompt_mapa",
      system: "Eres un experto en teología bíblica y aprendizaje visual.",
      user: `Analiza esta información y genera 1 prompt para un Mapa Mental esquemático en NotebookLM (máx 4000 chars). Incluye: tema central, versículos clave, palabras originales. Formato JSON: { "prompt_mapa_mental": "..." }.\n\nINFO:\n${baseInfo}`,
    },
    {
      type: "prompt_diapositivas",
      system: "Eres un experto en educación bíblica y diseño instruccional.",
      user: `Analiza esta información y genera 1 prompt para una presentación de 5 a 7 diapositivas en NotebookLM (máx 4000 chars). Estructura: Portada, Desarrollo, Conclusión. Formato JSON: { "prompt_diapositivas": "..." }.\n\nINFO:\n${baseInfo}`,
    },
    {
      type: "prompt_miniatura",
      system:
        "Eres un experto en diseño de miniaturas virales para YouTube y prompt engineering para IA generativa de imágenes.",
      user: `Analiza esta información y genera UN prompt en INGLÉS para crear una miniatura de YouTube ultra-llamativa. 
      REQUISITOS: 1. Estilo cinematográfico/hiperrealista. 2. Alto contraste y espacio negativo para texto. 3. Instruye a la IA para incluir el texto exacto: "${context.estudioTitulo}" en letras grandes y legibles. 4. Colores vibrantes. 
      Formato JSON: { "prompt_miniatura_youtube": "..." }.\n\nINFO:\n${baseInfo}`,
    },
    {
      type: "prompt_descripcion",
      system: "Eres un experto en SEO para YouTube y Copywriting cristiano.",
      user: `Analiza esta información y genera una descripción completa y optimizada para SEO para el video de YouTube sobre este capítulo.
      
      ESTRUCTURA OBLIGATORIA DE LA DESCRIPCIÓN:
      1. TÍTULO SUGERIDO: 3 opciones de títulos virales y con gancho (máx 60 caracteres).
      2. GANCHO INICIAL: Las primeras 2 líneas que atrapan al lector (lo que se ve antes de "mostrar más").
      3. RESUMEN: Un párrafo corto explicando qué aprenderá el espectador (usa palabras clave del estudio).
      4. TIMESTAMPS: Sugiere una lista de capítulos con tiempos (ej: 0:00 Intro, 0:45 El conflicto, etc.) basada en la estructura del video.
      5. VERSÍCULO CLAVE: Cita el versículo principal del capítulo.
      6. LLAMADO A LA ACCIÓN: Invitación a suscribirse y comentar.
      7. HASHTAGS: 5 hashtags relevantes al final.
      
      Formato JSON: { "descripcion_youtube": "..." } (Usa saltos de línea \\n para formatear).\n\nINFO:\n${baseInfo}`,
    },
    {
      type: "prompt_mapa_interactivo",
      system:
        "Eres un experto en geografía bíblica, arqueología del antiguo oriente próximo y teología. Tu trabajo es identificar ubicaciones geográficas mencionadas en el estudio bíblico y crear recursos de mapa interactivo educativos.",
      user: `Analiza este estudio bíblico de ${bookName} capítulo ${chapterNum} e identifica TODAS las ubicaciones geográficas mencionadas (ciudades, montes, ríos, regiones, etc.).

Para CADA ubicación identificada, genera:

**INFORMACIÓN REQUERIDA:**
1. **Nombre del lugar** (en español)
2. **Coordenadas GPS aproximadas** (latitud, longitud)
3. **Referencia bíblica** donde se menciona
4. **Contexto histórico/arqueológico** breve
5. **Importancia teológica** en el capítulo

**UBICACIONES CON CERTEZA vs INCERTIDUMBRE:**
- Si la ubicación es **confirmada** arqueológicamente: proporciona coordenadas exactas
- Si es **probable pero debatida**: proporciona la teoría más aceptada y menciona la incertidumbre
- Si es **desconocida**: usa la región general más probable según el contexto

**FORMATO DE SALIDA JSON:**
{
  "titulo_recurso": "Mapa Interactivo: [Tema del capítulo] - Ubicaciones Bíblicas",
  "ubicaciones": [
    {
      "nombre": "Nombre del lugar",
      "latitud": 31.0103,
      "longitud": 47.4344,
      "referencia_biblica": "Génesis 2:14",
      "contexto_historico": "Descripción breve del contexto histórico y arqueológico",
      "importancia_teologica": "Significado teológico en el pasaje",
      "certeza": "confirmada | probable | debatida | desconocida"
    }
  ],
  "nota_metodologica": "Explicación sobre la certeza/incertidumbre de las ubicaciones"
}

**EJEMPLO DE UBICACIONES PARA ÉXODO 5:**
1. Pi-Ramsés (capital de Faraón) - 30.8080, 31.2859
2. Ladrilleras del Delta - 30.7500, 31.3000
3. Monte Sinaí (Horeb) - 28.5394, 33.9746
4. Tierra de Gosén - 30.8500, 31.6500

**INFORMACIÓN DEL ESTUDIO:**
${baseInfo}

Genera el recurso de mapa en formato JSON completo.`,
    },
    {
      type: "prompt_podcast_guion",
      system:
        "Eres un experto en guionización de podcasts cristianos. Tu tarea es transformar el estudio bíblico, el sermón y el bosquejo en un guion de podcast fluido. DEBES RESPONDER EXCLUSIVAMENTE EN FORMATO JSON.",
      user: `Basado en la siguiente información, escribe un guion de podcast completo.
      
      ESTRUCTURA DEL GUION:
      1. INTRODUCCIÓN (1-2 min): Gancho atractivo, presentación del tema y el texto base.
      2. DESARROLLO (6-10 min): Explicación exegética clara, aplicación práctica.
      3. CONCLUSIÓN Y LLAMADO (2-3 min): Resumen de la verdad central y oración final.
      
      TONO: Cálido, pastoral, claro. Usa indicaciones de locución entre corchetes, ej: [Música suave], [Pausa].
      
      INFO DEL ESTUDIO:
      ${baseInfo}
      
      FORMATO DE SALIDA JSON OBLIGATORIO:
      { "guion_podcast": "Aquí va el texto completo del guion..." }`,
    },
  ];
}

async function generateWithAI(promptData) {
  console.log(`   🤖 Generando: ${promptData.type}...`);
  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: promptData.system },
        { role: "user", content: promptData.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 12000,
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(`   ❌ Error en IA para ${promptData.type}:`, error.message);
    return null;
  }
}

async function saveFilesLocally(
  results,
  plainTextSource,
  bookName,
  chapterNum,
  studyTitle,
) {
  console.log(`   💾 Generando archivos de texto para descargar...`);

  // 📁 CREAR CARPETA ORGANIZADA: prompts_output/{libro}/Capitulo_{numero}/
  function quitarTildes(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  const outputDir = path.join(
    "prompts_output",
    quitarTildes(bookName.toLowerCase()),
    `Capitulo_${chapterNum}`,
  );
  mkdirSync(outputDir, { recursive: true });

  for (const result of results) {
    if (!result) continue;
    const jsonData = result.data;
    let fileContent = "";
    let fileName = "";

    if (result.type === "prompt_video") {
      fileName = `1_VIDEO_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPTS PARA VIDEO - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 PROMPT 1 - ESTILO VISUAL:\n───────────────────────────────────────────\n${jsonData.prompt_estilo_visual}\n\n📋 PROMPT 2 - CONTENIDO NARRATIVO:\n───────────────────────────────────────────\n${jsonData.prompt_contenido_narrativo}\n`;
    } else if (result.type === "prompt_mapa") {
      fileName = `2_MAPA_MENTAL_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA MAPA MENTAL - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 INSTRUCCIONES:\n───────────────────────────────────────────\n${jsonData.prompt_mapa_mental}\n`;
    } else if (result.type === "prompt_diapositivas") {
      fileName = `3_DIAPOSITIVAS_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA DIAPOSITIVAS - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 INSTRUCCIONES:\n───────────────────────────────────────────\n${jsonData.prompt_diapositivas}\n`;
    } else if (result.type === "prompt_miniatura") {
      fileName = `4_MINIATURA_YOUTUBE_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA MINIATURA DE YOUTUBE (IA)\nLibro: ${bookName} | Capítulo: ${chapterNum}\nTítulo del Estudio: "${studyTitle}"\n═══════════════════════════════════════════\n\n📋 INSTRUCCIONES:\nCopia el siguiente prompt (en inglés) y pégalo en Midjourney/DALL-E 3.\n\n───────────────────────────────────────────\n${jsonData.prompt_miniatura_youtube}\n───────────────────────────────────────────\n\n💡 CONSEJO: Si la IA falla con el texto, genera la imagen sin texto y agrégalo luego en Canva con fuente gruesa.`;
    } else if (result.type === "prompt_descripcion") {
      fileName = `5_DESCRIPCION_YOUTUBE_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nDESCRIPCIÓN OPTIMIZADA PARA YOUTUBE\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 COPIA Y PEGA ESTO EN LA DESCRIPCIÓN DE TU VIDEO:\n───────────────────────────────────────────\n${jsonData.descripcion_youtube}\n───────────────────────────────────────────\n\n💡 NOTA: Los timestamps son sugerencias basadas en la estructura del video. Ajustalos según la duración final.`;
    } else if (result.type === "prompt_mapa_interactivo") {
      fileName = `6_MAPA_INTERACTIVO_${bookName}_Cap${chapterNum}.txt`;

      const mapaData = jsonData;
      const htmlGenerado = generateMapResourceHTML(
        mapaData.titulo_recurso,
        mapaData.ubicaciones,
        bookName,
        chapterNum,
      );

      fileContent = `═══════════════════════════════════════════
RECURSO DE MAPA INTERACTIVO - MAHANAIM
Libro: ${bookName} | Capítulo: ${chapterNum}
═══════════════════════════════════════════

📋 DATOS PARA CREAR EL RECURSO EN EL ADMIN:

TÍTULO: ${mapaData.titulo_recurso}
TIPO: mapa
URL DEL RECURSO: (Dejar vacío - el mapa se genera desde el HTML)
MODO: html

CONTENIDO HTML:
───────────────────────────────────────────
${htmlGenerado}
───────────────────────────────────────────

📍 UBICACIONES IDENTIFICADAS:
${mapaData.ubicaciones.map((u, i) => `${i + 1}. ${u.nombre} (${u.latitud}, ${u.longitud}) - ${u.certeza}`).join("\n")}

 NOTA METODOLÓGICA:
${mapaData.nota_metodologica || "Las ubicaciones varían en certeza según la evidencia arqueológica disponible."}

💡 INSTRUCCIONES:
1. Copia el HTML completo de arriba
2. Ve a /admin/recursos/nuevo
3. Selecciona Libro: ${bookName}, Capítulo: ${chapterNum}
4. Tipo: "mapa"
5. Pega el HTML en "Contenido HTML"
6. Deja "URL del recurso" vacío
7. Guarda y publica

✅ El recurso se mostrará con mapas interactivos de Google Maps para cada ubicación.
`;
    } else if (result.type === "prompt_podcast_guion") {
      fileName = `7_PODCAST_GUION_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════
GUION DE PODCAST PARA NOTEBOOKLM / TTS
Libro: ${bookName} | Capítulo: ${chapterNum}
═══════════════════════════════════════════

🎙️ INSTRUCCIONES:
Copia este texto y pégalo en NotebookLM (como fuente de audio) o en tu herramienta de Texto a Voz (ElevenLabs, etc.) preferida.

───────────────────────────────────────────
${jsonData.guion_podcast}
───────────────────────────────────────────

💡 NOTA: Este guion fue generado siguiendo la cadena homilética (Estudio -> Sermón -> Bosquejo -> Guion) para garantizar profundidad teológica y fluidez narrativa.
`;
    }

    // 🛡️ Guardar con BOM UTF-8 para compatibilidad perfecta con Windows
    writeFileSync(
      path.join(outputDir, fileName),
      "\uFEFF" + fileContent,
      "utf8",
    );
    console.log(`   ✅ Archivo creado: ${fileName}`);
  }

  if (plainTextSource) {
    const sourceFileName = `0_FUENTE_CONSOLIDADA_${bookName}_Cap${chapterNum}.txt`;
    writeFileSync(
      path.join(outputDir, sourceFileName),
      "\uFEFF" + plainTextSource,
      "utf8",
    );
    console.log(`   ✅ Archivo creado: ${sourceFileName}`);
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL EXPORTADA (PARA SER USADA POR EL ORQUESTADOR)
// ============================================================

// ============================================================
// FUNCIONES AUXILIARES PARA DETECCIÓN DE MOMENTOS NARRATIVOS
// ============================================================

/**
 * Extrae segmentos del SSML cortando por <break>.
 * Devuelve un array de strings (cada uno es un bloque de texto entre breaks).
 * NO incluye las etiquetas <speak>, <prosody>, ni las etiquetas <break>.
 */
function extraerSegmentosPorBreak(ssml) {
  if (!ssml || typeof ssml !== "string") return [];

  // Quitar <speak> y <prosody> de apertura/cierre
  let contenido = ssml
    .replace(/<speak[^>]*>/gi, "")
    .replace(/<\/speak>/gi, "")
    .replace(/<prosody[^>]*>/gi, "")
    .replace(/<\/prosody>/gi, "")
    .trim();

  // Cortar por <break time="..."/> (cualquier duración)
  const partes = contenido.split(/<break\s+time="[^"]*"\s*\/?>/gi);

  // Limpiar cada segmento
  const segmentos = partes
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return segmentos;
}

/**
 * Llama a DeepSeek para refinar los segmentos brutos en 12-25 momentos narrativos.
 * Devuelve un array de objetos { indice, texto_inicio, descripcion_visual }.
 */
async function detectarMomentosNarrativos(segmentos, ctx) {
  if (!segmentos || segmentos.length === 0) return [];

  // Unir los segmentos numerados para pasárselos a la IA
  const segmentosNumerados = segmentos
    .map((seg, i) => `[${i + 1}] ${seg}`)
    .join("\n\n");

  const prompt = `Eres un editor narrativo experto. Te paso los segmentos de un guion para un video bíblico sobre ${ctx}, cortados por pausas dramáticas.

TAREA: Analizá los segmentos y agrupalos en 12-25 MOMENTOS NARRATIVOS. Un "momento narrativo" es un bloque donde se habla del mismo tema, personaje o sección. Cada momento puede contener 1 o varios segmentos consecutivos.

REGLAS:
1. Cada momento debe tener sentido narrativo propio.
2. NO fragmentes en exceso (no hagas 40 momentos).
3. NO fusiones en exceso (no hagas 5 momentos).
4. La cantidad óptima es 15-22 momentos.
5. El primer momento SIEMPRE es el gancho inicial.
6. El último momento SIEMPRE es la conclusión.
7. NINGÚN momento debe ser demasiado largo ni demasiado corto. Si un bloque de segmentos es muy extenso, dividilo en dos momentos. Si es muy corto, fusionálo con el siguiente.
8. La cantidad IDEAL es 15-22 momentos. Si te salen más de 25, fusioná los más cortos. Si te salen menos de 12, dividí los más largos.

SEGMENTOS:
${segmentosNumerados}

FORMATO DE SALIDA (JSON estricto):
{
  "momentos": [
    {
      "indice": 1,
      "inicio_segmento": 1,
      "fin_segmento": 2,
      "texto_inicio": "primeras palabras exactas del momento (20-30 caracteres)",
      "descripcion_visual": "descripción breve de qué mostrar visualmente (una línea, en español)"
    },
    ...
  ]
}

Devolvé SOLO el JSON, sin markdown, sin explicaciones.`;

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    if (!parsed.momentos || !Array.isArray(parsed.momentos)) {
      console.error("   ⚠️ La IA no devolvió momentos válidos.");
      return [];
    }

    console.log(`   📊 Momentos narrativos detectados: ${parsed.momentos.length}`);
    return parsed.momentos;
  } catch (error) {
    console.error("   ❌ Error detectando momentos narrativos:", error.message);
    return [];
  }
}

/**
 * Inserta las marcas <mark name="imagen_N"/> en el SSML, antes de cada momento narrativo.
 * Busca el texto exacto de inicio del momento y le inserta la marca antes.
 */

function insertarMarcasEnSSML(ssml, momentos) {
  if (!ssml || !momentos || momentos.length === 0) return ssml;

  // Ordenar los momentos por su índice (1, 2, 3, ...)
  const momentosOrdenados = [...momentos].sort(
    (a, b) => (a.indice || 0) - (b.indice || 0),
  );

  let ssmlConMarcas = ssml;
  let posicionAnterior = 0;

  for (let i = 0; i < momentosOrdenados.length; i++) {
    const momento = momentosOrdenados[i];
    const numImagen = i + 1;

    // Buscar texto de inicio con diferentes longitudes (fallback progresivo)
    const textosBuscar = [
      (momento.texto_inicio || "").substring(0, 25),
      (momento.texto_inicio || "").substring(0, 15),
      (momento.texto_inicio || "").substring(0, 10),
    ].filter((t) => t.length > 0);

    let posicion = -1;

    for (const texto of textosBuscar) {
      const pos = ssmlConMarcas.indexOf(texto, posicionAnterior);
      if (pos !== -1) {
        posicion = pos;
        break;
      }
    }

    if (posicion === -1) {
      console.error(
        `   ⚠️ No se encontró el momento ${numImagen} en el SSML.`,
      );
      continue;
    }

    // Insertar la marca justo antes del texto encontrado
    const marca = `<mark name="imagen_${numImagen}"/>`;
    ssmlConMarcas =
      ssmlConMarcas.slice(0, posicion) +
      marca +
      ssmlConMarcas.slice(posicion);

    // Actualizar la posición anterior (para la próxima búsqueda)
    posicionAnterior = posicion + marca.length;

    console.log(`   ✓ Momento ${numImagen} insertado en posición ${posicion}`);
  }

  return ssmlConMarcas;
}

export async function generarPromptsCapitulo(bookSlug, chapterNumber) {
  try {
    const chapterInfo = await fetchChapterResources(bookSlug, chapterNumber);
    console.log(
      `   ✅ Capítulo encontrado: ID ${chapterInfo.chapterId}, Libro: ${chapterInfo.bookName}`,
    );

    const context = await getResourcesForChapter(chapterInfo.chapterId);
    const plainTextSource = buildPlainTextSource(
      chapterInfo.bookName,
      chapterInfo.chapterNumber,
      context,
    );
    const promptsToGenerate = buildPrompts(
      chapterInfo.bookName,
      chapterInfo.chapterNumber,
      context,
    );

    const results = [];
    for (const p of promptsToGenerate) {
      const aiResponse = await generateWithAI(p);
      if (aiResponse) results.push({ type: p.type, data: aiResponse });
    }

    await saveFilesLocally(
      results,
      plainTextSource,
      chapterInfo.bookName,
      chapterInfo.chapterNumber,
      context.estudioTitulo,
    );
    // NUEVO: Generar artefactos para Video Automático (Azure + Replicate)
    // Extraemos el texto del estudio si existe

    // Presupuesto total para la fuente que va al SSML (en caracteres)
    const PRESUPUESTO_FUENTE = 70000;

    // 1. Sermón completo (limpio de HTML) — fuente narrativa principal
    const sermonLimpio = context.sermon
      ? context.sermon
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";

    // 2. Estudio completo (limpio de HTML) — fuente exegética
    const estudioLimpio = context.estudio
      ? context.estudio
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";

    // 3. Priorización dinámica: primero el sermón, el resto al estudio
    let sermonFinal = sermonLimpio;
    let estudioFinal = "";
    let presupuestoRestante = PRESUPUESTO_FUENTE;

    if (sermonLimpio.length <= presupuestoRestante) {
      presupuestoRestante -= sermonLimpio.length;
      estudioFinal = estudioLimpio.substring(0, presupuestoRestante);
    } else {
      sermonFinal = sermonLimpio.substring(0, presupuestoRestante);
      estudioFinal = "";
    }

    // 4. Armar el bloque final
    const textoEstudioAmpliado = `
TÍTULO DEL ESTUDIO: "${context.estudioTitulo}"

═══════════════════════════════════════
SERMÓN ${sermonFinal.length < sermonLimpio.length ? "(recortado)" : ""}
═══════════════════════════════════════
${sermonFinal}

═══════════════════════════════════════
ESTUDIO BÍBLICO ${estudioFinal.length < estudioLimpio.length ? "(recortado)" : ""}
═══════════════════════════════════════
${estudioFinal}
`;

    console.log(
      `📏 Fuente consolidada: ${textoEstudioAmpliado.length} caracteres (estudio: ${estudioFinal.length}, sermón: ${sermonFinal.length})`,
    );

    await generarArtefactosVideo(
      chapterInfo.bookName,
      chapterInfo.chapterNumber,
      textoEstudioAmpliado,
    );
    console.log(`   ✨ ¡Prompts listos para ${bookSlug} ${chapterNumber}!`);
    return true;
  } catch (error) {
    console.error(
      `   ❌ Error fatal en el workflow de prompts:`,
      error.message,
    );
    return false;
  }

  // NUEVOS ARTEFACTOS PARA PIPELINE DE VIDEO (rediseñado)
  // ============================================================

  async function generarArtefactosVideo(libro, capitulo, textoCapitulo) {
    console.log(
      `\n    [Paso 3.1] Generando artefactos para Video Automático...`,
    );

    // Guardar en la EXACTA misma carpeta que los otros 8 archivos del capítulo
    function quitarTildes(texto) {
      return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    const dir = path.join(
      "prompts_output",
      quitarTildes(libro.toLowerCase()),
      `Capitulo_${capitulo}`,
    );
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ctx = `${libro} capítulo ${capitulo}`;

    // --- PASO 1: GENERAR EL GUION SSML SIN MARCAS ---
    const promptSSML = `
Eres un guionista profesional de documentales bíblicos para YouTube, especializado en retención de audiencia y profundidad teológica. Escribís para el canal "Mahanaim", que se caracteriza por contenido exegético serio pero accesible, con narrativa envolvente.

TAREA: Genera un guion narrativo completo para un video de 18 a 22 minutos sobre ${ctx}, en formato SSML válido para Google Cloud Text-to-Speech.

Tenés acceso al estudio bíblico y al sermón del capítulo al final de este prompt. Usá ambos como material de base. El estudio aporta exégesis profunda y datos arqueológicos/lingüísticos. El sermón aporta estructura narrativa, aplicaciones y tono pastoral. NO inventes datos que no estén en estas fuentes ni en conocimiento bíblico ampliamente aceptado.


═══════════════════════════════════════
PERFIL DOCTRINAL QUE DEBES RESPETAR (CRÍTICO)
═══════════════════════════════════════

- Monoteísmo puro: Un solo Dios, el Padre. Jesucristo es Su Hijo y Mesías, preexistente, de Su esencia pero distinto y subordinado al Padre, con todo poder y autoridad conferido por el Padre.
- ⛔ REGLA INVIOLABLE SOBRE LA DEIDAD: En NINGÚN punto debes afirmar, sugerir ni dar a entender que existe una "Trinidad" o un "Dios trino" de tres personas divinas coiguales. NUNCA digas que Jesucristo es "Dios" o "Dios el Hijo" (es el HIJO de Dios). NUNCA digas que el Espíritu Santo es "Dios" ni una tercera persona divina (es el Espíritu de Dios y de Cristo). Un solo Dios: el Padre.
- Soteriología calvinista, escatología premilenial postribulacionista, cesacionismo moderado, teología de pactos reformada. Cristo es el hijo de Dios, El mesias, es preexistente, el padre le dio toda autoridad y poder, por medio de Cristo fue hecho todo. 

═══════════════════════════════════════
ESTRUCTURA OBLIGATORIA DEL GUION (respeta el orden)
═══════════════════════════════════════

1. GANCHO INICIAL (20-30 segundos):
   - Empezá con una pregunta intrigante, un dato sorprendente, o un contraste que despierte curiosidad inmediata.
   - NO empieces con "En este video vamos a..." ni "Bienvenidos a...". Empezá directo con el gancho.
   - Ejemplos de gancho efectivo:
     * "¿Qué harías si te dieran a elegir entre dos caminos, y uno de ellos te costara todo?"
     * "Hay una frase en este capítulo que ha perturbado a teólogos por siglos."
     * "El hombre más importante de su generación murió... y ni siquiera lo notaron."

2. CONTEXTO NARRATIVO (60-90 segundos):
   - Ubicá al oyente en el tiempo, lugar y circunstancia histórica con suficiente detalle para que se sienta transportado.
   - Presentá el conflicto central del capítulo sin resolverlo todavía.
   - Mencioná 1-2 datos culturales o históricos de la época que iluminen el pasaje.

3. DESARROLLO CON PROFUNDIDAD (4-5 minutos):
   - Recorré el capítulo paso a paso, PERO no como un resumen plano.
   - Incluí AL MENOS 4 de estos recursos distribuidos en el desarrollo:
     * Análisis de una PALABRA CLAVE del hebreo/griego original (significado, matiz, uso en otros pasajes).
     * Conexión profética o tipológica con otro pasaje bíblico (AT → NT, o NT → consumación).
     * Dato del contexto arqueológico o cultural que ilumine el pasaje.
     * Contraste entre lo que parecía y lo que realmente fue.
     * Detalle exegético del estudio o del sermón que profundice el sentido.
   - Mantené tensión narrativa: dejá preguntas abiertas que se resuelven más adelante.
   - Marcá los cambios de escena narrativa con pausas naturales (no forzadas).

4. APLICACIÓN TRANSFORMADORA (90-120 segundos):
   - NO uses frases genéricas tipo "debemos confiar más en Dios" o "aprendamos a ser fieles".
   - En cambio, formulá una verdad específica y conmovedora que nazca del pasaje.
   - Conectala con una situación real que el oyente pueda estar viviendo.
   - Ejemplo: "Si estás en medio de un silencio de Dios que ya lleva demasiado tiempo, este capítulo te muestra que..."

5. CONCLUSIÓN IMPACTANTE (45-60 segundos):
   - Volvé al gancho inicial y resolvelo con la verdad central del capítulo.
   - Cerrá con una frase memorable, corta y potente (que el oyente pueda recordar).
   - Terminá con una oración breve (3-4 líneas), no genérica, que fluya de todo el guion.

═══════════════════════════════════════
REGLAS DE ESTILO Y SSML
═══════════════════════════════════════

1. Devolvé SOLO código XML SSML válido, empezando con:
   <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-US">
   y terminando con </speak>.

2. Envolvé TODO el guion (entre <speak> y </speak>) en UNA SOLA etiqueta:
   <prosody rate="medium" pitch="-2%">
   Este es el ritmo conversacional normal. NUNCA uses rate="slow" para la narración general.

3. Usá <break time="800ms"/> entre párrafos y <break time="1.5s"/> para pausas dramáticas después de frases clave.

4. Usá <emphasis level="moderate"> para palabras clave teológicas o giros importantes.

5. NO uses <prosody rate="slow"> en ningún caso. La velocidad de lectura debe mantenerse constante (rate="medium") durante TODO el guion, incluidas las citas bíblicas. Para marcar solemnidad en las citas, usá únicamente pausas antes y después (<break time="1.5s"/>). La reducción de velocidad suena artificial en la narración continua.

6. NO insertes NINGUNA etiqueta <mark> en el guion. El guion debe salir limpio, sin marcas de sincronización. Las marcas <mark> se agregan en un paso posterior del pipeline. Tu tarea es SOLO generar el guion narrativo completo con los <break> dramáticos.

7. Duración objetivo: 2.600-3.000 palabras MÁXIMO (15-18 minutos de narración a velocidad media). NO superes las 3.000 palabras bajo ninguna circunstancia. El guion completo con etiquetas SSML NO debe superar los 22.000 caracteres. Si estás cerca del límite, TERMINÁ el guion aunque falten detalles secundarios. Es preferible un guion conciso y bien estructurado que uno largo y denso.

═══════════════════════════════════════
ESTRUCTURA DE RETENCIÓN NARRATIVA (CRÍTICO PARA 20 MIN)
═══════════════════════════════════════

Para mantener la atención durante 20 minutos, el guion DEBE incluir estos elementos:

1. GANCHO INICIAL (30-45 segundos):
   - Pregunta intrigante, dato sorprendente o contraste impactante.
   - Promesa implícita de lo que el oyente va a descubrir.

2. MICRO-CLIFFHANGERS cada 3-4 minutos:
   - Insertá preguntas abiertas que se resuelven 2-3 minutos después.
   - Cada cliffhanger genera "mini tensión" que el oyente quiere resolver.

3. VARIEDAD DE RITMO:
   - Alterná entre: narrativa, exégesis profunda, ilustración, aplicación.
   - NO dejes más de 90 segundos de pura exégesis técnica sin una ilustración o aplicación.

4. MOMENTOS DE REVELACIÓN ("ajás"):
   - Al menos 3-4 momentos donde el oyente diga "no sabía eso".
   - Cada uno debe apoyarse en una palabra del original, un dato arqueológico, o una conexión profética.

5. PAUSAS DRAMÁTICAS:
   - Usá <break time="1.5s"/> o <break time="2s"/> antes de puntos clave.
   - El silencio prepara al oyente para lo importante.

6. SECCIÓN DE APLICACIÓN EXPANDIDA (2-3 minutos):
   - No seas genérico. Conectá con situaciones reales: ansiedad, soledad, decisiones difíciles.
   - Cada aplicación debe nacer del texto, no ser un añadido moralista.

7. CONCLUSIÓN QUE CIERRA EL CÍRCULO (1-1.5 minutos):
   - Volvé al gancho inicial y respondelo con la verdad del capítulo.
   - Frase final memorable y breve.
   - Oración corta (3-4 líneas).

8. Tono: reverente pero accesible. Profundo pero claro. Apasionado pero respetuoso.

═══════════════════════════════════════
MATERIAL DE REFERENCIA (estudio bíblico y sermón)
═══════════════════════════════════════
${textoCapitulo}

Generá el guion SSML completo ahora. Recordá:
1. SOLO el XML, sin explicaciones, sin markdown, sin comentarios fuera de las etiquetas SSML válidas.
2. NO incluyas NINGUNA etiqueta <mark>. El guion va limpio.
3. Los <break> son importantes: usá <break time="1.5s"/> en cambios narrativos reales (cambio de tema, personaje o sección), y <break time="800ms"/> entre párrafos comunes.
`;

    let ssmlLimpio = "";
    try {
      const resSSML = await fetch(
        process.env.LLM_BASE_URL ||
          "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.LLM_MODEL || "deepseek-chat",
            messages: [{ role: "user", content: promptSSML }],
            temperature: 0.5,
            max_tokens: 20000,
          }),
        },
      );
      const dataSSML = await resSSML.json();
      ssmlLimpio = dataSSML.choices[0]?.message?.content || "";
      ssmlLimpio = ssmlLimpio
        .replace(/```xml\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      if (!ssmlLimpio) {
        throw new Error("La IA devolvió un SSML vacío.");
      }
      console.log(`   ✅ SSML limpio generado (${ssmlLimpio.length} caracteres).`);
    } catch (e) {
      console.error("   ⚠️ Error generando guion SSML:", e.message);
      return;
    }

    // --- PASO 2: EXTRAER SEGMENTOS POR <break> ---
    const segmentos = extraerSegmentosPorBreak(ssmlLimpio);
    console.log(`   📄 Segmentos extraídos: ${segmentos.length}`);

    if (segmentos.length === 0) {
      console.error("   ⚠️ No se pudieron extraer segmentos del SSML.");
      return;
    }

    // --- PASO 3: DETECTAR MOMENTOS NARRATIVOS CON IA ---
    const momentos = await detectarMomentosNarrativos(segmentos, ctx);

    if (!momentos || momentos.length === 0) {
      console.error("   ⚠️ No se detectaron momentos narrativos.");
      return;
    }

    // --- PASO 4: INSERTAR MARCAS EN EL SSML ---
    const ssmlConMarcas = insertarMarcasEnSSML(ssmlLimpio, momentos);

    // Verificar que se insertaron todas las marcas
    const marcasInsertadas = (
      ssmlConMarcas.match(/<mark\s+name="imagen_\d+"\s*\/?>/gi) || []
    ).length;
    console.log(
      `   📌 Marcas insertadas: ${marcasInsertadas} de ${momentos.length}`,
    );

    // Guardar SSML final con marcas
    fs.writeFileSync(`${dir}/guion_video_tts.ssml`, ssmlConMarcas, "utf8");
    console.log(`   ✅ guion_video_tts.ssml guardado (${ssmlConMarcas.length} caracteres).`);

    // --- PASO 5: GENERAR PROMPTS DE IMÁGENES BASADOS EN LOS MOMENTOS ---
    const listaMomentos = momentos
      .map(
        (m) =>
          `[Momento ${m.indice}] Descripción visual: ${m.descripcion_visual}`,
      )
      .join("\n");

    const promptImagenes = `
Eres un director de arte cinematográfico e historiador bíblico con expertise en contextos culturales de todas las épocas.

TAREA: Generá EXACTAMENTE ${momentos.length} prompts detallados (en INGLÉS) para IA de generación de imágenes fotorrealistas. Cada prompt corresponde a UNO de los momentos narrativos del video sobre ${ctx}. La cantidad es EXACTA: ${momentos.length}. No generes más ni menos.

REGLAS UNIVERSALES PARA CADA PROMPT:

A) COHERENCIA HISTÓRICA Y CULTURAL:
- Cada prompt debe incluir al inicio un bloque de contexto de época específico a ESTE capítulo.
- Vestimenta, arquitectura, herramientas, mobiliario y entorno exactos a esa época y cultura.
- Paleta de colores coherente con la escena (ámbar, ocre y dorado para escenas diurnas; azules fríos para nocturnas).
- PROHIBIDO: cualquier objeto moderno o fuera de época. Prohibido mezclar culturas o siglos.

B) GÉNERO EXPLÍCITO EN PERSONAJES CON NOMBRE:
- Cada vez que un personaje con nombre aparezca, aclaralo entre paréntesis con su género.
- Ejemplo: "Rebekah (a woman)", "Abraham (a man)", "the midwife (a woman)", "the infant (a baby boy)".

C) HUMANIDAD Y PROPORCIONES:
- Todos los personajes son seres humanos completos y normales.
- PROPORCIONES HUMANAS CORRECTAS: adultos con proporciones adultas, niños con proporciones infantiles.
- Al final de cada prompt: "fully human anatomy with correct adult-child proportions, natural hands, no deformed fingers, no floating heads, no cut-off bodies, no dismembered limbs".

D) POSE, COMPOSICIÓN Y MULTITUDES:
- Poses explícitas. Figuras humanas completas.
- MULTITUDES: proporciones correctas, sin "enanos" al fondo.

E) AUTO-SUFICIENCIA:
- Cada prompt debe entenderse por sí solo. Todo el contexto dentro del string.

F) ESTILO VISUAL:
- Ilustración cinematográfica hiperrealista con realismo estilizado (semi-stylized realism).
- Iluminación dramática (35mm film aesthetic, shallow depth of field).
- Texturas hiperrealistas de piel y telas. Sin efecto "plástico CGI".
- NO caricatura, NO cartoon, NO Pixar/Disney, NO "pintura devocional del s.XIX".
- Relación de aspecto 16:9 al final (--ar 16:9).

G) PROHIBICIONES:
- NO texto, letras ni marcas de agua.
- NO rostros reconocibles de personas modernas.
- NO símbolos cristianos anacrónicos.

═══════════════════════════════════════
LISTA DE MOMENTOS NARRATIVOS (${momentos.length} momentos)
═══════════════════════════════════════

${listaMomentos}

═══════════════════════════════════════
CONTEXTO DEL CAPÍTULO (para coherencia general)
═══════════════════════════════════════
${textoCapitulo.substring(0, 8000)}

FORMATO DE SALIDA (obligatorio):
SOLO un array JSON de EXACTAMENTE ${momentos.length} strings en INGLÉS. Sin texto adicional. Ejemplo:
["Cinematic prompt 1... --ar 16:9", "Cinematic prompt 2... --ar 16:9", ...]
`;

    try {
      const resImg = await fetch(
        process.env.LLM_BASE_URL ||
          "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.LLM_MODEL || "deepseek-chat",
            messages: [{ role: "user", content: promptImagenes }],
            temperature: 0.7,
            max_tokens: 16000,
          }),
        },
      );
      const dataImg = await resImg.json();
      let contenidoImg = dataImg.choices[0]?.message?.content || "[]";
      contenidoImg = contenidoImg
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      // Validar que sea un array JSON con la cantidad correcta
      let arrayPrompts;
      try {
        arrayPrompts = JSON.parse(contenidoImg);
      } catch (err) {
        console.error("   ⚠️ La IA no devolvió un JSON válido de prompts.");
        console.error("   📄 Primeros 300 chars:", contenidoImg.substring(0, 300));
        return;
      }

      if (!Array.isArray(arrayPrompts)) {
        console.error("   ⚠️ El output no es un array.");
        return;
      }

      if (arrayPrompts.length !== momentos.length) {
        console.warn(
          `   ⚠️ ADVERTENCIA: Se esperaban ${momentos.length} prompts, la IA devolvió ${arrayPrompts.length}.`,
        );
        console.warn(`   ⚠️ Se recortarán o rellenarán para coincidir.`);

        if (arrayPrompts.length > momentos.length) {
          arrayPrompts = arrayPrompts.slice(0, momentos.length);
        } else {
          // Rellenar con prompts genéricos si faltan
          while (arrayPrompts.length < momentos.length) {
            arrayPrompts.push(
              `Ancient biblical scene, cinematic hyperrealistic illustration, correct adult-child proportions, natural hands, no anachronisms, --ar 16:9`,
            );
          }
        }
      }

      fs.writeFileSync(
        `${dir}/prompts_imagenes_video.json`,
        JSON.stringify(arrayPrompts, null, 2),
        "utf8",
      );
      console.log(
        `   ✅ prompts_imagenes_video.json guardado (${arrayPrompts.length} prompts).`,
      );
    } catch (e) {
      console.error("   ⚠️ Error generando prompts de imagen:", e.message);
    }
  }
}
