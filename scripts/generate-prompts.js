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

  // NUEVOS ARTEFACTOS PARA PIPELINE DE VIDEO (Azure + Replicate)
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

    // --- 1. PROMPTS DE IMÁGENES (Para Replicate/DALL-E) ---
    const promptImagenes = `
Eres un director de arte cinematográfico e historiador bíblico con expertise en contextos culturales de todas las épocas (patriarcal, egipcia, israelita, babilónica, persa, greco-romana, apostólica, etc.).

TAREA: Genera un array JSON con exactamente 12 prompts detallados (en INGLÉS) para IA de generación de imágenes fotorrealistas (Flux, Midjourney, DALL-E) que ilustrarán un video documental sobre: ${ctx}.

PASO 1 — IDENTIFICAR CONTEXTO Y PERSONAJES (crítico):
Antes de generar los prompts, analizá internamente:

A) CONTEXTO HISTÓRICO-CULTURAL:
- Época aproximada (siglo, año a.C./d.C., período histórico)
- Cultura y pueblo protagonista
- Región geográfica
- Estrato social y vestimenta típica

B) PERSONAJES QUE APARECEN:
Listá cada personaje humano que va a aparecer en las 12 imágenes. Para cada uno identificá:
- Nombre propio (si lo tiene)
- Género (hombre / mujer / niño / niña) — CRÍTICO
- Edad aproximada
- Rol en la narrativa (protagonista, secundario, multitud)

PASO 2 — REGLAS UNIVERSALES PARA CADA PROMPT:

A) COHERENCIA HISTÓRICA Y CULTURAL:
- Cada prompt debe incluir al inicio un bloque de contexto de época específico a ESTE capítulo (ej: "Ancient Egypt, New Kingdom period, c. 1440 BC, enslaved Hebrew people").
- Vestimenta, arquitectura, herramientas, armas (si las hay), mobiliario y entorno exactos a esa época y cultura.
- PROHIBIDO: cualquier objeto moderno o fuera de época (armas de fuego, ropa contemporánea, casas de estilos posteriores, tecnología, relojes, gafas, vehículos).
- Prohibido mezclar elementos de distintas culturas o siglos en la misma imagen.

B) GÉNERO EXPLÍCITO EN PERSONAJES CON NOMBRE (crítico):
- Cada vez que un personaje con nombre aparezca en un prompt, aclaralo explícitamente entre paréntesis junto al nombre. Ejemplos:
  * "Rebekah (a woman with long dark hair, no masculine features)"
  * "Abraham (a man with a long grey beard)"
  * "the midwife (a woman)"
  * "Isaac (a young man)" / "the infant (a baby boy)"
- Esto es OBLIGATORIO para evitar que el modelo confunda el género.

C) HUMANIDAD EXPLÍCITA (crítico):
- Todos los personajes son seres humanos completos y normales.
- Si un personaje tiene características rústicas o primitivas (piel de animal, pelo corporal, fuerza bruta, apariencia salvaje), aclaralo como rasgo HUMANO:
  * "Esau (a fully human muscular man with thick red-brown human body hair — human hair, not fur, no horns, no claws, no animal features)"
- Al final de cada prompt donde haya un personaje con estas características, agregá: "fully human anatomy only, no animal features, no horns, no fur, no claws".
- Prohibido: cabezas flotantes, cuerpos cortados, miembros desconectados, composiciones ambiguas.

D) POSE Y COMPOSICIÓN CLARA:
- Poses explícitas: si alguien sostiene algo, decirlo. Si alguien está solo, decirlo. Si alguien está de pie o sentado, decirlo.
- Figuras humanas completas o claramente visibles (busto solo si el prompt lo especifica).
- Anatomía natural, proporciones correctas, manos y rostros bien formados.

E) AUTO-SUFICIENCIA DEL PROMPT (crítico):
- Cada uno de los 12 prompts debe poder entenderse por sí solo, sin referencias a "el estudio", "el capítulo", "la escena anterior", "el pasaje", etc.
- Todo el contexto necesario (época, cultura, quién es quién, qué está pasando) debe estar descrito DENTRO del mismo string del prompt.

F) ESTILO VISUAL:
- Fotorrealismo hiperrealista, estilo documental cinematográfico.
- Iluminación dramática y naturalista (35mm, shallow depth of field).
- NO caricatura, NO CGI genérico, NO ilustración estilizada, NO "pintura devocional del s.XIX".
- Paleta de colores coherente con la escena.
- Relación de aspecto 16:9 al final de cada prompt (--ar 16:9).

G) PROHIBICIONES GENERALES:
- NO incluir texto, letras, símbolos legibles, ni marcas de agua en las imágenes.
- NO rostros reconocibles de personas reales modernas.
- NO cruces ni símbolos cristianos anacrónicos a la época del pasaje.

PASO 3 — ESTRUCTURA DE CADA PROMPT:
Cada uno de los 12 prompts debe seguir este orden:
[bloque de época y cultura] + [personaje/s con género y humanidad explícitos] + [descripción de la escena y la acción] + [entorno y arquitectura] + [iluminación y atmósfera] + [estilo fotográfico] + [restricciones negativas breves] + --ar 16:9

PASO 4 — COBERTURA NARRATIVA:
Los 12 prompts deben cubrir la secuencia narrativa del capítulo en orden: apertura, desarrollo, momentos clave, clímax, cierre. Deben poder concatenarse como storyboard del video.

FORMATO DE SALIDA (obligatorio):
SOLO un array JSON de 12 strings en INGLÉS. Sin texto adicional, sin explicaciones, sin markdown. Ejemplo:
["Cinematic prompt 1... --ar 16:9", "Cinematic prompt 2... --ar 16:9", ...]

CONTEXTO DEL CAPÍTULO (usalo para identificar personajes y coherencia, NO lo copies literal en los prompts):
${textoCapitulo.substring(0, 6000)}
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
          }),
        },
      );
      const dataImg = await resImg.json();
      let contenidoImg = dataImg.choices[0]?.message?.content || "[]";
      contenidoImg = contenidoImg
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      // GUARDAR EN LA CARPETA RAÍZ
      fs.writeFileSync(
        `${dir}/prompts_imagenes_video.json`,
        contenidoImg,
        "utf8",
      );
      console.log(`   ✅ prompts_imagenes_video.json guardado.`);
    } catch (e) {
      console.error("   ⚠️ Error generando prompts de imagen:", e.message);
    }

    // --- 2. GUION SSML (Para Azure TTS) ---
    const promptSSML = `
