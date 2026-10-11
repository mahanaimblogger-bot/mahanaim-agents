import "dotenv/config";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";

// ── Detectar FFmpeg portable ──────────────────────────────────────
// Si existe FFmpeg en tools/ffmpeg/, usarlo. Si no, usar el del sistema.
const ffmpegPortablePath = path.join(
  process.cwd(),
  "..",
  "tools",
  "ffmpeg",
  "ffmpeg-9.0.2-essentials_build",
  "bin",
  "ffmpeg.exe",
);
if (fs.existsSync(ffmpegPortablePath)) {
  ffmpeg.setFfmpegPath(ffmpegPortablePath);
  console.log("🔧 Usando FFmpeg portable desde tools/");
}

// ── Argumentos ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const bookName = args[0];
const chapterNum = args[1];

if (!bookName || !chapterNum) {
  console.error("Uso: node ensamblar-video.js <libro> <capitulo>");
  console.error("Ejemplo: node ensamblar-video.js genesis 25");
  process.exit(1);
}

// ── Rutas ─────────────────────────────────────────────────────────
const repoRoot = path.join(process.cwd(), "..");
const audioDir = path.join(repoRoot, "audio-tts");
const chapterDir = path.join(
  repoRoot,
  "prompts_output",
  bookName,
  `Capitulo_${chapterNum}`,
);
const imagesDir = path.join(chapterDir, "imagenes");
const outputDir = path.join(chapterDir, "video");

const audioPath = path.join(audioDir, "guion_video_tts_final.mp3");
const timestampsPath = path.join(audioDir, "guion_video_tts_timestamps.json");
const finalVideoPath = path.join(outputDir, "video_final.mp4");

// ── Validaciones ──────────────────────────────────────────────────
for (const [name, p] of [
  ["audio", audioPath],
  ["timestamps", timestampsPath],
  ["carpeta de imagenes", imagesDir],
]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ No se encontró ${name}: ${p}`);
    process.exit(1);
  }
}

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ── Leer timestamps ───────────────────────────────────────────────
const timestampsRaw = JSON.parse(fs.readFileSync(timestampsPath, "utf-8"));

// Normalizamos a un objeto { imagen_1: 0.01, imagen_2: 20.26, ... }
const marks = {};
if (Array.isArray(timestampsRaw)) {
  for (const item of timestampsRaw) {
    const key = item.markName || item.name || item.mark;
    const val = item.timeSeconds ?? item.time ?? item.seconds;
    if (key && val !== undefined) marks[key] = val;
  }
} else if (typeof timestampsRaw === "object" && timestampsRaw !== null) {
  Object.assign(marks, timestampsRaw);
}

console.log(`📊 Marcas encontradas en el JSON:`);
for (const [k, v] of Object.entries(marks)) {
  console.log(`   ${k}: ${v}s`);
}

// ── Detectar cantidad dinámica de marcas ──────────────────────────
const NUM_IMAGENES = Object.keys(marks).filter((k) =>
  k.startsWith("imagen_"),
).length;

if (NUM_IMAGENES === 0) {
  console.error("❌ No se encontraron marcas 'imagen_N' en el JSON.");
  process.exit(1);
}

console.log(`📊 Detectadas ${NUM_IMAGENES} imágenes dinámicamente.\n`);

// ── Calcular duración de cada imagen ──────────────────────────────
const duraciones = [];

for (let i = 1; i <= NUM_IMAGENES; i++) {
  const currentKey = `imagen_${i}`;
  const nextKey = `imagen_${i + 1}`;
  const start = marks[currentKey];

  if (start === undefined) {
    console.error(
      `❌ Falta la marca "${currentKey}" en el JSON de timestamps.`,
    );
    process.exit(1);
  }

  let end;
  if (i === NUM_IMAGENES) {
    end = null; // Se resuelve después con la duración real del audio
  } else if (marks[nextKey] !== undefined) {
    end = marks[nextKey];
  } else {
    console.error(
      `❌ Falta la marca "${nextKey}" necesaria para calcular la duración de la imagen ${i}.`,
    );
    process.exit(1);
  }

  duraciones.push({ index: i, start, end });
}

// ── Obtener duración real del audio ───────────────────────────────
function getAudioDuration() {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

// ── Generar un clip con Ken Burns ─────────────────────────────────

// ── Generar un clip con Ken Burns en 3 fases ──────────────────────
function generarClipKenBurns(imagePath, duracion, outputPath) {
  return new Promise((resolve, reject) => {
    const fps = 24;
    const frames = Math.round(duracion * fps);

    // Fases proporcionales a la duración
    const durApertura = 0.03 * duracion;
    const durPausa = 0.03 * duracion;
    const durCierre = 0.05 * duracion;

    const zoomInicio = 2.00; // Close up inicial muy cerrado
    const zoomMedio = 1.00;
    const zoomLentoFin = 1.25;
    const zoomCierre = 1.80; // Close up final muy cerrado

    const t1 = durApertura;
    const t2 = durApertura + durPausa;
    const t3 = duracion - durCierre;

    const exprZ = `if(lt(on/${fps},${t1}), ${zoomInicio} + (${zoomMedio}-${zoomInicio})*((on/${fps})/${t1}), if(lt(on/${fps},${t2}), ${zoomMedio}, if(lt(on/${fps},${t3}), ${zoomMedio} + (${zoomLentoFin}-${zoomMedio})*(((on/${fps})-${t2})/(${t3}-${t2})), ${zoomLentoFin} + (${zoomCierre}-${zoomLentoFin})*(((on/${fps})-${t3})/${durCierre}))))`;

    const vf = [
      `scale=8000:-1`,
      `zoompan=z='${exprZ}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=${fps}`,
      `format=yuv420p`,
    ].join(",");

    ffmpeg(imagePath)
      .videoFilters(vf)
      .outputOptions([
        "-c:v libx264",
        "-preset medium",
        "-crf 23",
        "-pix_fmt yuv420p",
        "-r 24",
        `-frames:v ${frames}`,
        "-movflags", "+faststart",
      ])
      .on("start", () =>
        console.log(
          `   ▶️  Iniciando render del clip ${path.basename(outputPath)}`,
        ),
      )
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

