import { obtenerVersiculoPorSlug } from "./supabaseClient.js";
import { resolverSlugLibro } from "./librosBiblia.js";

/**
 * Normaliza un texto para comparación: minúsculas, sin puntuación, espacios únicos.
 */
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Devuelve el slug del libro a partir de su nombre o abreviatura (coincidencia EXACTA).
 * "Ro" -> romanos, "Is" -> isaias, "1 Co" -> 1-corintios. Si no lo reconoce, null.
 */
async function obtenerSlugLibro(nombreLibro) {
  return resolverSlugLibro(nombreLibro);
}

// ==========================================================
// TOOLTIPS PARA REFERENCIAS BÍBLICAS EN EL TEXTO (PROSA)
// ==========================================================

const MAX_VERSOS_TOOLTIP = 6;

// Zonas del HTML donde NO se deben agregar tooltips (títulos, índice, cajas de cita, enlaces...)
const ETIQUETAS_VACIAS = new Set([
  "br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr",
]);
const ETIQUETAS_OMITIDAS = new Set([
  "a", "h1", "h2", "h3", "h4", "h5", "h6", "style", "script", "title", "head",
  "button", "select", "textarea", "pre", "code",
]);
const CLASES_OMITIDAS = [
  "biblia-ref", "tooltip-text", "tooltip-cita", "cita-versiculo",
  "indice-nav", "ref-etiqueta", "volver-indice",
];

// Ej.: "Génesis 21:10", "Fil 2:6-7", "Éx 28:35,43", "1 Co 3:5" (el nombre se valida luego con librosBiblia.js)
const NOMBRE_LIBRO = "[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñÑ]*\\.?";
const ESPEC_VERSOS = "\\d+(?:\\s?[-–]\\s?\\d+)?(?:\\s?,\\s?\\d+(?:\\s?[-–]\\s?\\d+)?)*";
const REGEX_REFERENCIA = new RegExp(
  `(?<![A-Za-zÁÉÍÓÚáéíóúñÑ\\d])((?:[1-3][ \\u00A0]?)?${NOMBRE_LIBRO})[ \\u00A0](\\d{1,3}):(${ESPEC_VERSOS})`,
  "g"
);

const cacheVersiculos = new Map(); // solo guarda aciertos (si falla la red, se reintenta)

async function leerVersiculo(slug, capitulo, verso) {
  const clave = `${slug}|${capitulo}|${verso}`;
  if (cacheVersiculos.has(clave)) return cacheVersiculos.get(clave);
  const texto = await obtenerVersiculoPorSlug(slug, capitulo, verso);
  if (texto) cacheVersiculos.set(clave, texto);
  return texto;
}

function escaparHtml(texto) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** "17-20" -> [17,18,19,20] | "35,43" -> [35,43] */
function expandirVersos(especificacion) {
  const lista = [];
  for (const trozo of especificacion.split(",")) {
    const m = trozo.trim().match(/^(\d+)(?:\s?[-–]\s?(\d+))?$/);
    if (!m) continue;
    const desde = parseInt(m[1], 10);
    const hasta = m[2] ? parseInt(m[2], 10) : desde;
    if (hasta < desde || hasta - desde > 40) {
      lista.push(desde);
      continue;
    }
    for (let v = desde; v <= hasta; v++) lista.push(v);
  }
  return [...new Set(lista)];
}

/** Texto RVR1960 para el tooltip: un versículo solo, o "17. texto 18. texto" si son varios. */
async function textoParaTooltip(slug, capitulo, especificacion) {
  const versos = expandirVersos(especificacion);
  if (versos.length === 0) return null;

  const mostrados = versos.slice(0, MAX_VERSOS_TOOLTIP);
  const encontrados = [];
  for (const v of mostrados) {
    const texto = await leerVersiculo(slug, capitulo, v);
    if (texto) encontrados.push({ verso: v, texto });
  }
  if (encontrados.length === 0) return null;

  let resultado =
    encontrados.length === 1 && versos.length === 1
      ? escaparHtml(encontrados[0].texto)
      : encontrados.map((e) => `${e.verso}. ${escaparHtml(e.texto)}`).join(" ");

  if (versos.length > MAX_VERSOS_TOOLTIP) resultado += " …";
  return resultado;
}

