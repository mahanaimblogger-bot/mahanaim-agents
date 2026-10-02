import "dotenv/config";
import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

// ── Configuración ────────────────────────────────────────────────
const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error(
    "❌ Error: Falta la variable FAL_KEY en tu .env (raíz del repo)",
  );
  process.exit(1);
}

fal.config({ credentials: FAL_KEY });

// ── Argumentos de línea de comandos ──────────────────────────────
const args = process.argv.slice(2);
const bookName = args[0]; // Ej: "genesis"
const chapterNum = args[1]; // Ej: "20"

if (!bookName || !chapterNum) {
  console.error("Uso: node scripts/generar-imagenes.js <libro> <capitulo>");
  console.error("Ejemplo: node scripts/generar-imagenes.js genesis 20");
  process.exit(1);
}

// ── Rutas (relativas a la raíz del repo) ─────────────────────────
const repoRoot = process.cwd();
const chapterDir = path.join(
  repoRoot,
  "prompts_output",
  bookName,
  `Capitulo_${chapterNum}`,
);
const promptsPath = path.join(chapterDir, "prompts_imagenes_video.json");
const outputDir = path.join(chapterDir, "imagenes");

// ── Validaciones ─────────────────────────────────────────────────
if (!fs.existsSync(promptsPath)) {
  console.error(
    `❌ No se encontró el archivo de prompts en:\n   ${promptsPath}`,
  );
  console.error(
    "   Corré primero el orquestador para generar los prompts multimedia.",
  );
  process.exit(1);
}

const prompts = JSON.parse(fs.readFileSync(promptsPath, "utf-8"));

if (!Array.isArray(prompts) || prompts.length === 0) {
  console.error("❌ El archivo de prompts está vacío o no es un array válido.");
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(
  `🎨 Generando ${prompts.length} imágenes para ${bookName} capítulo ${chapterNum}...`,
);
console.log(`📁 Salida: ${outputDir}\n`);

// ── Helper: descargar imagen ─────────────────────────────────────
async function downloadImage(url, filepath) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`HTTP ${response.status} al descargar la imagen`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
}

// ── Loop principal ───────────────────────────────────────────────
const resultado = { exitosas: 0, fallidas: 0, detalle: [] };

for (let i = 0; i < prompts.length; i++) {
  const promptText = prompts[i];
  const imageNumber = String(i + 1).padStart(2, "0");
  const filename = `imagen_${imageNumber}.png`;
  const filepath = path.join(outputDir, filename);

  console.log(`   🖼️  [${i + 1}/${prompts.length}] Generando imagen...`);

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
    console.log(`      ✅ Guardada: ${filename}`);
    resultado.exitosas++;
    resultado.detalle.push({ index: i + 1, archivo: filename, ok: true });
  } catch (error) {
    console.error(`      ❌ Error en imagen ${i + 1}: ${error.message}`);
    resultado.fallidas++;
    resultado.detalle.push({ index: i + 1, error: error.message, ok: false });
  }
}

// ── Resumen final ────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(`✨ Proceso terminado`);
console.log(`   ✅ Exitosas: ${resultado.exitosas}/${prompts.length}`);
console.log(`   ❌ Fallidas: ${resultado.fallidas}/${prompts.length}`);
console.log(`   📁 Carpeta:  ${outputDir}`);
console.log(`${"═".repeat(50)}\n`);

// Guardar log de resultados por si algo falla
const logPath = path.join(outputDir, "_log_generacion.json");
fs.writeFileSync(logPath, JSON.stringify(resultado, null, 2));
console.log(`📄 Log guardado en: ${logPath}`);
