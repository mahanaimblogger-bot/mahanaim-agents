/**
 * Módulo de formateo para convertir JSON de IA en HTML estilizado.
 * Sistema de Diseño Unificado Mahanaim (Estética Infografía Doctrinal).
 */

export function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function limpiarHtml(html) {
  if (!html) return "";
  
  // Si el HTML comienza con un JSON mal formado, extraemos solo el contenido real
  if (html.trim().startsWith('{')) {
    const match = html.match(/"contenido_html"\s*:\s*"([\s\S]*)"/);
    if (match && match[1]) {
      html = match[1];
    } else {
      const htmlStart = html.match(/<(div|h1|h2|p)[\s>]/i);
      if (htmlStart && htmlStart.index !== undefined) {
        html = html.substring(htmlStart.index);
      }
    }
  }
  
  let htmlLimpio = html
    .replace(/```json|```/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\n/g, '\n')
    .replace(/^["']|["']$/g, '')
    .trim();

  //  CLAVE: Envolver en contenedor responsivo para evitar desbordamiento
  // Solo si no está ya envuelto en un contenedor con max-width
  if (!htmlLimpio.includes('max-width') && !htmlLimpio.startsWith('<div style="')) {
    htmlLimpio = `<div style="font-family: 'Georgia', serif; color: #3e2723; background: #fdfbf7; padding: 20px; border-radius: 8px; max-width: 100%; box-sizing: border-box; overflow-wrap: break-word; word-wrap: break-word; overflow-x: auto;">${htmlLimpio}</div>`;
  }

  return htmlLimpio;
}

const ESTILOS = {
  contenedor: "font-family: 'Georgia', serif; color: #3e2723; background: #fdfbf7; padding: 20px; border-radius: 8px; max-width: 100%; box-sizing: border-box; overflow-wrap: break-word; word-wrap: break-word;",
  titulo: "color: #1a5276; border-bottom: 2px solid #d4ac0d; padding-bottom: 8px; margin-bottom: 20px;",
  tablaHeader: "background: #1a3a5c; color: #d4ac0d; padding: 10px 12px; text-align: left; font-weight: bold; font-size: 0.9em; border: 1px solid #3e5a7a; white-space: normal; word-wrap: break-word;",
  tablaCelda: "padding: 10px 12px; border: 1px solid #d4c4a8; vertical-align: top; font-size: 0.9em; line-height: 1.5; word-wrap: break-word; overflow-wrap: break-word; max-width: 300px;",
  tablaContenedor: "overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px;",
  card: "background: #ffffff; border: 1px solid #d4c4a8; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); max-width: 100%; box-sizing: border-box;",
  cardTitulo: "color: #1a3a5c; border-bottom: 1px dashed #d4ac0d; padding-bottom: 6px; margin-bottom: 10px; font-size: 1.1em;",
  btn: "background: #1a3a5c; color: #d4ac0d; border: 2px solid #d4ac0d; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-family: 'Georgia', serif;"
};

export function formatQuizInteractivo(json) {
  const preguntas = json.preguntas || [];
  if (preguntas.length === 0) return `<div style="${ESTILOS.contenedor}"><p>No se generaron preguntas.</p></div>`;

  let html = `<div style="${ESTILOS.contenedor}">`;
  html += `<h1 style="${ESTILOS.titulo}">${escapeHtml(json.titulo || "Cuestionario Bíblico")}</h1>`;
  html += `<p style="text-align: center; font-style: italic; color: #757575; margin-bottom: 24px;">Responde las siguientes preguntas seleccionando la opción correcta.</p>`;

  preguntas.forEach((p, i) => {
    const preguntaTexto = p.pregunta || "Pregunta sin texto";
    html += `<div class="quiz-pregunta-card" style="${ESTILOS.card}" data-pregunta-num="${i + 1}">`;
    html += `<p style="font-weight: bold; color: #1a5276; margin-bottom: 12px; font-size: 1.05em; word-wrap: break-word;">${i + 1}. ${escapeHtml(preguntaTexto)}</p>`;
    html += `<div style="display: flex; flex-direction: column; gap: 8px;">`;

    const opciones = p.opciones || [];
    opciones.forEach((op, j) => {
      const opcionTexto = op.texto || op.text || "Opción sin texto";
      const esCorrecta = op.correcta || op.correcto || op.isCorrect || op.correct || false;
      html += `<label class="quiz-opcion-label" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid #e8e8e8; border-radius: 6px; cursor: pointer; transition: all 0.2s; word-wrap: break-word;">`;
      html += `<input type="radio" name="pregunta-${i}" value="${j}" data-correcta="${esCorrecta}" style="accent-color: #d4ac0d; width: 16px; height: 16px; flex-shrink: 0;">`;
      html += `<span style="color: #3e2723; word-wrap: break-word;">${escapeHtml(opcionTexto)}</span>`;
      html += `</label>`;
    });

    html += `</div><p class="quiz-feedback-individual" style="font-size: 0.9em; margin-top: 12px; font-weight: bold;"></p></div>`;
  });

  html += `<div style="text-align: center; margin-top: 24px;">`;
  html += `<button class="quiz-verificar" style="${ESTILOS.btn}">Verificar respuestas</button>`;
  html += `</div>`;
  html += `<div class="quiz-resultado" style="text-align: center; font-weight: bold; font-size: 1.2em; margin-top: 20px;"></div>`;

  html += `<script>
    (function() {
      const btn = document.querySelector('.quiz-verificar');
      const resultado = document.querySelector('.quiz-resultado');
      if (!btn || !resultado) return;
      btn.addEventListener('click', function() {
        let correctas = 0;
        const preguntasCards = document.querySelectorAll('.quiz-pregunta-card');
        preguntasCards.forEach((card) => {
          const seleccionada = card.querySelector('input[type="radio"]:checked');
          const feedback = card.querySelector('.quiz-feedback-individual');
          const labels = card.querySelectorAll('.quiz-opcion-label');
          labels.forEach((label) => { label.style.backgroundColor = ''; label.style.borderColor = '#e8e8e8'; });
          const esCorrectaRespuesta = seleccionada && seleccionada.getAttribute('data-correcta') === 'true';
          if (esCorrectaRespuesta) {
            correctas++;
            if (feedback) { feedback.textContent = '✅ Correcto'; feedback.style.color = '#2d6a4f'; }
            if (seleccionada) { seleccionada.closest('.quiz-opcion-label').style.backgroundColor = '#d4f4dd'; seleccionada.closest('.quiz-opcion-label').style.borderColor = '#2d6a4f'; }
          } else {
            if (feedback) { feedback.textContent = seleccionada ? '❌ Incorrecto' : '️ Sin responder'; feedback.style.color = '#c0392b'; }
            if (seleccionada) { seleccionada.closest('.quiz-opcion-label').style.backgroundColor = '#fbdcdc'; seleccionada.closest('.quiz-opcion-label').style.borderColor = '#c0392b'; }
            const correctaLabel = card.querySelector('input[data-correcta="true"]');
            if (correctaLabel) { correctaLabel.closest('.quiz-opcion-label').style.backgroundColor = '#d4f4dd'; correctaLabel.closest('.quiz-opcion-label').style.borderColor = '#2d6a4f'; }
          }
        });
        const total = preguntasCards.length;
        const porcentaje = Math.round((correctas / total) * 100);
        let mensaje = porcentaje === 100 ? '🎉 ¡Excelente! Has comprendido muy bien este pasaje.' : porcentaje >= 80 ? '🙌 Muy bien. Revisa las preguntas que fallaste.' : porcentaje >= 50 ? ' Buen intento. Te recomiendo volver a leer el capítulo.' : '💪 No te desanimes. Este es un buen momento para estudiar el capítulo con más calma.';
        resultado.innerHTML = correctas + ' de ' + total + ' correctas (' + porcentaje + '%)<br><span style="font-size: 0.8em; font-weight: normal; margin-top: 8px; display: block;">' + mensaje + '</span>';
        resultado.style.color = porcentaje === 100 ? '#2d6a4f' : porcentaje >= 50 ? '#b7950b' : '#c0392b';
      });
    })();
  </script>`;
  html += `</div>`;
  return html;
}

export function formatTablaGenerica(json, tipoLabel, columnas) {
  const items = json[columnas.dataKey] || [];
  if (items.length === 0) return `<div style="${ESTILOS.contenedor}"><p>No se encontraron datos.</p></div>`;

  let html = `<div style="${ESTILOS.contenedor}">`;
  html += `<h1 style="${ESTILOS.titulo}">${escapeHtml(json.titulo || tipoLabel)}</h1>`;
  html += `<div style="${ESTILOS.tablaContenedor}"><table style="width: 100%; border-collapse: collapse; font-family: 'Georgia', serif; font-size: 0.9em; color: #3e2723; table-layout: auto;">`;
  html += `<thead><tr>`;
  columnas.headers.forEach(h => {
    html += `<th style="${ESTILOS.tablaHeader}">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;
  
  items.forEach((item, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#fdfbf7';
    html += `<tr style="background-color: ${bgColor};">`;
    columnas.keys.forEach(k => {
      const val = item[k] || "—";
      let style = ESTILOS.tablaCelda;
      if (k.includes('referencia') || k.includes('estado')) style += ' font-weight: bold; color: #1a5276;';
      if (k.includes('texto')) style += ' font-style: italic;';
      html += `<td style="${style}">${escapeHtml(val)}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div></div>`;
  return html;
}

export function formatInfografiaDoctrinal(json) {
  const items = json.doctrinas || [];
  if (items.length === 0) return `<div style="${ESTILOS.contenedor}"><p>No se encontraron doctrinas.</p></div>`;

  let html = `<div style="${ESTILOS.contenedor}">`;
  html += `<h1 style="${ESTILOS.titulo}">${escapeHtml(json.titulo || "Infografía Doctrinal")}</h1>`;
  
  html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">`;

  items.forEach((item, index) => {
    const doctrina = escapeHtml(item.doctrina || "Doctrina");
    const fundamento = escapeHtml(item.fundamento || "");
    const desarrollo = escapeHtml(item.desarrollo || "");
    
    // details sin 'open' - se controla por JS según dispositivo
    html += `<details class="mah-details-${index}" style="background: #ffffff; border: 2px solid #d4c4a8; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">`;
    
    // Summary (frente) - SIEMPRE VISIBLE, fondo blanco, texto oscuro
    html += `<summary style="padding: 24px; text-align: center; cursor: pointer; list-style: none; background: #ffffff;">`;
    html += `<div style="font-size: 2.5em; margin-bottom: 12px;"></div>`;
    html += `<h3 style="color: #1a5276; margin: 0 0 12px 0; font-size: 1.2em; font-weight: bold; font-family: 'Georgia', serif;">${doctrina}</h3>`;
    html += `<div style="background: #fdfbf7; padding: 12px; border-radius: 6px; border-left: 4px solid #d4ac0d; font-style: italic; color: #3e2723; font-size: 0.95em; font-weight: 500;">${fundamento}</div>`;
    html += `<p class="mah-hint-${index}" style="color: #1a5276; margin-top: 16px; font-size: 0.85em; font-weight: 600;">👆 Toca para ver el desarrollo</p>`;
    html += `</summary>`;
    
    // Contenido (desarrollo) - fondo AZUL OSCURO, texto BLANCO PURO
    html += `<div style="background: #1a3a5c; padding: 20px; border-top: 3px solid #d4ac0d;">`;
    html += `<h4 style="color: #d4ac0d; margin: 0 0 12px 0; font-size: 1em; font-weight: bold; font-family: 'Georgia', serif; border-bottom: 1px solid rgba(212, 172, 13, 0.3); padding-bottom: 8px;">Desarrollo Teológico</h4>`;
    html += `<p style="color: #ffffff; line-height: 1.6; font-size: 0.95em; margin: 0; text-align: justify; font-family: 'Georgia', serif; font-weight: 400;">${desarrollo}</p>`;
    html += `</div>`;
    
    html += `</details>`;
  });

  html += `</div>`;

  // Script para controlar apertura según dispositivo
  html += `<script>
    (function() {
      function updateLayout() {
        const isMobile = window.innerWidth <= 768;
        const totalCards = ${items.length};
        
        for (let i = 0; i < totalCards; i++) {
          const details = document.querySelector('.mah-details-' + i);
          const hint = document.querySelector('.mah-hint-' + i);
          
          if (!details || !hint) continue;
          
          if (isMobile) {
            // MÓVIL: Cerrado por defecto, mostrar hint
            details.removeAttribute('open');
            hint.style.display = 'block';
          } else {
            // PC: Abierto por defecto, ocultar hint
            details.setAttribute('open', '');
            hint.style.display = 'none';
          }
        }
      }
      
      updateLayout();
      window.addEventListener('resize', updateLayout);
    })();
  </script>`;

  html += `</div>`;
  return html;
}

export function formatCitasHtml(json, tipoLabel) {
  const citas = json.citas || [];
  if (citas.length === 0) return `<div style="${ESTILOS.contenedor}"><p>No se encontraron citas.</p></div>`;
  let html = `<div style="${ESTILOS.contenedor}">`;
  html += `<h1 style="${ESTILOS.titulo}">${escapeHtml(json.titulo || tipoLabel)}</h1>`;
  citas.forEach((c) => {
    html += `<div style="${ESTILOS.card}">`;
    html += `<h4 style="${ESTILOS.cardTitulo}"><strong>${escapeHtml(c.autor || "")}</strong>${c.obra ? ` — <em style="color: #757575;">${escapeHtml(c.obra)}</em>` : ""}${c.titulo_libro ? ` — <em style="color: #757575;">${escapeHtml(c.titulo_libro)}</em>` : ""}</h4>`;
    html += `<p style="font-style: italic; color: #3e2723; line-height: 1.6; border-left: 3px solid #d4ac0d; padding-left: 12px; margin: 0; word-wrap: break-word;">"${escapeHtml(c.cita)}"</p>`;
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

export function formatPalabrasClaveHtml(json) {
  const terminos = json.terminos || [];
  if (terminos.length === 0) return `<div style="${ESTILOS.contenedor}"><p>No se generaron términos.</p></div>`;
  let html = `<div style="${ESTILOS.contenedor}">`;
  html += `<h1 style="${ESTILOS.titulo}">${escapeHtml(json.titulo || "Estudio de Palabras Clave")}</h1>`;
  terminos.forEach((t) => {
    html += `<div style="${ESTILOS.card}">`;
    html += `<h4 style="${ESTILOS.cardTitulo}">`;
    html += `<span style="font-size: 1.2em; color: #1a3a5c; word-wrap: break-word;">${escapeHtml(t.termino_original)}</span> — <span style="font-style: italic;">${escapeHtml(t.transliteracion)}</span>`;
    if (t.strong && t.strong !== "No disponible") {
      html += `<span style="float: right; font-size: 0.75em; background: #1a3a5c; color: #d4ac0d; padding: 2px 8px; border-radius: 12px;">Strong ${escapeHtml(t.strong)}</span>`;
    }
    html += `</h4>`;
    html += `<p style="margin-bottom: 8px; word-wrap: break-word;"><strong style="color: #1a5276;">Significado:</strong> ${escapeHtml(t.significado)}</p>`;
    html += `<p style="margin: 0; word-wrap: break-word;"><strong style="color: #1a5276;">Contexto:</strong> ${escapeHtml(t.contexto)}</p>`;
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

export function formatearRecurso(tipo, datos) {
  if (!datos) return "<p>Error: No se recibieron datos.</p>";

  if (datos.contenido_html) {
    return limpiarHtml(datos.contenido_html);
  }

  switch (tipo) {
    case "quiz":
      return formatQuizInteractivo(datos);
    
    case "paralelos":
      return formatTablaGenerica(datos, "Paralelos Bíblicos", {
        dataKey: "paralelos",
        headers: ["Referencia", "Cita bíblica", "Conexión"],
        keys: ["referencia", "texto_cita", "explicacion"]
      });

    case "palabras_clave":
    case "glosario":
      return formatPalabrasClaveHtml(datos);

    case "infografia":
     return formatInfografiaDoctrinal(datos);  // <-- NUEVO CASO  

    case "profecias":
      return formatTablaGenerica(datos, "Profecías", {
        dataKey: "profecias",
        headers: ["Profecía", "Ref. Profecía", "Estado", "Cumplimiento", "Explicación"],
        keys: ["profecia", "referencia_profecia", "estado", "referencia_cumplimiento", "explicacion"]
      });

    case "citas_teologos":
    case "citas_libros":
      return formatCitasHtml(datos, datos.titulo || "Citas");

    case "conexion_at":
    case "conexion_nt":
      const refKey = tipo === "conexion_at" ? "referencia_at" : "referencia_nt";
      return formatTablaGenerica(datos, datos.titulo || "Conexiones", {
        dataKey: "conexiones",
        headers: ["Referencia", "Texto", "Explicación"],
        keys: [refKey, "texto_cita", "explicacion"]
      });

    default:
      return `<div style="${ESTILOS.contenedor}"><pre style="white-space: pre-wrap; font-family: monospace; word-wrap: break-word; overflow-wrap: break-word;">${escapeHtml(JSON.stringify(datos, null, 2))}</pre></div>`;
  }
}