function abreContextoOmitido(etiquetaCompleta, nombre) {
  if (ETIQUETAS_OMITIDAS.has(nombre)) return true;
  const m = etiquetaCompleta.match(/class\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  if (!m) return false;
  const clases = (m[1] ?? m[2]).split(/\s+/);
  return CLASES_OMITIDAS.some((c) => clases.includes(c));
}

/**
 * Recorre el HTML y agrega tooltip a cada referencia bíblica que aparezca en
 * texto corrido, sin tocar etiquetas, títulos, índice, cajas de cita ni tooltips ya existentes.
 */
async function agregarTooltipsEnProsa(html, nombresNoReconocidos) {
  let agregadas = 0;

  async function procesarTexto(texto) {
    const coincidencias = [...texto.matchAll(REGEX_REFERENCIA)];
    if (coincidencias.length === 0) return texto;

    let resultado = "";
    let cursor = 0;
    for (const m of coincidencias) {
      const [completo, nombre, capitulo, versos] = m;
      resultado += texto.slice(cursor, m.index);
      cursor = m.index + completo.length;

      let reemplazo = completo;
      const slug = resolverSlugLibro(nombre);
      if (!slug) {
        nombresNoReconocidos.add(nombre);
      } else {
        const textoTooltip = await textoParaTooltip(slug, parseInt(capitulo, 10), versos);
        if (textoTooltip) {
          reemplazo =
            `<span class="biblia-ref">${completo}<span class="tooltip-text">` +
            `<span class="tooltip-cita">${completo}</span>${textoTooltip}</span></span>`;
          agregadas++;
          console.log(`   ➕ Agregado tooltip para "${completo}"`);
        }
      }
      resultado += reemplazo;
    }
    return resultado + texto.slice(cursor);
  }

  // Los elementos impares son etiquetas o comentarios; los pares, texto.
  const partes = html.split(/(<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>)/g);
  const pila = [];
  let omitidos = 0;

  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];

    if (i % 2 === 0) {
      if (omitidos === 0 && parte.trim().length > 0) {
        partes[i] = await procesarTexto(parte);
      }
      continue;
    }
    if (parte.startsWith("<!--")) continue;

    const nombre = parte.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/)[1].toLowerCase();

    if (parte.startsWith("</")) {
      let idx = -1;
      for (let j = pila.length - 1; j >= 0; j--) {
        if (pila[j].nombre === nombre) { idx = j; break; }
      }
      if (idx !== -1) {
        while (pila.length > idx) {
          if (pila.pop().omitir) omitidos--;
        }
      }
      continue;
    }

    if (ETIQUETAS_VACIAS.has(nombre) || /\/\s*>$/.test(parte)) continue;

    const omitir = abreContextoOmitido(parte, nombre);
    pila.push({ nombre, omitir });
    if (omitir) omitidos++;
  }

  return { html: partes.join(""), agregadas };
}

/**
 * Validaciones automáticas + CORRECCIÓN AUTOMÁTICA de citas.
 * 1. Verifica que los tooltips existentes estén correctos
 * 2. Detecta referencias cruzadas sin tooltip y las corrige automáticamente
 */
