import "dotenv/config";
import { generarEstudio } from "./generarEstudio.js";
import { generarPromptsCapitulo } from "../scripts/generate-prompts.js";
import { 
  supabase, 
  obtenerBookIdPorSlug, 
  obtenerOCrearChapterId, 
  obtenerTextoCapituloCompleto, 
  obtenerRecurso, 
  guardarRecursoComoBorrador 
} from "./supabaseClient.js";
import { generarPromptRecurso } from "./promptsRecursos.js";
import { formatearRecurso } from "./formateadores.js";

// ============================================================
// CONFIGURACIÓN DE RECURSOS (Sin podcast_guion, ya está en prompts)
// ============================================================
const RECURSOS_IA = [
  "quiz", "glosario", "guia_estudio", "bosquejo", "sermon", "paralelos",
  "palabras_clave", "infografia", "citas_teologos", "citas_libros",
  "contexto_arqueologico", "diagrama_estructura", "cronologia", "devocional", "profecias",
];

const FUENTES_CADENA = {
  sermon: ["estudio"],
  bosquejo: ["sermon"],
};
const TIPOS_CADENA = new Set(Object.keys(FUENTES_CADENA));

const librosNT = ["mateo", "marcos", "lucas", "juan", "hechos", "romanos", "1-corintios", "2-corintios", "galatas", "efesios", "filipenses", "colosenses", "1-tesalonicenses", "2-tesalonicenses", "1-timoteo", "2-timoteo", "tito", "filemon", "hebreos", "santiago", "1-pedro", "2-pedro", "1-juan", "2-juan", "3-juan", "judas", "apocalipsis"];

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================
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

function parsearRango(rangoStr) {
  const capitulos = new Set();
  const partes = rangoStr.split(',');
  for (const parte of partes) {
    if (parte.includes('-')) {
      const [inicio, fin] = parte.split('-').map(Number);
      for (let i = inicio; i <= fin; i++) capitulos.add(i);
    } else {
      capitulos.add(Number(parte));
    }
  }
  return Array.from(capitulos).sort((a, b) => a - b);
}

