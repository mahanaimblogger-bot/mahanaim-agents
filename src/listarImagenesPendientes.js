import { writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  obtenerBookIdPorSlug,
  buscarChapterId,
  obtenerRecurso,
} from "./supabaseClient.js";
import {
  extraerImagenesSugeridas,
  generarListaLegible,
} from "./extraerImagenesSugeridas.js";

/**
 * ETAPA 2A — Lista los prompts de imagen pendientes de un estudio
 * que YA fue generado antes (no genera nada nuevo, solo lee).
 *
 * Da mensajes claros (sin lanzar excepciones feas) si:
 *   - El libro no existe.
 *   - El capítulo no existe todavía en Supabase.
 *   - El capítulo existe pero no tiene un recurso tipo "estudio".
 *   - El estudio existe pero no tiene ningún marcador de imagen.
 */
export async function listarImagenesPendientes({ libro, capitulo }) {
  console.log(`\n🖼️  Buscando imágenes pendientes: ${libro} ${capitulo}...`);

  // 1. Resolver el libro
  let libroInfo;
  try {
    libroInfo = await obtenerBookIdPorSlug(libro);
  } catch (error) {
    console.log(`❌ ${error.message}`);
    return { encontrado: false, motivo: "libro_no_existe" };
  }

  // 2. Resolver el capítulo (SIN crearlo — si no existe, es porque
  //    todavía no se generó ningún estudio para ese capítulo)
  const chapterId = await buscarChapterId(libroInfo.id, capitulo);
  if (!chapterId) {
    console.log(
      `❌ Todavía no existe ningún estudio generado para ${libro} ${capitulo}. ` +
        `Primero genera el estudio (Etapa 1) antes de buscar imágenes pendientes.`
    );
    return { encontrado: false, motivo: "capitulo_sin_estudio" };
  }

  // 3. Buscar el recurso tipo "estudio" para ese capítulo
  const recurso = await obtenerRecurso(chapterId, "estudio");
  if (!recurso) {
    console.log(
      `❌ El capítulo ${libro} ${capitulo} existe en Supabase, pero no tiene ` +
        `ningún recurso tipo "estudio" todavía. Genera el estudio primero (Etapa 1).`
    );
    return { encontrado: false, motivo: "recurso_no_existe" };
  }

  console.log(`   ✅ Estudio encontrado: "${recurso.titulo}"`);

  // 4. Extraer los marcadores de imagen del HTML guardado
  const { portada, contenido } = extraerImagenesSugeridas(
    recurso.contenido_html || ""
  );

  if (!portada && contenido.length === 0) {
    console.log(
      `⚠️  El estudio "${recurso.titulo}" no tiene ningún marcador de imagen ` +
        `(ni de portada ni de contenido). Puede que sea un estudio generado ` +
        `antes de agregar esta función, o que el modelo no haya incluido ninguno.`
    );
    return { encontrado: true, sinMarcadores: true, recurso };
  }

  // 5. Armar el archivo de texto legible y guardarlo en /output
  const textoLegible = generarListaLegible({ libro, capitulo, portada, contenido });

  await mkdir(path.join(process.cwd(), "output"), { recursive: true });
  const rutaLocal = path.join(
    process.cwd(),
    "output",
    `${libro}-${capitulo}-imagenes-pendientes.txt`
  );
  await writeFile(rutaLocal, textoLegible, "utf-8");

  console.log(`   💾 Lista guardada en: ${rutaLocal}`);
  console.log(
    `   📋 Total: ${portada ? 1 : 0} imagen de portada + ${contenido.length} imagen(es) de contenido.`
  );

  return { encontrado: true, sinMarcadores: false, portada, contenido, rutaLocal };
}
