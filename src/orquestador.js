import "dotenv/config";
import { supabase, obtenerBookIdPorSlug, obtenerOCrearChapterId, obtenerTextoCapituloCompleto, guardarRecursoComoBorrador } from "./supabaseClient.js";
import { generarPromptRecurso } from "./promptsRecursos.js";
import { formatearRecurso } from "./formateadores.js"; // <-- NUEVO IMPORT

// Recursos que la IA puede generar automáticamente
const RECURSOS_IA = [
  "quiz", "glosario", "guia_estudio", "bosquejo", "sermon", "paralelos", 
  "palabras_clave", "infografia", "citas_teologos", "citas_libros", 
  "contexto_arqueologico", "diagrama_estructura", "cronologia", "devocional", "profecias"
];

// Recursos externos que requieren URL
const RECURSOS_EXTERNOS = ["video", "imagen", "audio", "mapa", "diapositiva", "testimonio"];

async function llamarIA(prompt) {
  const response = await fetch(process.env.LLM_BASE_URL || "https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Error IA: ${data.error?.message || response.statusText}`);
  return data.choices[0].message.content;
}

async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [clave, valor] = arg.replace(/^--/, "").split("=");
    args[clave] = valor;
  }

  if (!args.libro || !args.capitulo) {
    console.log("Uso: node src/orquestador.js --libro=josue --capitulo=1 --url_video=https://...");
    process.exit(1);
  }

  const { libro, capitulo } = args;
  const capituloNum = parseInt(capitulo, 10);

  console.log(`\n🚀 Iniciando Orquestador para: ${libro} ${capituloNum}`);

  // 1. Obtener IDs
  const libroInfo = await obtenerBookIdPorSlug(libro);
  const chapterId = await obtenerOCrearChapterId(libroInfo.id, capituloNum);

  // 2. Verificar recursos existentes
  const { data: recursosDB, error: errorDB } = await supabase
    .from("resources")
    .select("tipo, titulo")
    .eq("chapter_id", chapterId);
  
  if (errorDB) throw new Error(errorDB.message);

  const tiposExistentes = recursosDB.map(r => r.tipo);
  console.log(`📚 Recursos ya existentes: ${tiposExistentes.join(", ") || "Ninguno"}`);

  // Determinar si es AT o NT para conexion_at / conexion_nt
  const librosNT = ["mateo", "marcos", "lucas", "juan", "hechos", "romanos", "1-corintios", "2-corintios", "galatas", "efesios", "filipenses", "colosenses", "1-tesalonicenses", "2-tesalonicenses", "1-timoteo", "2-timoteo", "tito", "filemon", "hebreos", "santiago", "1-pedro", "2-pedro", "1-juan", "2-juan", "3-juan", "judas", "apocalipsis"];
  const esNT = librosNT.includes(libro.toLowerCase());
  
  const recursosIATotales = esNT 
    ? [...RECURSOS_IA, "conexion_at"] 
    : [...RECURSOS_IA, "conexion_nt"];

  // 3. Determinar faltantes de IA
  const faltantesIA = recursosIATotales.filter(tipo => !tiposExistentes.includes(tipo));
  
  if (faltantesIA.length === 0) {
    console.log("✅ Todos los recursos de IA para este capítulo ya están generados.");
  } else {
    console.log(` Recursos de IA a generar: ${faltantesIA.join(", ")}`);
    
    const textoCapitulo = await obtenerTextoCapituloCompleto(libroInfo.id, capituloNum);

    for (const tipo of faltantesIA) {
      console.log(`\n Generando: ${tipo}...`);
      try {
        const prompt = generarPromptRecurso(tipo, libroInfo.nombre, capituloNum, textoCapitulo);
        const respuestaCruda = await llamarIA(prompt);
        
        // Limpieza básica de markdown JSON
        const jsonLimpio = respuestaCruda.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        let datos;
        try {
          datos = JSON.parse(jsonLimpio);
        } catch {
          // Si falla el parse, creamos un objeto básico para que el formateador lo maneje
          datos = { tipo, titulo: `Recurso de ${tipo}`, contenido_html: jsonLimpio };
        }

        // 🔥 CORRECCIÓN CLAVE: Formatear el JSON a HTML antes de guardar
        const htmlFinal = formatearRecurso(tipo, datos);

        // Guardar en Supabase como borrador
        await guardarRecursoComoBorrador({
          chapterId,
          tipo: datos.tipo || tipo,
          titulo: datos.titulo || `Recurso de ${tipo}`,
          slug: `${libro}-${capituloNum}-${tipo}`,
          contenidoHtml: htmlFinal, // <-- Ahora guardamos el HTML limpio
        });
        console.log(`   ✅ ${tipo} guardado como borrador.`);
        
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.error(`   ❌ Error generando ${tipo}:`, err.message);
      }
    }
  }

  // 4. Procesar Recursos Externos (URLs)
  console.log("\n🔗 Procesando recursos externos...");
  let externosPendientes = [];
  
  for (const tipo of RECURSOS_EXTERNOS) {
    if (tiposExistentes.includes(tipo)) {
      console.log(`   ️ ${tipo} ya existe, se omite.`);
      continue;
    }
    
    const urlKey = `url_${tipo}`;
    const url = args[urlKey];
    
    if (url && url !== "SIN_URL") {
      await guardarRecursoComoBorrador({
        chapterId,
        tipo,
        titulo: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} de ${libro} ${capituloNum}`,
        slug: `${libro}-${capituloNum}-${tipo}`,
        contenidoHtml: `<div class="contenedor-blog"><h1 class="titulo-entrada">${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</h1><p>Recurso externo: <a href="${url}" target="_blank" class="text-[#1a5276] underline">${url}</a></p></div>`,
      });
      console.log(`   ✅ ${tipo} agregado con URL.`);
    } else {
      console.log(`   ️ ${tipo} omitido (sin URL). Podrás agregarlo luego en el panel Admin.`);
      externosPendientes.push(tipo);
    }
  }

  // 5. Verificación Final
  const { data: recursosFinales } = await supabase.from("resources").select("tipo").eq("chapter_id", chapterId);
  const tiposFinales = recursosFinales.map(r => r.tipo);
  
  if (faltantesIA.length === 0 && externosPendientes.length === 0) {
    console.log("\n🎉 ¡ÉXITO! Este capítulo ya tiene todos los recursos completos.");
  } else {
    console.log(`\n📋 Resumen: Se completaron ${tiposFinales.length} recursos. Recursos de IA pendientes: ${faltantesIA.length}. Recursos externos pendientes: ${externosPendientes.join(", ") || "Ninguno"}.`);
    console.log("💡 Ejecuta el orquestador nuevamente con las URLs faltantes si lo deseas.");
  }
}

main().catch(console.error);
