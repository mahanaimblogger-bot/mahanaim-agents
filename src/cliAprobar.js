import { aprobarEstudio } from "./aprobarEstudio.js";

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
  node src/cliAprobar.js --libro=genesis --capitulo=4
  node src/cliAprobar.js --libro=genesis --capitulo=4 --tipo=estudio

Publica el borrador pendiente de ese capítulo. Si ya había una versión
publicada antes, la reemplaza (borra la vieja, publica la nueva).
`);
    process.exit(1);
  }

  const resultado = await aprobarEstudio({
    libro: args.libro,
    capitulo: parseInt(args.capitulo, 10),
    tipo: args.tipo || "estudio",
  });

  process.exit(resultado.exito ? 0 : 2);
}

main().catch((error) => {
  console.error("\n💥 Error inesperado:", error.message);
  process.exit(1);
});