export async function validarEstudio(html, minimoPalabras = 3500) {
  const errores = [];
  const advertencias = []; // avisos de estilo: se muestran en el log pero NO impiden guardar el estudio
  let htmlCorregido = html;

  if (!html || html.trim().length === 0) {
    return { valido: false, errores: ["El contenido está vacío."], htmlCorregido: html };
  }

  // Validaciones estructurales
  if (!html.includes('id="indice"')) errores.push('Falta el contenedor del índice.');
  if (!html.includes('id="contexto"')) errores.push('Falta la ficha de contexto.');
  if (!html.includes('id="resumen-cristo"')) errores.push('Falta la sección cristológica.');
  if (!html.includes('id="meditar"')) errores.push('Falta la caja "Para meditar".');
  if (!html.includes('id="apendice"')) errores.push('Falta el apéndice informativo.');

  const cierreContenedor = html.indexOf('<!-- FIN contenedor-blog -->');
  const inicioApendice = html.indexOf('id="apendice"');
  if (cierreContenedor !== -1 && inicioApendice !== -1 && inicioApendice < cierreContenedor) {
    errores.push("El apéndice está DENTRO del contenedor-blog (debe ir después).");
  }

  if (!html.includes('class="volver-indice"')) errores.push('Falta enlace "Volver al índice".');

  const textoPlano = html.replace(/<[^>]*>/g, " ");
  const cantidadPalabras = textoPlano.split(/\s+/).filter((p) => p.length > 0).length;
  if (cantidadPalabras < minimoPalabras) {
    errores.push(`El estudio tiene ~${cantidadPalabras} palabras, mínimo: ${minimoPalabras}.`);
  }

  if (/\[TÍTULO|\[REFERENCIA|\[DATOS\]|\[CONTENIDO/i.test(html)) {
    errores.push("Quedó un [PLACEHOLDER] sin rellenar.");
  }

  // Validación de estilo del título (reglas del prompt: sin dos puntos, máx. 60 caracteres, no genérico).
  // Solo son ADVERTENCIAS: rechazar el estudio por esto tiraría una generación completa.
  const matchTitulo = html.match(/<h1[^>]*class="[^"]*titulo-entrada[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  if (!matchTitulo) {
    advertencias.push("No se encontró el título (<h1 class=\"titulo-entrada\">).");
  } else {
    const titulo = matchTitulo[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (titulo.includes(":")) {
      advertencias.push(`El título tiene dos puntos (el prompt lo prohíbe): "${titulo}"`);
    }
    if (titulo.length > 60) {
      advertencias.push(`El título tiene ${titulo.length} caracteres (máximo 60): "${titulo}"`);
    }
    if (/^(estudio|an[aá]lisis|resumen)\s+(b[ií]blico\s+)?(de|del|sobre)\b/i.test(titulo)) {
      advertencias.push(`El título es genérico: "${titulo}"`);
    }
  }
  for (const aviso of advertencias) console.log(`   ⚠️  ${aviso}`);

  // Validación de la imagen de portada (ÚNICA imagen permitida)
  if (!/<!--\s*IMAGEN_SUGERIDA_PORTADA:/i.test(html)) {
    errores.push("Falta el marcador de imagen de portada (<!-- IMAGEN_SUGERIDA_PORTADA: ... -->).");
  }

  // NOTA: Se eliminó la validación de mínimo 2 imágenes en el contenido, 
  // ya que el nuevo estándar es usar SOLO la imagen de portada para mantener el diseño limpio.

  // ==========================================================
  // CORRECCIÓN AUTOMÁTICA DE CITAS BÍBLICAS
  // ==========================================================
  console.log("   🔍 Verificando y corrigiendo citas bíblicas contra la base de datos...");
  
  let citasCorregidas = 0;
  let citasValidadas = 0;
  let referenciasAgregadas = 0;
  const nombresNoReconocidos = new Set();

  // PASO 1: Verificar tooltips existentes contra Supabase
  const tooltipRegex = /<span class="tooltip-cita">(.*?)<\/span>([\s\S]*?)(?=<\/span>\s*<\/span>)/g;
  let match;
  const tooltipsExistentes = [];

  while ((match = tooltipRegex.exec(html)) !== null) {
    tooltipsExistentes.push({
      referenciaCompleta: match[1].trim(),
      textoTooltip: match[2].trim(),
      matchCompleto: match[0],
    });
  }

  for (const cita of tooltipsExistentes) {
    const matchRef = cita.referenciaCompleta.match(/^((?:[1-3]\s*)?[a-zA-ZáéíóúñÁÉÍÓÚÑ][a-zA-ZáéíóúñÁÉÍÓÚÑ\s\-.]*?)\s+(\d+):(\d+)/i);
    
    if (matchRef) {
      const nombreLibro = matchRef[1].trim();
      const capitulo = parseInt(matchRef[2], 10);
      const verso = parseInt(matchRef[3], 10);

      const slugLibro = await obtenerSlugLibro(nombreLibro);
      if (!slugLibro) nombresNoReconocidos.add(nombreLibro);

      if (slugLibro) {
        const textoReal = await obtenerVersiculoPorSlug(slugLibro, capitulo, verso);

        if (textoReal) {
          const textoRealNorm = normalizarTexto(textoReal);
          const textoTooltipNorm = normalizarTexto(cita.textoTooltip);

          const palabrasReales = textoRealNorm.split(" ");
          const coincidencias = palabrasReales.filter(p => textoTooltipNorm.includes(p)).length;
          const porcentaje = (coincidencias / palabrasReales.length) * 100;

          if (porcentaje < 85) {
            const tooltipCorregido = `<span class="tooltip-cita">${cita.referenciaCompleta}</span>${textoReal}`;
            htmlCorregido = htmlCorregido.replace(cita.matchCompleto, tooltipCorregido);
            console.log(`   ✅ Tooltip "${cita.referenciaCompleta}" corregido (coincidencia: ${porcentaje.toFixed(0)}%).`);
            citasCorregidas++;
          } else {
            citasValidadas++;
          }
        }
      }
    }
  }

  // PASO 2: Agregar tooltip a TODA referencia bíblica que esté en el texto sin tooltip
  // (con o sin paréntesis, con rangos "17-20" y listas "35,43"; no toca títulos, índice ni cajas de cita)
  const resultadoProsa = await agregarTooltipsEnProsa(htmlCorregido, nombresNoReconocidos);
  htmlCorregido = resultadoProsa.html;
  referenciasAgregadas = resultadoProsa.agregadas;

  console.log(`   📊 Resumen: ${citasValidadas} tooltips validados | ${citasCorregidas} corregidos | ${referenciasAgregadas} nuevos tooltips agregados`);
  if (nombresNoReconocidos.size > 0) {
    console.log(`   ℹ️  Referencias con libro no reconocido (no se validaron): ${[...nombresNoReconocidos].join(", ")}`);
  }

  const valido = errores.length === 0;

  return { 
    valido, 
    errores, 
    advertencias,
    htmlCorregido,
    citasCorregidas: citasCorregidas + referenciasAgregadas 
  };
}