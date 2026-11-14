import fs from "fs";
import path from "path";

// Uso: node scripts/actualizar-capitulos-youtube.js <libro> <capitulo>
const args = process.argv.slice(2);
const bookName = args[0];
const chapterNum = args[1];

if (!bookName || !chapterNum) {
  console.error("Uso: node scripts/actualizar-capitulos-youtube.js <libro> <capitulo>");
  process.exit(1);
}

const repoRoot = process.cwd();
const chapterDir = path.join(repoRoot, "prompts_output", bookName, `Capitulo_${chapterNum}`);
const audioDir = path.join(repoRoot, "audio-tts");

const metadataPath = path.join(chapterDir, "youtube_metadata.json");
const timestampsPath = path.join(audioDir, "guion_video_tts_timestamps.json");
const outputTxtPath = path.join(chapterDir, "descripcion_youtube.txt");

if (!fs.existsSync(metadataPath) || !fs.existsSync(timestampsPath)) {
  console.error("❌ Faltan archivos: asegúrate de haber generado los metadatos y el audio.");
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
const timestamps = JSON.parse(fs.readFileSync(timestampsPath, "utf-8"));

// 1. Crear un mapa de "marca" -> "segundos"
const tiempos = {};
timestamps.forEach(t => {
  tiempos[t.markName] = t.timeSeconds;
});

// 2. Función para formatear segundos a MM:SS
function formatearTiempo(segundos) {
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// 3. Construir la lista de capítulos
const listaCapitulos = metadata.capitulos_youtube.map(cap => {
  const segundos = tiempos[cap.marca] || 0;
  const tiempoFormateado = segundos < 1 ? "00:00" : formatearTiempo(segundos);
  return `${tiempoFormateado} ${cap.titulo}`;
}).join("\n"); // Aquí se usa un salto de línea real

// 4. Reemplazar el hueco en la descripción
if (metadata.descripcion.includes("{{CAPITULOS}}")) {
  metadata.descripcion = metadata.descripcion.replace("{{CAPITULOS}}", listaCapitulos);
} else {
  metadata.descripcion += `\n\n⏱️ CAPÍTULOS\n${listaCapitulos}`;
}

// 5. Guardar el JSON actualizado
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

// 6. 🆕 CREAR EL ARCHIVO TXT LIMPIO PARA COPIAR Y PEGAR
fs.writeFileSync(outputTxtPath, metadata.descripcion, "utf-8");

console.log("✅ Metadatos actualizados con los tiempos exactos.");
console.log(`✅ Archivo creado listo para copiar y pegar: ${outputTxtPath}`);
console.log("📋 Capítulos generados:\n" + listaCapitulos);