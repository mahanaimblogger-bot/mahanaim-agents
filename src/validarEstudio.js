/**
 * Validaciones automáticas (sin usar IA) contra reglas objetivas
 * del Prompt Maestro. Esto NO reemplaza la revisión humana, pero
 * atrapa errores obvios antes de guardar nada en Supabase.
 *
 * @param {string} html
 * @param {number} minimoPalabras
 * @returns {{ valido: boolean, errores: string[] }}
 */
export function validarEstudio(html, minimoPalabras = 3500) {
  const errores = [];

  if (!html || html.trim().length === 0) {
    return { valido: false, errores: ["El contenido está vacío."] };
  }

  // 1. Debe tener el índice de contenidos
  if (!html.includes('id="indice"')) {
    errores.push('Falta el contenedor del índice (id="indice").');
  }

  // 2. Debe tener la ficha de contexto
  if (!html.includes('id="contexto"')) {
    errores.push('Falta la ficha de contexto (id="contexto").');
  }

  // 3. Debe tener la sección cristológica
  if (!html.includes('id="resumen-cristo"')) {
    errores.push('Falta la sección cristológica (id="resumen-cristo").');
  }

  // 4. Debe tener "Para meditar"
  if (!html.includes('id="meditar"')) {
    errores.push('Falta la caja "Para meditar" (id="meditar").');
  }

  // 5. Debe tener el apéndice
  if (!html.includes('id="apendice"')) {
    errores.push('Falta el apéndice informativo (id="apendice").');
  }

  // 6. El apéndice debe estar fuera del contenedor-blog
  const cierreContenedor = html.indexOf('<!-- FIN contenedor-blog -->');
  const inicioApendice = html.indexOf('id="apendice"');
  if (
    cierreContenedor !== -1 &&
    inicioApendice !== -1 &&
    inicioApendice < cierreContenedor
  ) {
    errores.push(
      "El apéndice parece estar DENTRO del contenedor-blog (debe ir después)."
    );
  }

  // 7. Debe tener al menos un enlace "volver al índice"
  if (!html.includes('class="volver-indice"')) {
    errores.push('Falta al menos un enlace "↑ Volver al índice".');
  }

  // 8. Conteo aproximado de palabras (quitando etiquetas HTML)
  const textoPlano = html.replace(/<[^>]*>/g, " ");
  const cantidadPalabras = textoPlano
    .split(/\s+/)
    .filter((p) => p.length > 0).length;

  if (cantidadPalabras < minimoPalabras) {
    errores.push(
      `El estudio tiene ~${cantidadPalabras} palabras, por debajo del mínimo de ${minimoPalabras}.`
    );
  }

  // 9. Verificación básica de que no quedó un placeholder sin rellenar
  if (/\[TÍTULO|\[REFERENCIA|\[DATOS\]|\[CONTENIDO/i.test(html)) {
    errores.push(
      "Parece que quedó un [PLACEHOLDER] sin rellenar en el HTML."
    );
  }

  return { valido: errores.length === 0, errores };
}
