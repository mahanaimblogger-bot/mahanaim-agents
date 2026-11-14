/* =====================================================================
   🛠️ HERRAMIENTA: REGENERADOR DE UNA SOLA IMAGEN
   =====================================================================
   Esta herramienta sirve para volver a generar ÚNICAMENTE una imagen
   específica si falló o no te gustó el resultado, sin tener que gastar
   tiempo y dinero regenerando todo el capítulo.

   ¿CÓMO SE USA? (Ejecutar en la terminal, en la raíz del proyecto)

   1. Modifica el prompt de la imagen que quieres cambiar en el archivo:
      prompts_output/<libro>/Capitulo_<capitulo>/prompts_imagenes_video.json

   2. Ejecuta el comando:
      node scripts/regenerar-imagen.js <libro> <capitulo> <numero_de_imagen>

   EJEMPLO:
   node scripts/regenerar-imagen.js efesios 2 13
   (Esto regenerará solo la imagen 13 de Efesios 2)

   NOTA: Asegúrate de tener configurada la variable FAL_KEY en tu .env
   ===================================================================== */

import "dotenv/config";
import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

// ── Configuración ────────────────────────────────────────────────
const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("❌ Error: Falta la variable FAL_KEY en tu .env");
  process.exit(1);
}
fal.config({ credentials: FAL_KEY });

// ── Argumentos ───────────────────────────────────────────────────
const args = process.argv.slice(2);
const bookName = args[0];
const chapterNum = args[1];
const imageIndex = parseInt(args[2], 10);

if (!bookName || !chapterNum || isNaN(imageIndex)) {
  console.error("Uso: node scripts/regenerar-imagen.js <libro> <capitulo> <numero_imagen>");
  console.error("Ejemplo: node scripts/regenerar-imagen.js efesios 2 13");
  process.exit(1);
}

// ── Rutas ────────────────────────────────────────────────────────
const repoRoot = process.cwd();
const chapterDir = path.join(repoRoot, "prompts_output", bookName, `Capitulo_${chapterNum}`);
const promptsPath = path.join(chapterDir, "prompts_imagenes_video.json");
const outputDir = path.join(chapterDir, "imagenes");

// ── Validaciones ─────────────────────────────────────────────────
if (!fs.existsSync(promptsPath)) {
  console.error(`❌ No se encontró el archivo de prompts en: ${promptsPath}`);
  process.exit(1);
}

const prompts = JSON.parse(fs.readFileSync(promptsPath, "utf-8"));

if (imageIndex < 1 || imageIndex > prompts.length) {
  console.error(`❌ El índice debe estar entre 1 y ${prompts.length}`);
  process.exit(1);
}

const promptText = prompts[imageIndex - 1];
const imageNumberStr = String(imageIndex).padStart(2, "0");
const filename = `imagen_${imageNumberStr}.png`;
const filepath = path.join(outputDir, filename);

console.log(`🎨 Regenerando la imagen ${imageIndex} (${filename})...`);
console.log(`📝 Prompt: ${promptText.substring(0, 100)}...\n`);

async function downloadImage(url, filepath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} al descargar`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
}

// ── Generación ───────────────────────────────────────────────────
async function regenerar() {
  try {
    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt: promptText,
        image_size: "landscape_16_9",
        num_inference_steps: 28,
        num_images: 1,
      },
      logs: false,
    });

    const imageUrl = result.data.images[0].url;
    await downloadImage(imageUrl, filepath);
    
    console.log(`\n✅ ¡Imagen ${imageIndex} regenerada y guardada con éxito!`);
    console.log(`📁 Ruta: ${filepath}`);
  } catch (error) {
    console.error(`❌ Error al regenerar la imagen ${imageIndex}:`, error.message);
    const detalle = error.response?.data || error.body || error.message;
    console.error("Detalle del error:", JSON.stringify(detalle, null, 2));
  }
}

regenerar();