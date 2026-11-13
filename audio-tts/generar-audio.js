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
const VOZ = process.env.VOZ_TTS || "es-US-Chirp3-HD-Algieba";
const IDIOMA = "es-US";
const LIMITE_MENSUAL_GRATIS = 1_000_000;
const MARGEN_SEGURIDAD = 940_000;
const LIMITE_BYTES_POR_LLAMADA = 4500;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ============================================================
// CONTROL DE PRESUPUESTO
// ============================================================
function mesActualISO() { return new Date().toISOString().slice(0, 7); }
async function leerContador() {
  const mes = mesActualISO();
  const { data, error } = await supabase.from("uso_mensual_tts").select("caracteres").eq("mes", mes).maybeSingle();
  if (error) throw new Error(`Error leyendo contador: ${error.message}`);
  return { mes, caracteres: data?.caracteres || 0 };
}
async function guardarContador(contador) {
  const { error } = await supabase.from("uso_mensual_tts").upsert({ mes: contador.mes, caracteres: contador.caracteres });
  if (error) throw new Error(`Error guardando contador: ${error.message}`);
}
function contarCaracteresFacturables(ssml) { return ssml.replace(/<mark[^>]*\/>/g, "").length; }

// ============================================================
// PARTIR EL SSML POR MARCAS DE IMAGEN (Para calcular tiempos)
// ============================================================
function partirSSMLPorImagen(ssmlCompleto) {
  const matchSpeak = ssmlCompleto.match(/<speak([^>]*)>/);
  const tagSpeak = matchSpeak ? matchSpeak[0] : `<speak version="1.0" xml:lang="${IDIOMA}">`;
  const inicioProsody = ssmlCompleto.indexOf("<prosody");
  const finProsodyTag = ssmlCompleto.indexOf(">", inicioProsody);
  const tagProsody = ssmlCompleto.slice(inicioProsody, finProsodyTag + 1);
  const finContenido = ssmlCompleto.lastIndexOf("</prosody>");
  const contenido = ssmlCompleto.slice(finProsodyTag + 1, finContenido);

  // Dividimos el contenido usando las marcas <mark name="imagen_N"/>
  const partes = contenido.split(/<mark name="imagen_(\d+)"\/>/);
  const pre = partes[0]; // Texto antes de la primera marca (normalmente vacío)
  const bloques = [];

  for (let i = 1; i < partes.length; i += 2) {
    const num = parseInt(partes[i], 10);
    const texto = partes[i + 1] || "";
    if (texto.trim()) {
      bloques.push({ num, texto });
    }
  }

  // Reconstruimos cada bloque con sus etiquetas
  return bloques.map(b => ({
    num: b.num,
    ssml: `${tagSpeak}${tagProsody}${b.texto}</prosody></speak>`
  }));
}

// ============================================================
// UNIR WAVS Y LEER DURACIÓN
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

// ============================================================
// MASTERIZACIÓN
// ============================================================
function masterizarAudio(rutaEntrada, rutaSalida) {
  return new Promise((resolve, reject) => {
    console.log(`\n🎛️  Masterizando audio ("Voz Natural")...`);
    ffmpeg(rutaEntrada)
      .audioFilters([
        "highpass=f=65", "equalizer=f=6500:width_type=o:width=1.2:g=-3",
        "equalizer=f=200:width_type=o:width=1.5:g=1.5", "equalizer=f=3000:width_type=o:width=1.5:g=-1.5",
        "equalizer=f=9000:width_type=o:width=1.5:g=1.5",
        "acompressor=threshold=-20dB:ratio=2.5:attack=20:release=200:makeup=2dB",
        "acompressor=threshold=-6dB:ratio=4:attack=5:release=50:makeup=1dB",
        "aecho=0.8:0.7:20:0.06", "loudnorm=I=-16:TP=-1:LRA=7",
      ])
      .save(rutaSalida)
      .on("end", () => { console.log(`✅ Audio masterizado: ${rutaSalida}`); resolve(); })
      .on("error", (err) => reject(new Error(`Error de FFmpeg al masterizar: ${err.message}`)));
  });
}

