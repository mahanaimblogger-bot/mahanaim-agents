/**
 * Formateadores de recursos a HTML con diseño Mahanaim
 */
export function formatearRecurso(tipo, datos) {
  if (!datos) return '<p>Error: No hay datos para mostrar</p>';

  // ============================================================
  // RECURSO #9: ILUSTRACIONES HOMILÉTICAS (DISEÑO PREMIUM)
  // ============================================================
  if (tipo === 'ilustraciones') {
    let html = `
<div class="recurso-ilustraciones" style="
  font-family: 'Georgia', 'Times New Roman', serif;
  max-width: 900px;
  margin: 40px auto;
  padding: 0 20px;
">
  
  <div style="
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px;
    border-radius: 12px;
    text-align: center;
    margin-bottom: 40px;
    box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
  ">
    <div style="font-size: 3em; margin-bottom: 10px;"></div>
    <h2 style="
      margin: 0;
      font-size: 2em;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    ">Ilustraciones Homiléticas</h2>
    <p style="margin: 10px 0 0 0; opacity: 0.9; font-style: italic;">
      ${datos.titulo || ''}
    </p>
  </div>

  ${!datos.ilustraciones || datos.ilustraciones.length === 0 ? `
    <div style="
      background: #f8f9fa;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      color: #6c757d;
      font-style: italic;
      border-left: 4px solid #dee2e6;
    ">
      <p style="margin: 0; font-size: 1.1em;">No se encontraron ilustraciones específicas en la base de datos para este pasaje.</p>
    </div>
  ` : ''}

  ${datos.ilustraciones ? datos.ilustraciones.map((ilus, index) => `
    <div class="ilustracion-item" style="
      background: white;
      margin-bottom: 40px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 5px 20px rgba(0,0,0,0.08);
      border: 1px solid #e9ecef;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    " onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 8px 30px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 5px 20px rgba(0,0,0,0.08)'">
      
      <!-- Header de la ilustración -->
      <div style="
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        padding: 25px 30px;
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 20px;
          right: 30px;
          background: rgba(255,255,255,0.2);
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 0.85em;
          font-weight: 600;
          backdrop-filter: blur(10px);
        ">
          💡 Ilustración ${index + 1}
        </div>
        <h3 style="
          margin: 0 60px 0 0;
          font-size: 1.6em;
          font-weight: 700;
          line-height: 1.3;
        ">${ilus.titulo_ilustracion || 'Ilustración'}</h3>
        ${ilus.fuente && ilus.fuente !== 'Desconocida' ? `
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 0.95em;">
            📚 Fuente: <strong>${ilus.fuente}</strong>
          </p>
        ` : ''}
      </div>

      <!-- Contenido de la ilustración -->
      <div style="padding: 30px;">
        <div style="
          background: linear-gradient(to right, #fff9e6, #fff);
          border-left: 5px solid #f5576c;
          padding: 25px;
          border-radius: 0 8px 8px 0;
          margin-bottom: 25px;
          font-style: italic;
          line-height: 1.8;
          color: #495057;
          position: relative;
        ">
          <div style="
            position: absolute;
            top: -10px;
            left: 10px;
            background: #f5576c;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
          ">"</div>
          <p style="margin: 10px 0 0 0; font-size: 1.05em;">${ilus.contenido_ilustracion || ''}</p>
          <div style="
            position: absolute;
            bottom: -10px;
            right: 10px;
            background: #f5576c;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
          ">"</div>
        </div>

        <!-- Conexión Homilética -->
        <div style="
          background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
          padding: 25px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 2px solid #ff9a76;
        ">
          <h4 style="
            margin: 0 0 15px 0;
            color: #d63031;
            font-size: 1.2em;
            display: flex;
            align-items: center;
            gap: 10px;
          ">
            <span style="font-size: 1.3em;">✝️</span>
            Conexión Homilética
          </h4>
          <p style="margin: 0; line-height: 1.8; color: #2d3436; font-size: 1.05em;">
            ${ilus.conexion_homiletica || ''}
          </p>
        </div>

        <!-- Aplicación Práctica -->
        <div style="
          background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
          padding: 25px;
          border-radius: 8px;
          border: 2px solid #00b894;
        ">
          <h4 style="
            margin: 0 0 15px 0;
            color: #00b894;
            font-size: 1.2em;
            display: flex;
            align-items: center;
            gap: 10px;
          ">
            <span style="font-size: 1.3em;">🚀</span>
            Aplicación Práctica
          </h4>
          <p style="margin: 0; line-height: 1.8; color: #2d3436; font-size: 1.05em;">
            ${ilus.aplicacion_practica || ''}
          </p>
        </div>
      </div>
    </div>
  `).join('') : ''}

  <!-- Footer -->
  <div style="
    text-align: center;
    padding: 30px;
    color: #6c757d;
    font-style: italic;
    border-top: 2px dashed #dee2e6;
    margin-top: 40px;
  ">
    <p style="margin: 0;">Ilustraciones extraídas de nuestra base de datos homilética</p>
  </div>
</div>`;

    return html;
  }

  // ============================================================
  // LOS DEMÁS RECURSOS (sermon, bosquejo, etc.) se mantienen igual
  // ============================================================
  
  // ... (aquí va el resto de tu código de formateadores existente)
  
  return '<p>Recurso no disponible</p>';
}
