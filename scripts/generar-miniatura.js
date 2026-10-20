// ============================================================
// scripts/generar-miniatura.js
// ------------------------------------------------------------
// Superpone el texto (etiqueta + gancho + complemento) sobre la
// ilustración de fondo y deja una miniatura de YouTube:
//   1280x720, JPG, menos de 2 MB.
//
// Uso:
//   node scripts/generar-miniatura.js <libro> <capitulo> [--fondo=ruta]
//   ej: node scripts/generar-miniatura.js filemon 1
//
// Lee:    prompts_output/<libro>/Capitulo_<n>/youtube_metadata.json
//         prompts_output/<libro>/Capitulo_<n>/miniatura_fondo.(png|jpg|webp)
// Escribe: prompts_output/<libro>/Capitulo_<n>/miniatura.jpg
//
// Requiere: npm install @napi-rs/canvas
//           assets/fonts/Anton-Regular.ttf  (Google Fonts, licencia OFL)
// ============================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const W = 1280;
const H = 720;
const LIMITE_BYTES = 1_900_000; // YouTube acepta hasta 2 MB
const RUTA_FUENTE = path.join(repoRoot, "assets", "fonts", "Anton-Regular.ttf");

// ── Argumentos ────────────────────────────────────────────────────
const posicionales = [];
const opciones = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--")) {
    const i = a.indexOf("=");
    if (i === -1) opciones[a.slice(2)] = true;
    else opciones[a.slice(2, i)] = a.slice(i + 1);
  } else {
    posicionales.push(a);
  }
}
const [libro, capitulo] = posicionales;
if (!libro || !capitulo) {
  console.error("Uso: node scripts/generar-miniatura.js <libro> <capitulo> [--fondo=ruta]");
  process.exit(1);
}

const quitarTildes = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const dir = path.join(
  repoRoot,
  "prompts_output",
  quitarTildes(libro.toLowerCase()),
  `Capitulo_${capitulo}`,
);

// ── Validaciones ──────────────────────────────────────────────────
if (!fs.existsSync(RUTA_FUENTE)) {
  console.error(`❌ Falta la fuente: ${RUTA_FUENTE}`);
  console.error("   Descárgala de Google Fonts (Anton) y guárdala en assets/fonts/.");
  process.exit(1);
}
GlobalFonts.registerFromPath(RUTA_FUENTE, "Anton");

const rutaMeta = path.join(dir, "youtube_metadata.json");
if (!fs.existsSync(rutaMeta)) {
  console.error(`❌ No se encontró ${rutaMeta}`);
  process.exit(1);
}
const meta = JSON.parse(fs.readFileSync(rutaMeta, "utf8"));
const mini = meta.miniatura || {};

let rutaFondo = typeof opciones.fondo === "string" ? opciones.fondo : null;
if (!rutaFondo) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const candidata = path.join(dir, `miniatura_fondo.${ext}`);
    if (fs.existsSync(candidata)) {
      rutaFondo = candidata;
      break;
    }
  }
}
if (!rutaFondo || !fs.existsSync(rutaFondo)) {
  console.error(`❌ No se encontró la ilustración de fondo (miniatura_fondo.png) en ${dir}`);
  process.exit(1);
}

// ── Textos ────────────────────────────────────────────────────────
const etiqueta = String(mini.etiqueta || "").toUpperCase();
const principal = String(mini.texto_principal || "").toUpperCase();
const secundario = String(mini.texto_secundario || "").toUpperCase();
const textoAlaDerecha = mini.lado_texto !== "left";

if (!principal) {
  console.error("❌ El JSON no tiene miniatura.texto_principal");
  process.exit(1);
}

// ── Estilo (inspirado en las miniaturas de referencia) ────────────
//  - Tipografía condensada y muy gruesa (Anton)
//  - Etiqueta y gancho en blanco, con contorno negro grueso y RELIEVE 3D
//  - Complemento en AMARILLO-DORADO sobre una FRANJA ROJA ligeramente
//    inclinada, con borde negro y filo dorado
const ESTILOS = {
  blanco: { degradado: ["#FFFFFF", "#F6F6F6", "#C9C9C9"] },
  oro: { degradado: ["#FFF6A8", "#FFD21F", "#FF9F00"] },
};

