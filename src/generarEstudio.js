import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { generarConDeepSeek } from "./deepseekClient.js";
import { leerIndicacionEspecial } from "./leerIndicaciones.js";
import { validarEstudio } from "./validarEstudio.js";
import {
  obtenerBookIdPorSlug,
  obtenerOCrearChapterId,
  existeRecurso,
  eliminarBorradorExistente,
  guardarRecursoComoBorrador,
} from "./supabaseClient.js";

/**
 * Extrae el título del <h1 class="titulo-entrada">...</h1> generado por
 * el Prompt Maestro.
 */
function extraerTitulo(html, libro, capitulo) {
  const coincidencia = html.match(
    /<h1[^>]*class="titulo-entrada"[^>]*>([\s\S]*?)<\/h1>/i
  );
  if (coincidencia) {
    return coincidencia[1].replace(/<[^>]+>/g, "").trim();
  }
  return `Estudio de ${libro} ${capitulo}`;
}

function generarSlug(libro, capitulo, tipo) {
  return `${libro}-${capitulo}-${tipo}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function limpiarCercasDeCodigo(texto) {
  return texto
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

/**
 * Genera el estudio expositivo de un capítulo usando el Prompt Maestro.
 *
 * COMPORTAMIENTO DE "forzar":
 *   - forzar=false (por defecto): si ya existe CUALQUIER recurso tipo
 *     "estudio" para ese capítulo (borrador o publicado), no hace nada.
 *   - forzar=true: si ya existe un BORRADOR sin aprobar, lo borra primero
 *     (para no acumular borradores viejos). Si existe un recurso YA
 *     PUBLICADO, lo deja intacto — el nuevo se guarda como borrador
 *     aparte, y solo se reemplaza cuando tú lo apruebes con el agente
 *     "Aprobar estudio" (ver aprobarEstudio.js).
 */
export async function generarEstudio({
  libro,
  capitulo,
  video = "SIN VIDEO",
  imagen = "SIN IMAGEN",
  minimoPalabras = 3500,
  forzar = false,
  indicacionManual = null,
}) {
  console.log(`\n📖 Generando estudio: ${libro} ${capitulo}...`);

  const libroInfo = await obtenerBookIdPorSlug(libro);
  const bookId = libroInfo.id;

  const chapterId = await obtenerOCrearChapterId(bookId, capitulo);

  if (!forzar) {
    const yaExiste = await existeRecurso(chapterId, "estudio");
    if (yaExiste) {
      console.log(
        `✋ Ya existe un estudio para ${libro} ${capitulo}. Usa forzar=true para regenerarlo.`
      );
      return { omitido: true };
    }
  } else {
    await eliminarRecursoExistente(chapterId, "estudio");
  }

  const promptMaestro = await readFile(
    path.join(process.cwd(), "prompts", "prompt-maestro.txt"),
    "utf-8"
  );

  const indicacionEspecial =
    indicacionManual && indicacionManual.trim().length > 0
      ? indicacionManual.trim()
      : await leerIndicacionEspecial(libro, capitulo);

  const mensajeUsuario = `
DATOS DE ENTRADA:
- Libro: ${libro}
- Capítulo: CAPÍTULO ${capitulo}
- Indicaciones especiales: ${indicacionEspecial}
- Enlace de video YouTube: ${video}
- Enlace de imagen de portada: ${imagen}

Genera el estudio completo siguiendo EXACTAMENTE las instrucciones del Prompt Maestro.
Recuerda: responde ÚNICAMENTE con el HTML completo, sin explicaciones antes o después,
sin usar cercas de código (\`\`\`).
`.trim();

  console.log(
    `   → Indicación especial usada: ${indicacionEspecial === "SIN INDICACIONES ESPECIALES" ? "(ninguna)" : indicacionEspecial}`
  );

  const respuestaCruda = await generarConDeepSeek(
    promptMaestro,
    mensajeUsuario,
    32000
  );

  const html = limpiarCercasDeCodigo(respuestaCruda);

  const { valido, errores } = validarEstudio(html, minimoPalabras);

  await mkdir(path.join(process.cwd(), "output"), { recursive: true });
  const rutaLocal = path.join(
    process.cwd(),
    "output",
    `${libro}-${capitulo}.html`
  );
  await writeFile(rutaLocal, html, "utf-8");
  console.log(`   💾 Copia local guardada en: ${rutaLocal}`);

  if (!valido) {
    console.log("   ❌ El estudio NO pasó la validación automática:");
    errores.forEach((e) => console.log(`      - ${e}`));
    console.log(
      "   No se guardó en Supabase. Revisa el archivo local, ajusta y vuelve a intentar."
    );
    return { valido: false, errores, rutaLocal };
  }

  console.log("   ✅ Validación automática superada.");

  const titulo = extraerTitulo(html, libro, capitulo);
  const slug = generarSlug(libro, capitulo, "estudio");

  await guardarRecursoComoBorrador({
    chapterId,
    tipo: "estudio",
    titulo,
    slug,
    contenidoHtml: html,
  });
  console.log(
    `   ☁️  Guardado en Supabase como BORRADOR (publicado=false). Título: "${titulo}"`
  );
  console.log(
    `   👉 Corre el agente "Aprobar estudio" cuando lo hayas revisado y quieras publicarlo.`
  );

  return { valido: true, rutaLocal, titulo };
}
