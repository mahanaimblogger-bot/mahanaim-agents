import {
  obtenerBookIdPorSlug,
  buscarChapterId,
  obtenerRecursosPorTipo,
  eliminarRecurso,
  publicarRecurso,
} from "./supabaseClient.js";

/**
 * Aprueba (publica) el borrador pendiente de un capítulo.
 *
 * Comportamiento:
 *   - Si NO hay ningún borrador pendiente: avisa y no hace nada.
 *   - Si hay un borrador Y NO había nada publicado antes: simplemente
 *     publica el borrador (era un estudio nuevo).
 *   - Si hay un borrador Y YA había uno publicado antes: borra el
 *     publicado viejo y publica el borrador nuevo (era un reemplazo).
 *     Este es el ÚNICO momento en que el estudio viejo se borra —
 *     nunca antes, nunca automáticamente al generar.
 */
export async function aprobarEstudio({ libro, capitulo, tipo = "estudio" }) {
  console.log(`\n✅ Aprobando: ${libro} ${capitulo} (tipo: ${tipo})...`);

  let libroInfo;
  try {
    libroInfo = await obtenerBookIdPorSlug(libro);
  } catch (error) {
    console.log(`❌ ${error.message}`);
    return { exito: false, motivo: "libro_no_existe" };
  }

  const chapterId = await buscarChapterId(libroInfo.id, capitulo);
  if (!chapterId) {
    console.log(
      `❌ Todavía no existe ningún recurso para ${libro} ${capitulo}. Nada que aprobar.`
    );
    return { exito: false, motivo: "capitulo_no_existe" };
  }

  const recursos = await obtenerRecursosPorTipo(chapterId, tipo);

  const borrador = recursos.find((r) => r.publicado === false);
  const publicadosViejos = recursos.filter((r) => r.publicado === true);

  if (!borrador) {
    console.log(
      `⚠️  No hay ningún borrador pendiente de aprobar para ${libro} ${capitulo}. ` +
        (publicadosViejos.length > 0
          ? `Ya está publicado: "${publicadosViejos[0].titulo}".`
          : `Tampoco hay nada publicado todavía — genera el estudio primero.`)
    );
    return { exito: false, motivo: "no_hay_borrador" };
  }

  console.log(`   📄 Borrador encontrado: "${borrador.titulo}"`);

  for (const viejo of publicadosViejos) {
    await eliminarRecurso(viejo.id);
    console.log(`   🗑️  Versión publicada anterior eliminada: "${viejo.titulo}"`);
  }

  await publicarRecurso(borrador.id);
  console.log(`   🎉 Publicado: "${borrador.titulo}"`);

  return {
    exito: true,
    eraReemplazo: publicadosViejos.length > 0,
    tituloPublicado: borrador.titulo,
  };
}
