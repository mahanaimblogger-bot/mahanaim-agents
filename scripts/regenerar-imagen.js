import "dotenv/config";
import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("❌ Falta la variable FAL_KEY en tu .env");
  process.exit(1);
}

fal.config({ credentials: FAL_KEY });

const args = process.argv.slice(2);
const bookName = args[0];
const chapterNum = args[1];
const imageIndex = args[2]; // número de imagen a regenerar, ej: "11"

if (!bookName || !chapterNum || !imageIndex) {
  console.error(
    "Uso: node scripts/regenerar-imagen.js <libro> <capitulo> <numero_imagen>",
  );
  console.error("Ejemplo: node scripts/regenerar-imagen.js genesis 25 11");
  process.exit(1);
}

const repoRoot = process.cwd();
const chapterDir = path.join(
  repoRoot,
  "prompts_output",
  bookName,
  `Capitulo_${chapterNum}`,
);
const promptsPath = path.join(chapterDir, "prompts_imagenes_video.json");
const outputDir = path.join(chapterDir, "imagenes");

if (!fs.existsSync(promptsPath)) {
  console.error(`❌ No se encontró el archivo de prompts: ${promptsPath}`);
  process.exit(1);
}

const prompts = JSON.parse(fs.readFileSync(promptsPath, "utf-8"));
const indexInt = parseInt(imageIndex, 10) - 1;

if (indexInt < 0 || indexInt >= prompts.length) {
  console.error(`❌ Índice inválido. Debe ser entre 1 y ${prompts.length}`);
  process.exit(1);
}

// Leer el prompt actual y limpiar cualquier mención de cuernos/garras/pelaje animal
let promptText = prompts[indexInt];

// Reemplazar las menciones problemáticas
promptText = promptText
  .replace(/,?\s*no horns/gi, "")
  .replace(/,?\s*no claws/gi, "")
  .replace(/,?\s*no fur/gi, "")
  .replace(/,?\s*no animal features/gi, "")
  .replace(/,?\s*not fur/gi, "")
  .replace(/,?\s*human hair, not fur/gi, "human hair")
  .replace(
    /\s*—\s*human hair, not fur, no horns, no claws, no animal features/gi,
    "",
  )
  .replace(
    /\s*-\s*human hair, not fur, no horns, no claws, no animal features/gi,
    "",
  );

console.log(`\n📝 Prompt original (con menciones problemáticas):`);
console.log(`   ${prompts[indexInt].substring(0, 200)}...\n`);
console.log(`📝 Prompt corregido (sin menciones problemáticas):`);
console.log(`   ${promptText.substring(0, 200)}...\n`);

const filename = `imagen_${String(indexInt + 1).padStart(2, "0")}.png`;
const filepath = path.join(outputDir, filename);

async function downloadImage(url, filepath) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`HTTP ${response.status} al descargar la imagen`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
}

async function main() {
  console.log(`🖼️  Regenerando imagen ${indexInt + 1} con prompt corregido...`);
  try {
    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: promptText,
        image_size: "landscape_16_9",
        num_inference_steps: 4,
        num_images: 1,
      },
      logs: false,
    });
    const imageUrl = result.data.images[0].url;
    await downloadImage(imageUrl, filepath);
    console.log(`   ✅ Guardada: ${filename}`);
    console.log(`\n✨ Proceso terminado.`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
