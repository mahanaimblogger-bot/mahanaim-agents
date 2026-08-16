import { listarImagenesPendientes } from "./listarImagenesPendientes.js";

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
  node src/cliImagenesPendientes.js --libro=genesis --capitulo=4
`);
    process.exit(1);
  }

  const resultado = await listarImagenesPendientes({
    libro: args.libro,
    capitulo: parseInt(args.capitulo, 10),
  });

  // Salimos siempre con código 0 (éxito) aunque no se haya encontrado nada,
  // porque un "no encontrado" es una respuesta válida y esperada, no un
  // error del programa. Así el workflow de GitHub Actions no se marca
  // como fallido solo porque el capítulo no tenía estudio todavía.
  process.exit(0);
}

main().catch((error) => {
  console.error("\n💥 Error inesperado:", error.message);
  process.exit(1);
});