// ============================================================
// SÍNTESIS
// ============================================================
async function sintetizarTrozo(ssmlTrozo) {
  const respuesta = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { ssml: ssmlTrozo },
      voice: { languageCode: IDIOMA, name: VOZ },
      audioConfig: { audioEncoding: "LINEAR16" },
      // ⛔ QUITAMOS enableTimePointing PORQUE CHIRP 3 NO LO SOPORTA
    }),
  });
  if (!respuesta.ok) {
    const errorTexto = await respuesta.text();
    throw new Error(`Error de la API de Google (${respuesta.status}): ${errorTexto}`);
  }
  const datos = await respuesta.json();
  return Buffer.from(datos.audioContent, "base64");
}

// ============================================================
// ORQUESTADOR
// ============================================================
async function generarAudio(ssmlOriginal, nombreSalida) {
  const caracteresDeEsteAudio = contarCaracteresFacturables(ssmlOriginal);
  const contador = await leerContador();
  console.log(`📊 Caracteres facturables: ${caracteresDeEsteAudio}`);
  console.log(`📊 Gastados este mes: ${contador.caracteres} de ${LIMITE_MENSUAL_GRATIS} gratis`);

  const totalEstimado = contador.caracteres + caracteresDeEsteAudio;
  if (totalEstimado > MARGEN_SEGURIDAD) {
    console.error(`\n🛑 STOP DE SEGURIDAD: El total (${totalEstimado}) supera el margen de ${MARGEN_SEGURIDAD}.`);
    process.exitCode = 1;
    return;
  }

  const bloques = partirSSMLPorImagen(ssmlOriginal);
  console.log(`\n✂️  El guion se partió en ${bloques.length} bloques (uno por imagen).`);

  const audiosBuffers = [];
  const timepointsGlobal = [];
  let offsetAcumulado = 0;

  for (const bloque of bloques) {
    console.log(`\n🎙️  Generando audio para imagen_${bloque.num}...`);
    const audioBuffer = await sintetizarTrozo(bloque.ssml);
    audiosBuffers.push(audioBuffer);

    // Guardamos la marca con el tiempo exacto (offset)
    timepointsGlobal.push({
      markName: `imagen_${bloque.num}`,
      timeSeconds: offsetAcumulado,
    });

    const { duracionSegundos } = leerDatosWav(audioBuffer);
    offsetAcumulado += duracionSegundos;
    console.log(`   ✅ Generado (${duracionSegundos.toFixed(1)}s) | Inicio: ${timepointsGlobal[timepointsGlobal.length - 1].timeSeconds.toFixed(1)}s`);
  }

  const { wavFinal, duracionTotal } = unirWavs(audiosBuffers);
  const rutaCruda = path.join(repoRoot, "audio-tts", `${nombreSalida}_crudo.wav`);
  fs.writeFileSync(rutaCruda, wavFinal);
  console.log(`\n✅ Audio crudo guardado (duración: ${duracionTotal.toFixed(1)}s)`);

  const rutaFinal = path.join(repoRoot, "audio-tts", `${nombreSalida}_final.mp3`);
  await masterizarAudio(rutaCruda, rutaFinal);

  const rutaTimestamps = path.join(repoRoot, "audio-tts", `${nombreSalida}_timestamps.json`);
  fs.writeFileSync(rutaTimestamps, JSON.stringify(timepointsGlobal, null, 2));
  console.log(`✅ Timestamps guardados con ${timepointsGlobal.length} marcas.`);

  contador.caracteres += caracteresDeEsteAudio;
  await guardarContador(contador);
  console.log(`\n🎧 Archivo final listo: ${rutaFinal}`);
}

// ============================================================
// EJECUCIÓN
// ============================================================
const archivoGuion = process.argv[2];
if (!archivoGuion) {
  console.error("Uso: node generar-audio.js <archivo-guion.ssml>");
  process.exitCode = 1;
} else {
  const ssml = fs.readFileSync(archivoGuion, "utf-8");
  const nombreBase = path.basename(archivoGuion, path.extname(archivoGuion));
  generarAudio(ssml, nombreBase).catch((err) => {
    console.error("❌ Error:", err.message);
    process.exitCode = 1;
  });
}