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
  html += `<div id="mah-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">`;

  items.forEach((item, index) => {
    const doctrina  = escapeHtml(item.doctrina  || "Doctrina");
    const fundamento = escapeHtml(item.fundamento || "");
    const desarrollo = escapeHtml(item.desarrollo || "");

    html += `<div id="mah-card-${index}" style="background:#ffffff;border:2px solid #d4c4a8;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;

    // FRENTE — siempre visible
    html += `<div style="padding:24px;text-align:center;">`;
    html += `<div style="font-size:2.5em;margin-bottom:12px;"></div>`;
    html += `<h3 style="color:#1a5276;margin:0 0 12px 0;font-size:1.2em;font-weight:bold;font-family:Georgia,serif;">${doctrina}</h3>`;
    html += `<div style="background:#fdfbf7;padding:12px;border-radius:6px;border-left:4px solid #d4ac0d;font-style:italic;color:#3e2723;font-size:0.95em;font-weight:500;">${fundamento}</div>`;

    // Botón toggle — solo visible en móvil, texto cambia según estado
    html += `<button id="mah-btn-${index}" style="color:#1a5276;margin-top:16px;font-size:0.85em;font-weight:600;cursor:pointer;background:none;border:none;font-family:Georgia,serif;display:none;" aria-expanded="false">👆 Toca para ver el desarrollo</button>`;
    html += `</div>`;

    // DESARROLLO — oculto en móvil por defecto, siempre visible en PC
    html += `<div id="mah-dev-${index}" style="background:#1a3a5c;padding:20px;border-top:3px solid #d4ac0d;display:none;">`;
    html += `<h4 style="color:#d4ac0d;margin:0 0 12px 0;font-size:1em;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(212,172,13,0.3);padding-bottom:8px;">Desarrollo Teológico</h4>`;
    html += `<p style="color:#ffffff;line-height:1.6;font-size:0.95em;margin:0;text-align:justify;font-family:Georgia,serif;">${desarrollo}</p>`;
    html += `</div>`;

    html += `</div>`;
  });

  html += `</div>`;

  html += `<script>
  (function() {
    const total = ${items.length};
    let openIndex = -1;
    let currentMode = null;

    function cerrar(i) {
      const btn = document.getElementById('mah-btn-' + i);
      const dev = document.getElementById('mah-dev-' + i);
      if (!btn || !dev) return;
      dev.style.display = 'none';
      btn.textContent = '👆 Toca para ver el desarrollo';
      btn.setAttribute('aria-expanded', 'false');
      openIndex = -1;
    }

    function abrir(i) {
      const btn = document.getElementById('mah-btn-' + i);
      const dev = document.getElementById('mah-dev-' + i);
      if (!btn || !dev) return;
      dev.style.display = 'block';
      btn.textContent = '🔼 Toca para ocultar';
      btn.setAttribute('aria-expanded', 'true');
      openIndex = i;
    }

    function inicializarListeners() {
      for (let i = 0; i < total; i++) {
        const btn = document.getElementById('mah-btn-' + i);
        if (!btn || btn.dataset.mahInit) continue;
        btn.dataset.mahInit = '1';
        btn.addEventListener('click', function() {
          const idx = parseInt(this.id.replace('mah-btn-', ''));
          if (openIndex === idx) {
            cerrar(idx);
          } else {
            if (openIndex !== -1) cerrar(openIndex);
            abrir(idx);
          }
        });
      }
    }

    function aplicarModo(isMobile) {
      const modo = isMobile ? 'mobile' : 'desktop';
      if (currentMode === modo) return;
      currentMode = modo;

      for (let i = 0; i < total; i++) {
        const btn = document.getElementById('mah-btn-' + i);
        const dev = document.getElementById('mah-dev-' + i);
        if (!btn || !dev) continue;

        if (isMobile) {
          btn.style.display = 'block';
          dev.style.display = 'none';
          btn.textContent = '👆 Toca para ver el desarrollo';
          btn.setAttribute('aria-expanded', 'false');
          openIndex = -1;
        } else {
          dev.style.display = 'block';
          btn.style.display = 'none';
          btn.setAttribute('aria-expanded', 'true');
          openIndex = -1;
        }
      }
    }

    let resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        aplicarModo(window.innerWidth <= 768);
      }, 150);
    }

    inicializarListeners();
    aplicarModo(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
  })();
  </script>`;

  html += `</div>`;
  return html;
}

export function formatParalelosCards(json) {
  const items = json.paralelos || [];
  if (items.length === 0) return `<div style="${ESTILOS.contenedor}"><p>No se encontraron paralelos.</p></div>`;

  let html = `<div style="${ESTILOS.contenedor}">`;
  html += `<h1 style="${ESTILOS.titulo}">${escapeHtml(json.titulo || "Paralelos Bíblicos")}</h1>`;
  html += `<div id="par-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:20px;">`;

  items.forEach((item, index) => {
    const referencia = escapeHtml(item.referencia || "");
    const texto = escapeHtml(item.texto_cita || "");
    const explicacion = escapeHtml(item.explicacion || "");

    html += `<div style="background:#ffffff;border:2px solid #d4c4a8;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;
    html += `<div style="padding:20px;">`;
    html += `<div style="font-size:1.8em;margin-bottom:8px;"></div>`;
    html += `<h3 style="color:#1a5276;margin:0 0 12px 0;font-size:1.1em;font-weight:bold;font-family:Georgia,serif;">${referencia}</h3>`;
    html += `<p style="font-style:italic;color:#3e2723;margin:0 0 12px 0;line-height:1.5;">"${texto}"</p>`;
    html += `<button id="par-btn-${index}" style="color:#1a5276;font-size:0.85em;font-weight:600;cursor:pointer;background:none;border:none;font-family:Georgia,serif;display:none;"> Ver conexión</button>`;
    html += `</div>`;
    html += `<div id="par-exp-${index}" style="background:#1a3a5c;padding:20px;border-top:3px solid #d4ac0d;display:none;">`;
    html += `<h4 style="color:#d4ac0d;margin:0 0 12px 0;font-size:1em;font-weight:bold;font-family:Georgia,serif;">Conexión Teológica</h4>`;
    html += `<p style="color:#ffffff;line-height:1.6;font-size:0.95em;margin:0;">${explicacion}</p>`;
    html += `</div></div>`;
  });

  html += `</div>`;
  html += `<script>
  (function(){const t=${items.length};let o=-1,m=null;
  function c(i){const b=document.getElementById('par-btn-'+i),e=document.getElementById('par-exp-'+i);if(!b||!e)return;e.style.display='none';b.textContent='👆 Ver conexión';b.setAttribute('aria-expanded','false');o=-1;}
  function a(i){const b=document.getElementById('par-btn-'+i),e=document.getElementById('par-exp-'+i);if(!b||!e)return;e.style.display='block';b.textContent='🔼 Ocultar';b.setAttribute('aria-expanded','true');o=i;}
  function init(){for(let i=0;i<t;i++){const b=document.getElementById('par-btn-'+i);if(!b||b.dataset.mahInit)continue;b.dataset.mahInit='1';b.addEventListener('click',function(){const idx=parseInt(this.id.replace('par-btn-',''));if(o===idx)c(idx);else{if(o!==-1)c(o);a(idx);}});}}
  function mode(mob){const md=mob?'mobile':'desktop';if(m===md)return;m=md;for(let i=0;i<t;i++){const b=document.getElementById('par-btn-'+i),e=document.getElementById('par-exp-'+i);if(!b||!e)continue;if(mob){b.style.display='block';e.style.display='none';b.textContent='👆 Ver conexión';o=-1;}else{e.style.display='block';b.style.display='none';o=-1;}}}
  let rt;function onR(){clearTimeout(rt);rt=setTimeout(()=>mode(window.innerWidth<=768),150);}
  init();mode(window.innerWidth<=768);window.addEventListener('resize',onR);})();
  </script></div>`;
  return html;
}

