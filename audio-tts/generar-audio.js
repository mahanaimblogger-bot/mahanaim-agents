import "dotenv/config";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { createClient } from "@supabase/supabase-js";
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


// ============================================================
// CONFIGURACIÓN
// ============================================================
const API_KEY = process.env.GOOGLE_TTS_API_KEY;
const VOZ = process.env.VOZ_TTS || "es-US-Wavenet-C";
const IDIOMA = "es-US";

const LIMITE_MENSUAL_GRATIS = 4_000_000;
const MARGEN_SEGURIDAD = 3_900_000;
const LIMITE_BYTES_POR_LLAMADA = 4500;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// CONTROL DE PRESUPUESTO MENSUAL (en Supabase, compartido)
// ============================================================
function mesActualISO() {
  return new Date().toISOString().slice(0, 7);
}

async function leerContador() {
  const mes = mesActualISO();
  const { data, error } = await supabase
    .from("uso_mensual_tts")
    .select("caracteres")
    .eq("mes", mes)
    .maybeSingle();

  if (error) throw new Error(`Error leyendo contador de Supabase: ${error.message}`);
  return { mes, caracteres: data?.caracteres || 0 };
}

async function guardarContador(contador) {
  const { error } = await supabase
    .from("uso_mensual_tts")
    .upsert({ mes: contador.mes, caracteres: contador.caracteres });

  if (error) throw new Error(`Error guardando contador en Supabase: ${error.message}`);
}

function contarCaracteresFacturables(ssml) {
  return ssml.replace(/<mark[^>]*\/>/g, "").length;
}

// ============================================================
// PARTIR EL SSML EN TROZOS VÁLIDOS
// ============================================================
function partirSSML(ssmlCompleto) {
  const matchSpeak = ssmlCompleto.match(/<speak([^>]*)>/);
  const tagSpeak = matchSpeak ? matchSpeak[0] : `<speak version="1.0" xml:lang="${IDIOMA}">`;

  const inicioProsody = ssmlCompleto.indexOf("<prosody");
  const finProsodyTag = ssmlCompleto.indexOf(">", inicioProsody);
  const tagProsody = ssmlCompleto.slice(inicioProsody, finProsodyTag + 1);

  const finContenido = ssmlCompleto.lastIndexOf("</prosody>");
  const contenido = ssmlCompleto.slice(finProsodyTag + 1, finContenido);

  const piezas = contenido.split(/(<break[^>]*\/>)/g).filter((p) => p.length > 0);

  const trozos = [];
  let actual = "";

  for (const pieza of piezas) {
    const candidato = actual + pieza;
    const bytesCandidato = Buffer.byteLength(
      `${tagSpeak}${tagProsody}${candidato}</prosody></speak>`,
      "utf-8"
    );

    if (bytesCandidato > LIMITE_BYTES_POR_LLAMADA && actual.length > 0) {
      trozos.push(actual);
      actual = pieza;
    } else {
      actual = candidato;
    }
  }
  if (actual.length > 0) trozos.push(actual);

  return trozos.map(
    (trozo) => `${tagSpeak}${tagProsody}${trozo}</prosody></speak>`
  );
}