Eres un guionista profesional de documentales bíblicos para YouTube, especializado en retención de audiencia y profundidad teológica. Escribís para el canal "Mahanaim", que se caracteriza por contenido exegético serio pero accesible, con narrativa envolvente.

TAREA: Genera un guion narrativo completo para un video de 8 a 10 minutos sobre ${ctx}, en formato SSML válido para Google Cloud Text-to-Speech.

Tenés acceso al estudio bíblico y al sermón del capítulo al final de este prompt. Usá ambos como material de base. El estudio aporta exégesis profunda y datos arqueológicos/lingüísticos. El sermón aporta estructura narrativa, aplicaciones y tono pastoral. NO inventes datos que no estén en estas fuentes ni en conocimiento bíblico ampliamente aceptado.

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

5. Usá <prosody rate="slow"> ÚNICAMENTE para citas textuales de la Escritura (entre comillas), anidada dentro del prosody general.

6. Marcas de sincronización <mark name="imagen_N"/> (CRÍTICO):
   - Insertá EXACTAMENTE 12 marcas: <mark name="imagen_1"/>, <mark name="imagen_2"/>, ..., <mark name="imagen_12"/>.
   - Cada marca debe ir JUSTO ANTES de la frase donde cambia la escena visual.
   - Distribución OBLIGATORIA (aprox. 60-70 segundos entre marcas):
     * imagen_1: al inicio absoluto del guion (antes del gancho).
     * imagen_2: al inicio del contexto narrativo (después del gancho).
     * imagen_3 a imagen_10: distribuidas uniformemente en el desarrollo y la aplicación (aprox. cada 60-70 segundos, NO mecánicamente, sino donde cambia la escena).
     * imagen_11: en el inicio de la conclusión impactante.
     * imagen_12: en la MITAD de la conclusión (por ejemplo, antes de la oración final).
   - REGLAS CRÍTICAS DE DISTRIBUCIÓN:
     * NINGUNA imagen debe durar más de 90 segundos.
     * NINGUNA imagen debe durar menos de 30 segundos (excepto imagen_1 que puede ser más corta).
     * La última imagen (imagen_12) NO debe empezar en el inicio de la conclusión. Debe empezar en la mitad de la conclusión, dejando solo 30-60 segundos hasta el final.
     * Si el guion total dura ~12-13 minutos, cada una de las 12 imágenes debe durar en promedio ~60-70 segundos.
   - IMPORTANTE: las marcas deben coincidir con el contenido visual correspondiente de cada sección.

7. Duración objetivo: 1400-1700 palabras (8-10 minutos de narración a velocidad media).

8. Tono: reverente pero accesible. Profundo pero claro. Apasionado pero respetuoso.

═══════════════════════════════════════
MATERIAL DE REFERENCIA (estudio bíblico y sermón)
═══════════════════════════════════════
${textoCapitulo}

Generá el guion SSML completo ahora. Recordá: SOLO el XML, sin explicaciones, sin markdown, sin comentarios fuera de las etiquetas SSML válidas.
`;
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
            max_tokens: 10000,
          }),
        },
      );
      const dataSSML = await resSSML.json();
      let contenidoSSML = dataSSML.choices[0]?.message?.content || "";
      contenidoSSML = contenidoSSML
        .replace(/```xml\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      // GUARDAR EN LA CARPETA RAÍZ
      fs.writeFileSync(`${dir}/guion_video_tts.ssml`, contenidoSSML, "utf8");
      console.log(`   ✅ guion_video_tts.ssml guardado.`);
    } catch (e) {
      console.error("   ⚠️ Error generando guion SSML:", e.message);
    }
  }
}
