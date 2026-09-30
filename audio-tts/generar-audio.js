import "dotenv/config";
import fs from "fs";
import path from "path";

// ============================================================
// CONFIGURACIÓN
// ============================================================
const API_KEY = process.env.GOOGLE_TTS_API_KEY;
const VOZ = process.env.VOZ_TTS || "es-US-Wavenet-B"; // cambiá esto si elegís otra voz
const IDIOMA = "es-US"; // usá "es-ES" si tu voz elegida es de España

const LIMITE_MENSUAL_GRATIS = 4_000_000; // caracteres gratis/mes para Wavenet
const MARGEN_SEGURIDAD = 3_900_000; // nos detenemos antes de tocar el límite real

const ARCHIVO_CONTADOR = path.join(process.cwd(), "contador-caracteres.json");

// ============================================================
// CONTROL DE PRESUPUESTO MENSUAL
// ------------------------------------------------------------
// Guardamos, en un archivo simple, cuántos caracteres llevamos
// gastados en el mes actual. Si nos vamos a pasar del margen de
// seguridad, el script se niega a llamar a la API.
// ============================================================
function leerContador() {
  const mesActual = new Date().toISOString().slice(0, 7); // "2026-09"

  if (!fs.existsSync(ARCHIVO_CONTADOR)) {
    return { mes: mesActual, caracteres: 0 };
  }

  const datos = JSON.parse(fs.readFileSync(ARCHIVO_CONTADOR, "utf-8"));

  // Si cambiamos de mes, reiniciamos el contador
  if (datos.mes !== mesActual) {
    return { mes: mesActual, caracteres: 0 };
  }

  return datos;
}

function guardarContador(contador) {
  fs.writeFileSync(ARCHIVO_CONTADOR, JSON.stringify(contador, null, 2));
}

// ============================================================
// Cuenta los caracteres que realmente factura Google.
// Las marcas <mark .../> NO se cobran, así que las descontamos
// antes de contar (según la documentación oficial de precios).
// ============================================================
function contarCaracteresFacturables(ssml) {
  const sinMarcas = ssml.replace(/<mark[^>]*\/>/g, "");
  return sinMarcas.length;
}

// ============================================================
// Llama a la API de Google Cloud Text-to-Speech
// ============================================================
async function generarAudio(ssml, nombreSalida) {
  const caracteresDeEsteAudio = contarCaracteresFacturables(ssml);
  const contador = leerContador();

  console.log(
    `📊 Caracteres facturables de este guion: ${caracteresDeEsteAudio}`
  );
  console.log(
    `📊 Llevás gastados este mes: ${contador.caracteres} de ${LIMITE_MENSUAL_GRATIS} gratis`
  );

  if (contador.caracteres + caracteresDeEsteAudio > MARGEN_SEGURIDAD) {
    console.error(
      `\n⛔ DETENIDO POR SEGURIDAD: generar este audio llevaría el total mensual a ${
        contador.caracteres + caracteresDeEsteAudio
      }, superando el margen de seguridad de ${MARGEN_SEGURIDAD} caracteres.`
    );
    console.error(
      "   No se llamó a la API. Esperá al próximo mes o revisá el uso en Google Cloud Console."
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n🎙️  Generando audio con la voz ${VOZ}...`);

  const respuesta = await fetch(
    `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { ssml },
        voice: { languageCode: IDIOMA, name: VOZ },
        audioConfig: { audioEncoding: "MP3" },
        enableTimePointing: ["SSML_MARK"], // pide los timestamps de cada <mark>
      }),
    }
  );

  if (!respuesta.ok) {
    const errorTexto = await respuesta.text();
    throw new Error(`Error de la API de Google (${respuesta.status}): ${errorTexto}`);
  }

  const datos = await respuesta.json();

  // Guardar el audio (viene en base64)
  const audioBuffer = Buffer.from(datos.audioContent, "base64");
  const rutaAudio = `${nombreSalida}.mp3`;
  fs.writeFileSync(rutaAudio, audioBuffer);
  console.log(`✅ Audio guardado en: ${rutaAudio}`);

  // Guardar los timestamps de cada imagen
  const timepoints = datos.timepoints || [];
  const rutaTimestamps = `${nombreSalida}_timestamps.json`;
  fs.writeFileSync(rutaTimestamps, JSON.stringify(timepoints, null, 2));
  console.log(`✅ Timestamps guardados en: ${rutaTimestamps}`);
  console.log(`\n📍 Marcas encontradas:`);
  timepoints.forEach((tp) => {
    console.log(`   ${tp.markName}: segundo ${tp.timeSeconds}`);
  });

  // Actualizar el contador de caracteres del mes
  contador.caracteres += caracteresDeEsteAudio;
  guardarContador(contador);
  console.log(
    `\n📊 Nuevo total del mes: ${contador.caracteres} de ${LIMITE_MENSUAL_GRATIS} caracteres gratis`
  );

  return { rutaAudio, timepoints };
}

// ============================================================
// Ejecución: lee el guion desde un archivo pasado como argumento
// Uso: node generar-audio.js guion_video_tts.ssml
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