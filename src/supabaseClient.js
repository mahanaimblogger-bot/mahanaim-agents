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
 * Busca el id del capítulo para un book_id + número dado.
 * Si el capítulo no existe todavía, lo crea automáticamente.
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
 * Revisa si ya existe AL MENOS UN recurso de cierto tipo para un
 * chapter_id dado (sin importar si es borrador o publicado).
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
 * Busca UN recurso (el más reciente) de cierto tipo para un chapter_id.
 * Si puede haber un borrador Y un publicado a la vez, usa
 * obtenerRecursosPorTipo() en su lugar para verlos todos.
 */
export async function obtenerRecurso(chapterId, tipo) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("resources")
    .select("id, titulo, contenido_html, publicado")
    .eq("chapter_id", chapterId)
    .eq("tipo", tipo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando el recurso: ${error.message}`);
  }
  return data; // null si no existe
}

/**
 * Devuelve TODOS los recursos de un tipo para un chapter_id (puede haber
 * 0, 1, o hasta 2 a la vez: un borrador pendiente + uno publicado).
 */
export async function obtenerRecursosPorTipo(chapterId, tipo) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("resources")
    .select("id, titulo, contenido_html, publicado, created_at")
    .eq("chapter_id", chapterId)
    .eq("tipo", tipo)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Error buscando recursos: ${error.message}`);
  }
  return data || [];
}

/**
 * Actualiza el contenido_html de un recurso ya existente (por su id).
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
 * Borra un recurso por su id.
 */
export async function eliminarRecurso(recursoId) {
  if (!supabase) return null;

  const { error } = await supabase.from("resources").delete().eq("id", recursoId);

  if (error) {
    throw new Error(`Error eliminando el recurso: ${error.message}`);
  }
  return true;
}

/**
 * Marca un recurso como publicado (publicado: true).
 */
export async function publicarRecurso(recursoId) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("resources")
    .update({ publicado: true })
    .eq("id", recursoId)
    .select();

  if (error) {
    throw new Error(`Error publicando el recurso: ${error.message}`);
  }
  return data;
}

/**
 * Borra CUALQUIER recurso pendiente o publicado de un chapter_id + tipo,
 * si existe. Se usa cuando forzar=true, para garantizar que no se dupliquen
 * registros en la base de datos (reemplaza en lugar de acumular).
 */
export async function eliminarRecursoExistente(chapterId, tipo) {
  if (!supabase) return null;

  // NOTA: Eliminamos la condición .eq("publicado", false) para que borre
  // tanto borradores como versiones ya publicadas, evitando duplicados.
  const { data, error } = await supabase
    .from("resources")
    .delete()
    .eq("chapter_id", chapterId)
    .eq("tipo", tipo)
    .select();

  if (error) {
    throw new Error(`Error eliminando el recurso anterior: ${error.message}`);
  }
  if (data && data.length > 0) {
    console.log(`   🗑️  Recurso anterior eliminado (id=${data[0].id}, publicado=${data[0].publicado}).`);
  } else {
    console.log(`   ℹ️  No existía un recurso previo para este capítulo.`);
  }
  return data;
}

/**
 * Guarda un recurso generado en Supabase con publicado=false (borrador),
 * para que lo revises antes de publicarlo con el agente "Aprobar estudio".
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
 * Obtiene TODOS los versículos de un capítulo específico de una sola vez.
 * Devuelve un string formateado listo para ser inyectado en el Prompt.
 */
export async function obtenerTextoCapituloCompleto(bookId, capitulo) {
  if (!supabase) return "NO DISPONIBLE";

  const { data, error } = await supabase
    .from("verses")
    .select("verse, text")
    .eq("book_id", bookId)
    .eq("chapter", capitulo)
    .order("verse", { ascending: true });

  if (error || !data || data.length === 0) {
    console.warn(`⚠️ No se pudieron cargar los versículos para el capítulo ${capitulo}.`);
    return "NO DISPONIBLE";
  }

  return data.map(v => `${v.verse}. ${v.text}`).join("\n");
}
/**
 * Devuelve el texto real (RVR1960) de un versículo desde la tabla "verses".
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

/**
 * Obtiene el texto de un versículo específico usando el slug del libro.
 * Útil para validar referencias cruzadas sin tener que buscar el book_id primero.
 */
export async function obtenerVersiculoPorSlug(slugLibro, capitulo, verso) {
  if (!supabase) return null;

  // Primero buscamos el book_id
  const libroInfo = await obtenerBookIdPorSlug(slugLibro);
  if (!libroInfo) return null;

  return await obtenerVersiculo(libroInfo.id, capitulo, verso);
}
