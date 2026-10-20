// ============================================================
// scripts/generar-fondo-miniatura.js
// ------------------------------------------------------------
// Genera con fal.ai la ILUSTRACIÓN de fondo de la miniatura
// (sin texto) usando el prompt que dejó el orquestador en
// youtube_metadata.json. El texto se agrega después con
// scripts/generar-miniatura.js.
//
// Uso:    node scripts/generar-fondo-miniatura.js <libro> <capitulo>
// Ej.:    node scripts/generar-fondo-miniatura.js filemon 1
//
// Lee:    prompts_output/<libro>/Capitulo_<n>/youtube_metadata.json
// Escribe: prompts_output/<libro>/Capitulo_<n>/miniatura_fondo.png
// ============================================================
import "dotenv/config";
import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// Modelo de mayor calidad que el de las escenas del video (flux/schnell):
// la miniatura es la pieza que decide el clic, y cuesta una sola imagen.
const MODELO = "fal-ai/flux/dev";

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("❌ Falta la variable FAL_KEY (archivo .env o secret de GitHub).");
  process.exit(1);
}
fal.config({ credentials: FAL_KEY });

const [libro, capitulo] = process.argv.slice(2);
if (!libro || !capitulo) {
  console.error("Uso: node scripts/generar-fondo-miniatura.js <libro> <capitulo>");
  process.exit(1);
}

const quitarTildes = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const dir = path.join(
  repoRoot,
  "prompts_output",
  quitarTildes(libro.toLowerCase()),
  `Capitulo_${capitulo}`,
);

const rutaMeta = path.join(dir, "youtube_metadata.json");
if (!fs.existsSync(rutaMeta)) {
  console.error(`❌ No se encontró ${rutaMeta}`);
  console.error("   Corre primero el orquestador para generar los metadatos.");
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(rutaMeta, "utf8"));
const prompt = meta.miniatura?.prompt_ilustracion;
if (!prompt || prompt.length < 40) {
  console.error("❌ El JSON no trae miniatura.prompt_ilustracion");
  process.exit(1);
}

console.log(`🎨 Generando la ilustración de la miniatura (${MODELO})...`);
console.log(`   Prompt: ${prompt.substring(0, 160)}...\n`);

async function generarUnaVez() {
  const result = await fal.subscribe(MODELO, {
    input: {
      prompt,
      image_size: { width: 1280, height: 720 },
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
    },
    logs: false,
  });
  const url = result.data?.images?.[0]?.url;
  if (!url) throw new Error("fal.ai no devolvió ninguna imagen");

  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} al descargar la imagen`);
  return Buffer.from(await respuesta.arrayBuffer());
}

let buffer = null;
for (let intento = 1; intento <= 2 && !buffer; intento++) {
  try {
    buffer = await generarUnaVez();
  } catch (e) {
    console.error(`   ⚠️ Intento ${intento} falló: ${e.message}`);
  }
}

if (!buffer) {
  console.error("❌ No se pudo generar la ilustración de la miniatura.");
  process.exit(1);
}

const salida = path.join(dir, "miniatura_fondo.png");
fs.writeFileSync(salida, buffer);
console.log(`✅ Ilustración guardada: ${salida} (${(buffer.length / 1024).toFixed(0)} KB)`);