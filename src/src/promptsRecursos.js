/**
 * Genera el prompt específico para cada tipo de recurso.
 * Incluye la inyección del texto bíblico para evitar alucinaciones.
 */
export function generarPromptRecurso(tipo, libro, capitulo, textoCapitulo = "") {
  const ctx = `${libro} capítulo ${capitulo}`;
  const reglaOrtografia = "**⛔ REGLA ABSOLUTA DE ORTOGRAFÍA Y FORMATO ⛔**\nEl texto DEBE estar en ESPAÑOL PERFECTO. Revisa tildes, puntuación y nombres propios. No inventes citas ni datos. Si usas comillas dobles dentro del JSON, escápalas con \\\".\n\n";
  
  const basePrompt = `Genera contenido para ${ctx}. \n\nTEXTO BÍBLICO DE REFERENCIA (RVR1960) PARA CITAS EXACTAS:\n${textoCapitulo}\n\n`;

  // Clases CSS base para mantener consistencia visual con Mahanaim App
  const clasesCSS = "Usa las clases HTML: 'contenedor-blog', 'titulo-entrada', 'subtitulo', 'caja-meditar', 'tabla-comparativa'.";

  switch (tipo) {
    case "quiz":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON puro, SIN markdown. Estructura: {"tipo": "quiz", "titulo": "Título atractivo", "preguntas": [{"pregunta": "Texto de la pregunta", "opciones": [{"texto": "Opción A", "correcta": false}, {"texto": "Opción B", "correcta": true}]}]}. 5 a 7 preguntas. Solo una opción correcta por pregunta.`;
    
    case "glosario":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "glosario", "titulo": "Glosario: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener al menos 5 términos. Usa la clase "caja-linguistica" para cada término, con un span clase "palabra-original" para el término en hebreo/griego. Incluir significado y contexto bíblico.`;
    
    case "guia_estudio":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "guia_estudio", "titulo": "Guía de Estudio y Reflexión: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe incluir: 1) Preguntas de comprensión del texto, 2) Preguntas de reflexión personal aplicativa, 3) Búsqueda bíblica (pasajes relacionados), 4) Conexión con Cristo, 5) Aplicación práctica concreta. ${clasesCSS}`;
    
    case "bosquejo":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "bosquejo", "titulo": "Bosquejo Homilético: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener: Tema Central, Pasaje Base, Bosquejo (3 puntos principales con subpuntos), Ilustración sugerida, Aplicación. ${clasesCSS}`;
    
    case "sermon":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "sermon", "titulo": "Sermón: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener: Introducción, Desarrollo (expositivo), Conclusión y Llamado. ${clasesCSS}`;
    
    case "paralelos":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "paralelos", "titulo": "Paralelos Bíblicos: ${ctx}", "paralelos": [{"referencia": "Libro Cap:Ver", "texto_cita": "Texto exacto RVR1960", "explicacion": "Conexión teológica clara"}]}. Máximo 6 paralelos.`;
    
    case "palabras_clave":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "palabras_clave", "titulo": "Estudio de Palabras Clave: ${ctx}", "terminos": [{"termino_original": "Hebreo/Griego", "transliteracion": "Transliteración", "strong": "Número Strong", "significado": "Significado", "contexto": "Contexto en el capítulo"}]}. Entre 3 y 5 términos.`;
    
    case "infografia":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "infografia", "titulo": "Infografía Doctrinal: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe ser una tabla con clase "tabla-comparativa" mostrando: Doctrina, Fundamento Bíblico, Desarrollo Teológico (con tipología). 3 a 5 doctrinas.`;
    
    case "citas_teologos":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "citas_teologos", "titulo": "Citas de Teólogos: ${ctx}", "citas": [{"autor": "Nombre real", "obra": "Obra real", "cita": "Cita textual pertinente"}]}. 3 a 5 citas. SOLO autores y obras REALES y VERIFICABLES.`;
    
    case "citas_libros":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "citas_libros", "titulo": "Citas de Libros: ${ctx}", "citas": [{"autor": "Nombre real", "titulo_libro": "Título real", "cita": "Cita textual pertinente"}]}. 3 a 5 citas. SOLO autores y libros REALES.`;
    
    case "contexto_arqueologico":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "contexto_arqueologico", "titulo": "Contexto Histórico-Arqueológico: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener secciones: Contexto Histórico, Contexto Arqueológico (datos REALES), Implicaciones para la Interpretación. ${clasesCSS}`;
    
    case "diagrama_estructura":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "diagrama_estructura", "titulo": "Diagrama de Estructura Literaria: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe mostrar el tipo de estructura (ej: quiasmo) y un diagrama textual en una etiqueta <pre>. Incluye el significado teológico de la estructura.`;
    
    case "cronologia":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "cronologia", "titulo": "Cronología del Capítulo: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe ser una tabla con clase "tabla-comparativa" listando los eventos en orden cronológico con su referencia bíblica exacta.`;
    
    case "conexion_at":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "conexion_at", "titulo": "Conexión con el A.T.: ${ctx}", "conexiones": [{"referencia_at": "Ref AT real", "texto_cita": "Cita textual RVR1960", "explicacion": "Cómo se relaciona con este pasaje del NT"}]}. 3 a 5 conexiones REALES.`;

    case "conexion_nt":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "conexion_nt", "titulo": "Conexión con el N.T.: ${ctx}", "conexiones": [{"referencia_nt": "Ref NT real", "texto_cita": "Cita textual RVR1960", "explicacion": "Cómo este pasaje del AT se cumple o conecta en el NT"}]}. 3 a 5 conexiones REALES.`;
    
    case "profecias":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "profecias", "titulo": "Profecías en ${ctx}", "profecias": [{"profecia": "Descripción", "referencia_profecia": "Ref bíblica", "estado": "Cumplida/Parcial/Por cumplir", "referencia_cumplimiento": "Ref cumplimiento", "explicacion": "Explicación teológica profunda"}]}. Mínimo 2 profecías REALES.`;

    case "devocional":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "devocional", "titulo": "Devocional: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener: Versículo principal (clase "cita-versiculo"), Contexto, Reflexión profunda (3-4 párrafos), Aplicación Personal, Para Meditar (clase "caja-meditar"), Oración Sugerida.`;

    default:
      return `Genera un recurso de tipo ${tipo} para ${ctx}. Devuelve un JSON válido con "tipo", "titulo" y "contenido_html" o la estructura específica del recurso.`;
  }
}
