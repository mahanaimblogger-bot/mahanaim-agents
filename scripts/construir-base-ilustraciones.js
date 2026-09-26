import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// Esta es la forma segura de importar paquetes antiguos en Node.js moderno (ESM)
const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.default || pdfParseModule;
// ============================================================
// CONFIGURACIÓN
// ============================================================
const INPUT_DIR = './recursos_base';
const OUTPUT_FILE = './ilustraciones.json';
const LLM_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';

// ============================================================
// FUNCIONES PRINCIPALES
// ============================================================

async function extraerTextoDeArchivo(rutaArchivo) {
  const ext = path.extname(rutaArchivo).toLowerCase();
  console.log(`📄 Procesando: ${path.basename(rutaArchivo)}`);

  if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(rutaArchivo);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } else if (ext === '.txt') {
    return fs.readFileSync(rutaArchivo, 'utf8');
  } else {
    console.warn(`⚠️ Formato no soportado: ${ext} (solo .pdf y .txt)`);
    return null;
  }
}

function detectarFuente(nombreArchivo) {
  const nombre = nombreArchivo.toLowerCase();
  if (nombre.includes('spurgeon')) return 'Spurgeon';
  if (nombre.includes('moody')) return 'Moody';
  return 'Desconocida';
}

function dividirEnBloques(texto, tamanoBloque = 3000) {
  const bloques = [];
  let inicio = 0;
  while (inicio < texto.length) {
    let fin = Math.min(inicio + tamanoBloque, texto.length);
    if (fin < texto.length) {
      const ultimoSalto = texto.lastIndexOf('\n', fin);
      const ultimoPunto = texto.lastIndexOf('.', fin);
      const corteOptimo = Math.max(ultimoSalto, ultimoPunto);
      if (corteOptimo > inicio + 1000) fin = corteOptimo + 1;
    }
    bloques.push(texto.slice(inicio, fin).trim());
    inicio = fin;
  }
  return bloques;
}

async function estructurarConIA(bloque, numeroBloque, totalBloques, fuente) {
  const prompt = `
Eres un experto en teología y homilética. Extrae ILUSTRACIONES Y ANÉCDOTAS del texto y estructúralas en JSON.

TEXTO A PROCESAR (Bloque ${numeroBloque} de ${totalBloques}):
${bloque}

INSTRUCCIONES:
1. Identifica CADA ilustración, anécdota o historia en el texto.
2. Para cada una, extrae:
   - tema: tema principal en minúsculas (ej: "fe", "obediencia", "perdón", "oración")
   - subtema: subtema más específico si existe
   - titulo: título breve y descriptivo
   - contenido: texto completo de la ilustración (limpio)
   - fuente: "${fuente}"
   - tipo: "ilustracion" | "anecdota" | "testimonio" | "historia"
3. Si no hay ilustraciones claras, devuelve array vacío [].
4. NO inventes nada. Solo extrae lo explícito en el texto.
5. Devuelve SOLO un array JSON válido, sin explicaciones adicionales.

FORMATO DE SALIDA:
[
  {
    "tema": "fe",
    "subtema": "fe en la prueba",
    "titulo": "El faro que no se apagó",
    "contenido": "Un capitán de barco...",
    "fuente": "${fuente}",
    "tipo": "ilustracion"
  }
]

RESPONDE SOLO CON EL JSON:`;

    try {
    const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    const data = await response.json();
    
    // NUEVO: Mostrar el error real si la API falla
    if (!response.ok) {
      console.error(`❌ Error de API (${response.status}):`, data);
      return [];
    }

    const contenido = data.choices?.[0]?.message?.content || '[]';
    const jsonLimpio = contenido.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    try {
      return JSON.parse(jsonLimpio);
    } catch (e) {
      console.error(`⚠️ Error parseando JSON en bloque ${numeroBloque}:`, e.message);
      console.error(`Contenido crudo recibido:`, contenido);
      return [];
    }
  } catch (error) {
    console.error(`❌ Error en IA para bloque ${numeroBloque}:`, error.message);
    return [];
  }
}

async function procesarArchivo(rutaArchivo) {
  const texto = await extraerTextoDeArchivo(rutaArchivo);
  if (!texto) return [];

  const fuente = detectarFuente(path.basename(rutaArchivo));
  const bloques = dividirEnBloques(texto, 3000);
  console.log(`📋 Texto dividido en ${bloques.length} bloques`);

  const todasIlustraciones = [];

  for (let i = 0; i < bloques.length; i++) {
    console.log(`🤖 Procesando bloque ${i + 1} de ${bloques.length}...`);
    const ilustraciones = await estructurarConIA(bloques[i], i + 1, bloques.length, fuente);
    todasIlustraciones.push(...ilustraciones);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa para no saturar API
  }

  return todasIlustraciones;
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

async function main() {
  console.log('🚀 INICIANDO CONSTRUCCIÓN DE BASE DE ILUSTRACIONES\n');

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ La carpeta ${INPUT_DIR} no existe.`);
    process.exit(1);
  }

  const archivos = fs.readdirSync(INPUT_DIR)
    .filter(file => file.endsWith('.pdf') || file.endsWith('.txt'))
    .map(file => path.join(INPUT_DIR, file));

  if (archivos.length === 0) {
    console.error(`❌ No se encontraron archivos .pdf o .txt en ${INPUT_DIR}`);
    process.exit(1);
  }

  console.log(`📚 Archivos encontrados: ${archivos.map(f => path.basename(f)).join(', ')}\n`);

  const todasIlustraciones = [];

  for (const archivo of archivos) {
    console.log(`\n═══════════════════════════════════════`);
    console.log(`Procesando: ${path.basename(archivo)}`);
    console.log(`═══════════════════════════════════════\n`);
    
    const ilustraciones = await procesarArchivo(archivo);
    todasIlustraciones.push(...ilustraciones);
    console.log(`✅ ${path.basename(archivo)} completado. Ilustraciones extraídas: ${ilustraciones.length}\n`);
  }

  const ilustracionesUnicas = todasIlustraciones.filter((ilustracion, index, self) =>
    index === self.findIndex((t) => t.titulo === ilustracion.titulo && t.fuente === ilustracion.fuente)
  );

  const baseDeDatos = {
    metadata: {
      version: '1.0',
      fecha_creacion: new Date().toISOString(),
      fuentes: [...new Set(ilustracionesUnicas.map(i => i.fuente))],
      total_ilustraciones: ilustracionesUnicas.length,
      temas_disponibles: [...new Set(ilustracionesUnicas.map(i => i.tema))].sort()
    },
    ilustraciones: ilustracionesUnicas
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(baseDeDatos, null, 2), 'utf8');
  
  console.log('\n═══════════════════════════════════════');
  console.log('✅ ¡BASE DE ILUSTRACIONES CREADA EXITOSAMENTE!');
  console.log(`═══════════════════════════════════════`);
  console.log(`📁 Archivo guardado: ${OUTPUT_FILE}`);
  console.log(`📊 Total de ilustraciones: ${ilustracionesUnicas.length}`);
}

main().catch(console.error);
