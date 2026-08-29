import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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
  
  // Primero buscamos el libro
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, nombre, slug')
    .eq('slug', bookSlug)
    .single();

  if (bookError || !book) {
    throw new Error(`Libro no encontrado: ${bookSlug}. Detalle: ${bookError?.message}`);
  }

  // Luego buscamos el capítulo usando el book_id
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id, numero')
    .eq('book_id', book.id)
    .eq('numero', chapterNumber)
    .single();

  if (chapterError || !chapter) {
    throw new Error(`Capítulo ${chapterNumber} no encontrado para ${bookSlug}. Detalle: ${chapterError?.message}`);
  }

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

// Función para generar el texto plano consolidado
function buildPlainTextSource(bookName, chapterNum, context) {
  let source = `FUENTE CONSOLIDADA PARA NOTEBOOKLM\n`;
  source += `LIBRO: ${bookName}\n`;
  source += `CAPÍTULO: ${chapterNum}\n`;
  source += `========================================\n\n`;

  if (context.estudio) {
    source += `--- ESTUDIO BÍBLICO ---\n`;
    source += cleanHtml(context.estudio) + `\n\n`;
  }
  if (context.sermon) {
    source += `--- SERMÓN ---\n`;
    source += cleanHtml(context.sermon) + `\n\n`;
  }
  if (context.infografia) {
    source += `--- INFOGRAFÍA DOCTRINAL ---\n`;
    source += cleanHtml(context.infografia) + `\n\n`;
  }
  if (context.arqueologia) {
    source += `--- CONTEXTO ARQUEOLÓGICO ---\n`;
    source += cleanHtml(context.arqueologia) + `\n\n`;
  }
  if (context.palabras) {
    source += `--- PALABRAS CLAVE ---\n`;
    source += cleanHtml(context.palabras) + `\n\n`;
  }
  if (context.citasTeologos) {
    source += `--- CITAS DE TEÓLOGOS ---\n`;
    source += cleanHtml(context.citasTeologos) + `\n\n`;
  }
  if (context.citasLibros) {
    source += `--- CITAS DE LIBROS ---\n`;
    source += cleanHtml(context.citasLibros) + `\n\n`;
  }

  return source;
}

function buildPrompts(bookName, chapterNum, context) {
  const baseInfo = `
  LIBRO: ${bookName}
  CAPÍTULO: ${chapterNum}
  
  [ESTUDIO BÍBLICO]: ${context.estudio.substring(0, 1500)}...
  [SERMÓN]: ${context.sermon.substring(0, 1500)}...
  [INFOGRAFÍA DOCTRINAL]: ${context.infografia.substring(0, 1000)}...
  [CONTEXTO ARQUEOLÓGICO]: ${context.arqueologia.substring(0, 800)}...
  [PALABRAS CLAVE]: ${context.palabras.substring(0, 800)}...
  [CITAS TEÓLOGOS]: ${context.citasTeologos.substring(0, 800)}...
  [CITAS LIBROS]: ${context.citasLibros.substring(0, 800)}...
  `;

  return [
    {
      type: 'prompt_video',
      system: "Eres un experto en producción de contenido viral cristiano con profundidad teológica.",
      user: `Analiza esta información de ${bookName} ${chapterNum} y genera 2 prompts para NotebookLM (Estilo Visual máx 4000 chars, Contenido Narrativo máx 4000 chars). Regla de oro: usa solo 1 cita de autoridad (teólogo O libro). Formato de salida: JSON { "prompt_estilo_visual": "...", "prompt_contenido_narrativo": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_audio',
      system: "Eres un experto en producción de podcasts cristianos con profundidad teológica.",
      user: `Analiza esta información y genera 1 prompt para NotebookLM (Audio Debate, máx 4000 chars). Debe tener 4 fases: Apertura, Exploración Exegética, Tensión Teológica y Cierre Pastoral. Regla: solo 1 cita de autoridad. Formato de salida: JSON { "prompt_audio": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_mapa',
      system: "Eres un experto en teología bíblica y aprendizaje visual.",
      user: `Analiza esta información y genera 1 prompt para un Mapa Mental esquemático en NotebookLM (máx 4000 chars). Debe incluir: tema central, versículos clave, palabras originales y contexto. Elige la mejor estructura (radial o flujo). Formato de salida: JSON { "prompt_mapa_mental": "..." }.\n\nINFO:\n${baseInfo}`
    },
    {
      type: 'prompt_diapositivas',
      system: "Eres un experto en educación bíblica y diseño instruccional.",
      user: `Analiza esta información y genera 1 prompt para una presentación de 5 a 7 diapositivas en NotebookLM (máx 4000 chars). Estructura: Portada, Desarrollo (1 idea por slide), Conclusión. Texto mínimo y esquemático. Formato de salida: JSON { "prompt_diapositivas": "..." }.\n\nINFO:\n${baseInfo}`
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

async function saveToSupabase(chapterId, results, plainTextSource) {
  console.log("💾 Guardando en Supabase...");
  
  // Guardar los 4 prompts generados por IA
  for (const result of results) {
    if (!result) continue;
    
    const { error } = await supabase.from('resources').insert({
      chapter_id: chapterId,
      tipo: result.type, 
      titulo: `Prompt Generado: ${result.type}`,
      contenido_html: JSON.stringify(result.data), 
      modo: 'json',
      estado: 'aprobado'
    });

    if (error) console.error(`⚠️ Error guardando ${result.type}:`, error.message);
  }

  // Guardar el texto plano consolidado para NotebookLM
  if (plainTextSource) {
    const { error: sourceError } = await supabase.from('resources').insert({
      chapter_id: chapterId,
      tipo: 'fuente_notebooklm',
      titulo: 'Fuente Consolidada para NotebookLM (Texto Plano)',
      contenido_html: plainTextSource,
      modo: 'text',
      estado: 'aprobado'
    });

    if (sourceError) {
      console.error(`⚠️ Error guardando fuente_notebooklm:`, sourceError.message);
    } else {
      console.log("✅ Texto plano consolidado guardado exitosamente.");
    }
  }

  console.log("✅ ¡Proceso completado con éxito!");
}

async function main() {
  try {
    const chapterInfo = await fetchChapterResources();
    console.log(`✅ Capítulo encontrado: ID ${chapterInfo.chapterId}, Libro: ${chapterInfo.bookName}`);
    
    const context = await getResourcesForChapter(chapterInfo.chapterId);
    
    // Generar texto plano consolidado
    const plainTextSource = buildPlainTextSource(chapterInfo.bookName, chapterInfo.chapterNumber, context);
    console.log(`📝 Texto plano generado: ${plainTextSource.length} caracteres`);
    
    const promptsToGenerate = buildPrompts(chapterInfo.bookName, chapterInfo.chapterNumber, context);
    
    const results = [];
    for (const p of promptsToGenerate) {
      const aiResponse = await generateWithAI(p);
      if (aiResponse) {
        results.push({ type: p.type, data: aiResponse });
      }
    }

    await saveToSupabase(chapterInfo.chapterId, results, plainTextSource);

  } catch (error) {
    console.error("❌ Error fatal en el workflow:", error.message);
    process.exit(1);
  }
}

main();
