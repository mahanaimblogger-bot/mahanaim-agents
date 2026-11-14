import "dotenv/config";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── Raíz del repo (relativa a este archivo, no al cwd) ────────────
// Este archivo vive en <repo>/video/, así que la raíz es un nivel arriba.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
console.log("🔍 repoRoot detectado como:", repoRoot);

// ── Detectar FFmpeg portable (solo Windows) ───────────────────────
const ffmpegPortablePath = path.join(
  repoRoot,
  "tools",
  "ffmpeg",
  "ffmpeg-9.0.2-essentials_build",
  "bin",
  "ffmpeg.exe",
);
if (process.platform === "win32" && fs.existsSync(ffmpegPortablePath)) {
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

const momentosClavePath = path.join(chapterDir, "momentos_clave.json");

// ── Extraer dinámicamente los textos de los micro-ganchos del SSML ──
function extraerTextosDeSSML(ssmlPath) {
  const ssml = fs.readFileSync(ssmlPath, "utf-8");
  const regex = /<mark name="imagen_(\d+)"\s*\/>([\s\S]*?)(?=<mark|<\/prosody>)/g;
  let match;
  const textos = {};
  
  while ((match = regex.exec(ssml)) !== null) {
    const num = parseInt(match[1], 10);
    let textoLimpio = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const primeraOracion = textoLimpio.split(/(?<=[.?!])\s+/)[0];
    
    if (primeraOracion.length > 10 && primeraOracion.length < 120) {
      textos[num] = primeraOracion;
    }
  }
  return textos;
}

// ── Función para cortar el texto en líneas y que quepa en pantalla ──
function envolverTexto(texto, maxCaracteresPorLinea = 35) {
  const palabras = texto.split(" ");
  let lineas = [];
  let lineaActual = "";
  for (const palabra of palabras) {
    if ((lineaActual + palabra).length > maxCaracteresPorLinea) {
      lineas.push(lineaActual.trim());
      lineaActual = palabra + " ";
    } else {
      lineaActual += palabra + " ";
    }
  }
  if (lineaActual.trim()) lineas.push(lineaActual.trim());
  return lineas.join("\n");
}

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

// ── Indexar imágenes (tolerante a nombre/extensión/mayúsculas) ────
const archivosImagenes = fs.readdirSync(imagesDir);
const imagenesPorIndice = {};
for (const file of archivosImagenes) {
  const m = file.match(/^imagen[_-]?0*(\d+)\.(png|jpe?g|webp)$/i);
  if (m) imagenesPorIndice[Number(m[1])] = path.join(imagesDir, file);
}
console.log(
  `🖼️  Imágenes en carpeta (${Object.keys(imagenesPorIndice).length} reconocidas de ${archivosImagenes.length} archivos):`,
  archivosImagenes.join(", ") || "(vacía)",
);

// ── Leer timestamps ───────────────────────────────────────────────
const timestampsRaw = JSON.parse(fs.readFileSync(timestampsPath, "utf-8"));

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
    end = null; // Se resuelve con la duración real del audio
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

// ── Generar un clip con Ken Burns en 3 fases ──────────────────────
// ── Generar un clip con Ken Burns y texto opcional ────────────────
function generarClipKenBurns(imagePath, duracion, outputPath, textoOverlay = null) {
  return new Promise((resolve, reject) => {
    const fps = 24;
    const frames = Math.round(duracion * fps);

    const durApertura = 0.03 * duracion;
    const durPausa = 0.03 * duracion;
    const durCierre = 0.05 * duracion;

    const zoomInicio = 2.0;
    const zoomMedio = 1.0;
    const zoomLentoFin = 1.25;
    const zoomCierre = 1.8;

    const t1 = durApertura;
    const t2 = durApertura + durPausa;
    const t3 = duracion - durCierre;

    const exprZ = `if(lt(on/${fps},${t1}), ${zoomInicio} + (${zoomMedio}-${zoomInicio})*((on/${fps})/${t1}), if(lt(on/${fps},${t2}), ${zoomMedio}, if(lt(on/${fps},${t3}), ${zoomMedio} + (${zoomLentoFin}-${zoomMedio})*(((on/${fps})-${t2})/(${t3}-${t2})), ${zoomLentoFin} + (${zoomCierre}-${zoomLentoFin})*(((on/${fps})-${t3})/${durCierre}))))`;

    let filtros = [
      `scale=8000:-1`,
      `zoompan=z='${exprZ}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=${fps}`,
      `format=yuv420p`,
    ];

    let textFilePath = null;

    if (textoOverlay) {
      const textoFormateado = envolverTexto(textoOverlay, 25); // Menos caracteres por línea
      
      textFilePath = path.join(outputDir, `temp_text_${Date.now()}.txt`);
      fs.writeFileSync(textFilePath, textoFormateado, 'utf-8');
      
      const textFilePathEscaped = textFilePath.replace(/\\/g, '/').replace(/:/g, '\\:');
      
      // Usamos la fuente Anton desde assets/fonts, borde negro y letras más grandes
      const rutaFuente = path.join(repoRoot, "assets", "fonts", "Anton-Regular.ttf").replace(/\\/g, "/").replace(/:/g, "\\:");

      const filtroTexto = `drawtext=fontfile='${rutaFuente}':textfile='${textFilePathEscaped}':fontcolor=white:fontsize=85:borderw=8:bordercolor=black:x=(w-text_w)/2:y=h-300:line_spacing=15:text_align=C:alpha='if(lt(t,1),0,if(lt(t,2),(t-1),1))'`;
      
      filtros.push(filtroTexto);
    }

    const vf = filtros.join(",");

    ffmpeg(imagePath)
      .videoFilters(vf)
      .outputOptions(["-c:v libx264", "-preset medium", "-crf 23", "-pix_fmt yuv420p", "-r 24", `-frames:v ${frames}`, "-movflags", "+faststart"])
      .on("start", () => console.log(`   ▶️  Iniciando render del clip ${path.basename(outputPath)}`))
      .on("end", () => {
        if (textFilePath && fs.existsSync(textFilePath)) fs.unlinkSync(textFilePath);
        resolve(outputPath);
      })
      .on("error", (err) => {
        if (textFilePath && fs.existsSync(textFilePath)) fs.unlinkSync(textFilePath);
        reject(err);
      })
      .save(outputPath);
  });
}

// ── Concatenar los clips ──────────────────────────────────────────
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
// ── Agregar audio ─────────────────────────────────────────────────
function agregarAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      // Quitamos "-shortest" para que el video no se corte si es más largo que el audio
      .outputOptions(["-c:v copy", "-c:a aac", "-b:a 192k"])
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

// ── Generar End Screen (Últimos 20 segundos) ─────────────────────
function generarEndScreen(ultimaImagen, outputPath) {
  return new Promise((resolve, reject) => {
    // Filtro: Desenfoca, oscurece un poco y escribe el texto en el centro
    // Nota: Usa Arial de Windows. En Linux (GitHub Actions) habría que cambiar la ruta.
    const filtro = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=15:5,eq=brightness=-0.2,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='SUSCRÍBETE AL CANAL':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.6:boxborderw=30";
    
    ffmpeg(ultimaImagen)
      .inputOptions(["-loop 1"])
      .videoFilters(filtro)
      .outputOptions([
        "-c:v libx264", 
        "-preset medium", 
        "-crf 23", 
        "-pix_fmt yuv420p", 
        "-t 10", // 10 segundos exactos
        "-r 24", 
        "-movflags", "+faststart"
      ])
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

// ── Proceso principal ─────────────────────────────────────────────
// ── Proceso principal ─────────────────────────────────────────────
async function main() {
  try {
    console.log(`\n🎬 Ensamblando video para ${bookName} ${chapterNum}...\n`);

    const faltantes = duraciones.filter((d) => !imagenesPorIndice[d.index]).map((d) => d.index);
    if (faltantes.length > 0) {
      console.error(`❌ Faltan ${faltantes.length} imagen(es) para los índices: ${faltantes.join(", ")}`);
      process.exit(1);
    }

    const audioDuration = await getAudioDuration();
    console.log(`⏱️  Duración del audio: ${audioDuration.toFixed(2)}s\n`);

    duraciones[duraciones.length - 1].end = audioDuration;

    console.log("📋 Duraciones por imagen:");
    for (const d of duraciones) {
      const dur = d.end - d.start;
      console.log(`   imagen_${String(d.index).padStart(2, "0")}: ${dur.toFixed(2)}s`);
    }
    console.log();

        // 1. Extraemos dinámicamente los textos del SSML de ESTE capítulo
    const ssmlPath = path.join(chapterDir, "guion_video_tts.ssml");
   
        // 2. Leemos los momentos clave identificados por la IA
    let indicesClave = [];
    let textosGanchos = {}; // 🆕 Aquí guardaremos los textos impactantes

    if (fs.existsSync(momentosClavePath)) {
      const momentosData = JSON.parse(fs.readFileSync(momentosClavePath, "utf-8"));
      
      // Extraemos los índices (números de imagen)
      indicesClave = [
        momentosData.gancho,
        momentosData.conflicto,
        momentosData.climax,
        momentosData.cierre
      ].filter(Boolean); // Elimina nulos o undefined
      
      // Mapeamos cada imagen a su frase gancho
      textosGanchos[momentosData.gancho] = momentosData.texto_gancho;
      textosGanchos[momentosData.conflicto] = momentosData.texto_conflicto;
      textosGanchos[momentosData.climax] = momentosData.texto_climax;
      textosGanchos[momentosData.cierre] = momentosData.texto_cierre;

      console.log(`🎯 Momentos clave cargados desde JSON: ${indicesClave.join(", ")}`);
    } else {
      // Fallback por si el orquestador falló
      indicesClave = [1, Math.round(NUM_IMAGENES * 0.25), Math.round(NUM_IMAGENES * 0.75), NUM_IMAGENES];
      console.log(`⚠️ No se encontró momentos_clave.json. Usando fallback: ${indicesClave.join(", ")}`);
    }

    const clipPaths = [];
    for (const d of duraciones) {
      const imagePath = imagenesPorIndice[d.index];
      const clipPath = path.join(outputDir, `clip_${String(d.index).padStart(2, "0")}.mp4`);
      const dur = d.end - d.start;
      
      // 3. Aplicamos texto SOLO si la imagen está en los momentos clave
      const esMicroGancho = indicesClave.includes(d.index);
      const textoGancho = esMicroGancho ? textosGanchos[d.index] : null;

      if (textoGancho) {
        console.log(`   🎞️  [${d.index}/${NUM_IMAGENES}] Renderizando clip con TEXTO (${dur.toFixed(2)}s)...`);
      } else {
        console.log(`   🎞️  [${d.index}/${NUM_IMAGENES}] Renderizando clip (${dur.toFixed(2)}s)...`);
      }
      
      await generarClipKenBurns(imagePath, dur, clipPath, textoGancho);
      clipPaths.push(clipPath);
    }

    // 🆕 Renderizamos el End Screen de 20s y lo añadimos al final
    console.log(`\n🖥️  Generando Pantalla Final (20s)...`);
    const endScreenPath = path.join(outputDir, `clip_endscreen.mp4`);
    const ultimaImagen = imagenesPorIndice[NUM_IMAGENES];
    await generarEndScreen(ultimaImagen, endScreenPath);
    clipPaths.push(endScreenPath);

    console.log(`\n🔗 Concatenando ${clipPaths.length} clips...`);
    const concatenatedPath = path.join(outputDir, "_video_sin_audio.mp4");
    await concatenarClips(clipPaths, concatenatedPath);

    console.log(`🎵 Agregando audio...`);
    await agregarAudio(concatenatedPath, finalVideoPath);

    console.log(`🧹 Limpiando archivos temporales...`);
    for (const p of clipPaths) if (fs.existsSync(p)) fs.unlinkSync(p);
    if (fs.existsSync(concatenatedPath)) fs.unlinkSync(concatenatedPath);
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