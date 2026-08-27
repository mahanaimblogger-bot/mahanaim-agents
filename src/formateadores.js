/**
 * Módulo de formateo para convertir JSON de IA en HTML estilizado.
 * Basado en las funciones de AsistenteModal.jsx para mantener consistencia visual.
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
  return html
    .replace(/```json|```/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\n/g, '\n')
    .trim();
}

export function formatQuizInteractivo(json) {
  const preguntas = json.preguntas || [];
  if (preguntas.length === 0) return `<div class="contenedor-blog"><p>No se generaron preguntas.</p></div>`;

  let html = `<div class="contenedor-blog">`;
  html += `<h1 class="titulo-entrada">${escapeHtml(json.titulo || "Cuestionario Bíblico")}</h1>`;
  html += `<p class="text-[#5d4037] italic text-center mb-6">Responde las siguientes preguntas seleccionando la opción correcta.</p>`;

  preguntas.forEach((p, i) => {
    const preguntaTexto = p.pregunta || "Pregunta sin texto";
    html += `<div class="quiz-pregunta-card bg-[#fdfbf7] p-4 rounded shadow-sm border border-[#d4c4a8] mb-4" data-pregunta-num="${i + 1}">`;
    html += `<p class="font-bold text-[#1a5276] mb-3">${i + 1}. ${escapeHtml(preguntaTexto)}</p>`;
    html += `<div class="space-y-2">`;

    const opciones = p.opciones || [];
    opciones.forEach((op, j) => {
      const opcionTexto = op.texto || op.text || "Opción sin texto";
      const esCorrecta = op.correcta || op.correcto || op.isCorrect || op.correct || false;
      html += `<label class="flex items-center gap-3 cursor-pointer p-2 hover:bg-[#fef9e6] rounded transition quiz-opcion-label">`;
      html += `<input type="radio" name="pregunta-${i}" value="${j}" data-correcta="${esCorrecta}" class="w-4 h-4 text-[#d4ac0d]">`;
      html += `<span class="text-gray-700">${escapeHtml(opcionTexto)}</span>`;
      html += `</label>`;
    });

    html += `</div><p class="quiz-feedback-individual text-sm mt-2 font-semibold"></p></div>`;
  });

  html += `<div class="text-center mt-6">`;
  html += `<button class="quiz-verificar bg-[#1a3a5c] hover:bg-[#2d5a3d] text-[#d4ac0d] font-bold py-2 px-6 rounded border border-[#d4ac0d] transition cursor-pointer">Verificar respuestas</button>`;
  html += `</div>`;
  html += `<div class="quiz-resultado mt-4 text-center font-bold text-lg"></div>`;

  html += `<script>
    (function() {
      const btn = document.querySelector('.quiz-verificar');
      const resultado = document.querySelector('.quiz-resultado');
      if (!btn || !resultado) return;
      btn.addEventListener('click', function() {
        let correctas = 0;
        const aciertos = [];
        const fallos = [];
        const preguntasCards = document.querySelectorAll('.quiz-pregunta-card');

        preguntasCards.forEach((card) => {
          const numPregunta = card.getAttribute('data-pregunta-num');
          const seleccionada = card.querySelector('input[type="radio"]:checked');
          const feedback = card.querySelector('.quiz-feedback-individual');
          const labels = card.querySelectorAll('.quiz-opcion-label');

          labels.forEach((label) => { label.style.backgroundColor = ''; label.style.borderRadius = '6px'; });

          const esCorrectaRespuesta = seleccionada && seleccionada.getAttribute('data-correcta') === 'true';

          if (esCorrectaRespuesta) {
            correctas++; aciertos.push(numPregunta);
            if (feedback) { feedback.textContent = '✅ Correcto'; feedback.style.color = '#2d6a4f'; }
            if (seleccionada) seleccionada.closest('.quiz-opcion-label').style.backgroundColor = '#d4f4dd';
          } else {
            fallos.push(numPregunta);
            if (feedback) { feedback.textContent = seleccionada ? ' Incorrecto' : '⚠️ Sin responder'; feedback.style.color = '#c0392b'; }
            if (seleccionada) seleccionada.closest('.quiz-opcion-label').style.backgroundColor = '#fbdcdc';
            const correctaLabel = card.querySelector('input[data-correcta="true"]');
            if (correctaLabel) correctaLabel.closest('.quiz-opcion-label').style.backgroundColor = '#d4f4dd';
          }
        });

        const total = preguntasCards.length;
        const porcentaje = Math.round((correctas / total) * 100);
        let mensaje = porcentaje === 100 ? '🎉 ¡Excelente!' : porcentaje >= 80 ? '🙌 Muy bien.' : porcentaje >= 50 ? '📖 Buen intento.' : '💪 No te desanimes.';
        
        resultado.innerHTML = correctas + ' de ' + total + ' correctas (' + porcentaje + '%)<br><span class="text-sm block mt-2">' + mensaje + '</span>';
        resultado.style.color = porcentaje === 100 ? '#2d6a4f' : porcentaje >= 50 ? '#b7950b' : '#c0392b';
        resultado.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    })();
  </script>`;
  html += `</div>`;
  return html;
}

export function formatTablaGenerica(json, tipoLabel, columnas) {
  const items = json[columnas.dataKey] || [];
  if (items.length === 0) return `<div class="contenedor-blog"><p>No se encontraron datos.</p></div>`;

  let html = `<div class="contenedor-blog">`;
  html += `<h1 class="titulo-entrada">${escapeHtml(json.titulo || tipoLabel)}</h1>`;
  html += `<div class="tabla-comparativa"><table style="width:100%; border-collapse:collapse; font-size:0.9em; color:#3e2723; font-family:Georgia,serif;">`;
  html += `<thead><tr>`;
  columnas.headers.forEach(h => {
    html += `<th style="background:#1a3a5c; color:#d4ac0d; padding:8px 10px; text-align:left; font-weight:bold; font-size:0.85em; border:1px solid #3e5a7a;">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;
  
  items.forEach(item => {
    html += `<tr>`;
    columnas.keys.forEach(k => {
      const val = item[k] || "—";
      const style = k.includes('referencia') || k.includes('estado') ? 'font-weight:bold;' : k.includes('texto') ? 'font-style:italic;' : '';
      html += `<td style="padding:6px 8px; border:1px solid #d4c4a8; vertical-align:top; font-size:0.85em; ${style}">${escapeHtml(val)}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div></div>`;
  return html;
}

export function formatCitasHtml(json, tipoLabel) {
  const citas = json.citas || [];
  if (citas.length === 0) return `<div class="contenedor-blog"><p>No se encontraron citas.</p></div>`;
  let html = `<div class="contenedor-blog">`;
  html += `<h1 class="titulo-entrada">${escapeHtml(json.titulo || tipoLabel)}</h1>`;
  citas.forEach((c) => {
    html += `<div class="caja-linguistica" style="margin-bottom:16px; padding: 15px; background: #fdfbf7; border-left: 4px solid #d4ac0d;">`;
    html += `<p><strong>${escapeHtml(c.autor || "")}</strong>${c.obra ? ` — <em>${escapeHtml(c.obra)}</em>` : ""}${c.titulo_libro ? ` — <em>${escapeHtml(c.titulo_libro)}</em>` : ""}</p>`;
    html += `<p style="margin-top:6px; font-style: italic;">“${escapeHtml(c.cita)}”</p>`;
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

export function formatPalabrasClaveHtml(json) {
  const terminos = json.terminos || [];
  if (terminos.length === 0) return `<div class="contenedor-blog"><p>No se generaron términos.</p></div>`;
  let html = `<div class="contenedor-blog">`;
  html += `<h1 class="titulo-entrada">${escapeHtml(json.titulo || "Estudio de Palabras Clave")}</h1>`;
  terminos.forEach((t) => {
    html += `<div class="caja-linguistica" style="margin-bottom: 18px; padding: 15px; background: #fdfbf7; border-left: 4px solid #1a5276;">`;
    html += `<h4 style="color:#1a5276;">`;
    html += `<span class="palabra-original" style="font-size: 1.2em;">${escapeHtml(t.termino_original)}</span> — ${escapeHtml(t.transliteracion)}`;
    if (t.strong && t.strong !== "No disponible") {
      html += `<span style="margin-left: 20px; font-size: 0.75em; background: #1a3a5c; color: #d4ac0d; padding: 2px 8px; border-radius: 10px;">Strong ${escapeHtml(t.strong)}</span>`;
    }
    html += `</h4>`;
    html += `<p><strong>Significado:</strong> ${escapeHtml(t.significado)}</p>`;
    html += `<p><strong>Contexto:</strong> ${escapeHtml(t.contexto)}</p>`;
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

/**
 * Función principal que decide cómo formatear cada recurso.
 */
export function formatearRecurso(tipo, datos) {
  if (!datos) return "<p>Error: No se recibieron datos.</p>";

  // 1. Si el recurso ya trae el HTML listo en contenido_html, solo lo limpiamos
  if (datos.contenido_html) {
    return limpiarHtml(datos.contenido_html);
  }

  // 2. Si es un recurso estructurado (arrays), lo convertimos a HTML
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
      return formatPalabrasClaveHtml(datos);

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
      // Maneja tanto referencias del AT como del NT dinámicamente
      const refKey = tipo === "conexion_at" ? "referencia_at" : "referencia_nt";
      return formatTablaGenerica(datos, datos.titulo || "Conexiones", {
        dataKey: "conexiones",
        headers: ["Referencia", "Texto", "Explicación"],
        keys: [refKey, "texto_cita", "explicacion"]
      });

    default:
      // Fallback: si no hay contenido_html y no hay formatter específico, devuelve el JSON limpio como texto
      return `<div class="contenedor-blog"><pre>${escapeHtml(JSON.stringify(datos, null, 2))}</pre></div>`;
  }
}
