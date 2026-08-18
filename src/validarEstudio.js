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

  // 10. Debe tener el marcador de imagen de portada
  const tienePortada = /<!--\s*IMAGEN_SUGERIDA_PORTADA:/i.test(html);
  if (!tienePortada) {
    errores.push(
      "Falta el marcador de imagen de portada (IMAGEN_SUGERIDA_PORTADA)."
    );
  }

  // 11. Debe tener MÍNIMO 2 marcadores de recurso visual de contenido
  //     (esto se valida por código, no solo confiando en que el modelo
  //     siga la instrucción del prompt — así nunca pasa desapercibido
  //     un estudio con 0 o 1 marcador).
  const marcadoresContenido = (
    html.match(/<!--\s*IMAGEN_SUGERIDA:/gi) || []
  ).length;

  if (marcadoresContenido < 2) {
    errores.push(
      `El estudio tiene ${marcadoresContenido} marcador(es) de recurso visual de contenido ` +
        `(IMAGEN_SUGERIDA), por debajo del mínimo obligatorio de 2.`
    );
  }

  return { valido: errores.length === 0, errores };
}
