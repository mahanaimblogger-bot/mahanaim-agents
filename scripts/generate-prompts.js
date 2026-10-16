// ============================================================
// scripts/generate-prompts.js  (v2: el VIDEO es la pieza central)
// ------------------------------------------------------------
// Orden de generación:
//   0. Fuente consolidada
//   1. Guion SSML del video (sin <emphasis>, validado)
//   2. Momentos narrativos -> marcas <mark> -> prompts de imágenes
//   3. Metadatos de YouTube (título NUEVO, descripción, tags,
//      capítulos, miniatura) derivados del guion ya terminado
//   4. Guion de podcast (2 voces, otro ángulo, mismo material)
//   5. Mapa interactivo (para el sitio web)
//
// Archivos que genera en prompts_output/<libro>/Capitulo_<n>/:
//   0_FUENTE_CONSOLIDADA_<Libro>_Cap<n>.txt
//   guion_video_tts.ssml
//   prompts_imagenes_video.json
//   youtube_metadata.json
//   5_YOUTUBE_PREVIEW_<Libro>_Cap<n>.txt      (lectura humana)
//   podcast_guion.json
//   7_PODCAST_GUION_<Libro>_Cap<n>.txt        (lectura humana)
//   6_MAPA_INTERACTIVO_<Libro>_Cap<n>.txt
// ============================================================
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
});

// ============================================================
// CONFIGURACIÓN
// ============================================================
// Las llamadas en modo JSON siguen usando "deepseek-chat" (como antes).
// Las de texto libre (SSML) usan LLM_MODEL si está definido (como antes).
const MODELO_JSON = "deepseek-chat";
const MODELO_TEXTO = process.env.LLM_MODEL || "deepseek-chat";

// Presupuesto total (caracteres) de la fuente que alimenta guion y podcast
const PRESUPUESTO_FUENTE = 70000;

// Valores por defecto que leerá el script de subida a YouTube
const AJUSTES_YOUTUBE = {
  categoria_id: "27", // Educación
  idioma: "es",
  para_ninos: false,
  contenido_sintetico: true, // declaración de contenido alterado / IA
  visibilidad: "private",
};

const ANATOMIA =
  "fully human anatomy with correct adult-child proportions, natural hands, no deformed fingers, no floating heads, no cut-off bodies, no dismembered limbs";

// ============================================================
// TEXTOS COMPARTIDOS
// ============================================================
const PERFIL_DOCTRINAL = `
- Monoteísmo puro: Un solo Dios, el Padre. Jesucristo es Su Hijo y Mesías, preexistente, de Su esencia pero distinto y subordinado al Padre, con todo poder y autoridad conferido por el Padre.
- ⛔ REGLA INVIOLABLE SOBRE LA DEIDAD: En NINGÚN punto debes afirmar, sugerir ni dar a entender que existe una "Trinidad" o un "Dios trino" de tres personas divinas coiguales. NUNCA digas que Jesucristo es "Dios" o "Dios el Hijo" (es el HIJO de Dios). NUNCA digas que el Espíritu Santo es "Dios" ni una tercera persona divina (es el Espíritu de Dios y de Cristo). Un solo Dios: el Padre.
- Soteriología calvinista, escatología premilenial postribulacionista, cesacionismo moderado, teología de pactos reformada. Cristo es el hijo de Dios, El mesias, es preexistente, el padre le dio toda autoridad y poder, por medio de Cristo fue hecho todo.`;

const REGLAS_IMAGEN = `
A) COHERENCIA HISTÓRICA Y CULTURAL:
- Cada prompt debe incluir al inicio un bloque de contexto de época específico a ESTE capítulo.
- Vestimenta, arquitectura, herramientas, mobiliario y entorno exactos a esa época y cultura.
- Paleta de colores coherente con la escena (ámbar, ocre y dorado para escenas diurnas; azules fríos para nocturnas).
- PROHIBIDO: cualquier objeto moderno o fuera de época. Prohibido mezclar culturas o siglos.

B) GÉNERO EXPLÍCITO EN PERSONAJES CON NOMBRE:
- Cada vez que un personaje con nombre aparezca, aclaralo entre paréntesis con su género.
- Ejemplo: "Rebekah (a woman)", "Abraham (a man)", "the midwife (a woman)", "the infant (a baby boy)".

C) HUMANIDAD Y PROPORCIONES:
- Todos los personajes son seres humanos completos y normales.
- PROPORCIONES HUMANAS CORRECTAS: adultos con proporciones adultas, niños con proporciones infantiles.
- Al final de cada prompt: "${ANATOMIA}".

D) POSE, COMPOSICIÓN Y MULTITUDES:
- Poses explícitas. Figuras humanas completas.
- MULTITUDES: proporciones correctas, sin "enanos" al fondo.

E) AUTO-SUFICIENCIA:
- Cada prompt debe entenderse por sí solo. Todo el contexto dentro del string.

F) ESTILO VISUAL:
- Ilustración cinematográfica hiperrealista con realismo estilizado (semi-stylized realism).
- Iluminación dramática (35mm film aesthetic, shallow depth of field).
- Texturas hiperrealistas de piel y telas. Sin efecto "plástico CGI".
- NO caricatura, NO cartoon, NO Pixar/Disney, NO "pintura devocional del s.XIX".

G) PROHIBICIONES:
- NO texto, letras ni marcas de agua.
- NO rostros reconocibles de personas modernas.
- NO símbolos cristianos anacrónicos.`;

