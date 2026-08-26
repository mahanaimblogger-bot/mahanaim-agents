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
 * Validaciones automáticas + CORRECCIÓN AUTOMÁTICA de citas.
 * 1. Verifica que las citas en cajas estén correctas
 * 2. Detecta referencias cruzadas sin tooltip y las corrige automáticamente
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
  
  let citasCorregidas = 0;
  let citasValidadas = 0;
  let referenciasAgregadas = 0;

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
            // Corregir tooltip existente
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

  // PASO 2: Detectar referencias cruzadas SIN tooltip y agregarlas
  // Busca patrones como: (Dt 34:8), (Éx 28:35,43), (Ro 4:17), (Sal 1:2)
  // Pero IGNORA las que ya están dentro de <span class="biblia-ref">
  const referenciasDesnudasRegex = /(?<!<span class="biblia-ref">[^<]*?)\(([a-zA-ZáéíóúñÁÉÍÓÑ\s\-]+?)\s+(\d+):(\d+(?:,\d+)*?)\)(?![^<]*?<\/span>)/g;
  let matchRef;
  const referenciasAProcesar = [];

  // Resetear el regex
  const htmlSinTooltips = htmlCorregido.replace(/<span class="biblia-ref">[\s\S]*?<\/span>/g, '');
  
  while ((matchRef = referenciasDesnudasRegex.exec(htmlSinTooltips)) !== null) {
    referenciasAProcesar.push({
      nombreLibro: matchRef[1].trim(),
      capitulo: parseInt(matchRef[2], 10),
      versos: matchRef[3], // Puede ser "17" o "35,43"
      textoOriginal: matchRef[0],
    });
  }

  for (const ref of referenciasAProcesar) {
    const slugLibro = await obtenerSlugLibro(ref.nombreLibro);

    if (slugLibro) {
      // Obtener el primer verso del rango (si es "35,43", tomamos 35)
      const primerVerso = parseInt(ref.versos.split(',')[0], 10);
      
      const textoReal = await obtenerVersiculoPorSlug(slugLibro, ref.capitulo, primerVerso);

      if (textoReal) {
        // Crear el HTML completo con tooltip
        const referenciaFormateada = `${ref.nombreLibro} ${ref.capitulo}:${ref.versos}`;
        const htmlConTooltip = `<span class="biblia-ref">${referenciaFormateada}<span class="tooltip-text"><span class="tooltip-cita">${referenciaFormateada}</span>${textoReal}</span></span>`;
        
        // Reemplazar la referencia desnuda por la versión con tooltip
        htmlCorregido = htmlCorregido.replace(`(${ref.nombreLibro} ${ref.capitulo}:${ref.versos})`, htmlConTooltip);
        console.log(`   ➕ Agregado tooltip para "${referenciaFormateada}"`);
        referenciasAgregadas++;
      }
    }
  }

  console.log(`   📊 Resumen: ${citasValidadas} tooltips validados | ${citasCorregidas} corregidos | ${referenciasAgregadas} nuevos tooltips agregados`);

  const valido = errores.length === 0;

  return { 
    valido, 
    errores, 
    htmlCorregido,
    citasCorregidas: citasCorregidas + referenciasAgregadas 
  };
}
