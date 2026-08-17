import {
  obtenerBookIdPorSlug,
  buscarChapterId,
  obtenerRecurso,
  actualizarContenidoRecurso,
} from "./supabaseClient.js";
import { incorporarImagenesEnHtml } from "./incorporarImagenesEnHtml.js";

/**
 * ETAPA 2B — Incorpora al estudio las imágenes que el usuario ya generó
 * y subió manualmente a Supabase Storage, reemplazando los marcadores
 * IMAGEN_SUGERIDA / IMAGEN_SUGERIDA_PORTADA por las etiquetas <img> reales.
 *
 * El estudio sigue quedando con publicado=false (no se toca ese campo
 * aquí) — publicar sigue siendo una decisión manual del usuario.
 */
export async function incorporarImagenes({
  libro,
  capitulo,
  urlPortada = null,
  urlsContenido = [],
}) {
  console.log(`\n🖼️  Incorporando imágenes: ${libro} ${capitulo}...`);

  // 1. Resolver el libro
  let libroInfo;
  try {
    libroInfo = await obtenerBookIdPorSlug(libro);
  } catch (error) {
    console.log(`❌ ${error.message}`);
    return { exito: false, motivo: "libro_no_existe" };
  }

  // 2. Resolver el capítulo (sin crearlo)
  const chapterId = await buscarChapterId(libroInfo.id, capitulo);
  if (!chapterId) {
    console.log(
      `❌ Todavía no existe ningún estudio generado para ${libro} ${capitulo}. ` +
        `No hay nada donde incorporar imágenes.`
    );
    return { exito: false, motivo: "capitulo_sin_estudio" };
  }

  // 3. Buscar el recurso tipo "estudio"
  const recurso = await obtenerRecurso(chapterId, "estudio");
  if (!recurso) {
    console.log(
      `❌ El capítulo ${libro} ${capitulo} no tiene ningún recurso tipo "estudio" todavía.`
    );
    return { exito: false, motivo: "recurso_no_existe" };
  }

  console.log(`   ✅ Estudio encontrado: "${recurso.titulo}"`);

  // 4. Reemplazar los marcadores por las imágenes reales
  const { htmlFinal, reemplazosPortada, reemplazosContenido, pendientes } =
    incorporarImagenesEnHtml(recurso.contenido_html || "", urlPortada, urlsContenido);

  if (reemplazosPortada === 0 && reemplazosContenido === 0) {
    console.log(
      `⚠️  No se reemplazó ningún marcador. Verifica que el estudio tenga ` +
        `marcadores IMAGEN_SUGERIDA y que le hayas pasado al menos una URL.`
    );
    return { exito: false, motivo: "nada_para_reemplazar" };
  }

  // 5. Guardar el HTML actualizado en Supabase (mismo registro, se actualiza)
  await actualizarContenidoRecurso(recurso.id, htmlFinal);

  console.log(
    `   💾 Actualizado en Supabase: ${reemplazosPortada} portada + ${reemplazosContenido} imagen(es) de contenido.`
  );

  if (pendientes > 0) {
    console.log(
      `   ⚠️  Quedan ${pendientes} marcador(es) SIN reemplazar (diste menos URLs de las que había).`
    );
  } else {
    console.log(
      `   🎉 No quedan marcadores pendientes. El estudio sigue como borrador ` +
        `(publicado: false) — revísalo y publícalo manualmente cuando estés conforme.`
    );
  }

  return {
    exito: true,
    reemplazosPortada,
    reemplazosContenido,
    pendientes,
  };
}