// ── Concatenar los clips ───────────────────────────────────────
function concatenarClips(clipPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const listPath = path.join(outputDir, "clips_list.txt");
    const contenido = clipPaths
      .map((p) => `file '${p.replace(/\\/g, "/")}'`)
      .join("\n");
    fs.writeFileSync(listPath, contenido, "utf-8");

    ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

// ── Agregar audio ─────────────────────────────────────────────────
function agregarAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions(["-c:v copy", "-c:a aac", "-b:a 192k", "-shortest"])
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

// ── Proceso principal ─────────────────────────────────────────────
async function main() {
  try {
    console.log(`\n🎬 Ensamblando video para ${bookName} ${chapterNum}...\n`);

    const audioDuration = await getAudioDuration();
    console.log(`⏱️  Duración del audio: ${audioDuration.toFixed(2)}s\n`);

    duraciones[duraciones.length - 1].end = audioDuration;

    console.log("📋 Duraciones por imagen:");
    for (const d of duraciones) {
      const dur = d.end - d.start;
      console.log(
        `   imagen_${String(d.index).padStart(2, "0")}: ${dur.toFixed(2)}s`,
      );
    }
    console.log();

    // Paso 1: generar los clips
    const clipPaths = [];
    for (const d of duraciones) {
      const imageName = `imagen_${String(d.index).padStart(2, "0")}.png`;
      const imagePath = path.join(imagesDir, imageName);
      const clipPath = path.join(
        outputDir,
        `clip_${String(d.index).padStart(2, "0")}.mp4`,
      );
      const dur = d.end - d.start;

      if (!fs.existsSync(imagePath)) {
        console.error(`❌ No se encontró la imagen: ${imagePath}`);
        process.exit(1);
      }

      console.log(
        `   🎞️  [${d.index}/${NUM_IMAGENES}] Renderizando clip (${dur.toFixed(2)}s)...`,
      );
      await generarClipKenBurns(imagePath, dur, clipPath);
      clipPaths.push(clipPath);
    }

    // Paso 2: concatenar
    console.log(`\n🔗 Concatenando ${clipPaths.length} clips...`);
    const concatenatedPath = path.join(outputDir, "_video_sin_audio.mp4");
    await concatenarClips(clipPaths, concatenatedPath);

    // Paso 3: agregar audio
    console.log(`🎵 Agregando audio masterizado...`);
    await agregarAudio(concatenatedPath, finalVideoPath);

    // Paso 4: limpiar archivos temporales
    console.log(`🧹 Limpiando archivos temporales...`);
    for (const p of clipPaths) fs.unlinkSync(p);
    fs.unlinkSync(concatenatedPath);
    const listPath = path.join(outputDir, "clips_list.txt");
    if (fs.existsSync(listPath)) fs.unlinkSync(listPath);

    console.log(`\n${"═".repeat(50)}`);
    console.log(`✨ ¡Video final listo!`);
    console.log(`   📁 ${finalVideoPath}`);
    console.log(`${"═".repeat(50)}\n`);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
