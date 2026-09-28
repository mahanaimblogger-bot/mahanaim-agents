/**
 * Genera el prompt específico para cada tipo de recurso optimizado.
 * Incluye la inyección del texto bíblico para evitar alucinaciones.
 */
export function generarPromptRecurso(tipo, libro, capitulo, textoCapitulo = "", materiales = {}, baseIlustraciones = []) {
  const ctx = `${libro} capítulo ${capitulo}`;
  const reglaOrtografia = "**⛔ REGLA ABSOLUTA DE ORTOGRAFÍA Y FORMATO ⛔**\nEl texto DEBE estar en ESPAÑOL PERFECTO. Revisa tildes, puntuación y nombres propios. No inventes citas ni datos. Si usas comillas dobles dentro del JSON, escápalas con \\\".\n\n";

  const basePrompt = `Genera contenido para ${ctx}. \n\nTEXTO BÍBLICO DE REFERENCIA (RVR1960) PARA CITAS EXACTAS:\n${textoCapitulo}\n\n`;
  const clasesCSS = "Usa las clases HTML: 'contenedor-blog', 'titulo-entrada', 'subtitulo', 'caja-meditar', 'tabla-comparativa', 'caja-linguistica'.";

  function recortarFuente(html, max = 26000) {
    if (!html) return "";
    const limpio = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return limpio.length > max ? limpio.slice(0, max) + " …" : limpio;
  }

  const PERFIL_DOCTRINAL = `
### PERFIL DOCTRINAL QUE DEBES RESPETAR (coherente con el Prompt Maestro):
- Monoteísmo puro: Un solo Dios, el Padre. Jesucristo es Su Hijo y Mesías, preexistente, de Su esencia pero distinto y subordinado al Padre, con todo poder y autoridad conferido por el Padre.
- ⛔ REGLA INVIOLABLE SOBRE LA DEIDAD: En NINGÚN punto debes afirmar, sugerir ni dar a entender que existe una "Trinidad" o un "Dios trino" de tres personas divinas coiguales. NUNCA digas que Jesucristo es "Dios" o "Dios el Hijo" (es el HIJO de Dios). NUNCA digas que el Espíritu Santo es "Dios" ni una tercera persona divina (es el Espíritu de Dios y de Cristo). Un solo Dios: el Padre.
- Soteriología calvinista, escatología premilenial postribulacionista, cesacionismo moderado, teología de pactos reformada.
`;

  switch (tipo) {
    case "sermon": {
      const fuenteEstudio = recortarFuente(materiales.estudio_html);
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Generar un SERMÓN HOMILÉTICO COMPLETO (mínimo 3,000 palabras) para ${ctx}.
[... El resto del case "sermon" se mantiene igual ...]
### FUENTE: ${fuenteEstudio}
FORMATO JSON: {"tipo": "sermon", "titulo": "...", "texto_base": "${ctx}", "contenido_html": "[HTML con diseño rico y cajas de colores]"}`;
    }
      
    case "bosquejo": {
      const fuenteSermon = recortarFuente(materiales.sermon_html);
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Generar el BOSQUEJO HOMILÉTICO del sermón para ${ctx} con diseño "Línea de Tiempo Vertical".
[... El resto del case "bosquejo" se mantiene igual ...]
#### FORMATO DE SALIDA
Devolvé SOLO un objeto JSON: {"tipo": "bosquejo", "titulo": "Bosquejo: [tema del sermón]", "texto_base": "${ctx}", "contenido_html": "[HTML con diseño Línea de Tiempo Vertical]"}. Castellano perfecto.`;
    }

    case "aplicaciones_practicas": {
      return `Genera APLICACIONES PRÁCTICAS, CONCRETAS Y RESUMIDAS para ${ctx}.
[... El resto del case "aplicaciones_practicas" se mantiene igual ...]
FUENTE: ${materiales.sermon_html ? materiales.sermon_html.substring(0, 2000) : ''}
FORMATO JSON: {"tipo": "aplicaciones_practicas", "titulo": "Aplicaciones Prácticas: ${ctx}", "contenido_html": "[HTML de tarjetas]"}`;
    }   

    case "citas_autoridades": {
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Generar CITAS DE AUTORIDADES (Teólogos y Libros de referencia) para ${ctx}.
[... El resto del case "citas_autoridades" se mantiene igual ...]
#### FORMATO DE SALIDA
Devolvé SOLO un objeto JSON: {"tipo": "citas_autoridades", "titulo": "Citas de Autoridades: ${ctx}", "contenido_html": "[HTML con las citas]"}. Castellano perfecto.`;
    }  
      
    case "quiz":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON puro, SIN markdown. Estructura: {"tipo": "quiz", "titulo": "Título atractivo", "preguntas": [{"pregunta": "Texto de la pregunta", "opciones": [{"texto": "Opción A", "correcta": false}, {"texto": "Opción B", "correcta": true}]}]}. 5 a 7 preguntas. Solo una opción correcta por pregunta.`;

    case "glosario":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "glosario", "titulo": "Glosario: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener al menos 5 términos. Usa la clase "caja-linguistica" para cada término, con un span clase "palabra-original" para el término en hebreo/griego. Incluir significado y contexto bíblico.`;

    case "palabras_clave":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "palabras_clave", "titulo": "Estudio de Palabras Clave: ${ctx}", "terminos": [{"termino_original": "Hebreo/Griego", "transliteracion": "Transliteración", "strong": "Número Strong", "significado": "Significado", "contexto": "Contexto en el capítulo"}]}. Entre 3 y 5 términos.`;

    case "contexto_arqueologico": {
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Generar el CONTEXTO HISTÓRICO-ARQUEOLÓGICO para ${ctx} con diseño "Ficha de Museo".
[... El resto del case "contexto_arqueologico" se mantiene igual ...]
#### FORMATO DE SALIDA
Devolvé SOLO un objeto JSON: {"tipo": "contexto_arqueologico", "titulo": "Contexto Histórico-Arqueológico: ${ctx}", "contenido_html": "[HTML con diseño Ficha de Museo]"}. Castellano perfecto.`;
    }

    // ============================================================
    // NUEVO CASO: ILUSTRACIONES HOMILÉTICAS
    // ============================================================
    case "ilustraciones": {
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Seleccionar 1 o 2 ilustraciones de la base de datos proporcionada que se conecten perfectamente con el estudio bíblico de ${ctx}.

BASE DE DATOS DE ILUSTRACIONES DISPONIBLES (JSON):
${JSON.stringify(baseIlustraciones || [], null, 2)}

INSTRUCCIONES:
1. Analiza el contexto del estudio bíblico y busca en la base de datos 1 o 2 ilustraciones que iluminen la verdad teológica principal de este pasaje.
2. Para cada ilustración elegida, genera una "Conexión Homilética" que explique claramente cómo la historia se conecta con el texto bíblico específico de este capítulo.
3. Incluye una "Aplicación Práctica" concreta y desafiante para el creyente de hoy.
4. Si no encuentras ninguna ilustración relevante en la base de datos, devuelve el array "ilustraciones" vacío [].

FORMATO DE SALIDA (JSON ESTRICTO):
{
  "tipo": "ilustraciones",
  "titulo": "Ilustraciones Homiléticas para ${ctx}",
  "ilustraciones": [
    {
      "fuente": "Nombre del autor (ej: Spurgeon, Moody)",
      "titulo_ilustracion": "Título breve de la historia",
      "contenido_ilustracion": "Texto limpio de la ilustración",
      "conexion_homiletica": "Explicación de 1-2 párrafos de cómo esto ilumina el texto bíblico de este capítulo.",
      "aplicacion_practica": "1-2 párrafos de aplicación directa y desafiante para la vida del creyente."
    }
  ]
}
Responde SOLO con el JSON válido, sin explicaciones adicionales.`;
    }

    default:
      return `Genera un recurso de tipo ${tipo} para ${ctx}. Devuelve un JSON válido con "tipo", "titulo" y "contenido_html" o la estructura específica del recurso.`;
  }
}
