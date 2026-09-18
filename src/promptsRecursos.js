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
### TAREA: Generar un SERMÓN HOMILÉTICO COMPLETO (mínimo 3,000 palabras) para ${ctx}.

#### REGLA DE ARMONÍA
Desarrolla el TEMA del estudio. No inventes temas distintos.

#### DISEÑO HTML OBLIGATORIO (ESTILO RICO Y VISUAL):
NO generes párrafos largos de texto plano. DEBES usar esta estructura HTML con estilos en línea para garantizar el diseño:

<div style="background: #fdfbf7; padding: 40px 30px; border-radius: 12px; border: 1px solid #e8dcc8; font-family: Georgia, serif; color: #3e2723; line-height: 1.8;">
  
  <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px dashed #d4ac0d; padding-bottom: 20px;">
    <p style="color: #8b6914; font-style: italic; font-size: 1.1em; margin: 0;">Sermón Expositivo</p>
    <h1 style="color: #1a3a5c; font-size: 2.2em; margin: 10px 0;">[TÍTULO IMPACTANTE]</h1>
    <p style="color: #5d4037; font-weight: bold; letter-spacing: 1px;">TEXTO BASE: [Libro Capítulo:Versículos]</p>
  </div>

  <h2 style="color: #1a3a5c; border-left: 4px solid #d4ac0d; padding-left: 15px; margin-top: 30px;">Introducción</h2>
  <p>[Párrafo de gancho conversacional]</p>
  
  <div style="background: linear-gradient(135deg, #2c0a0a, #4a1010); color: #f0e6d0; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 5px solid #d4ac0d;">
    <strong style="color: #d4ac0d; display: block; margin-bottom: 10px;">💡 Ilustración:</strong>
    [Historia o analogía visual breve]
  </div>

  <div style="margin: 30px 0; border-top: 1px solid #d4c4a8; border-bottom: 1px solid #d4c4a8; padding: 15px 0; text-align: center; color: #d4ac0d; font-size: 1.5em; letter-spacing: 10px;">❦ ❦</div>

  <h2 style="color: #1a3a5c; border-left: 4px solid #d4ac0d; padding-left: 15px; margin-top: 30px;">I. [TÍTULO DEL PRIMER PUNTO]</h2>
  
  <div style="background: #fef9e7; border-left: 4px solid #b7950b; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; font-style: italic; color: #5d4037;">
    <strong style="color: #1a3a5c; font-style: normal; display: block; margin-bottom: 5px;">📖 [Referencia Bíblica]</strong>
    "[Texto bíblico citado]"
  </div>

  <p>[Exposición del punto]</p>

  <div style="background: #f4ecf7; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8e44ad;">
    <strong style="color: #6c3483; display: block; margin-bottom: 5px;">📜 Nota Teológica:</strong>
    [Explicación breve de término hebreo/griego o doctrina]
  </div>

  <div style="background: #e8f8f5; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #1abc9c;">
    <strong style="color: #117a65; display: block; margin-bottom: 5px;">✅ Aplicación:</strong>
    [Acción concreta para la vida]
  </div>

  [REPITE LA ESTRUCTURA DE PUNTOS CON SUS CAJAS DE COLORES]

  <div style="background: linear-gradient(135deg, #1a3a5c, #2d4a6c); color: white; padding: 30px; border-radius: 12px; margin-top: 40px; text-align: center; border: 2px solid #d4ac0d;">
    <h2 style="color: #d4ac0d; margin-top: 0;">Conclusión y Llamado</h2>
    <p>[Recapitulación breve]</p>
    <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
      <strong>1.</strong> [Verdad 1]<br>
      <strong>2.</strong> [Verdad 2]<br>
      <strong>3.</strong> [Verdad 3]
    </div>
    <div style="background: #fdfbf7; color: #3e2723; padding: 20px; border-radius: 8px; margin-top: 20px; font-style: italic;">
      <strong style="display: block; margin-bottom: 10px; color: #8b6914;">🙏 Oración Final:</strong>
      "[Oración completa escrita]"
    </div>
  </div>

</div>

REGLA: Máximo 3 párrafos seguidos sin una caja de color o separador.

### FUENTE: ${fuenteEstudio}

FORMATO JSON: {"tipo": "sermon", "titulo": "...", "texto_base": "${ctx}", "contenido_html": "[HTML con diseño rico y cajas de colores]"}`;
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
      return `Genera APLICACIONES PRÁCTICAS, CONCRETAS Y RESUMIDAS para ${ctx}.

