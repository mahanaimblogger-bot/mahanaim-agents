import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { writeFileSync, mkdirSync } from 'fs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const bookSlug = (process.env.BOOK_SLUG || '').trim().toLowerCase();
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
  <h2 style="color: #5d4037; font-family: 'Georgia', serif; font-size: 1.2rem; font-weight: normal;">${bookName} CapÃ­tulo ${chapterNum}</h2>
</div>

<div style="background: #fdfbf7; padding: 1.5rem; border-radius: 12px; border: 2px solid #d4c4a8; margin-bottom: 2rem;">
  <h3 style="color: #1a3a5c; margin-top: 0;">ðŸ“ Ubicaciones BÃ­blicas del CapÃ­tulo</h3>
  <p style="line-height: 1.8; color: #3e2723;">
    Este mapa interactivo muestra las ubicaciones geogrÃ¡ficas mencionadas en el estudio. 
    Algunas son confirmadas arqueolÃ³gicamente, otras son probables segÃºn la evidencia histÃ³rica.
  </p>
</div>
`;

  ubicaciones.forEach((ubicacion, index) => {
    const embedUrl = generateGoogleMapsEmbedUrl(ubicacion.latitud, ubicacion.longitud, ubicacion.nombre);
    const certezaIcon = ubicacion.certeza === 'confirmada' ? 'âœ…' : 
                        ubicacion.certeza === 'probable' ? 'ðŸŸ¡' : 'âš ï¸';
    
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
    <p style="margin: 0 0 0.5rem 0;"><strong>ðŸ“– Referencia:</strong> ${ubicacion.referencia_biblica}</p>
    <p style="margin: 0 0 0.5rem 0;"><strong>ðŸ“ Coordenadas:</strong> ${ubicacion.latitud}Â°N, ${ubicacion.longitud}Â°E</p>
    <p style="margin: 0 0 0.5rem 0;"><strong>ðŸ›ï¸ Contexto HistÃ³rico:</strong> ${ubicacion.contexto_historico}</p>
    <p style="margin: 0;"><strong>âœï¸ Importancia TeolÃ³gica:</strong> ${ubicacion.importancia_teologica}</p>
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
  <h3 style="color: #d4ac0d; margin-top: 0;">ðŸ“š Nota MetodolÃ³gica</h3>
  <p style="line-height: 1.8; margin: 0;">
    Las ubicaciones marcadas como <strong>"confirmadas"</strong> tienen evidencia arqueolÃ³gica sÃ³lida. 
    Las <strong>"probables"</strong> se basan en consenso acadÃ©mico y evidencia contextual. 
    Las <strong>"debatidas"</strong> o <strong>"desconocidas"</strong> reflejan incertidumbre debido a cambios 
    geogrÃ¡ficos histÃ³ricos, limitaciones arqueolÃ³gicas o interpretaciones divergentes de los textos antiguos.
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
  console.log(`ðŸ” Buscando recursos para ${bookSlug} capÃ­tulo ${chapterNumber}...`);
  
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

  if (chapterError || !chapter) throw new Error(`CapÃ­tulo ${chapterNumber} no encontrado para ${bookSlug}`);

  return {
    chapterId: chapter.id,
    bookName: book.nombre,
    bookSlug: book.slug,
    chapterNumber
  };
}

async function getResourcesForChapter(chapterId) {
  console.log(`ðŸ“š Obteniendo recursos para chapter_id: ${chapterId}...`);
  
  const { data: resources, error } = await supabase
    .from('resources')
    .select('tipo, contenido_html, titulo')
    .eq('chapter_id', chapterId);

  if (error) throw error;

  return {
    estudioTitulo: resources.find(r => r.tipo === 'estudio')?.titulo || 'Estudio BÃ­blico',
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
  let source = `FUENTE CONSOLIDADA PARA NOTEBOOKLM\nLIBRO: ${bookName}\nCAPÃTULO: ${chapterNum}\n========================================\n\n`;
  if (context.estudio) source += `--- ESTUDIO BÃBLICO: ${context.estudioTitulo} ---\n${cleanHtml(context.estudio)}\n\n`;
  if (context.sermon) source += `--- SERMÃ“N ---\n${cleanHtml(context.sermon)}\n\n`;
  if (context.infografia) source += `--- INFOGRAFÃA DOCTRINAL ---\n${cleanHtml(context.infografia)}\n\n`;
  if (context.arqueologia) source += `--- CONTEXTO ARQUEOLÃ“GICO ---\n${cleanHtml(context.arqueologia)}\n\n`;
  if (context.palabras) source += `--- PALABRAS CLAVE ---\n${cleanHtml(context.palabras)}\n\n`;
  if (context.citasTeologos) source += `--- CITAS DE TEÃ“LOGOS ---\n${cleanHtml(context.citasTeologos)}\n\n`;
  if (context.citasLibros) source += `--- CITAS DE LIBROS ---\n${cleanHtml(context.citasLibros)}\n\n`;
  return source;
}

function buildPrompts(bookName, chapterNum, context) {
  const baseInfo = `
  LIBRO: ${bookName} | CAPÃTULO: ${chapterNum}
  TÃTULO DEL ESTUDIO: "${context.estudioTitulo}"
  [ESTUDIO]: ${context.estudio.substring(0, 1500)}
  [SERMÃ“N]: ${context.sermon.substring(0, 1500)}
  [INFOGRAFÃA]: ${context.infografia.substring(0, 1000)}
  [ARQUEOLOGÃA]: ${context.arqueologia.substring(0, 800)}
  [PALABRAS]: ${context.palabras.substring(0, 800)}
  [CITAS]: ${context.citasTeologos.substring(0, 800)} ${context.citasLibros.substring(0, 800)}
  `;

  return [
    {
      type: 'prompt_video',
      system: "Eres un experto en producciÃ³n de contenido viral cristiano con profundidad teolÃ³gica.",
      user: `Analiza esta informaciÃ³n y genera 2 prompts para NotebookLM (Estilo Visual mÃ¡x 4000 chars, Contenido Narrativo mÃ¡x 4000 chars). Regla: usa solo 1 cita de autoridad. Formato JSON: { "prompt_estilo_visual": "...", "prompt_contenido_narrativo": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_audio',
      system: "Eres un experto en producciÃ³n de podcasts cristianos con profundidad teolÃ³gica.",
      user: `Analiza esta informaciÃ³n y genera 1 prompt para NotebookLM (Audio Debate, mÃ¡x 4000 chars). Fases: Apertura, ExploraciÃ³n ExegÃ©tica, TensiÃ³n TeolÃ³gica y Cierre Pastoral. Regla: solo 1 cita. Formato JSON: { "prompt_audio": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_mapa',
      system: "Eres un experto en teologÃ­a bÃ­blica y aprendizaje visual.",
      user: `Analiza esta informaciÃ³n y genera 1 prompt para un Mapa Mental esquemÃ¡tico en NotebookLM (mÃ¡x 4000 chars). Incluye: tema central, versÃ­culos clave, palabras originales. Formato JSON: { "prompt_mapa_mental": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_diapositivas',
      system: "Eres un experto en educaciÃ³n bÃ­blica y diseÃ±o instruccional.",
      user: `Analiza esta informaciÃ³n y genera 1 prompt para una presentaciÃ³n de 5 a 7 diapositivas en NotebookLM (mÃ¡x 4000 chars). Estructura: Portada, Desarrollo, ConclusiÃ³n. Formato JSON: { "prompt_diapositivas": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_miniatura',
      system: "Eres un experto en diseÃ±o de miniaturas virales para YouTube y prompt engineering para IA generativa de imÃ¡genes.",
      user: `Analiza esta informaciÃ³n y genera UN prompt en INGLÃ‰S para crear una miniatura de YouTube ultra-llamativa. 
      REQUISITOS: 1. Estilo cinematogrÃ¡fico/hiperrealista. 2. Alto contraste y espacio negativo para texto. 3. Instruye a la IA para incluir el texto exacto: "${context.estudioTitulo}" en letras grandes y legibles. 4. Colores vibrantes. 
      Formato JSON: { "prompt_miniatura_youtube": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_descripcion',
      system: "Eres un experto en SEO para YouTube y Copywriting cristiano.",
      user: `Analiza esta informaciÃ³n y genera una descripciÃ³n completa y optimizada para SEO para el video de YouTube sobre este capÃ­tulo.
      
      ESTRUCTURA OBLIGATORIA DE LA DESCRIPCIÃ“N:
      1. TÃTULO SUGERIDO: 3 opciones de tÃ­tulos virales y con gancho (mÃ¡x 60 caracteres).
      2. GANCHO INICIAL: Las primeras 2 lÃ­neas que atrapan al lector (lo que se ve antes de "mostrar mÃ¡s").
      3. RESUMEN: Un pÃ¡rrafo corto explicando quÃ© aprenderÃ¡ el espectador (usa palabras clave del estudio).
      4. TIMESTAMPS: Sugiere una lista de capÃ­tulos con tiempos (ej: 0:00 Intro, 0:45 El conflicto, etc.) basada en la estructura del video.
      5. VERSÃCULO CLAVE: Cita el versÃ­culo principal del capÃ­tulo.
      6. LLAMADO A LA ACCIÃ“N: InvitaciÃ³n a suscribirse y comentar.
      7. HASHTAGS: 5 hashtags relevantes al final.
      
      Formato JSON: { "descripcion_youtube": "..." } (Usa saltos de lÃ­nea \\n para formatear).\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_mapa_interactivo',
      system: "Eres un experto en geografÃ­a bÃ­blica, arqueologÃ­a del antiguo oriente prÃ³ximo y teologÃ­a. Tu trabajo es identificar ubicaciones geogrÃ¡ficas mencionadas en el estudio bÃ­blico y crear recursos de mapa interactivo educativos.",
      user: `Analiza este estudio bÃ­blico de ${bookName} capÃ­tulo ${chapterNum} e identifica TODAS las ubicaciones geogrÃ¡ficas mencionadas (ciudades, montes, rÃ­os, regiones, etc.).

Para CADA ubicaciÃ³n identificada, genera:

**INFORMACIÃ“N REQUERIDA:**
1. **Nombre del lugar** (en espaÃ±ol)
2. **Coordenadas GPS aproximadas** (latitud, longitud)
3. **Referencia bÃ­blica** donde se menciona
4. **Contexto histÃ³rico/arqueolÃ³gico** breve
5. **Importancia teolÃ³gica** en el capÃ­tulo

**UBICACIONES CON CERTEZA vs INCERTIDUMBRE:**
- Si la ubicaciÃ³n es **confirmada** arqueolÃ³gicamente: proporciona coordenadas exactas
- Si es **probable pero debatida**: proporciona la teorÃ­a mÃ¡s aceptada y menciona la incertidumbre
- Si es **desconocida**: usa la regiÃ³n general mÃ¡s probable segÃºn el contexto

**FORMATO DE SALIDA JSON:**
{
  "titulo_recurso": "Mapa Interactivo: [Tema del capÃ­tulo] - Ubicaciones BÃ­blicas",
  "ubicaciones": [
    {
      "nombre": "Nombre del lugar",
      "latitud": 31.0103,
      "longitud": 47.4344,
      "referencia_biblica": "GÃ©nesis 2:14",
      "contexto_historico": "DescripciÃ³n breve del contexto histÃ³rico y arqueolÃ³gico",
      "importancia_teologica": "Significado teolÃ³gico en el pasaje",
      "certeza": "confirmada | probable | debatida | desconocida"
    }
  ],
  "nota_metodologica": "ExplicaciÃ³n sobre la certeza/incertidumbre de las ubicaciones"
}

**EJEMPLO DE UBICACIONES PARA Ã‰XODO 5:**
1. Pi-RamsÃ©s (capital de FaraÃ³n) - 30.8080, 31.2859
2. Ladrilleras del Delta - 30.7500, 31.3000
3. Monte SinaÃ­ (Horeb) - 28.5394, 33.9746
4. Tierra de GosÃ©n - 30.8500, 31.6500

**INFORMACIÃ“N DEL ESTUDIO:**
${baseInfo}

Genera el recurso de mapa en formato JSON completo.`
    }
  ];
}

async function generateWithAI(promptData) {
  console.log(`ðŸ¤– Generando: ${promptData.type}...`);
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
  console.log("ðŸ’¾ Generando archivos de texto para descargar...");
  const outputDir = 'prompts_output';
  mkdirSync(outputDir, { recursive: true });

  for (const result of results) {
    if (!result) continue;
    const jsonData = result.data;
    let fileContent = '';
    let fileName = '';

    if (result.type === 'prompt_video') {
      fileName = `1_VIDEO_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nPROMPTS PARA VIDEO - NOTEBOOKLM\nLibro: ${bookName} | CapÃ­tulo: ${chapterNum}\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n\nðŸ“‹ PROMPT 1 - ESTILO VISUAL:\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n${jsonData.prompt_estilo_visual}\n\nðŸ“‹ PROMPT 2 - CONTENIDO NARRATIVO:\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n${jsonData.prompt_contenido_narrativo}\n`;
    } else if (result.type === 'prompt_audio') {
      fileName = `2_AUDIO_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nPROMPT PARA AUDIO/PODCAST - NOTEBOOKLM\nLibro: ${bookName} | CapÃ­tulo: ${chapterNum}\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n\n INSTRUCCIONES:\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n${jsonData.prompt_audio}\n`;
    } else if (result.type === 'prompt_mapa') {
      fileName = `3_MAPA_MENTAL_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nPROMPT PARA MAPA MENTAL - NOTEBOOKLM\nLibro: ${bookName} | CapÃ­tulo: ${chapterNum}\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n\nðŸ“‹ INSTRUCCIONES:\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n${jsonData.prompt_mapa_mental}\n`;
    } else if (result.type === 'prompt_diapositivas') {
      fileName = `4_DIAPOSITIVAS_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nPROMPT PARA DIAPOSITIVAS - NOTEBOOKLM\nLibro: ${bookName} | CapÃ­tulo: ${chapterNum}\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n\n INSTRUCCIONES:\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n${jsonData.prompt_diapositivas}\n`;
    } else if (result.type === 'prompt_miniatura') {
      fileName = `5_MINIATURA_YOUTUBE_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nPROMPT PARA MINIATURA DE YOUTUBE (IA)\nLibro: ${bookName} | CapÃ­tulo: ${chapterNum}\nTÃ­tulo del Estudio: "${studyTitle}"\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n\nðŸ“‹ INSTRUCCIONES:\nCopia el siguiente prompt (en inglÃ©s) y pÃ©galo en Midjourney/DALL-E 3.\n\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n${jsonData.prompt_miniatura_youtube}\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n\nðŸ’¡ CONSEJO: Si la IA falla con el texto, genera la imagen sin texto y agrÃ©galo luego en Canva con fuente gruesa.`;
    } else if (result.type === 'prompt_descripcion') {
      fileName = `6_DESCRIPCION_YOUTUBE_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nDESCRIPCIÃ“N OPTIMIZADA PARA YOUTUBE\nLibro: ${bookName} | CapÃ­tulo: ${chapterNum}\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n\nðŸ“‹ COPIA Y PEGA ESTO EN LA DESCRIPCIÃ“N DE TU VIDEO:\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n${jsonData.descripcion_youtube}\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n\nðŸ’¡ NOTA: Los timestamps son sugerencias basadas en la estructura del video. Ajustalos segÃºn la duraciÃ³n final.`;
    } else if (result.type === 'prompt_mapa_interactivo') {
      fileName = `7_MAPA_INTERACTIVO_${bookName}_Cap${chapterNum}.txt`;
      
      const mapaData = jsonData;
      const htmlGenerado = generateMapResourceHTML(
        mapaData.titulo_recurso,
        mapaData.ubicaciones,
        bookName,
        chapterNum
      );
      
      fileContent = `â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
RECURSO DE MAPA INTERACTIVO - MAHANAIM
Libro: ${bookName} | CapÃ­tulo: ${chapterNum}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“‹ DATOS PARA CREAR EL RECURSO EN EL ADMIN:

TÃTULO: ${mapaData.titulo_recurso}

TIPO: mapa

URL DEL RECURSO: (Dejar vacÃ­o - el mapa se genera desde el HTML)

MODO: html

CONTENIDO HTML:
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
${htmlGenerado}
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ðŸ“ UBICACIONES IDENTIFICADAS:
${mapaData.ubicaciones.map((u, i) => `${i + 1}. ${u.nombre} (${u.latitud}, ${u.longitud}) - ${u.certeza}`).join('\n')}

ðŸ“ NOTA METODOLÃ“GICA:
${mapaData.nota_metodologica || 'Las ubicaciones varÃ­an en certeza segÃºn la evidencia arqueolÃ³gica disponible.'}

ðŸ’¡ INSTRUCCIONES:
1. Copia el HTML completo de arriba
2. Ve a /admin/recursos/nuevo
3. Selecciona Libro: ${bookName}, CapÃ­tulo: ${chapterNum}
4. Tipo: "mapa"
5. Pega el HTML en "Contenido HTML"
6. Deja "URL del recurso" vacÃ­o (o pon la primera URL de mapa si quieres)
7. Guarda y publica

âœ… El recurso se mostrarÃ¡ con mapas interactivos de Google Maps para cada ubicaciÃ³n.
`;
    }

    writeFileSync(`${outputDir}/${fileName}`, fileContent, 'utf8');
    console.log(`âœ… Archivo creado: ${fileName}`);
  }

  if (plainTextSource) {
    const sourceFileName = `0_FUENTE_CONSOLIDADA_${bookName}_Cap${chapterNum}.txt`;
    writeFileSync(`${outputDir}/${sourceFileName}`, plainTextSource, 'utf8');
    console.log(`âœ… Archivo creado: ${sourceFileName}`);
  }
}

async function main() {
  try {
    const chapterInfo = await fetchChapterResources();
    console.log(`âœ… CapÃ­tulo encontrado: ID ${chapterInfo.chapterId}, Libro: ${chapterInfo.bookName}`);
    
    const context = await getResourcesForChapter(chapterInfo.chapterId);
    const plainTextSource = buildPlainTextSource(chapterInfo.bookName, chapterInfo.chapterNumber, context);
    const promptsToGenerate = buildPrompts(chapterInfo.bookName, chapterInfo.chapterNumber, context);
    
    const results = [];
    for (const p of promptsToGenerate) {
      const aiResponse = await generateWithAI(p);
      if (aiResponse) results.push({ type: p.type, data: aiResponse });
    }

    await saveFilesLocally(results, plainTextSource, chapterInfo.bookName, chapterInfo.chapterNumber, context.estudioTitulo);
    console.log("âœ¨ Â¡Todo listo! Los archivos estÃ¡n en la carpeta prompts_output para ser subidos como artifacts.");

  } catch (error) {
    console.error("âŒ Error fatal en el workflow:", error.message);
    process.exit(1);
  }
}

main();
