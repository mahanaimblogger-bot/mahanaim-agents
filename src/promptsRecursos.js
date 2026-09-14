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
### TAREA: Generar un SERMÓN HOMILÉTICO COMPLETO Y EXTENSO (mínimo 3,500 palabras) para ${ctx}.

#### REGLA DE ARMONÍA (obligatoria)
Este sermón se genera DESDE el ESTUDIO ya existente de este mismo capítulo. Debe desarrollar el TEMA / MENSAJE CENTRAL del capítulo tal como emerge del estudio. No inventes un tema distinto ni contradigas el estudio.

#### CARACTERÍSTICAS OBLIGATORIAS:
1. **SERMÓN "PALABRA POR PALABRA"**: Debe estar redactado completo, listo para ser leído en el púlpito sin necesidad de improvisar nada. Si el predicador lo lee tal cual, debe sonar como un mensaje fluido, natural y pastoral.

2. **ESTRUCTURA HOMILÉTICA CLARA**:
   - INTRODUCCIÓN (400-500 palabras): Gancho impactante, planteamiento del tema, lectura del texto base.
   - 3-4 PUNTOS PRINCIPALES (cada uno 800-1000 palabras):
     * Título impactante para cada punto.
     * Explicación bíblica profunda.
     * Ilustraciones prácticas y ejemplos de la vida real.
     * Aplicación pastoral concreta.
     * Transición fluida al siguiente punto.
   - CONCLUSIÓN (400-500 palabras): Recapitulación, llamado a la acción, oración final.

3. **TONO Y ESTILO**: Pastoral, cálido pero firme. Conversacional (usa frases como: "Hermanos...", "Quiero que vean...", "Imaginen por un momento...", "Dios nos enseña aquí que..."). Incluye preguntas retóricas.

4. **PROFUNDIDAD TEOLÓGICA**: Extrae verdades teológicas del pasaje y conecta con el plan redentor de Dios.

#### DISEÑO HTML OBLIGATORIO (ESTILO "PASTORAL ÍNTIMO"):
El sermón DEBE usar EXACTAMENTE estas clases CSS y estructura visual. NO uses fondo blanco plano ni fragmentos largos de texto sin elementos visuales. Rompe el texto con cajas, ilustraciones y separadores cada 3-4 párrafos máximo.

**ESTRUCTURA HTML:**

\`\`\`html
<div class="sermon-pastoral">

<div class="titulo-wrapper">
  <p class="etiqueta-tipo">Sermón Expositivo</p>
  <h1 class="titulo-sermon">[TÍTULO IMPACTANTE DEL SERMÓN]</h1>
  <p class="texto-base">[Texto base: Libro Capítulo:Versículos]</p>
</div>

<h2>Introducción</h2>
<p>[Párrafo de introducción conversacional]</p>

<div class="ilustracion-pastoral">
  <span class="etiqueta">Ilustración</span>
  [Descripción visual o historia ilustrativa]
</div>

<p>[Más desarrollo de la introducción]</p>

<div class="aplicacion-pastoral">
  <span class="etiqueta">Para reflexionar antes de comenzar</span>
  [Pregunta o reflexión inicial]
</div>

<div class="separador-ornamental">❦  ❦</div>

<h2 class="punto">I. [TÍTULO DEL PRIMER PUNTO]</h2>

<div class="cita-versiculo">
  <span class="ref"> [Referencia bíblica]</span>
  "[Texto bíblico citado]"
</div>

<p>[Desarrollo expositivo del punto]</p>

<div class="nota-pastoral">
  <span class="etiqueta">Nota lingüística / teológica</span>
  [Explicación de términos hebreos/griegos o concepto teológico]
</div>

<p>[Más desarrollo]</p>

<div class="aplicacion-pastoral">
  <span class="etiqueta">Aplicación pastoral</span>
  [Aplicación concreta para la vida]
</div>

<div class="separador-ornamental">❦  ❦</div>

[REPETIR ESTRUCTURA PARA CADA PUNTO]

<div class="conclusion-pastoral">
  <h2>Conclusión y Llamado</h2>
  <p>[Recapitulación del mensaje]</p>
  
  <div class="punto-final">
    <strong>Primero:</strong> [Verdad 1]
  </div>
  <div class="punto-final">
    <strong>Segundo:</strong> [Verdad 2]
  </div>
  <div class="punto-final">
    <strong>Tercero:</strong> [Verdad 3]
  </div>

  <div class="oracion-final">
    <span class="etiqueta">Oración</span>
    "[Oración escrita completa para cerrar el sermón]"
  </div>
</div>

</div>
\`\`\`

**REGLAS DE DISEÑO:**
- Máximo 3-4 párrafos seguidos sin un elemento visual (caja, cita, separador).
- Usa <div class="separador-ornamental">❦  ❦</div> entre puntos principales.
- Las ilustraciones van en <div class="ilustracion-pastoral"> con <span class="etiqueta">Ilustración</span>.
- Las aplicaciones van en <div class="aplicacion-pastoral"> con <span class="etiqueta">Aplicación pastoral</span>.
- Las notas teológicas/lingüísticas van en <div class="nota-pastoral"> con <span class="etiqueta">Nota lingüística</span>.
- Las citas bíblicas van en <div class="cita-versiculo"> con <span class="ref"> Referencia</span>.
- La conclusión va en <div class="conclusion-pastoral"> con fondo oscuro y puntos finales destacados.

### FUENTE (ESTUDIO del capítulo)
${fuenteEstudio}

#### FORMATO DE SALIDA
Devolvé SOLO un objeto JSON: {"tipo": "sermon", "titulo": "Título impactante del sermón", "texto_base": "${ctx}", "contenido_html": "[HTML completo del sermón con diseño Pastoral Íntimo]"}. Castellano perfecto.`;
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
