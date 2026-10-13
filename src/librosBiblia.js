import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Resuelve el nombre o abreviatura de un libro bíblico a su slug de libros.json.
 *
 * Reglas:
 *  - Coincidencia EXACTA (nunca "contiene"): "Ro" solo es Romanos, "Is" solo Isaías.
 *  - No distingue mayúsculas, tildes, puntos ni espacios: "Éx", "ex.", "1 Co", "1co", "1 Corintios".
 *  - Si no lo reconoce devuelve null (mejor no validar una cita que validarla contra el libro equivocado).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libros = JSON.parse(
  readFileSync(path.join(__dirname, "..", "libros.json"), "utf-8")
);

/** "Éx." -> "ex" | "1 Co" -> "1co" | "1-corintios" -> "1corintios" */
export function normalizarClaveLibro(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\s-]+/g, "");
}

// Abreviaturas de uso común en español (RVR1960 y similares), por slug.
// Se omitieron a propósito las que son ambiguas entre dos libros.
const ABREVIATURAS = {
  genesis: ["gn", "gen"],
  exodo: ["ex", "exo", "exod"],
  levitico: ["lv", "lev"],
  numeros: ["nm", "num"],
  deuteronomio: ["dt", "deut"],
  josue: ["jos"],
  jueces: ["jue"],
  rut: ["rt"],
  "1-samuel": ["1s", "1sam"],
  "2-samuel": ["2s", "2sam"],
  "1-reyes": ["1r", "1re", "1rey"],
  "2-reyes": ["2r", "2re", "2rey"],
  "1-cronicas": ["1cr", "1cron"],
  "2-cronicas": ["2cr", "2cron"],
  esdras: ["esd"],
  nehemias: ["neh"],
  ester: ["est"],
  salmos: ["sal", "salmo"],
  proverbios: ["pr", "prov"],
  eclesiastes: ["ec", "ecl"],
  cantares: ["cnt", "cant", "cantar", "cantardeloscantares"],
  isaias: ["is", "isa"],
  jeremias: ["jer"],
  lamentaciones: ["lm", "lam"],
  ezequiel: ["ez", "eze", "ezeq"],
  daniel: ["dn", "dan"],
  oseas: ["os", "ose"],
  joel: ["jl"],
  amos: ["am"],
  abdias: ["abd"],
  jonas: ["jon"],
  miqueas: ["mi", "miq"],
  nahum: ["nah"],
  habacuc: ["hab"],
  sofonias: ["sof"],
  hageo: ["hag"],
  zacarias: ["zac"],
  malaquias: ["mal"],
  mateo: ["mt", "mat"],
  marcos: ["mr", "mc", "mar"],
  lucas: ["lc", "luc"],
  juan: ["jn"],
  hechos: ["hch", "hech"],
  romanos: ["ro", "rom"],
  "1-corintios": ["1co", "1cor"],
  "2-corintios": ["2co", "2cor"],
  galatas: ["ga", "gal"],
  efesios: ["ef", "efe"],
  filipenses: ["fil", "filip"],
  colosenses: ["col"],
  "1-tesalonicenses": ["1ts", "1tes"],
  "2-tesalonicenses": ["2ts", "2tes"],
  "1-timoteo": ["1ti", "1tim"],
  "2-timoteo": ["2ti", "2tim"],
  tito: ["tit"],
  filemon: ["flm", "filem"],
  hebreos: ["he", "heb"],
  santiago: ["stg", "snt", "sant", "stgo"],
  "1-pedro": ["1p", "1pe", "1ped"],
  "2-pedro": ["2p", "2pe", "2ped"],
  "1-juan": ["1jn"],
  "2-juan": ["2jn"],
  "3-juan": ["3jn"],
  judas: ["jud"],
  apocalipsis: ["ap", "apoc"],
};

const MAPA = new Map();

function registrar(clave, slug) {
  if (!clave) return;
  const previo = MAPA.get(clave);
  if (previo && previo !== slug) {
    console.warn(`⚠️ librosBiblia: la clave "${clave}" ya apunta a "${previo}", se ignora para "${slug}".`);
    return;
  }
  MAPA.set(clave, slug);
}

for (const libro of libros) {
  registrar(normalizarClaveLibro(libro.nombre), libro.slug); // "Génesis"
  registrar(normalizarClaveLibro(libro.slug), libro.slug);   // "genesis" / "1-samuel"
  for (const alias of ABREVIATURAS[libro.slug] || []) {
    registrar(normalizarClaveLibro(alias), libro.slug);
  }
}

/**
 * @param {string} nombre - ej: "Ro", "1 Co", "Génesis", "Éx."
 * @returns {string|null} slug de libros.json, o null si no se reconoce
 */
export function resolverSlugLibro(nombre) {
  if (!nombre) return null;
  return MAPA.get(normalizarClaveLibro(nombre)) || null;
}
