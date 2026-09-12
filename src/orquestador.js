import "dotenv/config";
import { supabase, obtenerBookIdPorSlug, obtenerOCrearChapterId, obtenerTextoCapituloCompleto, obtenerRecurso, guardarRecursoComoBorrador } from "./supabaseClient.js";
import { generarPromptRecurso } from "./promptsRecursos.js";
import { formatearRecurso } from "./formateadores.js"; // <-- NUEVO IMPORT

// Recursos que la IA puede generar automáticamente
const RECURSOS_IA = [
  "quiz", "glosario", "guia_estudio", "bosquejo", "sermon", "paralelos",
  "palabras_clave", "infografia", "citas_teologos", "citas_libros",
  "contexto_arqueologico", "diagrama_estructura", "cronologia", "devocional", "profecias",
];

// Cadena homilética: cada uno se nutre de la/s fuente/s previas del mismo capítulo.
// fuente_tipos[l] = tipos que deben existir (o poder generarse antes) para poder generar l.
const FUENTES_CADENA = {
  sermon:        ["estudio"],
  bosquejo:      ["sermon"],
};
const TIPOS_CADENA = new Set(Object.keys(FUENTES_CADENA));
// Tipos que NUNCA se guardan en la DB (solo se producen como archivo descargable).
const TIPOS_TXT_SOLO = new Set(["podcast_guion"]);

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
      max_tokens: 8000
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
  const faltantesIA = recursosIATotales.filter(tipo => TIPOS_TXT_SOLO.has(tipo) || !tiposExistentes.includes(tipo));
  
  if (faltantesIA.length === 0) {
    console.log("✅ Todos los recursos de IA para este capítulo ya están generados.");
  } else {
    console.log(` Recursos de IA a generar: ${faltantesIA.join(", ")}`);
    
    const textoCapitulo = await obtenerTextoCapituloCompleto(libroInfo.id, capituloNum);

        // ---- ORDENAMIENTO PARA RESPETAR LA CADENA HOMILÉTICA (estudio->sermón->bosquejo->podcast) ----
    const enCadena = faltantesIA.filter(t => TIPOS_CADENA.has(t));
    const fueraCadena = faltantesIA.filter(t => !TIPOS_CADENA.has(t));
    const ordenCadena = ["sermon", "bosquejo", "podcast_guion"].filter(t => enCadena.includes(t));
    const colaGeneracion = [...ordenCadena, ...fueraCadena];

    function displayTipo(t) {
      if (t === "sermon") return "sermón";
      if (t === "podcast_guion") return "guion de podcast";
      return t;
    }

    // Caché/lectura de fuentes desde Supabase (lo más reciente, borrador o publicado).
    const cacheFuentes = {};
    async function leerFuentePara(tipoFuente) {
      if (tipoFuente in cacheFuentes) return cacheFuentes[tipoFuente];
      const rec = await obtenerRecurso(chapterId, tipoFuente);
      cacheFuentes[tipoFuente] = rec || null;
      return rec;
    }

    for (const tipo of colaGeneracion) {
      console.log(`\n Generando: ${tipo}...`);
      try {
        // Validar y reunir las fuentes de este tipo (si es parte de la cadena homilética).
        const materiales = {};
        const fuentesTipo = FUENTES_CADENA[tipo] || [];
        const ausentes = [];
        const hallados = {};
        for (const fTipo of fuentesTipo) {
          const src = await leerFuentePara(fTipo);
          if (src) hallados[fTipo] = src.contenido_html || "";
          else ausentes.push(fTipo);
        }
        if (ausentes.length > 0) {
          const lista = ausentes.map(displayTipo).join(" y ");
          console.log(`   ⛔ No se generó "${displayTipo(tipo)}" porque falta el recurso fuente: ${lista} de ${libro} ${capituloNum}. Crea/verifica primero ese(os) recurso(s) y vuelve a correr el orquestador.`);
          continue; // No generar sin su fuente; avisamos cuál falta.
        }
        if (hallados.estudio) materiales.estudio_html = hallados.estudio;
        if (hallados.sermon) materiales.sermon_html = hallados.sermon;

        const prompt = generarPromptRecurso(tipo, libroInfo.nombre, capituloNum, textoCapitulo, materiales);
                const respuestaCruda = await llamarIA(prompt);

        // PODCAST_GUION: no se publica en Supabase; se guarda como .txt listo para TTS
        
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
