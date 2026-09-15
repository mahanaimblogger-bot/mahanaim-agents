/**
 * Genera el prompt específico para cada tipo de recurso optimizado.
 * Incluye la inyección del texto bíblico para evitar alucinaciones.
 */
export function generarPromptRecurso(tipo, libro, capitulo, textoCapitulo = "", materiales = {}) {
  const ctx = `${libro} capítulo ${capitulo}`;
  const reglaOrtografia = "**⛔ REGLA ABSOLUTA DE ORTOGRAFÍA Y FORMATO ⛔**\nEl texto DEBE estar en ESPAÑOL PERFECTO. Revisa tildes, puntuación y nombres propios. No inventes citas ni datos. Si usas comillas dobles dentro del JSON, escápalas con \\\".\n\n";

  const basePrompt = `Genera contenido para ${ctx}. \n\nTEXTO BÍBLICO DE REFERENCIA (RVR1960) PARA CITAS EXACTAS:\n${textoCapitulo}\n\n`;
  const clasesCSS = "Usa las clases HTML: 'contenedor-blog', 'titulo-entrada', 'subtitulo', 'caja-meditar', 'tabla-comparativa', 'caja-linguistica'.";

  // Recorte defensivo de una fuente HTML larga para no inflar el prompt.
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

  // Perfil doctrinal compacto para mantener coherencia con el Prompt Maestro.
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
### TAREA: Generar un SERMÓN HOMILÉTICO COMPLETO (mínimo 3,500 palabras) para ${ctx}.

#### REGLA DE ARMONÍA
Desarrolla el TEMA del estudio. No inventes temas distintos.

#### ESTRUCTURA HOMILÉTICA:
1. INTRODUCCIÓN (400-500 palabras): Gancho + texto base
2. 3-4 PUNTOS (800-1000 palabras cada uno): Título + exposición + ilustración + aplicación
3. CONCLUSIÓN (400-500 palabras): Recapitulación + llamado + oración

#### TONO: Pastoral, cálido, conversacional. Usa "Hermanos...", "Imaginen...", "Dios nos enseña..."

#### DISEÑO HTML OBLIGATORIO - ESTILO "PASTORAL ÍNTIMO":
DEBES usar EXACTAMENTE estas clases CSS. NO generes HTML plano.

EJEMPLO DE ESTRUCTURA QUE DEBES SEGUIR:

<div class="sermon-pastoral">
  <div class="titulo-wrapper">
    <p class="etiqueta-tipo">Sermón Expositivo</p>
    <h1 class="titulo-sermon">[TÍTULO]</h1>
    <p class="texto-base">[Texto base]</p>
  </div>
  
  <h2>Introducción</h2>
  <p>[Párrafo]</p>
  
  <div class="ilustracion-pastoral">
    <span class="etiqueta">Ilustración</span>
    [Historia ilustrativa]
  </div>
  
  <div class="separador-ornamental">❦ ❦</div>
  
  <h2 class="punto">I. [TÍTULO PUNTO 1]</h2>
  
  <div class="cita-versiculo">
    <span class="ref">[Referencia]</span>
    "[Texto bíblico]"
  </div>
  
  <p>[Exposición]</p>
  
  <div class="nota-pastoral">
    <span class="etiqueta">Nota lingüística</span>
    [Explicación hebreo/griego]
  </div>
  
  <div class="aplicacion-pastoral">
    <span class="etiqueta">Aplicación pastoral</span>
    [Aplicación concreta]
  </div>
  
  <div class="separador-ornamental">❦ ❦</div>
  
  [REPITE PARA CADA PUNTO]
  
  <div class="conclusion-pastoral">
    <h2>Conclusión y Llamado</h2>
    <div class="punto-final"><strong>1.</strong> [Verdad]</div>
    <div class="punto-final"><strong>2.</strong> [Verdad]</div>
    <div class="oracion-final">
      <span class="etiqueta">Oración</span>
      "[Oración completa]"
    </div>
  </div>
</div>

REGLAS CRÍTICAS:
- Máximo 3 párrafos seguidos sin una caja visual
- Usa TODAS las clases: titulo-wrapper, ilustracion-pastoral, nota-pastoral, aplicacion-pastoral, cita-versiculo, separador-ornamental, conclusion-pastoral
- NO uses <p> largos sin romper con cajas

### FUENTE: ${fuenteEstudio}

FORMATO JSON: {"tipo": "sermon", "titulo": "...", "texto_base": "${ctx}", "contenido_html": "[HTML con diseño Pastoral Íntimo]"}`;
}
    case "bosquejo": {
      const fuenteSermon = recortarFuente(materiales.sermon_html);
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Generar el BOSQUEJO HOMILÉTICO EXACTO del sermón para ${ctx}.

#### REGLA DE ARMONÍA (obligatoria)
Este bosquejo se genera DESDE el SERMÓN ya existente de este mismo capítulo. Debe reflejar fielmente el mismo mensaje, estructura y llamado del sermón. NO inventes un tema ni puntos que el sermón no trate.

#### CARACTERÍSTICAS OBLIGATORIAS:
1. **SOLO PUNTOS Y SUBPUNTOS**: NO desarrolles el contenido. Solo lista la estructura esquemática con referencias bíblicas.
2. **FORMATO ESQUEMÁTICO CLARO**:
   - TÍTULO DEL SERMÓN
   - TEXTO BASE
   - INTRODUCCIÓN (solo mencionar el gancho, sin desarrollar)
   - PUNTO I: [Título del punto]
     * Subpunto A: [Cita bíblica de apoyo]
     * Subpunto B: [Cita bíblica de apoyo]
   - PUNTO II: [Título del punto]
     * Subpunto A: [Cita bíblica]
     * Subpunto B: [Cita bíblica]
   - PUNTO III: [Título del punto]
     * Subpunto A: [Cita bíblica]
     * Subpunto B: [Cita bíblica]
   - CONCLUSIÓN (solo mencionar el llamado, sin desarrollar)

### FUENTE (SERMÓN del capítulo)
${fuenteSermon}

#### FORMATO DE SALIDA
Devolvé SOLO un objeto JSON: {"tipo": "bosquejo", "titulo": "Bosquejo: <tema del sermón>", "texto_base": "${ctx}", "contenido_html": "<div class='bosquejo-sermon'>[HTML con la estructura esquemática]</div>"}. Castellano perfecto.`;
    }

    case "aplicaciones_practicas": {
      const fuenteSermonApp = recortarFuente(materiales.sermon_html);
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Generar APLICACIONES PRÁCTICAS Y ACCIONABLES basadas en ${ctx}.

#### CARACTERÍSTICAS OBLIGATORIAS:
1. **ACCIONES CONCRETAS**: No teoría, sino "qué hacer" específicamente.
2. **CATEGORÍAS DE APLICACIÓN** (mínimo 3 aplicaciones por categoría):
   - **VIDA DEVOCIONAL**: Cómo aplicar esto en tu tiempo con Dios.
   - **FAMILIA**: Cómo vivir esto en el hogar.
   - **IGLESIA**: Cómo aplicar esto en la comunidad de fe.
   - **TRABAJO/ESTUDIO**: Cómo vivir esto en tu ámbito laboral.
   - **TESTIMONIO**: Cómo mostrar esto a los no creyentes.
3. **FORMATO ACCIONABLE**: Cada aplicación debe empezar con un verbo de acción en mayúsculas:
   - "ORA cada mañana por..."
   - "LEE este pasaje y reflexiona en..."
   - "COMPARTE con tu familia..."
   - "PRACTICA esto en tu trabajo..."
   - "MEMORIZA este versículo..."

### FUENTE (SERMÓN del capítulo)
${fuenteSermonApp}

#### FORMATO DE SALIDA
Devolvé SOLO un objeto JSON: {"tipo": "aplicaciones_practicas", "titulo": "Aplicaciones Prácticas: ${ctx}", "contenido_html": "<div class='aplicaciones-practicas'>[HTML con las aplicaciones organizadas por categorías]</div>"}. Castellano perfecto.`;
    }

    case "quiz":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON puro, SIN markdown. Estructura: {"tipo": "quiz", "titulo": "Título atractivo", "preguntas": [{"pregunta": "Texto de la pregunta", "opciones": [{"texto": "Opción A", "correcta": false}, {"texto": "Opción B", "correcta": true}]}]}. 5 a 7 preguntas. Solo una opción correcta por pregunta.`;

    case "glosario":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "glosario", "titulo": "Glosario: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener al menos 5 términos. Usa la clase "caja-linguistica" para cada término, con un span clase "palabra-original" para el término en hebreo/griego. Incluir significado y contexto bíblico.`;

    case "palabras_clave":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "palabras_clave", "titulo": "Estudio de Palabras Clave: ${ctx}", "terminos": [{"termino_original": "Hebreo/Griego", "transliteracion": "Transliteración", "strong": "Número Strong", "significado": "Significado", "contexto": "Contexto en el capítulo"}]}. Entre 3 y 5 términos.`;

    case "contexto_arqueologico":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "contexto_arqueologico", "titulo": "Contexto Histórico-Arqueológico: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener secciones: Contexto Histórico, Contexto Arqueológico (datos REALES), Implicaciones para la Interpretación. ${clasesCSS}`;

    default:
      return `Genera un recurso de tipo ${tipo} para ${ctx}. Devuelve un JSON válido con "tipo", "titulo" y "contenido_html" o la estructura específica del recurso.`;
  }
}
