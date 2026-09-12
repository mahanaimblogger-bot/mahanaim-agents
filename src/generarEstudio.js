import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { generarConDeepSeek } from "./deepseekClient.js";
import { leerIndicacionEspecial } from "./leerIndicaciones.js";
import { validarEstudio } from "./validarEstudio.js";
   import {
     obtenerBookIdPorSlug,
     obtenerOCrearChapterId,
     existeRecurso,
     eliminarRecursoExistente,
     guardarRecursoComoPublicado, // <--- NUEVO NOMBRE
     obtenerTextoCapituloCompleto,
   } from "./supabaseClient.js";

/**
 * Genera el encabezado HTML "Oro Metálico" para los estudios bíblicos.
 * Elimina la necesidad de subir imágenes de portada manualmente.
 */
function generarEncabezadoOroMetalico(nombreLibro, numeroCapitulo, tituloEstudio) {
  return `
<div style="background: #0f172a; border-left: 10px solid #d4ac0d; border-radius: 0 12px 12px 0; padding: 3rem 2.5rem; box-shadow: 0 15px 20px -5px rgba(0, 0, 0, 0.4); position: relative; margin-bottom: 2rem;">
  <div style="position: absolute; top: 0; right: 0; width: 40%; height: 3px; background: linear-gradient(90deg, #d4ac0d 0%, transparent 100%);"></div>
  
  <p style="color: #d4ac0d; font-family: Georgia, 'Times New Roman', serif; font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 1rem 0;">
    Estudio Bíblico Expositivo
  </p>
  
  <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 4.5rem; margin: 0; font-weight: 700; line-height: 1.1; background: linear-gradient(135deg, #bf953f 0%, #fcf6ba 25%, #b38728 50%, #fbf5b7 75%, #aa771c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: 0px 2px 10px rgba(212, 172, 13, 0.3);">
    ${nombreLibro} <span style="color: #ffffff; font-weight: 400; -webkit-text-fill-color: #ffffff;">${numeroCapitulo}</span>
  </h1>
  
  <div style="border-top: 2px dotted #334155; width: 35%; margin: 1.5rem 0;"></div>
  
  ${tituloEstudio ? `<h2 style="font-family: Georgia, serif; font-style: italic; color: #f8fafc; font-size: 1.6rem; font-weight: 400; margin: 0; line-height: 1.4;">"${tituloEstudio}"</h2>` : ''}
  
  <div style="position: absolute; bottom: 0; right: 0; width: 40%; height: 3px; background: linear-gradient(90deg, transparent 0%, #d4ac0d 100%);"></div>
</div>
`;
}


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

   // OBTENER EL TEXTO REAL DEL CAPÍTULO PARA INYECTAR EN EL PROMPT
  const textoCapituloReal = await obtenerTextoCapituloCompleto(bookId, capitulo);

    const mensajeUsuario = `
### CONTEXTO DEL CAPÍTULO
- Libro: ${libro}
- Capítulo: CAPÍTULO ${capitulo}
- Enlace de video YouTube: ${video}
- Enlace de imagen de portada: ${imagen}

### NOTAS DEL AUTOR (INDICACIONES ESPECIALES - PRIORITARIAS)
${indicacionEspecial && indicacionEspecial !== "SIN INDICACIONES ESPECIALES"
  ? indicacionEspecial
  : "El autor no ha dejado notas específicas para este capítulo. Sigue el Prompt Maestro de forma estándar."}

=========================================================
⚠️ REGLA ABSOLUTA SOBRE CITAS BÍBLICAS (ANTI-ALUCINACIÓN) ⚠️
A continuación te proporciono el texto EXACTO de este capítulo en la versión Reina-Valera 1960 (RVR1960) desde nuestra base de datos oficial.

### TEXTO BÍBLICO A EXPONER (RVR1960)
${textoCapituloReal}

### TU TAREA
Genera el estudio expositivo en formato HTML siguiendo estrictamente el "Prompt Maestro".

INSTRUCCIONES OBLIGATORIAS SOBRE CITAS:
1. Cualquier cita del capítulo que estás estudiando DEBE ser una copia exacta, palabra por palabra, del texto proporcionado arriba. TIENES PROHIBIDO parafrasear, inventar, o modificar una sola coma.
2. Para las REFERENCIAS CRUZADAS a otros libros/capítulos: usa SOLO citas que conozcas con 100% de certeza en la versión RVR1960. Si tienes la más mínima duda del texto exacto de una referencia cruzada, NO pongas el texto en el tooltip — solo deja la referencia (ej: "Ver Hebreos 11:4") sin el tooltip de texto.
3. NUNCA inventes un versículo. Es preferible omitir un tooltip a inventar una cita.
4. REGLA CRÍTICA SOBRE IMÁGENES: No sugieras, insertes ni marques placeholders (como [Imagen aquí] o <img>) para imágenes en el cuerpo del HTML del estudio. El texto debe fluir limpio, usando solo los separadores y viñetas de diseño indicados en el Prompt Maestro. ÚNICAMENTE debes sugerir UNA (1) sola imagen al final de tu respuesta, bajo la clave "imagen_portada", que servirá como cabecera principal del estudio. Bajo ninguna circunstancia sugieras imágenes para el cuerpo del texto.

Recuerda aplicar las reglas de "INSTRUCCIONES PARA NOTAS DEL AUTOR" definidas en el Prompt Maestro: integra, amplía, mejora y corrige doctrinal/históricamente las notas proporcionadas arriba.
Si el autor pidió preservar un estudio existente, extrae solo el contenido y reenvuélvelo en la estructura HTML del Prompt Maestro.
Al finalizar, verifica que todas las indicaciones del autor hayan sido reflejadas.
Responde ÚNICAMENTE con el HTML completo, sin explicaciones antes o después.
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

    const { valido, errores, htmlCorregido, citasCorregidas } = await validarEstudio(html, minimoPalabras);

  await mkdir(path.join(process.cwd(), "output"), { recursive: true });
  const rutaLocal = path.join(
    process.cwd(),
    "output",
    `${libro}-${capitulo}.html`
  );
  await writeFile(rutaLocal, htmlCorregido, "utf-8");
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

  if (citasCorregidas > 0) {
    console.log(`   🔧 ${citasCorregidas} cita(s) bíblica(s) fueron corregidas automáticamente con el texto de Supabase.`);
  }

    const titulo = extraerTitulo(htmlCorregido, libro, capitulo);
  const slug = generarSlug(libro, capitulo, "estudio");

  // 🌟 INYECTAR ENCABEZADO ORO METÁLICO AUTOMÁTICO
  const encabezadoOro = generarEncabezadoOroMetalico(libroInfo.nombre, capitulo, titulo);
  const htmlFinalConEncabezado = encabezadoOro + htmlCorregido;

  // Sobrescribimos el archivo local para que la previsualización incluya el encabezado
  await writeFile(rutaLocal, htmlFinalConEncabezado, "utf-8");

    await guardarRecursoComoPublicado({
     chapterId,
     tipo: "estudio",
     titulo,
     slug,
     contenidoHtml: htmlFinalConEncabezado,
   });
   console.log(`   ☁️  Guardado en Supabase como PUBLICADO (publicado=true). Título: "${titulo}"`);
   console.log(`   🎉 ¡El estudio ya está visible en tu sitio web!`);
  );

  return { valido: true, rutaLocal, titulo };
}