function medir(ctx, texto, tam) {
  ctx.font = `${tam}px Anton`;
  const m = ctx.measureText(texto);
  return {
    ancho: m.width,
    asc: m.actualBoundingBoxAscent,
    desc: m.actualBoundingBoxDescent,
  };
}

/** Parte el texto en 1 o 2 líneas y calcula el mayor tamaño que cabe. */
function ajustar(ctx, texto, anchoMax, tamMax, tamMinUnaLinea) {
  let tam = tamMax;
  while (tam > 30 && medir(ctx, texto, tam).ancho > anchoMax) tam -= 2;
  if (tam >= tamMinUnaLinea || !texto.includes(" ")) {
    return { lineas: [texto], tam };
  }
  const palabras = texto.split(" ");
  let mejor = null;
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(" ");
    const b = palabras.slice(i).join(" ");
    const dif = Math.abs(a.length - b.length);
    if (!mejor || dif < mejor.dif) mejor = { a, b, dif };
  }
  let tam2 = tamMax;
  while (
    tam2 > 30 &&
    Math.max(medir(ctx, mejor.a, tam2).ancho, medir(ctx, mejor.b, tam2).ancho) > anchoMax
  ) {
    tam2 -= 2;
  }
  return { lineas: [mejor.a, mejor.b], tam: tam2 };
}

/**
 * Texto con contorno negro grueso, relieve 3D hacia abajo-derecha
 * y relleno con degradado vertical.
 */
function dibujarLinea(ctx, texto, cx, baseY, tam, estiloNombre, relieve = 0, grosorFactor = 0.3) {
  const estilo = ESTILOS[estiloNombre];
  ctx.font = `${tam}px Anton`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  const grosor = tam * grosorFactor;

  // 1) sombra proyectada
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = tam * 0.2;
  ctx.shadowOffsetX = tam * 0.05;
  ctx.shadowOffsetY = tam * 0.1;
  ctx.lineWidth = grosor;
  ctx.strokeStyle = "#000000";
  ctx.strokeText(texto, cx + relieve, baseY + relieve);
  ctx.restore();

  // 2) relieve: copias del contorno desplazadas (efecto 3D)
  if (relieve > 0) {
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = grosor;
    for (let i = relieve; i >= 1; i -= 1) {
      ctx.strokeText(texto, cx + i, baseY + i);
    }
  }

  // 3) contorno negro frontal
  ctx.lineWidth = grosor;
  ctx.strokeStyle = "#000000";
  ctx.strokeText(texto, cx, baseY);

  // 4) relleno con degradado
  const g = ctx.createLinearGradient(0, baseY - tam * 0.8, 0, baseY);
  g.addColorStop(0, estilo.degradado[0]);
  g.addColorStop(0.5, estilo.degradado[1]);
  g.addColorStop(1, estilo.degradado[2]);
  ctx.fillStyle = g;
  ctx.fillText(texto, cx, baseY);
}

function rectRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Mide cuánto ocupa la franja roja con su texto. */
function medirFranja(ctx, texto, tam) {
  const m = medir(ctx, texto, tam);
  const padX = tam * 0.6;
  const padY = tam * 0.34;
  return {
    m,
    padX,
    padY,
    w: m.ancho + padX * 2,
    h: m.asc + m.desc + padY * 2,
  };
}

/** Franja roja inclinada con el texto dorado encima. */
function dibujarFranja(ctx, texto, cx, cy, tam) {
  const { m, padY, w, h } = medirFranja(ctx, texto, tam);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.03);

  // sombra + relleno rojo
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  const rojo = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  rojo.addColorStop(0, "#FF2A12");
  rojo.addColorStop(0.55, "#D40A00");
  rojo.addColorStop(1, "#8F0000");
  ctx.fillStyle = rojo;
  rectRedondeado(ctx, -w / 2, -h / 2, w, h, 10);
  ctx.fill();
  ctx.shadowColor = "transparent";

  // borde negro grueso + filo dorado interior
  ctx.lineJoin = "round";
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#000000";
  rectRedondeado(ctx, -w / 2, -h / 2, w, h, 10);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#FFC21A";
  rectRedondeado(ctx, -w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 6);
  ctx.stroke();

  // texto dorado con contorno negro
  const baseY = -h / 2 + padY + m.asc;
  dibujarLinea(ctx, texto, 0, baseY, tam, "oro", 0, 0.13);
  ctx.restore();
}

