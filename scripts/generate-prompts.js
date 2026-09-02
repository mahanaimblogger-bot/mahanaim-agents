import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { writeFileSync, mkdirSync } from 'fs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const bookSlug = process.env.BOOK_SLUG;
const chapterNumber = parseInt(process.env.CHAPTER_NUMBER);

// ============================================================
// FUNCIONES AUXILIARES PARA MAPAS INTERACTIVOS
// ============================================================

function generateGoogleMapsEmbedUrl(lat, lng, placeName = '') {
  const nameParam = placeName ? encodeURIComponent(placeName) : '';
  return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d50000!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${lat}, ${lng}!5e1!3m2!1ses!2s!4v1`;
}

function generateMapResourceHTML(titulo, ubicaciones, bookName, chapterNum) {
  let html = `
<div style="text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 3px solid #d4ac0d;">
  <h1 style="color: #1a3a5c; font-family: 'Georgia', serif; font-size: 2rem; margin-bottom: 0.5rem;">${titulo}</h1>
  <h2 style="color: #5d4037; font-family: 'Georgia', serif; font-size: 1.2rem; font-weight: normal;">${bookName} Capítulo ${chapterNum}</h2>
</div>

<div style="background: #fdfbf7; padding: 1.5rem; border-radius: 12px; border: 2px solid #d4c4a8; margin-bottom: 2rem;">
  <h3 style="color: #1a3a5c; margin-top: 0;">📍 Ubicaciones Bíblicas del Capítulo</h3>
  <p style="line-height: 1.8; color: #3e2723;">
    Este mapa interactivo muestra las ubicaciones geográficas mencionadas en el estudio. 
    Algunas son confirmadas arqueológicamente, otras son probables según la evidencia histórica.
  </p>
</div>
`;

  ubicaciones.forEach((ubicacion, index) => {
    const embedUrl = generateGoogleMapsEmbedUrl(ubicacion.latitud, ubicacion.longitud, ubicacion.nombre);
    const certezaIcon = ubicacion.certeza === 'confirmada' ? '✅' : 
                        ubicacion.certeza === 'probable' ? '🟡' : '⚠️';
    
    html += `
<div style="margin-bottom: 2.5rem;">
  <h3 style="color: #1a3a5c; border-left: 5px solid #d4ac0d; padding-left: 1rem; margin-bottom: 1rem;">
    ${index + 1}. ${ubicacion.nombre} ${certezaIcon}
  </h3>
  
  <div style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 1rem 0; border: 2px solid #d4c4a8;">
    <iframe 
      src="${embedUrl}" 
      width="100%" 
      height="400" 
      style="border:0;" 
      allowfullscreen="" 
      loading="lazy" 
      referrerpolicy="strict-origin-when-cross-origin">
    </iframe>
  </div>
  
  <div style="background: #f5f2eb; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
    <p style="margin: 0 0 0.5rem 0;"><strong>📖 Referencia:</strong> ${ubicacion.referencia_biblica}</p>
    <p style="margin: 0 0 0.5rem 0;"><strong>📍 Coordenadas:</strong> ${ubicacion.latitud}°N, ${ubicacion.longitud}°E</p>
    <p style="margin: 0 0 0.5rem 0;"><strong>🏛️ Contexto Histórico:</strong> ${ubicacion.contexto_historico}</p>
    <p style="margin: 0;"><strong>✝️ Importancia Teológica:</strong> ${ubicacion.importancia_teologica}</p>
  </div>
  
  <div style="background: ${ubicacion.certeza === 'confirmada' ? '#d4edda' : '#fff3cd'}; 
              padding: 0.8rem; border-radius: 6px; border-left: 4px solid ${ubicacion.certeza === 'confirmada' ? '#28a745' : '#ffc107'};">
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
    Las <strong>"debatidas"</strong> o <strong>"desconocidas"</strong> reflejan incertidumbre debido a cambios 
    geográficos históricos, limitaciones arqueológicas o interpretaciones divergentes de los textos antiguos.
  </p>
</div>
`;

  return html;
}

// ============================================================
// FUNCIONES EXISTENTES
// ============================================================

function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchChapterResources() {
  console.log(`🔍 Buscando recursos para ${bookSlug} capítulo ${chapterNumber}...`);
  
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, nombre, slug')
    .eq('slug', bookSlug)
    .single();

  if (bookError || !book) throw new Error(`Libro no encontrado: ${bookSlug}`);

  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id, numero')
    .eq('book_id', book.id)
    .eq('numero', chapterNumber)
    .single();

  if (chapterError || !chapter) throw new Error(`Capítulo ${chapterNumber} no encontrado para ${bookSlug}`);

  return {
    chapterId: chapter.id,
    bookName: book.nombre,
    bookSlug: book.slug,
    chapterNumber
  };
}

async function getResourcesForChapter(chapterId) {
  console.log(`📚 Obteniendo recursos para chapter_id: ${chapterId}...`);
  
  const { data: resources, error } = await supabase
    .from('resources')
    .select('tipo, contenido_html, titulo')
    .eq('chapter_id', chapterId);

  if (error) throw error;

  return {
    estudioTitulo: resources.find(r => r.tipo === 'estudio')?.titulo || 'Estudio Bíblico',
    estudio: resources.find(r => r.tipo === 'estudio')?.contenido_html || '',
    sermon: resources.find(r => r.tipo === 'sermon')?.contenido_html || '',
    infografia: resources.find(r => r.tipo === 'infografia')?.contenido_html || '',
    arqueologia: resources.find(r => r.tipo === 'contexto_arqueologico')?.contenido_html || '',
    palabras: resources.find(r => r.tipo === 'palabras_clave')?.contenido_html || '',
    citasTeologos: resources.find(r => r.tipo === 'citas_teologos')?.contenido_html || '',
    citasLibros: resources.find(r => r.tipo === 'citas_libros')?.contenido_html || '',
  };
}

function buildPlainTextSource(bookName, chapterNum, context) {
  let source = `FUENTE CONSOLIDADA PARA NOTEBOOKLM\nLIBRO: ${bookName}\nCAPÍTULO: ${chapterNum}\n========================================\n\n`;
  if (context.estudio) source += `--- ESTUDIO BÍBLICO: ${context.estudioTitulo} ---\n${cleanHtml(context.estudio)}\n\n`;
  if (context.sermon) source += `--- SERMÓN ---\n${cleanHtml(context.sermon)}\n\n`;
  if (context.infografia) source += `--- INFOGRAFÍA DOCTRINAL ---\n${cleanHtml(context.infografia)}\n\n`;
  if (context.arqueologia) source += `--- CONTEXTO ARQUEOLÓGICO ---\n${cleanHtml(context.arqueologia)}\n\n`;
  if (context.palabras) source += `--- PALABRAS CLAVE ---\n${cleanHtml(context.palabras)}\n\n`;
  if (context.citasTeologos) source += `--- CITAS DE TEÓLOGOS ---\n${cleanHtml(context.citasTeologos)}\n\n`;
  if (context.citasLibros) source += `--- CITAS DE LIBROS ---\n${cleanHtml(context.citasLibros)}\n\n`;
  return source;
}

function buildPrompts(bookName, chapterNum, context) {
  const baseInfo = `
  LIBRO: ${bookName} | CAPÍTULO: ${chapterNum}
  TÍTULO DEL ESTUDIO: "${context.estudioTitulo}"
  [ESTUDIO]: ${context.estudio.substring(0, 1500)}
  [SERMÓN]: ${context.sermon.substring(0, 1500)}
  [INFOGRAFÍA]: ${context.infografia.substring(0, 1000)}
  [ARQUEOLOGÍA]: ${context.arqueologia.substring(0, 800)}
  [PALABRAS]: ${context.palabras.substring(0, 800)}
  [CITAS]: ${context.citasTeologos.substring(0, 800)} ${context.citasLibros.substring(0, 800)}
  `;

  return [
    {
      type: 'prompt_video',
      system: "Eres un experto en producción de contenido viral cristiano con profundidad teológica.",
      user: `Analiza esta información y genera 2 prompts para NotebookLM (Estilo Visual máx 4000 chars, Contenido Narrativo máx 4000 chars). Regla: usa solo 1 cita de autoridad. Formato JSON: { "prompt_estilo_visual": "...", "prompt_contenido_narrativo": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_audio',
      system: "Eres un experto en producción de podcasts cristianos con profundidad teológica.",
      user: `Analiza esta información y genera 1 prompt para NotebookLM (Audio Debate, máx 4000 chars). Fases: Apertura, Exploración Exegética, Tensión Teológica y Cierre Pastoral. Regla: solo 1 cita. Formato JSON: { "prompt_audio": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_mapa',
      system: "Eres un experto en teología bíblica y aprendizaje visual.",
      user: `Analiza esta información y genera 1 prompt para un Mapa Mental esquemático en NotebookLM (máx 4000 chars). Incluye: tema central, versículos clave, palabras originales. Formato JSON: { "prompt_mapa_mental": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_diapositivas',
      system: "Eres un experto en educación bíblica y diseño instruccional.",
      user: `Analiza esta información y genera 1 prompt para una presentación de 5 a 7 diapositivas en NotebookLM (máx 4000 chars). Estructura: Portada, Desarrollo, Conclusión. Formato JSON: { "prompt_diapositivas": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_miniatura',
      system: "Eres un experto en diseño de miniaturas virales para YouTube y prompt engineering para IA generativa de imágenes.",
      user: `Analiza esta información y genera UN prompt en INGLÉS para crear una miniatura de YouTube ultra-llamativa. 
      REQUISITOS: 1. Estilo cinematográfico/hiperrealista. 2. Alto contraste y espacio negativo para texto. 3. Instruye a la IA para incluir el texto exacto: "${context.estudioTitulo}" en letras grandes y legibles. 4. Colores vibrantes. 
      Formato JSON: { "prompt_miniatura_youtube": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_descripcion',
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
      
      Formato JSON: { "descripcion_youtube": "..." } (Usa saltos de línea \\n para formatear).\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_mapa_interactivo',
      system: "Eres un experto en geografía bíblica, arqueología del antiguo oriente próximo y teología. Tu trabajo es identificar ubicaciones geográficas mencionadas en el estudio bíblico y crear recursos de mapa interactivo educativos.",
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

Genera el recurso de mapa en formato JSON completo.`
    }
  ];
}

async function generateWithAI(promptData) {
  console.log(`🤖 Generando: ${promptData.type}...`);
  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat", 
      messages: [
        { role: "system", content: promptData.system },
        { role: "user", content: promptData.user }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(` Error en IA para ${promptData.type}:`, error.message);
    return null;
  }
}

async function saveFilesLocally(results, plainTextSource, bookName, chapterNum, studyTitle) {
  console.log("💾 Generando archivos de texto para descargar...");
  const outputDir = 'prompts_output';
  mkdirSync(outputDir, { recursive: true });

  for (const result of results) {
    if (!result) continue;
    const jsonData = result.data;
    let fileContent = '';
    let fileName = '';

    if (result.type === 'prompt_video') {
      fileName = `1_VIDEO_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPTS PARA VIDEO - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 PROMPT 1 - ESTILO VISUAL:\n───────────────────────────────────────────\n${jsonData.prompt_estilo_visual}\n\n📋 PROMPT 2 - CONTENIDO NARRATIVO:\n───────────────────────────────────────────\n${jsonData.prompt_contenido_narrativo}\n`;
    } else if (result.type === 'prompt_audio') {
      fileName = `2_AUDIO_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA AUDIO/PODCAST - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n INSTRUCCIONES:\n───────────────────────────────────────────\n${jsonData.prompt_audio}\n`;
    } else if (result.type === 'prompt_mapa') {
      fileName = `3_MAPA_MENTAL_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA MAPA MENTAL - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 INSTRUCCIONES:\n───────────────────────────────────────────\n${jsonData.prompt_mapa_mental}\n`;
    } else if (result.type === 'prompt_diapositivas') {
      fileName = `4_DIAPOSITIVAS_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA DIAPOSITIVAS - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n INSTRUCCIONES:\n───────────────────────────────────────────\n${jsonData.prompt_diapositivas}\n`;
    } else if (result.type === 'prompt_miniatura') {
      fileName = `5_MINIATURA_YOUTUBE_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA MINIATURA DE YOUTUBE (IA)\nLibro: ${bookName} | Capítulo: ${chapterNum}\nTítulo del Estudio: "${studyTitle}"\n═══════════════════════════════════════════\n\n📋 INSTRUCCIONES:\nCopia el siguiente prompt (en inglés) y pégalo en Midjourney/DALL-E 3.\n\n───────────────────────────────────────────\n${jsonData.prompt_miniatura_youtube}\n───────────────────────────────────────────\n\n💡 CONSEJO: Si la IA falla con el texto, genera la imagen sin texto y agrégalo luego en Canva con fuente gruesa.`;
    } else if (result.type === 'prompt_descripcion') {
      fileName = `6_DESCRIPCION_YOUTUBE_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nDESCRIPCIÓN OPTIMIZADA PARA YOUTUBE\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 COPIA Y PEGA ESTO EN LA DESCRIPCIÓN DE TU VIDEO:\n───────────────────────────────────────────\n${jsonData.descripcion_youtube}\n───────────────────────────────────────────\n\n💡 NOTA: Los timestamps son sugerencias basadas en la estructura del video. Ajustalos según la duración final.`;
    } else if (result.type === 'prompt_mapa_interactivo') {
      fileName = `7_MAPA_INTERACTIVO_${bookName}_Cap${chapterNum}.txt`;
      
      const mapaData = jsonData;
      const htmlGenerado = generateMapResourceHTML(
        mapaData.titulo_recurso,
        mapaData.ubicaciones,
        bookName,
        chapterNum
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
${mapaData.ubicaciones.map((u, i) => `${i + 1}. ${u.nombre} (${u.latitud}, ${u.longitud}) - ${u.certeza}`).join('\n')}

📝 NOTA METODOLÓGICA:
${mapaData.nota_metodologica || 'Las ubicaciones varían en certeza según la evidencia arqueológica disponible.'}

💡 INSTRUCCIONES:
1. Copia el HTML completo de arriba
2. Ve a /admin/recursos/nuevo
3. Selecciona Libro: ${bookName}, Capítulo: ${chapterNum}
4. Tipo: "mapa"
5. Pega el HTML en "Contenido HTML"
6. Deja "URL del recurso" vacío (o pon la primera URL de mapa si quieres)
7. Guarda y publica

✅ El recurso se mostrará con mapas interactivos de Google Maps para cada ubicación.
`;
    }

    writeFileSync(`${outputDir}/${fileName}`, fileContent, 'utf8');
    console.log(`✅ Archivo creado: ${fileName}`);
  }

  if (plainTextSource) {
    const sourceFileName = `0_FUENTE_CONSOLIDADA_${bookName}_Cap${chapterNum}.txt`;
    writeFileSync(`${outputDir}/${sourceFileName}`, plainTextSource, 'utf8');
    console.log(`✅ Archivo creado: ${sourceFileName}`);
  }
}

async function main() {
  try {
    const chapterInfo = await fetchChapterResources();
    console.log(`✅ Capítulo encontrado: ID ${chapterInfo.chapterId}, Libro: ${chapterInfo.bookName}`);
    
    const context = await getResourcesForChapter(chapterInfo.chapterId);
    const plainTextSource = buildPlainTextSource(chapterInfo.bookName, chapterInfo.chapterNumber, context);
    const promptsToGenerate = buildPrompts(chapterInfo.bookName, chapterInfo.chapterNumber, context);
    
    const results = [];
    for (const p of promptsToGenerate) {
      const aiResponse = await generateWithAI(p);
      if (aiResponse) results.push({ type: p.type, data: aiResponse });
    }

    await saveFilesLocally(results, plainTextSource, chapterInfo.bookName, chapterInfo.chapterNumber, context.estudioTitulo);
    console.log("✨ ¡Todo listo! Los archivos están en la carpeta prompts_output para ser subidos como artifacts.");

  } catch (error) {
    console.error("❌ Error fatal en el workflow:", error.message);
    process.exit(1);
  }
}

main();
