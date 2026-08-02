import { readFile } from "fs/promises";
import path from "path";

/**
 * Lee el archivo indicaciones/<libro>.md (si existe) y devuelve
 * la indicación especial para un capítulo específico, o el texto
 * por defecto si no hay ninguna indicación guardada.
 *
 * Formato esperado dentro del archivo .md:
 *   Capítulo 3: texto de la indicación
 *
 * @param {string} libro - ej: "genesis"
 * @param {number} capitulo - ej: 4
 * @returns {Promise<string>}
 */
export async function leerIndicacionEspecial(libro, capitulo) {
  const rutaArchivo = path.join(
    process.cwd(),
    "indicaciones",
    `${libro.toLowerCase()}.md`
  );

  let contenido;
  try {
    contenido = await readFile(rutaArchivo, "utf-8");
  } catch (error) {
    // No existe archivo de indicaciones para este libro todavía. No es un error grave.
    return "SIN INDICACIONES ESPECIALES";
  }

  // Busca una línea tipo: "Capítulo 4: ..." o "Capitulo 4: ..." (con o sin tilde)
  const regex = new RegExp(
    `^cap[ií]tulo\\s+${capitulo}\\s*:\\s*(.+)$`,
    "im"
  );
  const coincidencia = contenido.match(regex);

  if (coincidencia && coincidencia[1].trim().length > 0) {
    return coincidencia[1].trim();
  }

  return "SIN INDICACIONES ESPECIALES";
}
