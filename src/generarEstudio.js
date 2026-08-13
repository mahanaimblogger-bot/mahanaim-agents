import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { generarConDeepSeek } from "./deepseekClient.js";
import { leerIndicacionEspecial } from "./leerIndicaciones.js";
import { validarEstudio } from "./validarEstudio.js";
import {
  obtenerBookIdPorSlug,
  obtenerOCrearChapterId,
  existeRecurso,
  guardarRecursoComoBorrador,
} from "./supabaseClient.js";

/**
 * Extrae el título del <h1 class="titulo-entrada">...</h1> generado por
 * el Prompt Maestro. resources.titulo es NOT NULL, así que si no lo
 * encontramos usamos un título de respaldo (nunca dejamos esto vacío).
 */
function extraerTitulo(html, libro, capitulo) {
  const coincidencia = html.match(
    /<h1[^>]*class="titulo-entrada"[^>]*>([\s\S]*?)<\/h1>/i
  );
  if (coincidencia) {
    return coincidencia[1].replace(/<[^>]+>/g, "").trim();
  }
  return `Estudio de ${libro} ${capitulo}`; // respaldo, no debería usarse casi nunca
}

/**
 * Genera un slug simple y único para el recurso, ej: "genesis-4-estudio".
 */
function generarSlug(libro, capitulo, tipo) {
  return `${libro}-${capitulo}-${tipo}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Quita las cercas de código ```html ... ``` que a veces los modelos
 * agregan aunque se les pida no hacerlo.
 */
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
 * @param {object} opciones
 * @param {string} opciones.libro - ej: "genesis"
 * @param {number} opciones.capitulo - ej: 4
 * @param {string} [opciones.video] - URL de YouTube, opcional
 * @param {string} [opciones.imagen] - URL de imagen de portada, opcional
 * @param {number} [opciones.minimoPalabras] - mínimo según el tipo de capítulo (ver Prompt Maestro)
 * @param {boolean} [opciones.forzar] - si true, genera aunque ya exista el recurso
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

  // 1. Resolver el book_id a partir del slug (tabla "books")
  const libroInfo = await obtenerBookIdPorSlug(libro);
  const bookId = libroInfo.id;

  // 2. Resolver (o crear) el chapter_id (tabla "chapters")
  const chapterId = await obtenerOCrearChapterId(bookId, capitulo);

  // 3. ¿Ya existe un recurso tipo "estudio" para este capítulo?
  if (!forzar) {
    const yaExiste = await existeRecurso(chapterId, "estudio");
    if (yaExiste) {
      console.log(
        `✋ Ya existe un estudio para ${libro} ${capitulo}. Usa forzar=true para regenerarlo.`
      );
      return { omitido: true };
    }
  }

  // 4. Leer el Prompt Maestro completo (system prompt)
  const promptMaestro = await readFile(
    path.join(process.cwd(), "prompts", "prompt-maestro.txt"),
    "utf-8"
  );

 // 5. Indicaciones especiales: prioridad a lo escrito manualmente al correr
  // el workflow; si no se escribió nada, se busca en indicaciones/<libro>.md
  const indicacionEspecial =
    indicacionManual && indicacionManual.trim().length > 0
      ? indicacionManual.trim()
      : await leerIndicacionEspecial(libro, capitulo);

  // 6. Armar el mensaje de datos de entrada
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

  // 7. Llamar a DeepSeek
  const respuestaCruda = await generarConDeepSeek(
    promptMaestro,
    mensajeUsuario,
    32000 // los estudios son largos, dejamos margen generoso
  );

  const html = limpiarCercasDeCodigo(respuestaCruda);

  // 8. Validar automáticamente antes de guardar nada
  const { valido, errores } = validarEstudio(html, minimoPalabras);

  // 9. Guardar SIEMPRE una copia local en /output para que puedas revisarlo,
  //    exista o no error de validación
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

  // 10. Extraer título real del HTML (resources.titulo es obligatorio)
  const titulo = extraerTitulo(html, libro, capitulo);
  const slug = generarSlug(libro, capitulo, "estudio");

  // 11. Guardar en Supabase con publicado=false (borrador), pendiente de tu revisión final
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
    `   👉 Revísalo en tu panel admin y cambia "publicado" a true cuando esté aprobado.`
  );

  return { valido: true, rutaLocal, titulo };
}
