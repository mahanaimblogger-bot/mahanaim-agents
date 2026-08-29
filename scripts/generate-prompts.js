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

// Función para limpiar HTML y dejar solo texto plano
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
  let source = `FUENTE CONSOLIDADA PARA NOTEBOOKLM\n`;
  source += `LIBRO: ${bookName}\n`;
  source += `CAPÍTULO: ${chapterNum}\n`;
  source += `========================================\n\n`;

  if (context.estudio) { source += `--- ESTUDIO BÍBLICO ---\n${cleanHtml(context.estudio)}\n\n`; }
  if (context.sermon) { source += `--- SERMÓN ---\n${cleanHtml(context.sermon)}\n\n`; }
  if (context.infografia) { source += `--- INFOGRAFÍA DOCTRINAL ---\n${cleanHtml(context.infografia)}\n\n`; }
  if (context.arqueologia) { source += `--- CONTEXTO ARQUEOLÓGICO ---\n${cleanHtml(context.arqueologia)}\n\n`; }
  if (context.palabras) { source += `--- PALABRAS CLAVE ---\n${cleanHtml(context.palabras)}\n\n`; }
  if (context.citasTeologos) { source += `--- CITAS DE TEÓLOGOS ---\n${cleanHtml(context.citasTeologos)}\n\n`; }
  if (context.citasLibros) { source += `--- CITAS DE LIBROS ---\n${cleanHtml(context.citasLibros)}\n\n`; }

  return source;
}

function buildPrompts(bookName, chapterNum, context) {
  const baseInfo = `
  LIBRO: ${bookName} | CAPÍTULO: ${chapterNum}
  [ESTUDIO]: ${context.estudio.substring(0, 1500)}
  [SERMÓN]: ${context.sermon.substring(0, 1500)}
  [INFOGRAFÍA]: ${context.infografia.substring(0, 1000)}
  [ARQUEOLOGÍA]: ${context.arqueologia.substring(0, 800)}
  [PALABRAS]: ${context.palabras.substring(0, 800)}
  [CITAS TEÓLOGOS]: ${context.citasTeologos.substring(0, 800)}
  [CITAS LIBROS]: ${context.citasLibros.substring(0, 800)}
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
      temperature: 0.7,
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(`❌ Error en IA para ${promptData.type}:`, error.message);
    return null;
  }
}

async function saveFilesLocally(results, plainTextSource, bookName, chapterNum) {
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
      fileContent = `═══════════════════════════════════════════\nPROMPTS PARA VIDEO - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 PROMPT 1 - ESTILO VISUAL (Pegar en "Describe un estilo visual personalizado"):\n───────────────────────────────────────────\n${jsonData.prompt_estilo_visual}\n\n📋 PROMPT 2 - CONTENIDO NARRATIVO (Pegar en "¿En qué deben centrarse los presentadores de IA?"):\n───────────────────────────────────────────\n${jsonData.prompt_contenido_narrativo}\n`;
    } else if (result.type === 'prompt_audio') {
      fileName = `2_AUDIO_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA AUDIO/PODCAST - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 INSTRUCCIONES (Pegar en "¿En qué deben centrarse los presentadores de IA?"):\n───────────────────────────────────────────\n${jsonData.prompt_audio}\n`;
    } else if (result.type === 'prompt_mapa') {
      fileName = `3_MAPA_MENTAL_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA MAPA MENTAL - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 INSTRUCCIONES:\n───────────────────────────────────────────\n${jsonData.prompt_mapa_mental}\n`;
    } else if (result.type === 'prompt_diapositivas') {
      fileName = `4_DIAPOSITIVAS_${bookName}_Cap${chapterNum}.txt`;
      fileContent = `═══════════════════════════════════════════\nPROMPT PARA DIAPOSITIVAS - NOTEBOOKLM\nLibro: ${bookName} | Capítulo: ${chapterNum}\n═══════════════════════════════════════════\n\n📋 INSTRUCCIONES:\n───────────────────────────────────────────\n${jsonData.prompt_diapositivas}\n`;
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

    await saveFilesLocally(results, plainTextSource, chapterInfo.bookName, chapterInfo.chapterNumber);
    console.log("🎉 ¡Todo listo! Los archivos están en la carpeta prompts_output para ser subidos como artifacts.");

  } catch (error) {
    console.error(" Error fatal en el workflow:", error.message);
    process.exit(1);
  }
}

main();
