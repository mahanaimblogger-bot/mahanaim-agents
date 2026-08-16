import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.warn(
    "⚠️  Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en tu .env. " +
      "El agente podrá generar contenido pero no podrá guardarlo en Supabase."
  );
}

// Usamos la service_role key porque este script corre fuera del navegador
// y necesita permisos de escritura directos. NUNCA uses esta key en el frontend.
export const supabase =
  url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;

/**
 * Busca el id de un libro por su slug (ej: "genesis", "1-samuel").
 * Corresponde a la tabla "books" (columnas: id, nombre, slug, testamento, capitulos...).
 */
export async function obtenerBookIdPorSlug(slugLibro) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("books")
    .select("id, nombre, capitulos")
    .eq("slug", slugLibro)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando el libro "${slugLibro}": ${error.message}`);
  }
  if (!data) {
    throw new Error(
      `No se encontró ningún libro con slug="${slugLibro}" en la tabla "books". ` +
        `Verifica el slug exacto en Supabase.`
    );
  }
  return data;
}

/**
 * Busca el id del capítulo (tabla "chapters") para un book_id + número dado.
 * Si el capítulo no existe todavía, lo crea automáticamente
 * (chapters solo tiene book_id, numero y resumen — no hace falta más para crearlo).
 */
export async function obtenerOCrearChapterId(bookId, numeroCapitulo) {
  if (!supabase) return null;

  const { data: existente, error: errorBusqueda } = await supabase
    .from("chapters")
    .select("id")
    .eq("book_id", bookId)
    .eq("numero", numeroCapitulo)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(`Error buscando el capítulo: ${errorBusqueda.message}`);
  }
  if (existente) return existente.id;

  const { data: creado, error: errorCreacion } = await supabase
    .from("chapters")
    .insert({ book_id: bookId, numero: numeroCapitulo })
    .select("id")
    .single();

  if (errorCreacion) {
    throw new Error(`Error creando el capítulo: ${errorCreacion.message}`);
  }
  console.log(`   ➕ Capítulo creado en Supabase (chapter_id=${creado.id}).`);
  return creado.id;
}

/**
 * Busca el chapter_id SIN crearlo. Devuelve null si el capítulo no existe.
 * Útil para los agentes de imágenes, que solo deben LEER estudios que
 * ya fueron generados antes — nunca crear un capítulo vacío por error.
 */
export async function buscarChapterId(bookId, numeroCapitulo) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("chapters")
    .select("id")
    .eq("book_id", bookId)
    .eq("numero", numeroCapitulo)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando el capítulo: ${error.message}`);
  }
  return data ? data.id : null;
}

/**
 * Revisa si ya existe un recurso de cierto tipo para un chapter_id dado.
 */
export async function existeRecurso(chapterId, tipo) {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("resources")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("tipo", tipo)
    .limit(1);

  if (error) {
    console.error("Error consultando Supabase:", error.message);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Busca el recurso ("estudio") completo de un chapter_id, con su
 * contenido HTML. Devuelve null si no existe (en vez de lanzar error),
 * para que el agente que llama pueda dar un mensaje amable en vez de
 * "colgarse".
 */
export async function obtenerRecurso(chapterId, tipo) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("resources")
    .select("id, titulo, contenido_html, publicado")
    .eq("chapter_id", chapterId)
    .eq("tipo", tipo)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando el recurso: ${error.message}`);
  }
  return data; // null si no existe
}

/**
 * Actualiza el contenido_html de un recurso ya existente (por su id).
 * Se usa en la Etapa 2B (incorporar imágenes) para reemplazar el HTML
 * con marcadores por el HTML final con las imágenes ya insertadas.
 */
export async function actualizarContenidoRecurso(recursoId, nuevoHtml) {
  if (!supabase) {
    console.warn("No hay conexión a Supabase configurada — no se actualizó nada.");
    return null;
  }

  const { data, error } = await supabase
    .from("resources")
    .update({ contenido_html: nuevoHtml })
    .eq("id", recursoId)
    .select();

  if (error) {
    throw new Error(`Error actualizando el recurso: ${error.message}`);
  }
  return data;
}

/**
 * Guarda un recurso generado en Supabase con publicado=false (borrador),
 * para que lo revises en el panel admin antes de publicarlo.
 */
export async function guardarRecursoComoBorrador({
  chapterId,
  tipo,
  titulo,
  slug,
  contenidoHtml,
}) {
  if (!supabase) {
    console.warn(
      "No hay conexión a Supabase configurada — no se guardó nada, " +
        "solo se generó el archivo local en /output."
    );
    return null;
  }

  const { data, error } = await supabase
    .from("resources")
    .insert({
      chapter_id: chapterId,
      tipo,
      titulo,
      slug,
      contenido_html: contenidoHtml,
      modo: "html",
      publicado: false,
    })
    .select();

  if (error) {
    throw new Error(`Error guardando en Supabase: ${error.message}`);
  }

  return data;
}

/**
 * Devuelve el texto real (RVR1960) de un versículo desde la tabla "verses".
 * Útil para, más adelante, validar que los tooltips del HTML generado
 * no contengan citas alucinadas por el modelo.
 */
export async function obtenerVersiculo(bookId, capitulo, verso) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("verses")
    .select("text")
    .eq("book_id", bookId)
    .eq("chapter", capitulo)
    .eq("verse", verso)
    .maybeSingle();

  if (error) {
    console.error("Error consultando la tabla verses:", error.message);
    return null;
  }
  return data ? data.text : null;
}
