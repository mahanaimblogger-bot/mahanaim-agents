/**
 * Genera el prompt específico para cada tipo de recurso.
 * Incluye la inyección del texto bíblico para evitar alucinaciones.
 */
export function generarPromptRecurso(tipo, libro, capitulo, textoCapitulo = "", materiales = {}) {
  const ctx = `${libro} capítulo ${capitulo}`;
  const reglaOrtografia = "**⛔ REGLA ABSOLUTA DE ORTOGRAFÍA Y FORMATO ⛔**\nEl texto DEBE estar en ESPAÑOL PERFECTO. Revisa tildes, puntuación y nombres propios. No inventes citas ni datos. Si usas comillas dobles dentro del JSON, escápalas con \\\".\n\n";

  const basePrompt = `Genera contenido para ${ctx}. \n\nTEXTO BÍBLICO DE REFERENCIA (RVR1960) PARA CITAS EXACTAS:\n${textoCapitulo}\n\n`;
  const clasesCSS = "Usa las clases HTML: 'contenedor-blog', 'titulo-entrada', 'subtitulo', 'caja-meditar', 'tabla-comparativa'.";

  // ============================================================
  // AYUDAS PARA LA CADENA HOMILÉTICA (estudio -> sermón -> bosquejo -> podcast)
  // Cada pieza se NUTRE de la pieza fuente del mismo capítulo y NO debe
  // contradecirla ni inventar fuera de ella.
  // materiales = { estudio_html, sermon_html }
  // ============================================================
  const estudioHtml = (materiales && materiales.estudio_html) || null;
  const sermonHtml = (materiales && materiales.sermon_html) || null;

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
    case "quiz":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON puro, SIN markdown. Estructura: {"tipo": "quiz", "titulo": "Título atractivo", "preguntas": [{"pregunta": "Texto de la pregunta", "opciones": [{"texto": "Opción A", "correcta": false}, {"texto": "Opción B", "correcta": true}]}]}. 5 a 7 preguntas. Solo una opción correcta por pregunta.`;

    case "glosario":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "glosario", "titulo": "Glosario: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener al menos 5 términos. Usa la clase "caja-linguistica" para cada término, con un span clase "palabra-original" para el término en hebreo/griego. Incluir significado y contexto bíblico.`;

    case "guia_estudio":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "guia_estudio", "titulo": "Guía de Estudio y Reflexión: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe incluir: 1) Preguntas de comprensión del texto, 2) Preguntas de reflexión personal aplicativa, 3) Búsqueda bíblica (pasajes relacionados), 4) Conexión con Cristo, 5) Aplicación práctica concreta. ${clasesCSS}`;

    case "bosquejo":
      if (!sermonHtml) {
        throw new Error(`Falta el recurso fuente para bosquejo: no se encontró el SERMÓN de ${ctx}.`);
      }
      const fuenteSermon = recortarFuente(sermonHtml);
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Generar un BOSQUEJO HOMILÉTICO para ${ctx}.

#### REGLA DE ARMONÍA (obligatoria)
Este bosquejo se genera DESDE el SERMÓN ya existente de este mismo capítulo (su texto se entrega como fuente). Debe reflejar fielmente el mismo mensaje/tema, estructura y llamado del sermón; NO inventes un tema ni puntos que el sermón no trate. Guarda coherencia doctrinal con el estudio/sermón del capítulo.

#### ESTRUCTURA (destilación del sermón)
1) Título del sermón (el mismo del sermón fuente o uno equivalente).
2) Tema / Mensaje central (tesis en UNA frase, tomada del sermón).
3) Pasaje base (referencia del capítulo).
4) Bosquejo de 3 puntos principales con subpuntos, extraídos de la estructura del sermón fuente.
5) Ilustración sugerida.
6) Conclusión y Aplicación/Llamado (tal como cierra el sermón fuente).

### FUENTE (SERMÓN del capítulo)
${fuenteSermon}

#### FORMATO DE SALIDA
Devolvé SOLO un objeto JSON: {"tipo": "bosquejo", "titulo": "Bosquejo Homilético: ${ctx} — <tema>", "contenido_html": "[HTML COMPLETO del bosquejo]"}. Usa ${clasesCSS}. Castellano perfecto.
`;

    case "sermon":
      if (!estudioHtml) {
        throw new Error(`Falta el recurso fuente para sermon: no se encontró el ESTUDIO de ${ctx}.`);
      }
      const fuenteEstudio = recortarFuente(estudioHtml);
      return reglaOrtografia + basePrompt + PERFIL_DOCTRINAL + `