// ============================================================
// UTILIDADES
// ============================================================
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function quitarTildes(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function contarPalabras(texto) {
  return (String(texto).replace(/<[^>]+>/g, " ").match(/\S+/g) || []).length;
}

function cleanHtml(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function guardarTexto(dir, nombre, contenido, { bom = true } = {}) {
  fs.writeFileSync(
    path.join(dir, nombre),
    (bom ? "\uFEFF" : "") + contenido,
    "utf8",
  );
  console.log(`   ✅ Archivo creado: ${nombre}`);
}

function guardarJSON(dir, nombre, objeto) {
  fs.writeFileSync(
    path.join(dir, nombre),
    JSON.stringify(objeto, null, 2),
    "utf8",
  );
  console.log(`   ✅ Archivo creado: ${nombre}`);
}

function parsearJSON(textoCrudo) {
  if (!textoCrudo) return null;
  const limpio = textoCrudo
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const ini = limpio.indexOf("{");
    const fin = limpio.lastIndexOf("}");
    if (ini === -1 || fin <= ini) return null;
    try {
      return JSON.parse(limpio.slice(ini, fin + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Llamada única a DeepSeek con reintentos y detección de truncado.
 * Lanza error si la respuesta viene vacía o cortada por max_tokens.
 */
async function llamarIA({
  etiqueta,
  system,
  user,
  json = false,
  temperature = 0.5,
  maxTokens = 8000,
  reintentos = 1,
}) {
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });

  let ultimoError;
  for (let intento = 1; intento <= reintentos + 1; intento++) {
    try {
      console.log(
        `   🤖 [${etiqueta}] Llamando a la IA (intento ${intento})...`,
      );
      const res = await openai.chat.completions.create({
        model: json ? MODELO_JSON : MODELO_TEXTO,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      });
      const choice = res.choices[0];
      const contenido = choice?.message?.content?.trim() || "";
      if (!contenido) throw new Error("respuesta vacía");
      if (choice.finish_reason === "length") {
        throw new Error("respuesta truncada por max_tokens");
      }
      return contenido;
    } catch (e) {
      ultimoError = e;
      console.error(`   ⚠️ [${etiqueta}] intento ${intento} falló: ${e.message}`);
      if (intento <= reintentos) await esperar(3000 * intento);
    }
  }
  throw ultimoError;
}

// ============================================================
// SUPABASE: RECURSOS DEL CAPÍTULO
// ============================================================
async function fetchChapterResources(bookSlug, chapterNumber) {
  console.log(
    `🔍 Buscando recursos para ${bookSlug} capítulo ${chapterNumber}...`,
  );

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, nombre, slug")
    .eq("slug", bookSlug)
    .single();
  if (bookError || !book) throw new Error(`Libro no encontrado: ${bookSlug}`);

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id, numero")
    .eq("book_id", book.id)
    .eq("numero", chapterNumber)
    .single();
  if (chapterError || !chapter) {
    throw new Error(`Capítulo ${chapterNumber} no encontrado para ${bookSlug}`);
  }

  return {
    chapterId: chapter.id,
    bookName: book.nombre,
    bookSlug: book.slug,
    chapterNumber,
  };
}

async function getResourcesForChapter(chapterId) {
  const { data: resources, error } = await supabase
    .from("resources")
    .select("tipo, contenido_html, titulo")
    .eq("chapter_id", chapterId);
  if (error) throw error;

  const html = (tipo) =>
    resources.find((r) => r.tipo === tipo)?.contenido_html || "";

  return {
    estudioTitulo:
      resources.find((r) => r.tipo === "estudio")?.titulo || "Estudio Bíblico",
    estudio: html("estudio"),
    sermon: html("sermon"),
    bosquejo: html("bosquejo"),
    infografia: html("infografia"),
    arqueologia: html("contexto_arqueologico"),
    palabras: html("palabras_clave"),
    citasTeologos: html("citas_teologos"),
    citasLibros: html("citas_libros"),
  };
}

function buildPlainTextSource(bookName, chapterNum, context) {
  let source = `FUENTE CONSOLIDADA\nLIBRO: ${bookName}\nCAPÍTULO: ${chapterNum}\n========================================\n\n`;
  if (context.estudio)
    source += `--- ESTUDIO BÍBLICO: ${context.estudioTitulo} ---\n${cleanHtml(context.estudio)}\n\n`;
  if (context.sermon)
    source += `--- SERMÓN ---\n${cleanHtml(context.sermon)}\n\n`;
  if (context.infografia)
    source += `--- INFOGRAFÍA DOCTRINAL ---\n${cleanHtml(context.infografia)}\n\n`;
  if (context.arqueologia)
    source += `--- CONTEXTO ARQUEOLÓGICO ---\n${cleanHtml(context.arqueologia)}\n\n`;
  if (context.palabras)
    source += `--- PALABRAS CLAVE ---\n${cleanHtml(context.palabras)}\n\n`;
  if (context.citasTeologos)
    source += `--- CITAS DE TEÓLOGOS ---\n${cleanHtml(context.citasTeologos)}\n\n`;
  if (context.citasLibros)
    source += `--- CITAS DE LIBROS ---\n${cleanHtml(context.citasLibros)}\n\n`;
  return source;
}

/** Sermón (prioridad) + estudio, recortados al presupuesto. */
function armarTextoFuente(context) {
  const sermonLimpio = cleanHtml(context.sermon);
  const estudioLimpio = cleanHtml(context.estudio);

  let sermonFinal = sermonLimpio;
  let estudioFinal = "";
  let restante = PRESUPUESTO_FUENTE;

  if (sermonLimpio.length <= restante) {
    restante -= sermonLimpio.length;
    estudioFinal = estudioLimpio.substring(0, restante);
  } else {
    sermonFinal = sermonLimpio.substring(0, restante);
  }

  const texto = `
TÍTULO DEL ESTUDIO: "${context.estudioTitulo}"

═══════════════════════════════════════
SERMÓN ${sermonFinal.length < sermonLimpio.length ? "(recortado)" : ""}
═══════════════════════════════════════
${sermonFinal}

═══════════════════════════════════════
ESTUDIO BÍBLICO ${estudioFinal.length < estudioLimpio.length ? "(recortado)" : ""}
═══════════════════════════════════════
${estudioFinal}
`;
  console.log(
    `📏 Fuente consolidada: ${texto.length} caracteres (estudio: ${estudioFinal.length}, sermón: ${sermonFinal.length})`,
  );
  return texto;
}

// ============================================================
// 1) GUION SSML DEL VIDEO
// ============================================================
function promptSSML(ctx, textoCapitulo) {
  return `
Eres un guionista profesional de documentales bíblicos para YouTube, especializado en retención de audiencia y profundidad teológica. Escribís para el canal "Mahanaim", que se caracteriza por contenido exegético serio pero accesible, con narrativa envolvente.

TAREA: Genera un guion narrativo completo para un video de 18 a 22 minutos sobre ${ctx}, en formato SSML válido para Google Cloud Text-to-Speech.

Tenés acceso al estudio bíblico y al sermón del capítulo al final de este prompt. Usá ambos como material de base. El estudio aporta exégesis profunda y datos arqueológicos/lingüísticos. El sermón aporta estructura narrativa, aplicaciones y tono pastoral. NO inventes datos que no estén en estas fuentes ni en conocimiento bíblico ampliamente aceptado.


═══════════════════════════════════════
PERFIL DOCTRINAL QUE DEBES RESPETAR (CRÍTICO)
═══════════════════════════════════════
${PERFIL_DOCTRINAL}

═══════════════════════════════════════
ESTRUCTURA OBLIGATORIA DEL GUION (respeta el orden)
═══════════════════════════════════════

1. GANCHO INICIAL (20-30 segundos):
   - Empezá con una pregunta intrigante, un dato sorprendente, o un contraste que despierte curiosidad inmediata.
   - NO empieces con "En este video vamos a..." ni "Bienvenidos a...". Empezá directo con el gancho.
   - Ejemplos de gancho efectivo:
     * "¿Qué harías si te dieran a elegir entre dos caminos, y uno de ellos te costara todo?"
     * "Hay una frase en este capítulo que ha perturbado a teólogos por siglos."
     * "El hombre más importante de su generación murió... y ni siquiera lo notaron."

2. CONTEXTO NARRATIVO (60-90 segundos):
   - Ubicá al oyente en el tiempo, lugar y circunstancia histórica con suficiente detalle para que se sienta transportado.
   - Presentá el conflicto central del capítulo sin resolverlo todavía.
   - Mencioná 1-2 datos culturales o históricos de la época que iluminen el pasaje.

3. DESARROLLO CON PROFUNDIDAD (4-5 minutos):
   - Recorré el capítulo paso a paso, PERO no como un resumen plano.
   - Incluí AL MENOS 4 de estos recursos distribuidos en el desarrollo:
     * Análisis de una PALABRA CLAVE del hebreo/griego original (significado, matiz, uso en otros pasajes).
     * Conexión profética o tipológica con otro pasaje bíblico (AT → NT, o NT → consumación).
     * Dato del contexto arqueológico o cultural que ilumine el pasaje.
     * Contraste entre lo que parecía y lo que realmente fue.
     * Detalle exegético del estudio o del sermón que profundice el sentido.
   - Mantené tensión narrativa: dejá preguntas abiertas que se resuelven más adelante.
   - Marcá los cambios de escena narrativa con pausas naturales (no forzadas).

4. APLICACIÓN TRANSFORMADORA (90-120 segundos):
   - NO uses frases genéricas tipo "debemos confiar más en Dios" o "aprendamos a ser fieles".
   - En cambio, formulá una verdad específica y conmovedora que nazca del pasaje.
   - Conectala con una situación real que el oyente pueda estar viviendo.
   - Ejemplo: "Si estás en medio de un silencio de Dios que ya lleva demasiado tiempo, este capítulo te muestra que..."

5. CONCLUSIÓN IMPACTANTE (45-60 segundos):
   - Volvé al gancho inicial y resolvelo con la verdad central del capítulo.
   - Cerrá con una frase memorable, corta y potente (que el oyente pueda recordar).
   - Terminá con una oración breve (3-4 líneas), no genérica, que fluya de todo el guion.

═══════════════════════════════════════
REGLAS DE ESTILO Y SSML
═══════════════════════════════════════

1. Devolvé SOLO código XML SSML válido, empezando con:
   <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-US">
   y terminando con </speak>.

2. Envolvé TODO el guion (entre <speak> y </speak>) en UNA SOLA etiqueta:
   <prosody rate="medium" pitch="-2%">
   Este es el ritmo conversacional normal. NUNCA uses rate="slow" para la narración general.

3. Usá <break time="800ms"/> entre párrafos y <break time="1.5s"/> para pausas dramáticas después de frases clave.

4. ⛔ NO uses <emphasis> en ningún caso. Hace que la voz suene artificial. La importancia de una palabra se transmite con la redacción y con las pausas, no con etiquetas.

5. NO uses <prosody rate="slow"> en ningún caso. La velocidad de lectura debe mantenerse constante (rate="medium") durante TODO el guion, incluidas las citas bíblicas. Para marcar solemnidad en las citas, usá únicamente pausas antes y después (<break time="1.5s"/>). La reducción de velocidad suena artificial en la narración continua.

6. NO insertes NINGUNA etiqueta <mark> en el guion. El guion debe salir limpio, sin marcas de sincronización. Las marcas <mark> se agregan en un paso posterior del pipeline. Tu tarea es SOLO generar el guion narrativo completo con los <break> dramáticos.

7. Duración objetivo: 2.600-3.000 palabras MÁXIMO (15-18 minutos de narración a velocidad media). NO superes las 3.000 palabras bajo ninguna circunstancia. El guion completo con etiquetas SSML NO debe superar los 22.000 caracteres. Si estás cerca del límite, TERMINÁ el guion aunque falten detalles secundarios. Es preferible un guion conciso y bien estructurado que uno largo y denso.

8. TEXTO PENSADO PARA SER LEÍDO POR UNA VOZ SINTÉTICA (para que suene natural):
   - Escribí números y referencias bíblicas tal como se pronuncian: "Filemón, versículo quince", "el siglo primero", "sesenta años". Nada de "Flm 1:15", "v. 15" ni cifras sueltas.
   - NO uses abreviaturas, símbolos (&, %, §, /), paréntesis con citas ni guiones largos como adorno.
   - NO escribas en alfabeto griego ni hebreo. Transliterá la palabra original (por ejemplo: "la palabra griega agápe") y explicá su significado.
   - Frases de largo moderado: una idea por frase. Evitá oraciones de más de 35 palabras.
   - Los nombres propios se escriben con su ortografía normal en español.

═══════════════════════════════════════
ESTRUCTURA DE RETENCIÓN NARRATIVA (CRÍTICO PARA 20 MIN)
═══════════════════════════════════════

Para mantener la atención durante 20 minutos, el guion DEBE incluir estos elementos:

1. GANCHO INICIAL (30-45 segundos):
   - Pregunta intrigante, dato sorprendente o contraste impactante.
   - Promesa implícita de lo que el oyente va a descubrir.

2. MICRO-CLIFFHANGERS cada 3-4 minutos:
   - Insertá preguntas abiertas que se resuelven 2-3 minutos después.
   - Cada cliffhanger genera "mini tensión" que el oyente quiere resolver.

3. VARIEDAD DE RITMO:
   - Alterná entre: narrativa, exégesis profunda, ilustración, aplicación.
   - NO dejes más de 90 segundos de pura exégesis técnica sin una ilustración o aplicación.

4. MOMENTOS DE REVELACIÓN ("ajás"):
   - Al menos 3-4 momentos donde el oyente diga "no sabía eso".
   - Cada uno debe apoyarse en una palabra del original, un dato arqueológico, o una conexión profética.

5. PAUSAS DRAMÁTICAS:
   - Usá <break time="1.5s"/> o <break time="2s"/> antes de puntos clave.
   - El silencio prepara al oyente para lo importante.

6. SECCIÓN DE APLICACIÓN EXPANDIDA (2-3 minutos):
   - No seas genérico. Conectá con situaciones reales: ansiedad, soledad, decisiones difíciles.
   - Cada aplicación debe nacer del texto, no ser un añadido moralista.

7. CONCLUSIÓN QUE CIERRA EL CÍRCULO (1-1.5 minutos):
   - Volvé al gancho inicial y respondelo con la verdad del capítulo.
   - Frase final memorable y breve.
   - Oración corta (3-4 líneas).

8. Tono: reverente pero accesible. Profundo pero claro. Apasionado pero respetuoso.

═══════════════════════════════════════
MATERIAL DE REFERENCIA (estudio bíblico y sermón)
═══════════════════════════════════════
${textoCapitulo}

Generá el guion SSML completo ahora. Recordá:
1. SOLO el XML, sin explicaciones, sin markdown, sin comentarios fuera de las etiquetas SSML válidas.
2. NO incluyas NINGUNA etiqueta <mark> ni <emphasis>. El guion va limpio.
3. Los <break> son importantes: usá <break time="1.5s"/> en cambios narrativos reales (cambio de tema, personaje o sección), y <break time="800ms"/> entre párrafos comunes.
4. Cerrá siempre con </prosody></speak>.
`;
}

/** Limpia y normaliza lo que devuelve la IA para que Google TTS lo acepte. */
function limpiarSSML(crudo) {
  let s = crudo.replace(/```xml\s*/gi, "").replace(/```\s*/g, "").trim();

  const ini = s.indexOf("<speak");
  const fin = s.lastIndexOf("</speak>");
  if (ini === -1 || fin === -1) {
    throw new Error("el SSML no tiene <speak> ... </speak>");
  }
  s = s.slice(ini, fin + "</speak>".length);

  // Fuera énfasis y marcas (las marcas se agregan después)
  s = s.replace(/<\/?emphasis[^>]*>/gi, "");
  s = s.replace(/<mark[^>]*\/>/gi, "");

  // generar-audio.js espera UNA sola envoltura <prosody>
  const aperturas = [...s.matchAll(/<prosody[^>]*>/gi)];
  if (aperturas.length > 1) {
    const primera = aperturas[0];
    const finPrimera = primera.index + primera[0].length;
    const antes = s.slice(0, finPrimera);
    const resto = s.slice(finPrimera);
    const ultimoCierre = resto.lastIndexOf("</prosody>");
    const cuerpo = (
      ultimoCierre !== -1 ? resto.slice(0, ultimoCierre) : resto
    ).replace(/<\/?prosody[^>]*>/gi, "");
    const cola = ultimoCierre !== -1 ? resto.slice(ultimoCierre) : "";
    s = antes + cuerpo + cola;
  }

  // "&" suelto rompe el XML
  s = s.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;");
  return s;
}

function validarSSML(ssml) {
  const errores = [];
  if (!/^<speak[\s>]/.test(ssml)) errores.push("no empieza con <speak>");
  if (!ssml.endsWith("</speak>")) errores.push("no termina con </speak>");
  const abre = (ssml.match(/<prosody[^>]*>/gi) || []).length;
  const cierra = (ssml.match(/<\/prosody>/gi) || []).length;
  if (abre !== 1 || cierra !== 1) {
    errores.push(`prosody: ${abre} aperturas y ${cierra} cierres (se espera 1 y 1)`);
  }
  const breaks = (ssml.match(/<break\s+time="[^"]*"\s*\/?>/gi) || []).length;
  if (breaks < 10) errores.push(`solo ${breaks} pausas <break> (muy pocas)`);
  return errores;
}

function ssmlATextoPlano(ssml) {
  return ssml
    .replace(/<mark[^>]*\/>/gi, "")
    .replace(/<break[^>]*\/>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function generarSSMLLimpio(ctx, textoCapitulo) {
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const crudo = await llamarIA({
        etiqueta: "SSML del video",
        user: promptSSML(ctx, textoCapitulo),
        temperature: 0.5,
        maxTokens: 20000,
        reintentos: 0,
      });
      const ssml = limpiarSSML(crudo);
      const errores = validarSSML(ssml);
      if (errores.length) throw new Error(errores.join("; "));

      const palabras = contarPalabras(ssmlATextoPlano(ssml));
      console.log(
        `   ✅ SSML válido (${ssml.length} caracteres, ~${palabras} palabras).`,
      );
      if (palabras < 1800 || palabras > 3600) {
        console.warn(
          `   ⚠️ Largo inusual: ${palabras} palabras (se esperaban 2600-3000).`,
        );
      }
      return ssml;
    } catch (e) {
      console.error(`   ⚠️ SSML intento ${intento} inválido: ${e.message}`);
    }
  }
  return null;
}

// ============================================================
// 2) MOMENTOS NARRATIVOS, MARCAS E IMÁGENES
// ============================================================
function extraerSegmentosPorBreak(ssml) {
  if (!ssml || typeof ssml !== "string") return [];
  const contenido = ssml
    .replace(/<speak[^>]*>/gi, "")
    .replace(/<\/speak>/gi, "")
    .replace(/<prosody[^>]*>/gi, "")
    .replace(/<\/prosody>/gi, "")
    .trim();
  return contenido
    .split(/<break\s+time="[^"]*"\s*\/?>/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function detectarMomentosNarrativos(segmentos, ctx) {
  if (!segmentos.length) return [];

  const lista = segmentos
    .map((seg, i) => `[${i + 1}] (${contarPalabras(seg)} palabras) ${seg}`)
    .join("\n\n");

  const prompt = `Eres un editor narrativo experto. Te paso los segmentos de un guion para un video bíblico sobre ${ctx}, cortados por pausas dramáticas. Entre paréntesis está la cantidad de palabras de cada segmento (la voz lee unas 130 palabras por minuto).

TAREA: Agrupá y/o dividí los segmentos en MOMENTOS NARRATIVOS. Un "momento" es un bloque que trata el mismo tema, personaje o escena, y recibirá UNA imagen en pantalla.

REGLAS:
1. Cada momento debe tener sentido narrativo propio.
2. Cantidad: mínimo 15 y máximo 25 momentos.
3. ⚠️ NINGÚN momento puede superar las 200 palabras (unos 90 segundos). Si un segmento o grupo de segmentos supera ese tope, dividilo en dos o más momentos. Para dividir en medio de un segmento, "texto_inicio" debe ser las primeras palabras EXACTAS (copiadas literalmente, sin cambiar nada) de la frase donde empieza el nuevo momento.
4. Ningún momento debe ser demasiado corto: mínimo 25 palabras.
5. El primer momento es el gancho inicial. El último es la conclusión y la oración final; si esa parte es larga, dividila también.
6. "texto_inicio": 25 a 40 caracteres COPIADOS LITERALMENTE del inicio del momento.
7. "titulo_capitulo": nombre corto (2 a 6 palabras, sin números ni signos raros) para un capítulo de YouTube.
8. "nuevo_capitulo_youtube": true en 8 a 12 momentos bien repartidos (el primero siempre true), false en el resto. Los que valen true marcan cambios grandes de tema.

SEGMENTOS:
${lista}

FORMATO DE SALIDA (JSON estricto):
{
  "momentos": [
    {
      "indice": 1,
      "texto_inicio": "texto literal del inicio del momento",
      "descripcion_visual": "qué mostrar visualmente (una línea, en español)",
      "titulo_capitulo": "Nombre corto",
      "nuevo_capitulo_youtube": true
    }
  ]
}

Devolvé SOLO el JSON.`;

  try {
    const crudo = await llamarIA({
      etiqueta: "Momentos narrativos",
      user: prompt,
      json: true,
      temperature: 0.3,
      maxTokens: 6000,
    });
    const parsed = parsearJSON(crudo);
    if (!parsed?.momentos || !Array.isArray(parsed.momentos)) {
      console.error("   ⚠️ La IA no devolvió momentos válidos.");
      return [];
    }
    console.log(`   📊 Momentos narrativos detectados: ${parsed.momentos.length}`);
    return parsed.momentos;
  } catch (e) {
    console.error("   ❌ Error detectando momentos narrativos:", e.message);
    return [];
  }
}

/**
 * Inserta <mark name="imagen_N"/> antes de cada momento.
 *  - La primera marca va SIEMPRE al comienzo del guion (así el video y el
 *    audio arrancan juntos).
 *  - Si un momento no se encuentra, se omite y la numeración sigue sin
 *    huecos (imagen_1, imagen_2, ... consecutivas).
 * Devuelve el SSML y los momentos que sí se insertaron.
 */
function insertarMarcasEnSSML(ssml, momentos) {
  const ordenados = [...momentos].sort(
    (a, b) => (a.indice || 0) - (b.indice || 0),
  );

  const mProsody = ssml.match(/<prosody[^>]*>/i);
  const inicioContenido = mProsody
    ? mProsody.index + mProsody[0].length
    : ssml.indexOf(">") + 1;

  let resultado = ssml;
  let desde = inicioContenido;
  const insertados = [];

  for (const momento of ordenados) {
    let pos = -1;

    if (insertados.length === 0) {
      pos = inicioContenido;
    } else {
      const base = (momento.texto_inicio || "").trim();
      for (const largo of [35, 25, 15]) {
        const t = base.substring(0, largo).trim();
        if (t.length < 8) continue;
        const p = resultado.indexOf(t, desde);
        if (p !== -1) {
          pos = p;
          break;
        }
      }
    }

    if (pos === -1) {
      console.warn(
        `   ⚠️ No se encontró el momento ${momento.indice} en el SSML; se omite.`,
      );
      continue;
    }

    const numero = insertados.length + 1;
    const marca = `<mark name="imagen_${numero}"/>`;
    resultado = resultado.slice(0, pos) + marca + resultado.slice(pos);
    desde = pos + marca.length;
    insertados.push({ ...momento, numero });
  }

  return { ssml: resultado, insertados };
}

/** Avisa si alguna imagen quedaría demasiado tiempo en pantalla. */
function advertirMomentosLargos(ssmlConMarcas, maxPalabras = 230) {
  const partes = ssmlConMarcas.split(/<mark name="imagen_(\d+)"\/>/);
  for (let i = 1; i < partes.length; i += 2) {
    const numero = partes[i];
    const palabras = contarPalabras(ssmlATextoPlano(partes[i + 1] || ""));
    if (palabras > maxPalabras) {
      console.warn(
        `   ⚠️ imagen_${numero} cubre ~${palabras} palabras (~${Math.round(palabras / 2.2)} s). Quedará mucho tiempo en pantalla.`,
      );
    }
  }
}

function elegirCapitulosYoutube(insertados) {
  let elegidos = insertados.filter(
    (m, i) => i === 0 || m.nuevo_capitulo_youtube === true,
  );

  if (elegidos.length < 6 || elegidos.length > 14) {
    const objetivo = Math.min(10, insertados.length);
    const paso = insertados.length / objetivo;
    const idx = new Set(
      Array.from({ length: objetivo }, (_, k) => Math.floor(k * paso)),
    );
    elegidos = insertados.filter((_, i) => idx.has(i));
  }

  return elegidos.map((m) => ({
    marca: `imagen_${m.numero}`,
    titulo: String(m.titulo_capitulo || `Parte ${m.numero}`)
      .replace(/[<>]/g, "")
      .trim(),
  }));
}

async function generarPromptsImagenes(insertados, ctx, textoCapitulo) {
  const listaMomentos = insertados
    .map((m) => `[Momento ${m.numero}] Descripción visual: ${m.descripcion_visual}`)
    .join("\n");

  const prompt = `
Eres un director de arte cinematográfico e historiador bíblico con expertise en contextos culturales de todas las épocas.

TAREA: Generá EXACTAMENTE ${insertados.length} prompts detallados (en INGLÉS) para IA de generación de imágenes fotorrealistas. Cada prompt corresponde a UNO de los momentos narrativos del video sobre ${ctx}. La cantidad es EXACTA: ${insertados.length}. No generes más ni menos.

REGLAS UNIVERSALES PARA CADA PROMPT:
${REGLAS_IMAGEN}
- Relación de aspecto 16:9 al final de cada prompt (--ar 16:9).

═══════════════════════════════════════
LISTA DE MOMENTOS NARRATIVOS (${insertados.length} momentos)
═══════════════════════════════════════

${listaMomentos}

═══════════════════════════════════════
CONTEXTO DEL CAPÍTULO (para coherencia general)
═══════════════════════════════════════
${textoCapitulo.substring(0, 8000)}

FORMATO DE SALIDA (obligatorio): un objeto JSON con un array "prompts" de EXACTAMENTE ${insertados.length} strings en INGLÉS, en el mismo orden de los momentos:
{ "prompts": ["Cinematic prompt 1... --ar 16:9", "Cinematic prompt 2... --ar 16:9"] }
`;

  let lista = [];
  try {
    const crudo = await llamarIA({
      etiqueta: "Prompts de imágenes",
      user: prompt,
      json: true,
      temperature: 0.7,
      maxTokens: 16000,
    });
    const parsed = parsearJSON(crudo);
    lista = Array.isArray(parsed) ? parsed : parsed?.prompts;
    if (!Array.isArray(lista)) throw new Error("no hay array 'prompts'");
  } catch (e) {
    console.error("   ❌ Error generando prompts de imágenes:", e.message);
    return null;
  }

  lista = lista.filter((p) => typeof p === "string" && p.trim().length > 20);

  if (lista.length !== insertados.length) {
    console.warn(
      `   ⚠️ Se esperaban ${insertados.length} prompts y llegaron ${lista.length}. Se ajusta.`,
    );
    lista = lista.slice(0, insertados.length);
    while (lista.length < insertados.length) {
      const m = insertados[lista.length];
      lista.push(
        `Hyperrealistic cinematic illustration, semi-stylized realism, 35mm film aesthetic, shallow depth of field. Ancient biblical scene: ${m.descripcion_visual}. Warm amber and ocre lighting. No text, no letters, no watermarks, no modern objects. ${ANATOMIA} --ar 16:9`,
      );
    }
  }
  return lista;
}

async function generarArtefactosVideo(dir, ctx, textoCapitulo) {
  console.log(`\n   🎬 [Video] Generando guion y prompts de imágenes...`);

  const ssmlLimpio = await generarSSMLLimpio(ctx, textoCapitulo);
  if (!ssmlLimpio) return null;

  const segmentos = extraerSegmentosPorBreak(ssmlLimpio);
  console.log(`   📄 Segmentos extraídos: ${segmentos.length}`);
  if (!segmentos.length) return null;

  const momentos = await detectarMomentosNarrativos(segmentos, ctx);
  if (!momentos.length) return null;

  const { ssml: ssmlConMarcas, insertados } = insertarMarcasEnSSML(
    ssmlLimpio,
    momentos,
  );
  console.log(
    `   📌 Marcas insertadas: ${insertados.length} de ${momentos.length}`,
  );
  if (insertados.length < 8) {
    console.error("   ❌ Muy pocas marcas insertadas; el video quedaría pobre.");
    return null;
  }
  advertirMomentosLargos(ssmlConMarcas);

  const prompts = await generarPromptsImagenes(insertados, ctx, textoCapitulo);
  if (!prompts) return null;

  // Solo se guarda todo cuando TODO el bloque salió bien
  fs.writeFileSync(path.join(dir, "guion_video_tts.ssml"), ssmlConMarcas, "utf8");
  console.log(
    `   ✅ guion_video_tts.ssml guardado (${ssmlConMarcas.length} caracteres, ${insertados.length} marcas).`,
  );
  guardarJSON(dir, "prompts_imagenes_video.json", prompts);

  return {
    ssml: ssmlConMarcas,
    insertados,
    capitulosYT: elegirCapitulosYoutube(insertados),
  };
}

// ============================================================
// 3) METADATOS DE YOUTUBE (derivados del guion terminado)
// ============================================================
function elegirTitulo(m) {
  const candidatos = [m.titulo, ...(m.titulos_alternativos || [])]
    .filter((t) => typeof t === "string")
    .map((t) => t.replace(/[<>]/g, "").trim())
    .filter(Boolean);
  const bueno = candidatos.find((t) => t.length <= 70);
  if (bueno) return bueno;
  if (candidatos[0]) {
    return candidatos[0].slice(0, 70).replace(/\s+\S*$/, "").trim();
  }
  return null;
}

function limpiarTags(tags, tope = 450) {
  const vistos = new Set();
  const salida = [];
  let total = 0;
  for (const t of Array.isArray(tags) ? tags : []) {
    const tag = String(t)
      .replace(/[<>#"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!tag || tag.length > 60) continue;
    const clave = tag.toLowerCase();
    if (vistos.has(clave)) continue;
    const costo = tag.length + (tag.includes(" ") ? 2 : 0) + 1;
    if (total + costo > tope) break;
    vistos.add(clave);
    salida.push(tag);
    total += costo;
  }
  return salida;
}

function limpiarHashtags(hashtags) {
  return (Array.isArray(hashtags) ? hashtags : [])
    .map((h) => String(h).replace(/[<>\s]/g, "").replace(/^#*/, ""))
    .filter((h) => h.length > 1)
    .slice(0, 5)
    .map((h) => `#${h}`);
}

function armarDescripcion(m, hashtags) {
  const quitar = (t) => String(t || "").replace(/[<>]/g, "").trim();
  const lineas = [
    quitar(m.gancho),
    "",
    quitar(m.resumen),
    "",
    "⏱️ CAPÍTULOS",
    "{{CAPITULOS}}",
    "",
  ];
  if (m.versiculo_clave) {
    lineas.push(`📖 Versículo clave: ${quitar(m.versiculo_clave)}`, "");
  }
  lineas.push(
    "🔔 Suscríbete al canal y cuéntanos en los comentarios qué te dejó este pasaje.",
    "",
    hashtags.join(" "),
  );
  return lineas.join("\n").trim();
}

async function generarMetadatosYoutube({ info, ssml, capitulosYT }) {
  console.log(`\n   📺 [YouTube] Generando metadatos a partir del guion...`);
  const guion = ssmlATextoPlano(ssml).substring(0, 30000);

  const prompt = `Analiza el GUION FINAL de un video de YouTube del canal "Mahanaim" sobre ${info.bookName} capítulo ${info.chapterNumber}, y genera sus metadatos. Todo debe salir de lo que dice el guion (no del estudio original), para que título, descripción y miniatura coincidan con el video real.

Respeta este perfil doctrinal (no escribas nada que lo contradiga):
${PERFIL_DOCTRINAL}

GENERA:
1. "titulo": título NUEVO del video, máximo 60 caracteres. Debe nacer del gancho o de la idea más fuerte del guion, despertar curiosidad y ser verdadero (nada de clickbait falso). Sin MAYÚSCULAS completas. Si cabe, incluye el libro y capítulo al final.
2. "titulos_alternativos": 2 opciones más, máximo 60 caracteres cada una.
3. "gancho": las 2 primeras líneas de la descripción (lo que se ve antes de "mostrar más"), máximo 200 caracteres, con la palabra clave principal.
4. "resumen": un párrafo de 60 a 100 palabras sobre lo que aprenderá el espectador, con palabras clave naturales.
5. "versiculo_clave": referencia y una frase breve del versículo principal.
6. "tags": de 15 a 25 etiquetas para búsqueda (libro, capítulo, personajes, temas, palabras clave). Sin el símbolo #.
7. "hashtags": 3 a 5 hashtags relevantes.
8. "miniatura": diseño de la miniatura. El texto lo agrega un programa después, NO la IA de imágenes:
   - "texto_principal": gancho de 2 a 3 palabras en MAYÚSCULAS, máximo 20 caracteres (ej: "¿PERDONARÍAS?").
   - "texto_secundario": complemento de 1 a 4 palabras en MAYÚSCULAS, máximo 25 caracteres (puede ir vacío).
   - "lado_texto": "left" o "right" (el lado donde irá el texto).
   - "prompt_ilustracion": prompt en INGLÉS para una ilustración SIN TEXTO: primer plano emotivo del personaje central del pasaje (rostro con emoción fuerte), contraluz dorado dramático, fondo oscuro. No indiques la posición del personaje en el cuadro. Aplica estas reglas:
${REGLAS_IMAGEN}

GUION DEL VIDEO:
${guion}

FORMATO (JSON estricto):
{
  "titulo": "...",
  "titulos_alternativos": ["...", "..."],
  "gancho": "...",
  "resumen": "...",
  "versiculo_clave": "...",
  "tags": ["..."],
  "hashtags": ["#..."],
  "miniatura": {
    "texto_principal": "...",
    "texto_secundario": "...",
    "lado_texto": "right",
    "prompt_ilustracion": "..."
  }
}`;

  let m;
  try {
    const crudo = await llamarIA({
      etiqueta: "Metadatos de YouTube",
      system:
        "Eres un experto en SEO para YouTube, copywriting cristiano y diseño de miniaturas virales.",
      user: prompt,
      json: true,
      temperature: 0.7,
      maxTokens: 6000,
    });
    m = parsearJSON(crudo);
  } catch (e) {
    console.error("   ❌ Error generando metadatos:", e.message);
    return null;
  }

  const titulo = m ? elegirTitulo(m) : null;
  if (!m || !titulo || !m.gancho || !m.resumen || !m.miniatura?.prompt_ilustracion) {
    console.error("   ❌ Los metadatos vienen incompletos.");
    return null;
  }

  const tags = limpiarTags(m.tags);
  const hashtags = limpiarHashtags(m.hashtags);
  const ladoTexto = m.miniatura.lado_texto === "left" ? "left" : "right";
  const ladoSujeto = ladoTexto === "left" ? "right" : "left";

  const promptIlustracion = [
    String(m.miniatura.prompt_ilustracion).trim().replace(/--ar\s*\d+:\d+/g, ""),
    `Subject placed on the ${ladoSujeto} third of the frame; the ${ladoTexto} third is dark, empty negative space.`,
    "Ultra high contrast, dramatic golden rim backlight, deep shadows, saturated warm amber and gold tones, intense emotional close-up, cinematic 35mm look.",
    `No text, no letters, no watermarks, no modern objects. ${ANATOMIA}`,
  ].join(" ");

  const metadata = {
    libro: info.bookName,
    capitulo: info.chapterNumber,
    titulo,
    titulos_alternativos: (m.titulos_alternativos || [])
      .filter((t) => typeof t === "string")
      .map((t) => t.trim()),
    descripcion: armarDescripcion(m, hashtags), // contiene {{CAPITULOS}}
    tags,
    hashtags,
    capitulos_youtube: capitulosYT, // [{ marca: "imagen_1", titulo: "..." }]
    ajustes_youtube: AJUSTES_YOUTUBE,
    miniatura: {
      texto_principal: String(m.miniatura.texto_principal || "").trim().toUpperCase(),
      texto_secundario: String(m.miniatura.texto_secundario || "").trim().toUpperCase(),
      etiqueta: `${info.bookName.toUpperCase()} ${info.chapterNumber}`,
      lado_texto: ladoTexto,
      prompt_ilustracion: promptIlustracion,
      aspect_ratio: "16:9",
      salida_ancho: 1280,
      salida_alto: 720,
    },
    generado_en: new Date().toISOString(),
  };

  console.log(`   ✅ Título del video: "${titulo}" (${titulo.length} caracteres)`);
  return metadata;
}

function guardarVistaPreviaYoutube(dir, info, meta) {
  const contenido = `═══════════════════════════════════════════
VISTA PREVIA DE YOUTUBE (solo lectura; el script de subida usa youtube_metadata.json)
Libro: ${info.bookName} | Capítulo: ${info.chapterNumber}
═══════════════════════════════════════════

TÍTULO (${meta.titulo.length} caracteres):
${meta.titulo}

ALTERNATIVAS:
${meta.titulos_alternativos.map((t) => `- ${t}`).join("\n")}

DESCRIPCIÓN (los capítulos con tiempos se completan después del audio):
───────────────────────────────────────────
${meta.descripcion}
───────────────────────────────────────────

CAPÍTULOS PREVISTOS:
${meta.capitulos_youtube.map((c) => `- ${c.marca}: ${c.titulo}`).join("\n")}

TAGS (${meta.tags.join(",").length} caracteres):
${meta.tags.join(", ")}

MINIATURA:
- Texto principal: ${meta.miniatura.texto_principal}
- Texto secundario: ${meta.miniatura.texto_secundario || "(ninguno)"}
- Etiqueta: ${meta.miniatura.etiqueta}
- Texto a la: ${meta.miniatura.lado_texto}
- Prompt de ilustración:
${meta.miniatura.prompt_ilustracion}
`;
  guardarTexto(dir, `5_YOUTUBE_PREVIEW_${info.bookName}_Cap${info.chapterNumber}.txt`, contenido);
}

// ============================================================
// 4) GUION DE PODCAST (2 voces, otro ángulo)
// ============================================================
async function generarGuionPodcast({ info, tituloVideo, textoFuente, capitulosVideo }) {
  console.log(`\n   🎙️ [Podcast] Generando guion de conversación...`);

  const temasVideo = capitulosVideo.map((c) => `- ${c.titulo}`).join("\n");

  const prompt = `Escribe el guion de un PODCAST conversacional de dos personas sobre ${info.bookName} capítulo ${info.chapterNumber}, para el canal "Mahanaim". Es el compañero del video titulado "${tituloVideo}": usa el mismo material, pero con OTRO ángulo.

EL VIDEO YA CUBRE (no lo repitas como repaso ordenado):
${temasVideo}

ÁNGULO DEL PODCAST: el dilema humano. Preguntas incómodas, tensiones, "¿qué habría hecho yo en su lugar?", y lo que este pasaje cambia en la vida de hoy. Sin repaso versículo por versículo.

LOCUTORES:
- "A" (el guía): conoce el tema a fondo, explica con claridad y cuenta con ritmo.
- "B" (el curioso): pregunta lo que el oyente se preguntaría, se sorprende, objeta con respeto y lo baja a la vida diaria.

ESTRUCTURA:
1. GANCHO (primeros 30 a 40 segundos): una escena fuerte o una pregunta que atrape. NADA de "hoy vamos a hablar de" ni saludos largos.
2. CONTEXTO JUSTO (1 a 2 minutos): lo mínimo para entender la situación.
3. TRES O CUATRO MOMENTOS CON GIRO: cada uno apoyado en un dato real del material (una palabra del original, un dato histórico, una conexión con otro pasaje) y terminando en una pregunta o sorpresa que lleve al siguiente.
4. "¿QUÉ HARÍAS TÚ?": B y A aterrizan el pasaje en una situación concreta de hoy.
5. CIERRE: una idea para llevarse, una invitación breve a ver el video completo en el canal y a comentar.

REGLAS:
- Extensión total: entre 1.500 y 1.900 palabras (10 a 13 minutos).
- Lenguaje oral y natural, español neutro latinoamericano, tuteo. Frases cortas. Algunos turnos muy breves ("¿En serio?", "Espera, espera.") y ninguno de más de 80 palabras.
- Está pensado para ser leído por voces sintéticas: SIN corchetes, SIN acotaciones, SIN emojis, SIN markdown. Números y referencias bíblicas escritos como se pronuncian ("Filemón, versículo quince"). Palabras griegas o hebreas solo transliteradas, nunca en su alfabeto. Sin abreviaturas ni símbolos.
- No inventes datos que no estén en el material ni en conocimiento bíblico ampliamente aceptado.
- Respeta este perfil doctrinal sin excepción:
${PERFIL_DOCTRINAL}

MATERIAL DE BASE:
${textoFuente}

FORMATO (JSON estricto):
{
  "titulo_podcast": "máximo 70 caracteres, distinto al del video pero reconocible como compañero, con el libro y capítulo",
  "turnos": [
    { "locutor": "A", "texto": "..." },
    { "locutor": "B", "texto": "..." }
  ]
}`;

  let data;
  try {
    const crudo = await llamarIA({
      etiqueta: "Guion de podcast",
      system:
        "Eres un guionista de podcasts cristianos dinámicos, con oído para el lenguaje hablado. Respondes únicamente con JSON válido.",
      user: prompt,
      json: true,
      temperature: 0.8,
      maxTokens: 8000,
    });
    data = parsearJSON(crudo);
  } catch (e) {
    console.error("   ❌ Error generando podcast:", e.message);
    return null;
  }

  const turnos = (data?.turnos || [])
    .filter(
      (t) =>
        t &&
        (t.locutor === "A" || t.locutor === "B") &&
        typeof t.texto === "string" &&
        t.texto.trim().length > 0,
    )
    .map((t) => ({
      locutor: t.locutor,
      texto: t.texto.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim(),
    }))
    .filter((t) => t.texto.length > 0);

  if (turnos.length < 30) {
    console.error(`   ❌ Podcast con solo ${turnos.length} turnos (se esperaban 30 o más).`);
    return null;
  }

  const palabras = turnos.reduce((acc, t) => acc + contarPalabras(t.texto), 0);
  const caracteres = turnos.reduce((acc, t) => acc + t.texto.length, 0);
  console.log(
    `   ✅ Podcast: ${turnos.length} turnos, ~${palabras} palabras, ${caracteres} caracteres.`,
  );
  if (palabras < 1200 || palabras > 2300) {
    console.warn(`   ⚠️ Largo inusual (${palabras} palabras; objetivo 1500-1900).`);
  }

  return {
    libro: info.bookName,
    capitulo: info.chapterNumber,
    titulo_podcast: String(data.titulo_podcast || `${tituloVideo} (conversación)`)
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 100),
    titulo_video_compañero: tituloVideo,
    voces: { A: "guía", B: "curioso" },
    caracteres_totales: caracteres,
    turnos,
    generado_en: new Date().toISOString(),
  };
}

function guardarPodcast(dir, info, podcast) {
  guardarJSON(dir, "podcast_guion.json", podcast);
  const cuerpo = podcast.turnos.map((t) => `${t.locutor}: ${t.texto}`).join("\n\n");
  guardarTexto(
    dir,
    `7_PODCAST_GUION_${info.bookName}_Cap${info.chapterNumber}.txt`,
    `═══════════════════════════════════════════
GUION DE PODCAST (2 voces: A = guía, B = curioso)
Libro: ${info.bookName} | Capítulo: ${info.chapterNumber}
Título: ${podcast.titulo_podcast}
(La fuente para el audio es podcast_guion.json)
═══════════════════════════════════════════

${cuerpo}
`,
  );
}

// ============================================================
// 5) MAPA INTERACTIVO (para el sitio web)
// ============================================================
function generateGoogleMapsEmbedUrl(lat, lng) {
  return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d50000!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${lat}, ${lng}!5e1!3m2!1ses!2s!4v1`;
}

function generateMapResourceHTML(titulo, ubicaciones, bookName, chapterNum) {
  let html = `
<div style="text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 3px solid #d4ac0d;">
  <h1 style="color: #1a3a5c; font-family: 'Georgia', serif; font-size: 2rem; margin-bottom: 0.5rem;">${titulo}</h1>
  <h2 style="color: #5d4037; font-family: 'Georgia', serif; font-size: 1.2rem; font-weight: normal;">${bookName} Capítulo ${chapterNum}</h2>
</div>

<div style="background: #fdfbf7; padding: 1.5rem; border-radius: 12px; border: 2px solid #d4c4a8; margin-bottom: 2rem;">
  <h3 style="color: #1a3a5c; margin-top: 0;"> Ubicaciones Bíblicas del Capítulo</h3>
  <p style="line-height: 1.8; color: #3e2723;">
    Este mapa interactivo muestra las ubicaciones geográficas mencionadas en el estudio. 
    Algunas son confirmadas arqueológicamente, otras son probables según la evidencia histórica.
  </p>
</div>
`;

  ubicaciones.forEach((ubicacion, index) => {
    const embedUrl = generateGoogleMapsEmbedUrl(ubicacion.latitud, ubicacion.longitud);
    const certeza = String(ubicacion.certeza || "desconocida");
    const certezaIcon =
      certeza === "confirmada" ? "✅" : certeza === "probable" ? "🟡" : "️";

    html += `
<div style="margin-bottom: 2.5rem;">
  <h3 style="color: #1a3a5c; border-left: 5px solid #d4ac0d; padding-left: 1rem; margin-bottom: 1rem;">
    ${index + 1}. ${ubicacion.nombre} ${certezaIcon}
  </h3>
  
  <div style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 1rem 0; border: 2px solid #d4c4a8;">
    <iframe src="${embedUrl}" width="100%" height="400" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>
  
  <div style="background: #f5f2eb; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
    <p style="margin: 0 0 0.5rem 0;"><strong>📖 Referencia:</strong> ${ubicacion.referencia_biblica}</p>
    <p style="margin: 0 0 0.5rem 0;"><strong>📍 Coordenadas:</strong> ${ubicacion.latitud}°N, ${ubicacion.longitud}°E</p>
    <p style="margin: 0 0 0.5rem 0;"><strong>🏛️ Contexto Histórico:</strong> ${ubicacion.contexto_historico}</p>
    <p style="margin: 0;"><strong>✝️ Importancia Teológica:</strong> ${ubicacion.importancia_teologica}</p>
  </div>
  
  <div style="background: ${certeza === "confirmada" ? "#d4edda" : "#fff3cd"}; padding: 0.8rem; border-radius: 6px; border-left: 4px solid ${certeza === "confirmada" ? "#28a745" : "#ffc107"};">
    <strong>Nivel de certeza:</strong> ${certeza.charAt(0).toUpperCase() + certeza.slice(1)}
  </div>
</div>
`;
  });

  html += `
<div style="background: #1a3a5c; color: #fdfbf7; padding: 1.5rem; border-radius: 12px; margin-top: 2rem;">
  <h3 style="color: #d4ac0d; margin-top: 0;">📚 Nota Metodológica</h3>
  <p style="line-height: 1.8; margin: 0;">
    Las ubicaciones marcadas como <strong>"confirmadas"</strong> tienen evidencia arqueológica sólida. 
    Las <strong>"probables"</strong> se basan en consenso académico y evidencia contextual. 
    Las <strong>"debatidas"</strong> o <strong>"desconocidas"</strong> reflejan incertidumbre debido a cambios geográficos históricos.
  </p>
</div>
`;
  return html;
}

async function generarMapaInteractivo(dir, info, context) {
  console.log(`\n   🗺️ [Mapa] Generando mapa interactivo...`);
  const recorte = (html, n) => cleanHtml(html).substring(0, n);

  const baseInfo = `
  LIBRO: ${info.bookName} | CAPÍTULO: ${info.chapterNumber}
  TÍTULO DEL ESTUDIO: "${context.estudioTitulo}"
  [ESTUDIO]: ${recorte(context.estudio, 8000)}
  [SERMÓN]: ${recorte(context.sermon, 3000)}
  [ARQUEOLOGÍA]: ${recorte(context.arqueologia, 1500)}
  [PALABRAS]: ${recorte(context.palabras, 800)}
  `;

  const user = `Analiza este estudio bíblico de ${info.bookName} capítulo ${info.chapterNumber} e identifica TODAS las ubicaciones geográficas mencionadas (ciudades, montes, ríos, regiones, etc.).

Para CADA ubicación identificada, genera:

**INFORMACIÓN REQUERIDA:**
1. **Nombre del lugar** (en español)
2. **Coordenadas GPS aproximadas** (latitud, longitud)
3. **Referencia bíblica** donde se menciona
4. **Contexto histórico/arqueológico** breve
5. **Importancia teológica** en el capítulo

**UBICACIONES CON CERTEZA vs INCERTIDUMBRE:**
- Si la ubicación es **confirmada** arqueológicamente: proporciona coordenadas exactas
- Si es **probable pero debatida**: proporciona la teoría más aceptada y menciona la incertidumbre
- Si es **desconocida**: usa la región general más probable según el contexto

**FORMATO DE SALIDA JSON:**
{
  "titulo_recurso": "Mapa Interactivo: [Tema del capítulo] - Ubicaciones Bíblicas",
  "ubicaciones": [
    {
      "nombre": "Nombre del lugar",
      "latitud": 31.0103,
      "longitud": 47.4344,
      "referencia_biblica": "Génesis 2:14",
      "contexto_historico": "Descripción breve del contexto histórico y arqueológico",
      "importancia_teologica": "Significado teológico en el pasaje",
      "certeza": "confirmada | probable | debatida | desconocida"
    }
  ],
  "nota_metodologica": "Explicación sobre la certeza/incertidumbre de las ubicaciones"
}

**EJEMPLO DE UBICACIONES PARA ÉXODO 5:**
1. Pi-Ramsés (capital de Faraón) - 30.8080, 31.2859
2. Ladrilleras del Delta - 30.7500, 31.3000
3. Monte Sinaí (Horeb) - 28.5394, 33.9746
4. Tierra de Gosén - 30.8500, 31.6500

**INFORMACIÓN DEL ESTUDIO:**
${baseInfo}

Genera el recurso de mapa en formato JSON completo.`;

  let mapa;
  try {
    const crudo = await llamarIA({
      etiqueta: "Mapa interactivo",
      system:
        "Eres un experto en geografía bíblica, arqueología del antiguo oriente próximo y teología. Tu trabajo es identificar ubicaciones geográficas mencionadas en el estudio bíblico y crear recursos de mapa interactivo educativos. Respondes únicamente con JSON válido.",
      user,
      json: true,
      temperature: 0.4,
      maxTokens: 8000,
    });
    mapa = parsearJSON(crudo);
  } catch (e) {
    console.error("   ❌ Error generando mapa:", e.message);
    return false;
  }

  if (!mapa || !Array.isArray(mapa.ubicaciones) || mapa.ubicaciones.length === 0) {
    console.error("   ❌ El mapa no trae ubicaciones válidas.");
    return false;
  }

  const html = generateMapResourceHTML(
    mapa.titulo_recurso || `Mapa Interactivo: ${info.bookName} ${info.chapterNumber}`,
    mapa.ubicaciones,
    info.bookName,
    info.chapterNumber,
  );

  const contenido = `═══════════════════════════════════════════
RECURSO DE MAPA INTERACTIVO - MAHANAIM
Libro: ${info.bookName} | Capítulo: ${info.chapterNumber}
═══════════════════════════════════════════

📋 DATOS PARA CREAR EL RECURSO EN EL ADMIN:

TÍTULO: ${mapa.titulo_recurso}
TIPO: mapa
URL DEL RECURSO: (Dejar vacío - el mapa se genera desde el HTML)
MODO: html

CONTENIDO HTML:
───────────────────────────────────────────
${html}
───────────────────────────────────────────

📍 UBICACIONES IDENTIFICADAS:
${mapa.ubicaciones.map((u, i) => `${i + 1}. ${u.nombre} (${u.latitud}, ${u.longitud}) - ${u.certeza}`).join("\n")}

 NOTA METODOLÓGICA:
${mapa.nota_metodologica || "Las ubicaciones varían en certeza según la evidencia arqueológica disponible."}

💡 INSTRUCCIONES:
1. Copia el HTML completo de arriba
2. Ve a /admin/recursos/nuevo
3. Selecciona Libro: ${info.bookName}, Capítulo: ${info.chapterNumber}
4. Tipo: "mapa"
5. Pega el HTML en "Contenido HTML"
6. Deja "URL del recurso" vacío
7. Guarda y publica

✅ El recurso se mostrará con mapas interactivos de Google Maps para cada ubicación.
`;
  guardarTexto(dir, `6_MAPA_INTERACTIVO_${info.bookName}_Cap${info.chapterNumber}.txt`, contenido);
  return true;
}

// ============================================================
// FUNCIÓN PRINCIPAL EXPORTADA (la usa el orquestador)
// ============================================================
export async function generarPromptsCapitulo(bookSlug, chapterNumber) {
  const avisos = [];

  try {
    const info = await fetchChapterResources(bookSlug, chapterNumber);
    console.log(
      `   ✅ Capítulo encontrado: ID ${info.chapterId}, Libro: ${info.bookName}`,
    );

    const context = await getResourcesForChapter(info.chapterId);
    const dir = path.join(
      "prompts_output",
      quitarTildes(info.bookName.toLowerCase()),
      `Capitulo_${info.chapterNumber}`,
    );
    fs.mkdirSync(dir, { recursive: true });

    // 0) Fuente consolidada
    guardarTexto(
      dir,
      `0_FUENTE_CONSOLIDADA_${info.bookName}_Cap${info.chapterNumber}.txt`,
      buildPlainTextSource(info.bookName, info.chapterNumber, context),
    );
    const textoFuente = armarTextoFuente(context);
    const ctx = `${info.bookName} capítulo ${info.chapterNumber}`;

    // 1-2) Guion, marcas e imágenes (CRÍTICO)
    const video = await generarArtefactosVideo(dir, ctx, textoFuente);
    if (!video) {
      console.error("   ❌ No se pudo generar el bloque del video.");
      return false;
    }

    // 3) Metadatos de YouTube (CRÍTICO)
    const meta = await generarMetadatosYoutube({
      info,
      ssml: video.ssml,
      capitulosYT: video.capitulosYT,
    });
    if (!meta) {
      console.error("   ❌ No se pudieron generar los metadatos de YouTube.");
      return false;
    }
    guardarJSON(dir, "youtube_metadata.json", meta);
    guardarVistaPreviaYoutube(dir, info, meta);

    // 4) Podcast (no crítico)
    try {
      const podcast = await generarGuionPodcast({
        info,
        tituloVideo: meta.titulo,
        textoFuente,
        capitulosVideo: video.capitulosYT,
      });
      if (podcast) guardarPodcast(dir, info, podcast);
      else avisos.push("podcast");
    } catch (e) {
      console.error("   ❌ Error en podcast:", e.message);
      avisos.push("podcast");
    }

    // 5) Mapa interactivo (no crítico)
    try {
      const ok = await generarMapaInteractivo(dir, info, context);
      if (!ok) avisos.push("mapa interactivo");
    } catch (e) {
      console.error("   ❌ Error en mapa:", e.message);
      avisos.push("mapa interactivo");
    }

    if (avisos.length) {
      console.warn(`   ⚠️ Terminó con pendientes: ${avisos.join(", ")}`);
    }
    console.log(`   ✨ ¡Prompts listos para ${bookSlug} ${chapterNumber}!`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error fatal en el workflow de prompts:`, error.message);
    return false;
  }
}