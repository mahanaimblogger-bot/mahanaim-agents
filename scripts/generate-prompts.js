import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// 1. Inicializar clientes
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1', // Endpoint de DeepSeek
});

const bookSlug = process.env.BOOK_SLUG;
const chapterNumber = parseInt(process.env.CHAPTER_NUMBER);

// 2. Función para obtener todos los recursos del capítulo
async function fetchChapterResources() {
  console.log(`🔍 Buscando recursos para ${bookSlug} capítulo ${chapterNumber}...`);
  
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id, books(name)')
    .eq('numero', chapterNumber)
    .eq('books.slug', bookSlug)
    .single();

  if (chapterError || !chapter) {
    throw new Error(`Capítulo no encontrado: ${bookSlug} ${chapterNumber}`);
  }

  const chapterId = chapter.id;
  const bookName = chapter.books.name;

  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('tipo, contenido_html, titulo')
    .eq('chapter_id', chapterId);

  if (resourcesError) throw resourcesError;

  // Agrupar recursos por tipo para inyectarlos en el prompt
  const context = {
    chapterId,
    bookName,
    chapterNumber,
    estudio: resources.find(r => r.tipo === 'estudio')?.contenido_html || '',
    sermon: resources.find(r => r.tipo === 'sermon')?.contenido_html || '',
    infografia: resources.find(r => r.tipo === 'infografia')?.contenido_html || '',
    arqueologia: resources.find(r => r.tipo === 'contexto_arqueologico')?.contenido_html || '',
    palabras: resources.find(r => r.tipo === 'palabras_clave')?.contenido_html || '',
    citasTeologos: resources.find(r => r.tipo === 'citas_teologos')?.contenido_html || '',
    citasLibros: resources.find(r => r.tipo === 'citas_libros')?.contenido_html || '',
  };

  return context;
}

// 3. Los 4 Prompts Maestros (Plantillas)
function buildPrompts(context) {
  const baseInfo = `
  LIBRO: ${context.bookName}
  CAPÍTULO: ${context.chapterNumber}
  
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
      user: `Analiza esta información de ${context.bookName} ${context.chapterNumber} y genera 2 prompts para NotebookLM (Estilo Visual máx 4000 chars, Contenido Narrativo máx 4000 chars). Regla de oro: usa solo 1 cita de autoridad (teólogo O libro). Formato de salida: JSON { "prompt_estilo_visual": "...", "prompt_contenido_narrativo": "..." }.\n\nINFO:\n${baseInfo}`
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

// 4. Función para llamar a la IA (DeepSeek)
async function generateWithAI(promptData) {
  console.log(`🤖 Generando: ${promptData.type}...`);
  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat", 
      messages: [
        { role: "system", content: promptData.system },
        { role: "user", content: promptData.user }
      ],
      response_format: { type: "json_object" }, // Fuerza salida JSON
      temperature: 0.7,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(`Error en IA para ${promptData.type}:`, error);
    return null;
  }
}

// 5. Función para guardar en Supabase
async function savePrompts(chapterId, results) {
  console.log("💾 Guardando prompts en Supabase...");
  
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

    if (error) console.error(`Error guardando ${result.type}:`, error);
  }
  console.log("✅ ¡Proceso completado con éxito!");
}

// 6. Ejecución principal
async function main() {
  try {
    const context = await fetchChapterResources();
    const promptsToGenerate = buildPrompts(context);
    
    const results = [];
    for (const p of promptsToGenerate) {
      const aiResponse = await generateWithAI(p);
      if (aiResponse) {
        results.push({ type: p.type, data: aiResponse });
      }
    }

    await savePrompts(context.chapterId, results);

  } catch (error) {
    console.error("❌ Error fatal en el workflow:", error);
    process.exit(1);
  }
}

main();
