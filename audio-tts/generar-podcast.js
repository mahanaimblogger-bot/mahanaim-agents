import "dotenv/config";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// ── Detectar FFmpeg ────────────────────────────────────────────────
if (process.platform === "win32") {
  const ffmpegPortablePath = path.join(repoRoot, "tools", "ffmpeg", "ffmpeg-9.0.2-essentials_build", "bin", "ffmpeg.exe");
  if (fs.existsSync(ffmpegPortablePath)) {
    ffmpeg.setFfmpegPath(ffmpegPortablePath);
    console.log("🔧 Usando FFmpeg portable desde tools/ (Windows)");
  }
} else {
  const ffmpegLinuxPath = "/usr/bin/ffmpeg";
  if (fs.existsSync(ffmpegLinuxPath)) {
    ffmpeg.setFfmpegPath(ffmpegLinuxPath);
    console.log("🔧 Usando FFmpeg del sistema (Linux)");
  }
}

// ============================================================
// CONFIGURACIÓN
// ============================================================
const API_KEY = process.env.GOOGLE_TTS_API_KEY;
const VOZ_A = process.env.VOZ_TTS_A || "es-US-Chirp3-HD-Algieba";
const VOZ_B = process.env.VOZ_TTS_B || "es-US-Chirp3-HD-Puck";
const IDIOMA = "es-US";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ============================================================
// UTILIDADES DE AUDIO (WAV)
// ============================================================
function leerDatosWav(buffer) {
  const indiceData = buffer.indexOf("data");
  const inicioDatos = indiceData + 8;
  const sampleRate = buffer.readUInt32LE(24);
  const numCanales = buffer.readUInt16LE(22);
  const bitsPorMuestra = buffer.readUInt16LE(34);
  const datosPCM = buffer.slice(inicioDatos);
  const duracionSegundos = datosPCM.length / (sampleRate * numCanales * (bitsPorMuestra / 8));
  return { datosPCM, sampleRate, numCanales, bitsPorMuestra, duracionSegundos };
}

function unirWavs(buffers) {
  const partes = buffers.map(leerDatosWav);
  const totalDatos = Buffer.concat(partes.map((p) => p.datosPCM));
  const primerBuffer = buffers[0];
  const indiceData = primerBuffer.indexOf("data");
  const encabezado = Buffer.from(primerBuffer.slice(0, indiceData + 8));
  encabezado.writeUInt32LE(36 + totalDatos.length, 4);
  encabezado.writeUInt32LE(totalDatos.length, indiceData + 4);
  const duracionTotal = partes.reduce((acc, p) => acc + p.duracionSegundos, 0);
  return { wavFinal: Buffer.concat([encabezado, totalDatos]), duracionTotal };
}

function generarSilencioWav(referenciaWav, duracionMs) {
  const { sampleRate, numCanales, bitsPorMuestra } = leerDatosWav(referenciaWav);
  const bytesPorMuestra = bitsPorMuestra / 8;
  const numMuestras = Math.round((sampleRate * duracionMs) / 1000);
  const tamanoDatos = numMuestras * numCanales * bytesPorMuestra;
  const encabezado = Buffer.alloc(44);
  encabezado.write("RIFF", 0);
  encabezado.writeUInt32LE(36 + tamanoDatos, 4);
  encabezado.write("WAVE", 8);
  encabezado.write("fmt ", 12);
  encabezado.writeUInt32LE(16, 16);
  encabezado.writeUInt16LE(1, 20); // PCM
  encabezado.writeUInt16LE(numCanales, 22);
  encabezado.writeUInt32LE(sampleRate, 24);
  encabezado.writeUInt32LE(sampleRate * numCanales * bytesPorMuestra, 28);
  encabezado.writeUInt16LE(numCanales * bytesPorMuestra, 32);
  encabezado.writeUInt16LE(bitsPorMuestra, 34);
  encabezado.write("data", 36);
  encabezado.writeUInt32LE(tamanoDatos, 40);
  return Buffer.concat([encabezado, Buffer.alloc(tamanoDatos, 0)]);
}

// ============================================================
// SÍNTESIS Y MASTERIZACIÓN
// ============================================================
async function sintetizarTexto(texto, voz) {
  const respuesta = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: texto },
      voice: { languageCode: IDIOMA, name: voz },
      audioConfig: { audioEncoding: "LINEAR16" },
    }),
  });

  if (!respuesta.ok) {
    const errorTexto = await respuesta.text();
    throw new Error(`Error de la API de Google (${respuesta.status}): ${errorTexto}`);
  }
  const datos = await respuesta.json();
  return Buffer.from(datos.audioContent, "base64");
}

