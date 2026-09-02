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
 * 1. Verifica que los tooltips existentes estén correctos
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
  // Regex segura para Node.js: busca patrones como (Dt 34:8), (Éx 28:35,43), (Ro 4:17)
  const referenciasDesnudasRegex = /\(([a-zA-ZáéíóúñÁÉÍÓÚÑ\s\-]+?)\s+(\d+):(\d+(?:,\d+)*?)\)/g;
  
  // Dividimos el HTML para NO tocar lo que ya está dentro de <span class="biblia-ref">
  const partes = htmlCorregido.split(/(<span class="biblia-ref">[\s\S]*?<\/span>)/g);
  
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];
    // Si la parte NO es un span de biblia-ref (los impares son los spans por el split con captura)
    if (!parte.startsWith('<span class="biblia-ref">')) {
      // Encontrar todas las coincidencias en esta parte
      const coincidencias = [...parte.matchAll(referenciasDesnudasRegex)];
      
      // Procesamos de atrás hacia adelante para no alterar los índices de reemplazo
      for (let j = coincidencias.length - 1; j >= 0; j--) {
        const match = coincidencias[j];
        const nombreLibro = match[1].trim();
        const capitulo = parseInt(match[2], 10);
        const versos = match[3];
        const matchTexto = match[0];
        const startIndex = match.index;
        const endIndex = startIndex + matchTexto.length;

        const slugLibro = await obtenerSlugLibro(nombreLibro);
        if (slugLibro) {
          const primerVerso = parseInt(versos.split(',')[0], 10);
          const textoReal = await obtenerVersiculoPorSlug(slugLibro, capitulo, primerVerso);

          if (textoReal) {
            const referenciaFormateada = `${nombreLibro} ${capitulo}:${versos}`;
            const htmlConTooltip = `<span class="biblia-ref">${referenciaFormateada}<span class="tooltip-text"><span class="tooltip-cita">${referenciaFormateada}</span>${textoReal}</span></span>`;
            
            // Reemplazar en la parte
            partes[i] = partes[i].substring(0, startIndex) + htmlConTooltip + partes[i].substring(endIndex);
            console.log(`   ➕ Agregado tooltip para "${referenciaFormateada}"`);
            referenciasAgregadas++;
          }
        }
      }
    }
  }
  
  htmlCorregido = partes.join('');

  console.log(`   📊 Resumen: ${citasValidadas} tooltips validados | ${citasCorregidas} corregidos | ${referenciasAgregadas} nuevos tooltips agregados`);

  const valido = errores.length === 0;

  return { 
    valido, 
    errores, 
    htmlCorregido,
    citasCorregidas: citasCorregidas + referenciasAgregadas 
  };
}
