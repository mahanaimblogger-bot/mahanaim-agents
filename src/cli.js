import { generarEstudio } from "./generarEstudio.js";

/**
 * Lee argumentos tipo --libro=genesis --capitulo=4 y los convierte en objeto.
 */
function leerArgumentos() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [clave, valor] = arg.replace(/^--/, "").split("=");
    args[clave] = valor;
  }
  return args;
}

async function main() {
  const args = leerArgumentos();

  if (!args.libro || !args.capitulo) {
    console.log(`
Uso:
  node src/cli.js --libro=genesis --capitulo=4
  node src/cli.js --libro=genesis --capitulo=4 --video=https://youtube.com/watch?v=XXXX
  node src/cli.js --libro=genesis --capitulo=4 --forzar=true

Parámetros opcionales:
  --video=URL         Enlace de YouTube (por defecto: SIN VIDEO)
  --imagen=URL        Enlace de imagen de portada (por defecto: SIN IMAGEN)
  --minimoPalabras=N  Mínimo de palabras a exigir (por defecto: 3500)
  --forzar=true       Regenera aunque ya exista el recurso
`);
    process.exit(1);
  }

  const resultado = await generarEstudio({
    libro: args.libro,
    capitulo: parseInt(args.capitulo, 10),
    video: args.video || "SIN VIDEO",
    imagen: args.imagen || "SIN IMAGEN",
    minimoPalabras: args.minimoPalabras ? parseInt(args.minimoPalabras, 10) : 3500,
    forzar: args.forzar === "true",
  });

  if (resultado.omitido) {
    process.exit(0);
  }

  process.exit(resultado.valido ? 0 : 2);
}

main().catch((error) => {
  console.error("\n💥 Error inesperado:", error.message);
  process.exit(1);
});
