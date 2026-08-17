/**
 * Reemplaza los marcadores de imagen sugerida por el HTML real de imagen,
 * usando las URLs que el usuario ya subió a Supabase Storage.
 *
 * @param {string} html - el contenido_html actual del estudio (con marcadores)
 * @param {string|null} urlPortada - URL pública de la imagen de portada, o null si no hay
 * @param {string[]} urlsContenido - URLs públicas, en el mismo orden que los marcadores
 * @returns {{ htmlFinal: string, reemplazosPortada: number, reemplazosContenido: number, pendientes: number }}
 */
export function incorporarImagenesEnHtml(html, urlPortada, urlsContenido = []) {
  let htmlFinal = html;
  let reemplazosPortada = 0;
  let reemplazosContenido = 0;

  // 1. Reemplazar el marcador de portada (solo hay uno, como máximo)
  if (urlPortada) {
    const regexPortada = /<!--\s*IMAGEN_SUGERIDA_PORTADA:\s*([\s\S]*?)-->/i;
    const coincidencia = htmlFinal.match(regexPortada);
    if (coincidencia) {
      const descripcion = coincidencia[1].trim();
      const bloqueImagen = `<div class="imagen-portada"><img alt="${escaparAtributo(
        descripcion
      )}" src="${urlPortada}" /></div>`;
      htmlFinal = htmlFinal.replace(regexPortada, bloqueImagen);
      reemplazosPortada = 1;
    }
  }

  // 2. Reemplazar los marcadores de contenido, en orden de aparición
  const regexContenido = /<!--\s*IMAGEN_SUGERIDA:\s*([\s\S]*?)-->/i;
  for (const url of urlsContenido) {
    const coincidencia = htmlFinal.match(regexContenido);
    if (!coincidencia) break;

    const descripcion = coincidencia[1].trim();
    const bloqueImagen = `<div style="margin: 25px auto; text-align: center;"><img alt="${escaparAtributo(
      descripcion
    )}" src="${url}" loading="lazy" style="max-width: 100%; height: auto; border: 3px solid rgb(212, 172, 13); border-radius: 4px; box-shadow: rgba(0, 0, 0, 0.3) 0px 8px 20px;" /></div>`;
    htmlFinal = htmlFinal.replace(regexContenido, bloqueImagen);
    reemplazosContenido++;
  }

  // 3. Contar cuántos marcadores quedaron sin reemplazar
  const marcadoresRestantes = (
    htmlFinal.match(/<!--\s*IMAGEN_SUGERIDA(_PORTADA)?:/gi) || []
  ).length;

  return {
    htmlFinal,
    reemplazosPortada,
    reemplazosContenido,
    pendientes: marcadoresRestantes,
  };
}

function escaparAtributo(texto) {
  return texto.replace(/"/g, "&quot;").slice(0, 200);
}