export function formatProfeciasCards(json) {
  const items = json.profecias || [];
  if (items.length === 0) return `<div style="${ESTILOS.contenedor}"><p>No se encontraron profecías.</p></div>`;

  let html = `<div style="${ESTILOS.contenedor}">`;
  html += `<h1 style="${ESTILOS.titulo}">${escapeHtml(json.titulo || "Profecías")}</h1>`;
  html += `<div id="prof-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:20px;">`;

  items.forEach((item, index) => {
    const profecia = escapeHtml(item.profecia || "");
    const refProf = escapeHtml(item.referencia_profecia || "");
    const estado = escapeHtml(item.estado || "");
    const refCumpl = escapeHtml(item.referencia_cumplimiento || "");
    const explicacion = escapeHtml(item.explicacion || "");

    const colorEstado = estado.includes('Cumplida') ? '#2d6a4f' : estado.includes('Parcial') ? '#b7950b' : '#c0392b';

    html += `<div style="background:#ffffff;border:2px solid #d4c4a8;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;
    html += `<div style="padding:20px;">`;
    html += `<div style="font-size:1.8em;margin-bottom:8px;">🔮</div>`;
    html += `<h3 style="color:#1a5276;margin:0 0 8px 0;font-size:1.05em;font-weight:bold;font-family:Georgia,serif;">${profecia}</h3>`;
    html += `<p style="color:#1a5276;margin:0 0 6px 0;font-size:0.9em;font-weight:600;">📍 ${refProf}</p>`;
    html += `<span style="display:inline-block;background:${colorEstado};color:#fff;padding:4px 10px;border-radius:12px;font-size:0.8em;font-weight:600;margin-bottom:12px;">${estado}</span>`;
    html += `<button id="prof-btn-${index}" style="color:#1a5276;margin-top:12px;font-size:0.85em;font-weight:600;cursor:pointer;background:none;border:none;font-family:Georgia,serif;display:none;">👆 Ver cumplimiento</button>`;
    html += `</div>`;
    html += `<div id="prof-exp-${index}" style="background:#1a3a5c;padding:20px;border-top:3px solid #d4ac0d;display:none;">`;
    html += `<p style="color:#d4ac0d;margin:0 0 8px 0;font-size:0.9em;"><strong>Cumplimiento:</strong> ${refCumpl}</p>`;
    html += `<p style="color:#ffffff;line-height:1.6;font-size:0.95em;margin:0;">${explicacion}</p>`;
    html += `</div></div>`;
  });

  html += `</div>`;
  html += `<script>
  (function(){const t=${items.length};let o=-1,m=null;
  function c(i){const b=document.getElementById('prof-btn-'+i),e=document.getElementById('prof-exp-'+i);if(!b||!e)return;e.style.display='none';b.textContent=' Ver cumplimiento';o=-1;}
  function a(i){const b=document.getElementById('prof-btn-'+i),e=document.getElementById('prof-exp-'+i);if(!b||!e)return;e.style.display='block';b.textContent='🔼 Ocultar';o=i;}
  function init(){for(let i=0;i<t;i++){const b=document.getElementById('prof-btn-'+i);if(!b||b.dataset.mahInit)continue;b.dataset.mahInit='1';b.addEventListener('click',function(){const idx=parseInt(this.id.replace('prof-btn-',''));if(o===idx)c(idx);else{if(o!==-1)c(o);a(idx);}});}}
  function mode(mob){const md=mob?'mobile':'desktop';if(m===md)return;m=md;for(let i=0;i<t;i++){const b=document.getElementById('prof-btn-'+i),e=document.getElementById('prof-exp-'+i);if(!b||!e)continue;if(mob){b.style.display='block';e.style.display='none';}else{e.style.display='block';b.style.display='none';o=-1;}}}
  let rt;function onR(){clearTimeout(rt);rt=setTimeout(()=>mode(window.innerWidth<=768),150);}
  init();mode(window.innerWidth<=768);window.addEventListener('resize',onR);})();
  </script></div>`;
  return html;
}

export function formatConexionesCards(json, tipo) {
  const items = json.conexiones || [];
  if (items.length === 0) return `<div style="${ESTILOS.contenedor}"><p>No se encontraron conexiones.</p></div>`;
  
  const titulo = tipo === 'conexion_at' ? 'Conexión con el Antiguo Testamento' : 'Conexión con el Nuevo Testamento';
  const emoji = tipo === 'conexion_at' ? '📜' : '✝️';
  const refKey = tipo === 'conexion_at' ? 'referencia_at' : 'referencia_nt';

  let html = `<div style="${ESTILOS.contenedor}">`;
  html += `<h1 style="${ESTILOS.titulo}">${escapeHtml(json.titulo || titulo)}</h1>`;
  html += `<div id="con-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:20px;">`;

  items.forEach((item, index) => {
    const referencia = escapeHtml(item[refKey] || "");
    const texto = escapeHtml(item.texto_cita || "");
    const explicacion = escapeHtml(item.explicacion || "");

    html += `<div style="background:#ffffff;border:2px solid #d4c4a8;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;
    html += `<div style="padding:20px;">`;
    html += `<div style="font-size:1.8em;margin-bottom:8px;">${emoji}</div>`;
    html += `<h3 style="color:#1a5276;margin:0 0 12px 0;font-size:1.1em;font-weight:bold;font-family:Georgia,serif;">${referencia}</h3>`;
    html += `<p style="font-style:italic;color:#3e2723;margin:0 0 12px 0;line-height:1.5;">"${texto}"</p>`;
    html += `<button id="con-btn-${index}" style="color:#1a5276;font-size:0.85em;font-weight:600;cursor:pointer;background:none;border:none;font-family:Georgia,serif;display:none;">👆 Ver explicación</button>`;
    html += `</div>`;
    html += `<div id="con-exp-${index}" style="background:#1a3a5c;padding:20px;border-top:3px solid #d4ac0d;display:none;">`;
    html += `<h4 style="color:#d4ac0d;margin:0 0 12px 0;font-size:1em;font-weight:bold;font-family:Georgia,serif;">Conexión</h4>`;
    html += `<p style="color:#ffffff;line-height:1.6;font-size:0.95em;margin:0;">${explicacion}</p>`;
    html += `</div></div>`;
  });

  html += `</div>`;
  html += `<script>
  (function(){const t=${items.length};let o=-1,m=null;
  function c(i){const b=document.getElementById('con-btn-'+i),e=document.getElementById('con-exp-'+i);if(!b||!e)return;e.style.display='none';b.textContent='👆 Ver explicación';o=-1;}
  function a(i){const b=document.getElementById('con-btn-'+i),e=document.getElementById('con-exp-'+i);if(!b||!e)return;e.style.display='block';b.textContent='🔼 Ocultar';o=i;}
  function init(){for(let i=0;i<t;i++){const b=document.getElementById('con-btn-'+i);if(!b||b.dataset.mahInit)continue;b.dataset.mahInit='1';b.addEventListener('click',function(){const idx=parseInt(this.id.replace('con-btn-',''));if(o===idx)c(idx);else{if(o!==-1)c(o);a(idx);}});}}
  function mode(mob){const md=mob?'mobile':'desktop';if(m===md)return;m=md;for(let i=0;i<t;i++){const b=document.getElementById('con-btn-'+i),e=document.getElementById('con-exp-'+i);if(!b||!e)continue;if(mob){b.style.display='block';e.style.display='none';}else{e.style.display='block';b.style.display='none';o=-1;}}}
  let rt;function onR(){clearTimeout(rt);rt=setTimeout(()=>mode(window.innerWidth<=768),150);}
  init();mode(window.innerWidth<=768);window.addEventListener('resize',onR);})();
  </script></div>`;
  return html;
}