// ============================================================
// UNIR VARIOS ARCHIVOS WAV EN UNO SOLO
// ============================================================
function leerDatosWav(buffer) {
  const indiceData = buffer.indexOf("data");
  const inicioDatos = indiceData + 8;
  const sampleRate = buffer.readUInt32LE(24);
  const numCanales = buffer.readUInt16LE(22);
  const bitsPorMuestra = buffer.readUInt16LE(34);
  const datosPCM = buffer.slice(inicioDatos);
  const duracionSegundos =
    datosPCM.length / (sampleRate * numCanales * (bitsPorMuestra / 8));
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
// MASTERIZACIÓN ("Voz Natural") — tu cadena de FFmpeg
// ------------------------------------------------------------
// Toma el WAV crudo de Google TTS y le aplica EQ correctivo,
// compresión en 2 etapas, un toque de espacio, y normalización
// de volumen al estándar de Spotify/YouTube (-16 LUFS).
// ============================================================
function masterizarAudio(rutaEntrada, rutaSalida) {
  return new Promise((resolve, reject) => {
    console.log(`\n🎛️  Masterizando audio ("Voz Natural")...`);
    ffmpeg(rutaEntrada)
      .audioFilters([
        "highpass=f=65",
        "equalizer=f=6500:width_type=o:width=1.2:g=-3",
        "equalizer=f=200:width_type=o:width=1.5:g=1.5",
        "equalizer=f=3000:width_type=o:width=1.5:g=-1.5",
        "equalizer=f=9000:width_type=o:width=1.5:g=1.5",
        "acompressor=threshold=-20dB:ratio=2.5:attack=20:release=200:makeup=2dB",
        "acompressor=threshold=-6dB:ratio=4:attack=5:release=50:makeup=1dB",
        "aecho=0.8:0.7:20:0.06",
        "loudnorm=I=-16:TP=-1:LRA=7",
      ])
      .save(rutaSalida)
      .on("end", () => {
        console.log(`✅ Audio masterizado: ${rutaSalida}`);
        resolve();
      })
      .on("error", (err) => {
        reject(new Error(`Error de FFmpeg al masterizar: ${err.message}`));
      });
  });
}

// ============================================================
// Llama a la API para un solo trozo de SSML
// ============================================================
async function sintetizarTrozo(ssmlTrozo) {
  const respuesta = await fetch(
    `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { ssml: ssmlTrozo },
        voice: { languageCode: IDIOMA, name: VOZ },
        audioConfig: { audioEncoding: "LINEAR16" },
        enableTimePointing: ["SSML_MARK"],
      }),
    }
  );

  if (!respuesta.ok) {
    const errorTexto = await respuesta.text();
    throw new Error(`Error de la API de Google (${respuesta.status}): ${errorTexto}`);
  }

  const datos = await respuesta.json();
  return {
    audioBuffer: Buffer.from(datos.audioContent, "base64"),
    timepoints: datos.timepoints || [],
  };
}

// ============================================================
// Orquesta todo
// ============================================================
async function generarAudio(ssmlOriginal, nombreSalida) {
  const caracteresDeEsteAudio = contarCaracteresFacturables(ssmlOriginal);
  const contador = await leerContador();

  console.log(`📊 Caracteres facturables de este guion: ${caracteresDeEsteAudio}`);
  console.log(
    `📊 Llevás gastados este mes (todas las computadoras): ${contador.caracteres} de ${LIMITE_MENSUAL_GRATIS} gratis`
  );

  if (contador.caracteres + caracteresDeEsteAudio > MARGEN_SEGURIDAD) {
    console.error(
      `\n⛔ DETENIDO POR SEGURIDAD: superaría el margen de ${MARGEN_SEGURIDAD} caracteres este mes.`
    );
    process.exitCode = 1;
    return;
  }

  const trozos = partirSSML(ssmlOriginal);
  console.log(`\n✂️  El guion se partió en ${trozos.length} trozo(s) para respetar el límite de bytes de Google.`);

  const audiosBuffers = [];
  const timepointsGlobal = [];
  let offsetAcumulado = 0;

  for (let i = 0; i < trozos.length; i++) {
    console.log(`\n🎙️  Generando audio del trozo ${i + 1} de ${trozos.length}...`);
    const { audioBuffer, timepoints } = await sintetizarTrozo(trozos[i]);
    audiosBuffers.push(audioBuffer);

    timepoints.forEach((tp) => {
      timepointsGlobal.push({
        markName: tp.markName,
        timeSeconds: tp.timeSeconds + offsetAcumulado,
      });
    });

    const { duracionSegundos } = leerDatosWav(audioBuffer);
    offsetAcumulado += duracionSegundos;
    console.log(`   ✅ Trozo ${i + 1} generado (${duracionSegundos.toFixed(1)}s)`);
  }

  const { wavFinal, duracionTotal } = unirWavs(audiosBuffers);
  const rutaCruda = `${nombreSalida}_crudo.wav`;
  fs.writeFileSync(rutaCruda, wavFinal);
  console.log(`\n✅ Audio crudo guardado en: ${rutaCruda} (duración: ${duracionTotal.toFixed(1)}s)`);

  const rutaFinal = `${nombreSalida}_final.mp3`;
  await masterizarAudio(rutaCruda, rutaFinal);

  const rutaTimestamps = `${nombreSalida}_timestamps.json`;
  fs.writeFileSync(rutaTimestamps, JSON.stringify(timepointsGlobal, null, 2));
  console.log(`✅ Timestamps guardados en: ${rutaTimestamps}`);

  if (timepointsGlobal.length > 0) {
    console.log(`\n📍 Marcas encontradas:`);
    timepointsGlobal.forEach((tp) => {
      console.log(`   ${tp.markName}: segundo ${tp.timeSeconds.toFixed(2)}`);
    });
  } else {
    console.log(`\nℹ️  No se encontraron marcas <mark> en este guion (todavía no las agregamos al prompt).`);
  }

  contador.caracteres += caracteresDeEsteAudio;
  await guardarContador(contador);
  console.log(`\n📊 Nuevo total del mes (compartido, en Supabase): ${contador.caracteres} de ${LIMITE_MENSUAL_GRATIS} caracteres gratis`);
  console.log(`\n🎧 Archivo final listo para escuchar: ${rutaFinal}`);
}

// ============================================================
// Ejecución
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