// ── Composición ───────────────────────────────────────────────────
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Fondo: recorte "cover" con más contraste y color
const img = await loadImage(rutaFondo);
const escala = Math.max(W / img.width, H / img.height);
const dw = img.width * escala;
const dh = img.height * escala;
ctx.filter = "contrast(1.12) saturate(1.2)";
ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
ctx.filter = "none";

// Oscurecer suavemente el lado del texto
const zonaAncho = W * 0.45;
const zonaX0 = textoAlaDerecha ? W * 0.5 : W * 0.05;
const sombra = ctx.createLinearGradient(
  textoAlaDerecha ? W * 0.38 : W * 0.62,
  0,
  textoAlaDerecha ? W : 0,
  0,
);
sombra.addColorStop(0, "rgba(0,0,0,0)");
sombra.addColorStop(1, "rgba(0,0,0,0.55)");
ctx.fillStyle = sombra;
ctx.fillRect(0, 0, W, H);

// Viñeta suave
const vin = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
vin.addColorStop(0, "rgba(0,0,0,0)");
vin.addColorStop(1, "rgba(0,0,0,0.35)");
ctx.fillStyle = vin;
ctx.fillRect(0, 0, W, H);

// Armar los bloques (de arriba hacia abajo)
const cx = zonaX0 + zonaAncho / 2;
const bloques = [];

if (etiqueta) {
  const t = ajustar(ctx, etiqueta, zonaAncho * 0.85, 62, 40);
  bloques.push({ tipo: "texto", lineas: t.lineas, tam: t.tam, estilo: "blanco" });
}
const p = ajustar(ctx, principal, zonaAncho, 140, 80);
bloques.push({ tipo: "texto", lineas: p.lineas, tam: p.tam, estilo: "blanco" });

if (secundario) {
  // La franja (texto + márgenes) debe caber en la zona
  let tam = 80;
  while (tam > 36 && medirFranja(ctx, secundario, tam).w > zonaAncho) tam -= 2;
  bloques.push({ tipo: "franja", texto: secundario, tam });
}

// Altura de cada bloque y centrado vertical
const GAP = 18;
const alturas = bloques.map((b) => {
  if (b.tipo === "franja") return medirFranja(ctx, b.texto, b.tam).h;
  return b.lineas.reduce((acc, l) => {
    const m = medir(ctx, l, b.tam);
    return acc + m.asc + m.desc + 8;
  }, -8);
});
const total = alturas.reduce((a, b) => a + b, 0) + GAP * (bloques.length - 1);

let y = (H - total) / 2;
bloques.forEach((b, i) => {
  if (b.tipo === "franja") {
    dibujarFranja(ctx, b.texto, cx, y + alturas[i] / 2, b.tam);
  } else {
    let yy = y;
    b.lineas.forEach((l) => {
      const m = medir(ctx, l, b.tam);
      dibujarLinea(ctx, l, cx, yy + m.asc, b.tam, b.estilo, Math.round(b.tam * 0.07));
      yy += m.asc + m.desc + 8;
    });
  }
  y += alturas[i] + GAP;
});

// ── Exportar (JPG por debajo de 2 MB) ─────────────────────────────
let calidad = 92;
let buffer = await canvas.encode("jpeg", calidad);
while (buffer.length > LIMITE_BYTES && calidad > 60) {
  calidad -= 6;
  buffer = await canvas.encode("jpeg", calidad);
}

const salida = path.join(dir, "miniatura.jpg");
fs.writeFileSync(salida, buffer);
console.log(
  `✅ Miniatura creada: ${salida} (${W}x${H}, ${(buffer.length / 1024).toFixed(0)} KB, calidad ${calidad})`,
);
if (buffer.length > 2_000_000) {
  console.error("⚠️ Pesa más de 2 MB; YouTube la rechazaría.");
  process.exitCode = 1;
}