async function generarRecursosIA(libro, capituloNum, chapterId, libroInfo) {
  console.log(`\n   🤖 [Paso 2/3] Generando recursos de IA para ${libro} ${capituloNum}...`);
  
  const esNT = librosNT.includes(libro.toLowerCase());
  const recursosIATotales = esNT 
    ? [...RECURSOS_IA, "conexion_at"] 
    : [...RECURSOS_IA, "conexion_nt"];

  const { data: recursosDB } = await supabase.from("resources").select("tipo").eq("chapter_id", chapterId);
  const tiposExistentes = recursosDB ? recursosDB.map(r => r.tipo) : [];
  const faltantesIA = recursosIATotales.filter(tipo => !tiposExistentes.includes(tipo));
  
  if (faltantesIA.length === 0) {
    console.log(`   ✅ Todos los recursos de IA ya existen para ${libro} ${capituloNum}.`);
    return;
  }

  const textoCapitulo = await obtenerTextoCapituloCompleto(libroInfo.id, capituloNum);
  const enCadena = faltantesIA.filter(t => TIPOS_CADENA.has(t));
  const fueraCadena = faltantesIA.filter(t => !TIPOS_CADENA.has(t));
  const ordenCadena = ["sermon", "bosquejo"].filter(t => enCadena.includes(t));
  const colaGeneracion = [...ordenCadena, ...fueraCadena];

  const cacheFuentes = {};
  async function leerFuentePara(tipoFuente) {
    if (tipoFuente in cacheFuentes) return cacheFuentes[tipoFuente];
    const rec = await obtenerRecurso(chapterId, tipoFuente);
    cacheFuentes[tipoFuente] = rec || null;
    return rec;
  }

  for (const tipo of colaGeneracion) {
    try {
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
        console.log(`   ⛔ Omitido "${tipo}" (falta fuente: ${ausentes.join(", ")})`);
        continue;
      }
      
      if (hallados.estudio) materiales.estudio_html = hallados.estudio;
      if (hallados.sermon) materiales.sermon_html = hallados.sermon;

      const prompt = generarPromptRecurso(tipo, libroInfo.nombre, capituloNum, textoCapitulo, materiales);
            const respuestaCruda = await llamarIA(prompt);
      
      if (!respuestaCruda || respuestaCruda.trim() === "") {
        throw new Error("La IA devolvió una respuesta vacía. Posible límite de tokens o error de API.");
      }

      const jsonLimpio = respuestaCruda.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      
      let datos;
      try { 
        datos = JSON.parse(jsonLimpio); 
      } catch (err) {
        console.log(`   ⚠️ [${tipo}] La IA no devolvió JSON válido. Usando respuesta cruda.`);
        datos = { tipo, titulo: `Recurso de ${tipo}`, contenido_html: jsonLimpio }; 
      }

      const htmlFinal = formatearRecurso(tipo, datos);
      await guardarRecursoComoBorrador({
        chapterId,
        tipo: datos.tipo || tipo,
        titulo: datos.titulo || `Recurso de ${tipo}`,
        slug: `${libro}-${capituloNum}-${tipo}`,
        contenidoHtml: htmlFinal,
      });
      console.log(`   ✅ ${tipo} guardado.`);
      await new Promise(r => setTimeout(r, 2000)); // Pausa para no saturar la API
    } catch (err) {
      console.error(`   ❌ Error generando ${tipo}:`, err.message);
    }
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL (MAESTRA)
// ============================================================
async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [clave, valor] = arg.replace(/^--/, "").split("=");
    args[clave] = valor;
  }

  if (!args.libro || !args.rango) {
    console.log("Uso: node src/orquestador-maestro.js --libro=genesis --rango=1-10");
    process.exit(1);
  }

  const { libro, rango } = args;
  const capitulos = parsearRango(rango);
  console.log(`\n🚀 INICIANDO ORQUESTADOR MAESTRO`);
  console.log(`📖 Libro: ${libro}`);
  console.log(` Capítulos a procesar: ${capitulos.join(", ")}`);
  console.log(`════════════════════════════════════════════\n`);

  const libroInfo = await obtenerBookIdPorSlug(libro);

  for (const capituloNum of capitulos) {
    console.log(`\n🔄 ══════ PROCESANDO CAPÍTULO ${capituloNum} ══════`);
    try {
      const chapterId = await obtenerOCrearChapterId(libroInfo.id, capituloNum);

      // PASO 1: Generar Estudio (con Oro Metálico)
      console.log(`\n   📝 [Paso 1/3] Generando estudio...`);
      await generarEstudio({
        libro,
        capitulo: capituloNum,
        video: "SIN VIDEO",
        imagen: "SIN IMAGEN",
        minimoPalabras: 3500,
        forzar: false, // No regenera si ya existe
        indicacionManual: null,
      });

      // PASO 2: Generar 16 Recursos de IA
      await generarRecursosIA(libro, capituloNum, chapterId, libroInfo);

      // PASO 3: Generar 8 Archivos de Prompts (Solo local)
      console.log(`\n   🎙️ [Paso 3/3] Generando prompts multimedia...`);
      await generarPromptsCapitulo(libro.toLowerCase(), capituloNum);

      console.log(`\n   🎉 ¡Capítulo ${capituloNum} completado exitosamente!`);
    } catch (error) {
      console.error(`\n   💥 ERROR CRÍTICO en capítulo ${capituloNum}:`, error.message);
      // Continuamos con el siguiente capítulo aunque uno falle
    }
  }

  console.log(`\n\n🏁 ══════ LOTE FINALIZADO ══════`);
  console.log(` Todos los prompts están en: prompts_output/${libro.toLowerCase()}/`);
}

main().catch(console.error);
