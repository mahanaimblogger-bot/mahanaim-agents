/**
 * Busca los marcadores de recurso visual dentro del HTML de un estudio
 * y los devuelve como una lista ordenada y fácil de leer.
 *
 * Reconoce dos tipos de marcador (ver Prompt Maestro):
 *   <!-- IMAGEN_SUGERIDA_PORTADA: descripción -->   (una sola, al inicio)
 *   <!-- IMAGEN_SUGERIDA: descripción -->            (varias, dentro del desarrollo)
 *
 * @param {string} html
 * @returns {{ portada: string|null, contenido: string[] }}
 */
export function extraerImagenesSugeridas(html) {
  const regexPortada = /<!--\s*IMAGEN_SUGERIDA_PORTADA:\s*([\s\S]*?)-->/i;
  const regexContenido = /<!--\s*IMAGEN_SUGERIDA:\s*([\s\S]*?)-->/gi;

  const coincidenciaPortada = html.match(regexPortada);
  const portada = coincidenciaPortada ? coincidenciaPortada[1].trim() : null;

  const contenido = [];
  let match;
  while ((match = regexContenido.exec(html)) !== null) {
    contenido.push(match[1].trim());
  }

  return { portada, contenido };
}

/**
 * Arma el texto legible (para descargar) con la lista numerada de
 * prompts de imagen pendientes de un estudio.
 */
export function generarListaLegible({ libro, capitulo, portada, contenido }) {
  const lineas = [];
  lineas.push(`IMÁGENES PENDIENTES — ${libro} ${capitulo}`);
  lineas.push("");

  if (portada) {
    lineas.push("[PORTADA]");
    lineas.push(portada);
    lineas.push("");
  } else {
    lineas.push("[PORTADA]");
    lineas.push("(No se encontró marcador de portada en este estudio.)");
    lineas.push("");
  }

  if (contenido.length === 0) {
    lineas.push(
      "(No se encontraron marcadores de imagen de contenido en este estudio.)"
    );
  } else {
    contenido.forEach((descripcion, indice) => {
      lineas.push(`[IMAGEN ${indice + 1}]`);
      lineas.push(descripcion);
      lineas.push("");
    });
  }

  lineas.push("---");
  lineas.push(
    "Genera cada imagen con el prompt de arriba, en el mismo orden, " +
      "y súbelas a Supabase Storage. Luego usa el agente " +
      '"incorporarImagenes" pasando las URLs en este mismo orden ' +
      "(portada primero, luego imagen 1, 2, 3...)."
  );

  return lineas.join("\n");
}