### TAREA: Generar un SERMÓN (predicación expositivo-concional) para ${ctx}.

#### REGLA DE ARMONÍA (obligatoria)
Este sermón se genera DESDE el ESTUDIO ya existente de este mismo capítulo (su contenido/idea/doctrinas/mensaje se entrega como fuente). Debe:
- Desarrollar el TEMA / MENSAJE CENTRAL del capítulo tal como emerge del estudio. No inventes un tema distinto ni contradigas el estudio.
- Ser MÁS conciso y predicable que el estudio (no un tratado académico): orientado a la congregación.
- Seguir NORMAS DE HOMILÉTICA: 1) Idea o tesis homilética (el mensaje central) en UNA frase; 2) Introducción que captura; 3) Desarrollo expositivo en puntos claros que avanzan el texto, con ilustraciones e implicaciones prácticas; 4) Conclusión; 5) Llamado/apelación final.

### FUENTE (ESTUDIO del capítulo)
${fuenteEstudio}

#### FORMATO DE SALIDA
Devolvé SOLO un objeto JSON: {"tipo": "sermon", "titulo": "Sermón: ${ctx} — <mensaje central en pocas palabras>", "contenido_html": "[HTML COMPLETO del sermón]"}. Usa ${clasesCSS}. Castellano perfecto.
`;

    case "podcast_guion":
      if (!estudioHtml || !sermonHtml) {
        const faltan = [];
        if (!estudioHtml) faltan.push("ESTUDIO");
        if (!sermonHtml) faltan.push("SERMÓN");
        throw new Error(`Falta el recurso fuente para podcast_guion de ${ctx}: no se encontró ${faltan.join(" y ")}.`);
      }
      const fuenteEstudioPod = recortarFuente(estudioHtml);
      const fuenteSermonPod = recortarFuente(sermonHtml);
      return basePrompt + PERFIL_DOCTRINAL + `
### TAREA: escribir el GUION COMPLETO de un PODCAST DE AUDIO de DOS VOCES (diálogo), en texto plano para ${ctx}.

#### NATURALEZA: PODCAST CONVERSACIONAL A DOS VOCES
- Es una conversación entre DOS personas que dialogan sobre el capítulo, NO un monólogo.
- Genera naturalidad: preguntas cruzadas, descubrimientos mutuos y comentarios breves que se responden.
- Entre ambos recorren el capítulo: cada uno aporta datos, aclara dudas del otro y llegan a la aplicación.
- Mantén el hilo: el mensaje central del sermón y el recorrido del estudio, pero en charla amena.
- Respeta el perfil doctrinal y las fuentes; no contradigas ni inventes fuera de ellas.

#### REGLAS CRÍTICAS DE SALIDA
- El archivo final será un .txt que se pasará a un conversor de texto a voz (TTS).
- NUNCA devuelvas JSON, HTML, markdown, ni encierres nada entre comillas de código.
- Devolvé SOLO el guion literal, listo para pegar en el conversor, en ESPAÑOL PERFECTO.
- Se arma DESDE el ESTUDIO y el SERMÓN del capítulo (provistos como fuentes).

#### FORMATO DEL ARCHIVO TXT (usa estos marcadores SIEMPRE)
#FORMATO=mahanaim-tts:v1
#IDIOMA=es-ES
#EPISODIO=Podcast de <libro> <capítulo> — <título atractivo>
#VOZ_PRINCIPAL=Narrador

[INTRO] (tono enérgico)
LOCUTOR=Narrador
...saludo y presentación de ambos conductores...
LOCUTOR=Locutor
...gancho que capta al oyente...
[EXPECTATIVA]
...pregunta que promete lo que van a descubrir...

[CUERPO] (tono de charla cálida)
LOCUTOR=Narrador
...primer tema planteado en voz conversacional...
LOCUTOR=Locutor
...reacción, pregunta o aporte en conversación...
[PAUSA 1s]
LOCUTOR=Narrador
...continúan alternando y profundizan otra sección...
[ENFASIS] ...frase que uno enfatiza y el otro subraya...

[CIERRE] (tono sereno y de llamado)
LOCUTOR=Narrador
...resumen breve y aplicación/llamado final...
LOCUTOR=Locutor
...cierre cálido, despedida e invitación al siguiente episodio...