export function formatCronologiaCards(json) {
  const items = json.cronologia || [];
  if (items.length === 0) return `<div style="${ESTILOS.contenedor}"><p>No hay eventos cronológicos.</p></div>`;

  let html = `<div style="${ESTILOS.contenedor}">`;
  html += `<h1 style="${ESTILOS.titulo}">${escapeHtml(json.titulo || "Cronología del Capítulo")}</h1>`;
  html += `<div id="cron-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:20px;">`;

  items.forEach((item, index) => {
    const evento = escapeHtml(item.evento || "");
    const referencia = escapeHtml(item.referencia || "");
    const detalles = escapeHtml(item.detalles || "");

    html += `<div style="background:#ffffff;border:2px solid #d4c4a8;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;
    html += `<div style="padding:20px;">`;
    html += `<div style="font-size:1.8em;margin-bottom:8px;">⏱️</div>`;
    html += `<h3 style="color:#1a5276;margin:0 0 8px 0;font-size:1.05em;font-weight:bold;font-family:Georgia,serif;">${evento}</h3>`;
    html += `<p style="color:#1a5276;margin:0 0 12px 0;font-size:0.9em;font-weight:600;">📍 ${referencia}</p>`;
    html += `<button id="cron-btn-${index}" style="color:#1a5276;font-size:0.85em;font-weight:600;cursor:pointer;background:none;border:none;font-family:Georgia,serif;display:none;">👆 Ver detalles</button>`;
    html += `</div>`;
    html += `<div id="cron-exp-${index}" style="background:#1a3a5c;padding:20px;border-top:3px solid #d4ac0d;display:none;">`;
    html += `<p style="color:#ffffff;line-height:1.6;font-size:0.95em;margin:0;">${detalles}</p>`;
    html += `</div></div>`;
  });

  html += `</div>`;
  html += `<script>
  (function(){const t=${items.length};let o=-1,m=null;
  function c(i){const b=document.getElementById('cron-btn-'+i),e=document.getElementById('cron-exp-'+i);if(!b||!e)return;e.style.display='none';b.textContent='👆 Ver detalles';o=-1;}
  function a(i){const b=document.getElementById('cron-btn-'+i),e=document.getElementById('cron-exp-'+i);if(!b||!e)return;e.style.display='block';b.textContent=' Ocultar';o=i;}
  function init(){for(let i=0;i<t;i++){const b=document.getElementById('cron-btn-'+i);if(!b||b.dataset.mahInit)continue;b.dataset.mahInit='1';b.addEventListener('click',function(){const idx=parseInt(this.id.replace('cron-btn-',''));if(o===idx)c(idx);else{if(o!==-1)c(o);a(idx);}});}}
  function mode(mob){const md=mob?'mobile':'desktop';if(m===md)return;m=md;for(let i=0;i<t;i++){const b=document.getElementById('cron-btn-'+i),e=document.getElementById('cron-exp-'+i);if(!b||!e)continue;if(mob){b.style.display='block';e.style.display='none';}else{e.style.display='block';b.style.display='none';o=-1;}}}
  let rt;function onR(){clearTimeout(rt);rt=setTimeout(()=>mode(window.innerWidth<=768),150);}
  init();mode(window.innerWidth<=768);window.addEventListener('resize',onR);})();
  </script></div>`;
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
