import { readFile } from "fs/promises";
import path from "path";
import { obtenerVersiculoPorSlug } from "./supabaseClient.js";

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
 * Busca el slug del libro en libros.json basado en el nombre o abreviatura.
 */
async function obtenerSlugLibro(nombreLibro) {
  const librosPath = path.join(process.cwd(), "libros.json");
  const librosData = await readFile(librosPath, "utf-8");
  const libros = JSON.parse(librosData);
  
  const nombreNormalizado = normalizarTexto(nombreLibro);
  
  const libroEncontrado = libros.find((libro) => {
    const nombreNorm = normalizarTexto(libro.nombre);
    const slugNorm = normalizarTexto(libro.slug);
    return nombreNorm.includes(nombreNormalizado) || slugNorm.includes(nombreNormalizado);
  });

  return libroEncontrado ? libroEncontrado.slug : null;
}

/**
 * Validaciones automáticas + CORRECCIÓN AUTOMÁTICA de citas incorrectas.
 * Reemplaza directamente las citas dudosas con el texto real de Supabase.
 */
export async function validarEstudio(html, minimoPalabras = 3500) {
  const errores = [];
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

  if (!/<!--\s*IMAGEN_SUGERIDA_PORTADA:/i.test(html)) {
    errores.push("Falta el marcador de imagen de portada.");
  }

  const marcadoresContenido = (html.match(/<!--\s*IMAGEN_SUGERIDA:/gi) || []).length;
  if (marcadoresContenido < 2) {
    errores.push(`Solo ${marcadoresContenido} marcador(es) de imagen, mínimo: 2.`);
  }

  // ==========================================================
  // CORRECCIÓN AUTOMÁTICA DE CITAS BÍBLICAS
  // ==========================================================
  console.log("   🔍 Verificando y corrigiendo citas bíblicas contra la base de datos...");
  
  // Regex para encontrar tooltips completos
  const tooltipRegex = /<span class="tooltip-cita">(.*?)<\/span>([\s\S]*?)(?=<\/span>\s*<\/span>)/g;
  let match;
  const citasAProcesar = [];

  while ((match = tooltipRegex.exec(html)) !== null) {
    citasAProcesar.push({
      referenciaCompleta: match[1].trim(),
      textoTooltip: match[2].trim(),
      matchCompleto: match[0],
    });
  }

  let citasCorregidas = 0;
  let citasValidadas = 0;

  for (const cita of citasAProcesar) {
    const matchRef = cita.referenciaCompleta.match(/^([a-zA-ZáéíóúñÁÉÍÓÚÑ\s\-]+?)\s+(\d+):(\d+)/i);
    
    if (matchRef) {
      const nombreLibro = matchRef[1].trim();
      const capitulo = parseInt(matchRef[2], 10);
      const verso = parseInt(matchRef[3], 10);

      const slugLibro = await obtenerSlugLibro(nombreLibro);

      if (slugLibro) {
        const textoReal = await obtenerVersiculoPorSlug(slugLibro, capitulo, verso);

        if (textoReal) {
          const textoRealNorm = normalizarTexto(textoReal);
          const textoTooltipNorm = normalizarTexto(cita.textoTooltip);

          const palabrasReales = textoRealNorm.split(" ");
          const coincidencias = palabrasReales.filter(p => textoTooltipNorm.includes(p)).length;
          const porcentaje = (coincidencias / palabrasReales.length) * 100;

          if (porcentaje < 85) {
            // REEMPLAZAR DIRECTAMENTE con el texto correcto de Supabase
            const tooltipCorregido = `<span class="tooltip-cita">${cita.referenciaCompleta}</span>${textoReal}`;
            htmlCorregido = htmlCorregido.replace(cita.matchCompleto, tooltipCorregido);
            console.log(`   ✅ Cita "${cita.referenciaCompleta}" corregida automáticamente (coincidencia era: ${porcentaje.toFixed(0)}%).`);
            citasCorregidas++;
          } else {
            citasValidadas++;
          }
        }
      }
    }
  }

  console.log(`   ✅ Citas validadas: ${citasValidadas} | Citas corregidas automáticamente: ${citasCorregidas}`);

  const valido = errores.length