#### REGLAS DE DIÁLOGO Y MARCAS
- Usa SIEMPRE la etiqueta LOCUTOR= ANTES de cada parlamento para indicar quién habla:
  * LOCUTOR=Narrador          -> Voz principal (conductor fijo).
  * LOCUTOR=Locutor (o Voz2, Invitado/a, Narradora) -> Segunda voz.
- Ningún parlamento sin su LOCUTOR= previo. Alterna voces varias veces a lo largo del guion.
- Coloca [PAUSA 1s], [PAUSA 2s] o [PAUSA 3s] en su propia línea donde haya silencio real.
- [ENFASIS] va en su propia línea o al inicio de la frase a enfatizar.
- (tono ...) en su propia línea al inicio de cada bloque, ej.: (tono enérgico | suave | serio | misterioso | cercano).
- [EXPECTATIVA] en su propia línea tras una pregunta que debe subir en entonación.
- Secciones [INTRO] | [CUERPO] | [CIERRE] y líneas # de metadatos no se leen en voz alta.
- Frases cortas y orales. Sin listas ni citas académicas largas: dialogar y leer en voz alta natural.

#### DURACIÓN OBJETIVO
Para un capítulo de estudio, apunta a entre 8 y 14 minutos leídos en voz alta (aprox. 1200-1600 palabras), repartidas entre ambas voces.

### FUENTES a usar
#### ESTUDIO del capítulo:
${fuenteEstudioPod}
#### SERMÓN del capítulo:
${fuenteSermonPod}

#### SALIDA
Imprimí el guion SOLO (sin NINGUNA línea extra, sin explicaciones).
`;

    case "paralelos":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "paralelos", "titulo": "Paralelos Bíblicos: ${ctx}", "paralelos": [{"referencia": "Libro Cap:Ver", "texto_cita": "Texto exacto RVR1960", "explicacion": "Conexión teológica clara"}]}. Máximo 6 paralelos.`;

    case "palabras_clave":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "palabras_clave", "titulo": "Estudio de Palabras Clave: ${ctx}", "terminos": [{"termino_original": "Hebreo/Griego", "transliteracion": "Transliteración", "strong": "Número Strong", "significado": "Significado", "contexto": "Contexto en el capítulo"}]}. Entre 3 y 5 términos.`;

    case "infografia":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "infografia", "titulo": "Infografía Doctrinal: ${ctx}", "doctrinas": [{"doctrina": "Nombre formal de la doctrina", "fundamento": "Versículos del capítulo", "desarrollo": "Explicación teológica con referencias cruzadas"}]}. 3 a 5 doctrinas formales según la Teología Sistemática.`;

    case "citas_teologos":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "citas_teologos", "titulo": "Citas de Teólogos: ${ctx}", "citas": [{"autor": "Nombre real", "obra": "Obra real", "cita": "Cita textual pertinente"}]}. 3 a 5 citas. SOLO autores y obras REALES y VERIFICABLES.`;

    case "citas_libros":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "citas_libros", "titulo": "Citas de Libros: ${ctx}", "citas": [{"autor": "Nombre del autor", "titulo_libro": "Título del libro", "cita": "Cita textual del libro"}]}. 3 a 5 citas de libros REALES y VERIFICABLES de comentarios bíblicos, teológicos o devocionales reconocidos (p. ej. Juan Calvino, Matthew Henry, Charles Spurgeon, C.S. Lewis, A.W. Tozer). NO uses referencias bíblicas como título_libro.`;

    case "contexto_arqueologico":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "contexto_arqueologico", "titulo": "Contexto Histórico-Arqueológico: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe tener secciones: Contexto Histórico, Contexto Arqueológico (datos REALES), Implicaciones para la Interpretación. ${clasesCSS}`;

    case "diagrama_estructura":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "diagrama_estructura", "titulo": "Diagrama de Estructura Literaria: ${ctx}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe mostrar el tipo de estructura (ej: quiasmo) y un diagrama textual en una etiqueta <pre>. Incluye el significado teológico de la estructura.`;

    case "cronologia":
      return reglaOrtografia + basePrompt + `Devolvé SOLO un objeto JSON: {"tipo": "cronologia", "titulo": "Cronología del capítulo ${capitulo}", "contenido_html": "[HTML COMPLETO]"}. El HTML debe ser una tabla con clase "tabla-comparativa" listando los eventos en orden cronológico con su referencia bíblica exacta. El título DEBE ser exactamente "Cronología del capítulo ${capitulo}".`;

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