ENFOQUE: CERO TEORÍA. Solo acciones específicas para HOY.

ESTRUCTURA OBLIGATORIA (Debes generar exactamente este formato HTML):

<div style="font-family: Georgia, serif; color: #3e2723; line-height: 1.7;">
  <h2 style="text-align: center; color: #1a3a5c; border-bottom: 3px solid #d4ac0d; padding-bottom: 10px; margin-bottom: 30px;">📌 Aplicaciones Prácticas para Tu Vida</h2>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #8b6914; display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">🙏 Vida Personal y Devocional</h3>
    
    <div style="background: #fdfbf7; padding: 20px; border-radius: 8px; border-left: 4px solid #d4ac0d; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
      <h4 style="margin: 0 0 10px 0; color: #1a3a5c;">✅ [Título de la acción en imperativo, ej: ORA con perseverancia]</h4>
      <p style="margin: 0 0 8px 0; font-size: 0.9em; color: #5d4037;"><strong>📖 Base:</strong> [Capítulo:Versículo]</p>
      <p style="margin: 0 0 8px 0; font-size: 0.95em;"><strong>💡 Principio:</strong> [La verdad del capítulo en 1 sola frase].</p>
      <p style="margin: 0; font-weight: bold; color: #1a3a5c;"><strong>🎯 Para HOY:</strong> [Acción concreta y específica. Ej: "Dedica 15 minutos hoy a orar en tu lugar secreto, no solo pidiendo, sino escuchando."]</p>
    </div>
    [Repite este bloque de "div" 2 veces más para esta categoría]
  </div>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #8b6914; display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">👨‍👩‍👧‍👦 Familia y Hogar</h3>
    [Genera 2 bloques "div" como el anterior, adaptados a la familia]
  </div>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #8b6914; display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">⛪ Iglesia y Comunidad</h3>
    [Genera 2 bloques "div" como el anterior, adaptados a la iglesia]
  </div>
</div>

REGLAS CRÍTICAS:
1. El "Para HOY" debe ser una acción que se pueda hacer en las próximas 24 horas.
2. Sé breve. El "Principio" es 1 frase. El "Para HOY" es 1 o 2 frases máximo.
3. Usa el HTML exacto proporcionado arriba para que se vea como tarjetas limpias y organizadas.

FUENTE: ${materiales.sermon_html ? materiales.sermon_html.substring(0, 2000) : ''}

FORMATO JSON: {"tipo": "aplicaciones_practicas", "titulo": "Aplicaciones Prácticas: ${ctx}", "contenido_html": "[HTML de tarjetas]"}`;
    }   

        case "citas_autoridades": {
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Generar CITAS DE AUTORIDADES (Teólogos y Libros de referencia) para ${ctx}.

#### REGLAS CRÍTICAS:
1. SOLO usa autores y obras REALES y VERIFICABLES (ej: Juan Calvino, Matthew Henry, Charles Spurgeon, John MacArthur, R.C. Sproul, Francis Schaeffer, A.W. Tozer, Jonathan Edwards).
2. NO inventes citas ni títulos de libros.
3. NO uses referencias bíblicas como "título de libro".
4. Genera entre 4 y 6 citas en total, mezclando teólogos clásicos y comentaristas modernos.
5. Cada cita debe estar DIRECTAMENTE relacionada con el tema del capítulo.

#### ESTRUCTURA HTML OBLIGATORIA (usa estilos inline):

<div style="font-family: Georgia, serif; color: #3e2723; line-height: 1.7;">
  <h2 style="text-align: center; color: #1a3a5c; border-bottom: 3px solid #d4ac0d; padding-bottom: 10px; margin-bottom: 25px;"> Citas de Autoridades</h2>
  
  <div style="background: #fdfbf7; padding: 20px; border-radius: 8px; border-left: 4px solid #8b6914; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
    <p style="font-style: italic; margin: 0 0 10px 0; color: #5d4037;">"[Cita textual del autor o libro]"</p>
    <p style="margin: 0; font-size: 0.9em; color: #1a3a5c;"><strong>— [Nombre del Autor]</strong>, <em>[Nombre de la Obra/Libro]</em></p>
  </div>
  
  [Repite el bloque "div" anterior para cada cita, entre 4 y 6 veces en total]
</div>

#### FORMATO DE SALIDA
Devolvé SOLO un objeto JSON: {"tipo": "citas_autoridades", "titulo": "Citas de Autoridades: ${ctx}", "contenido_html": "[HTML con las citas]"}. Castellano perfecto.`;
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