function masterizarAudio(rutaEntrada, rutaSalida) {
  return new Promise((resolve, reject) => {
    console.log(`\n🎛️  Masterizando audio del podcast...`);
    ffmpeg(rutaEntrada)
      .audioFilters([
        "highpass=f=65", "equalizer=f=6500:width_type=o:width=1.2:g=-3",
        "equalizer=f=200:width_type=o:width=1.5:g=1.5", "equalizer=f=3000:width_type=o:width=1.5:g=-1.5",
        "equalizer=f=9000:width_type=o:width=1.5:g=1.5",
        "acompressor=threshold=-20dB:ratio=2.5:attack=20:release=200:makeup=2dB",
        "acompressor=threshold=-6dB:ratio=4:attack=5:release=50:makeup=1dB",
        "loudnorm=I=-16:TP=-1:LRA=7",
      ])
      .save(rutaSalida)
      .on("end", () => { console.log(`✅ Audio masterizado: ${rutaSalida}`); resolve(); })
      .on("error", (err) => reject(new Error(`Error de FFmpeg al masterizar: ${err.message}`)));
  });
}

// ============================================================
// PROCESO PRINCIPAL
// ============================================================
async function generarPodcast(libro, capitulo) {
  const dirCapitulo = path.join(repoRoot, "prompts_output", libro, `Capitulo_${capitulo}`);
  const rutaGuion = path.join(dirCapitulo, "podcast_guion.json");

  if (!fs.existsSync(rutaGuion)) {
    throw new Error(`No se encontró el guion del podcast en: ${rutaGuion}`);
  }

  const guion = JSON.parse(fs.readFileSync(rutaGuion, "utf-8"));
  const turnos = guion.turnos;

  console.log(`\n🎙️  Generando Podcast: ${libro} ${capitulo}`);
  console.log(`👥 Turnos detectados: ${turnos.length}`);
  console.log(`🗣️  Voz A: ${VOZ_A}`);
  console.log(`🗣️  Voz B: ${VOZ_B}`);

  const buffersTurnos = [];
  let offsetAcumulado = 0;
  const timepoints = [];

  for (let i = 0; i < turnos.length; i++) {
    const turno = turnos[i];
    const voz = turno.locutor === "A" ? VOZ_A : VOZ_B;
    console.log(`   [${i + 1}/${turnos.length}] Generando turno ${turno.locutor}...`);
    
    const audioBuffer = await sintetizarTexto(turno.texto, voz);
    buffersTurnos.push(audioBuffer);
    
    const { duracionSegundos } = leerDatosWav(audioBuffer);
    offsetAcumulado += duracionSegundos;
    timepoints.push({ turno: i + 1, locutor: turno.locutor, inicio: offsetAcumulado - duracionSegundos, fin: offsetAcumulado });

    // Agregar 500ms de silencio después de cada turno (excepto el último)
    if (i < turnos.length - 1) {
      const silencio = generarSilencioWav(audioBuffer, 500);
      buffersTurnos.push(silencio);
      offsetAcumulado += 0.5;
    }
  }

  const { wavFinal, duracionTotal } = unirWavs(buffersTurnos);
  const rutaCruda = path.join(repoRoot, "audio-tts", `podcast_${libro}_${capitulo}_crudo.wav`);
  fs.writeFileSync(rutaCruda, wavFinal);
  console.log(`\n✅ Audio crudo guardado (Duración: ${duracionTotal.toFixed(1)}s)`);

  const rutaFinal = path.join(repoRoot, "audio-tts", `podcast_${libro}_${capitulo}_final.mp3`);
  await masterizarAudio(rutaCruda, rutaFinal);

  const rutaTimestamps = path.join(repoRoot, "audio-tts", `podcast_${libro}_${capitulo}_timestamps.json`);
  fs.writeFileSync(rutaTimestamps, JSON.stringify(timepoints, null, 2));
  
  console.log(`\n🎧 Podcast listo para RSS.com o YouTube: ${rutaFinal}`);
}

// ============================================================
// EJECUCIÓN
// ============================================================
const libro = process.argv[2];
const capitulo = process.argv[3];

if (!libro || !capitulo) {
  console.error("Uso: node audio-tts/generar-podcast.js <libro> <capitulo>");
  process.exit(1);
}

generarPodcast(libro, capitulo).catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});