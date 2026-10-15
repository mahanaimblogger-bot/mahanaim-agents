import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { generarConDeepSeek } from "./deepseekClient.js";
import { leerIndicacionEspecial } from "./leerIndicaciones.js";
import { validarEstudio } from "./validarEstudio.js";
import {
  obtenerBookIdPorSlug,
  obtenerOCrearChapterId,
  existeRecurso,
  reemplazarOCrearRecursoPublicado,
  obtenerTextoCapituloCompleto,
} from "./supabaseClient.js";

function extraerTitulo(html, libro, capitulo) {
  const coincidencia = html.match(/<h1[^>]*class="titulo-entrada"[^>]*>([\s\S]*?)<\/h1>/i);
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

/**
 * Limpia la respuesta cruda del modelo SIN tocar el cuerpo del estudio.
 *
 * Solo actúa en los EXTREMOS del texto:
 *  - Quita las cercas de código (```html ... ```) del inicio y del final.
 *  - Quita todo lo que haya ANTES del primer <h1 o <div (texto introductorio
 *    como "Aquí tienes el estudio...", o el <head>/<style> copiado de la plantilla).
 *  - Quita texto suelto que haya DESPUÉS del último </div> (despedidas del modelo).
 *
 * IMPORTANTE: no uses reemplazos con frases sueltas como "A continuación"
 * o "estudio" aquí: sin ancla borran párrafos reales del cuerpo del estudio.
 */
function limpiarCercasDeCodigo(texto) {
  return texto
    .trim()
    // Cercas de código al inicio y al final
    .replace(/^```(?:html|markdown)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    // Todo lo anterior al primer <h1 o <div (solo al INICIO del texto)
    .replace(/^[\s\S]*?(?=<h1|<div)/i, "")
    // Cierres </body></html> sueltos al final (si el modelo copió la plantilla completa)
    .replace(/(?:\s*<\/(?:body|html)>)+\s*$/i, "")
    // Texto suelto después del último </div> (solo al FINAL del texto)
    .replace(/(<\/div>)[^<]*$/i, "$1")
    .trim();
}

/**
 * Genera el encabezado HTML "Oro Metálico" para los estudios bíblicos.
 */
function generarEncabezadoOroMetalico(nombreLibro, numeroCapitulo, tituloEstudio) {
  return `
<div style="background: #0f172a; border-left: 10px solid #d4ac0d; border-radius: 0 12px 12px 0; padding: 2rem 1.5rem; box-shadow: 0 15px 20px -5px rgba(0, 0, 0, 0.4); position: relative; margin-bottom: 2rem; overflow: hidden;">
  <div style="position: absolute; top: 0; right: 0; width: 40%; height: 3px; background: linear-gradient(90deg, #d4ac0d 0%, transparent 100%);"></div>
  
  <p style="color: #d4ac0d; font-family: Georgia, 'Times New Roman', serif; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 0.8rem 0; line-height: 1.3;">
    Estudio Bíblico Expositivo
  </p>
  
  <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2rem, 8vw, 3.5rem); margin: 0; font-weight: 700; line-height: 1.1; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto; background: linear-gradient(135deg, #bf953f 0%, #fcf6ba 25%, #b38728 50%, #fbf5b7 75%, #aa771c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: 0px 2px 10px rgba(212, 172, 13, 0.3); max-width: 100%;">
    ${nombreLibro} <span style="color: #ffffff; font-weight: 400; -webkit-text-fill-color: #ffffff;">${numeroCapitulo}</span>
  </h1>
  
  <div style="border-top: 2px dotted #334155; width: 35%; margin: 1rem 0;"></div>
  
  ${tituloEstudio ? `<h2 style="font-family: Georgia, serif; font-style: italic; color: #f8fafc; font-size: clamp(1rem, 4vw, 1.4rem); font-weight: 400; margin: 0; line-height: 1.4; word-wrap: break-word;">"${tituloEstudio}"</h2>` : ''}
  
  <div style="position: absolute; bottom: 0; right: 0; width: 40%; height: 3px; background: linear-gradient(90deg, transparent 0%, #d4ac0d 100%);"></div>
</div>
`;
}

export async function generarEstudio({
  libro,
  capitulo,
  video = "SIN VIDEO",
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
      console.log(`✋ Ya existe un estudio para ${libro} ${capitulo}. Usa forzar=true para regenerarlo.`);
      return { omitido: true };
    }
  } else {
    // forzar=true: NO se borra nada ahora. El estudio actual se mantiene intacto
    // y solo se reemplaza al final, si el nuevo se generó y pasó la validación.
    console.log(`   ♻️  forzar=true: el estudio actual se conserva hasta que el nuevo pase la validación.`);
  }

  const promptMaestro = await readFile(path.join(process.cwd(), "prompts", "prompt-maestro.txt"), "utf-8");

  const indicacionEspecial = indicacionManual && indicacionManual.trim().length > 0
    ? indicacionManual.trim()
    : await leerIndicacionEspecial(libro, capitulo);

  const textoCapituloReal = await obtenerTextoCapituloCompleto(bookId, capitulo);

  const mensajeUsuario = `
### CONTEXTO DEL CAPÍTULO
- Libro: ${libro}
- Capítulo: CAPÍTULO ${capitulo}
- Enlace de video YouTube: ${video}

### NOTAS DEL AUTOR (INDICACIONES ESPECIALES - PRIORITARIAS)
${indicacionEspecial && indicacionEspecial !== "SIN INDICACIONES ESPECIALES"
  ? indicacionEspecial
  : "El autor no ha dejado notas específicas para este capítulo. Sigue el Prompt Maestro de forma estándar."}

=========================================================
⚠️ REGLA ABSOLUTA SOBRE CITAS BÍBLICAS (ANTI-ALUCINACIÓN) ⚠️
A continuación te proporciono el texto EXACTO de este capítulo en la versión Reina-Valeria 1960 (RVR1960) desde nuestra base de datos oficial.

### TEXTO BÍBLICO A EXPONER (RVR1960)
${textoCapituloReal}

### TU TAREA
Genera el estudio expositivo en formato HTML siguiendo estrictamente el "Prompt Maestro".

INSTRUCCIONES OBLIGATORIAS SOBRE CITAS:
1. Cualquier cita del capítulo que estás estudiando DEBE ser una copia exacta, palabra por palabra, del texto proporcionado arriba.
2. Para las REFERENCIAS CRUZADAS: usa SOLO citas que conozcas con 100% de certeza en la versión RVR1960. Si tienes duda, NO pongas el texto en el tooltip.
3. NUNCA inventes un versículo.
4. SIN IMÁGENES: el estudio no lleva imágenes. No incluyas portada, ni etiquetas <img> (salvo la miniatura del bloque de video de YouTube, si hay enlace), ni comentarios <!-- IMAGEN_SUGERIDA ... --> en ningún lugar del HTML.

Responde ÚNICAMENTE con el HTML completo, sin explicaciones antes o después.
`.trim();

  console.log(`   → Indicación especial usada: ${indicacionEspecial === "SIN INDICACIONES ESPECIALES" ? "(ninguna)" : indicacionEspecial}`);

  const respuestaCruda = await generarConDeepSeek(promptMaestro, mensajeUsuario, 32000);
  const html = limpiarCercasDeCodigo(respuestaCruda);
  // 🧹 Limpieza adicional: solo cercas de código sueltas (sin frases que borren contenido)
  const htmlLimpio = html
    .replace(/```(?:html|markdown)?\s*/gi, "")
    .trim();

  const { valido, errores, htmlCorregido, citasCorregidas } = await validarEstudio(htmlLimpio, minimoPalabras);

  await mkdir(path.join(process.cwd(), "output"), { recursive: true });
  const rutaLocal = path.join(process.cwd(), "output", `${libro}-${capitulo}.html`);
  
  // 🌟 INYECTAR ENCABEZADO ORO METÁLICO AUTOMÁTICO
  const titulo = extraerTitulo(htmlCorregido, libro, capitulo);
  const encabezadoOro = generarEncabezadoOroMetalico(libroInfo.nombre, capitulo, titulo);
  const htmlFinalConEncabezado = encabezadoOro + htmlCorregido;

  await writeFile(rutaLocal, htmlFinalConEncabezado, "utf-8");
  console.log(`   💾 Copia local guardada en: ${rutaLocal}`);

  if (!valido) {
    console.log("   ❌ El estudio NO pasó la validación automática:");
    errores.forEach((e) => console.log(`      - ${e}`));
    return { valido: false, errores, rutaLocal };
  }

  console.log("   ✅ Validación automática superada.");
  if (citasCorregidas > 0) {
    console.log(`   🔧 ${citasCorregidas} cita(s) bíblica(s) fueron corregidas automáticamente.`);
  }

  const slug = generarSlug(libro, capitulo, "estudio");

  // 🚀 GUARDAR COMO PUBLICADO (si ya existía uno, se actualiza en su mismo registro)
  await reemplazarOCrearRecursoPublicado({
    chapterId,
    tipo: "estudio",
    titulo,
    slug,
    contenidoHtml: htmlFinalConEncabezado,
  });
  
  console.log(`   ☁️  Guardado en Supabase como PUBLICADO (publicado=true). Título: "${titulo}"`);
  console.log(`   🎉 ¡El estudio ya está visible en tu sitio web!`);

  return { valido: true, rutaLocal, titulo };
}