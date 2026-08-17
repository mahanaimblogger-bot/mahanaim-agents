import { incorporarImagenes } from "./incorporarImagenes.js";

function leerArgumentos() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [clave, ...resto] = arg.replace(/^--/, "").split("=");
    args[clave] = resto.join("="); // por si la URL trae "=" (poco común, pero por si acaso)
  }
  return args;
}

async function main() {
  const args = leerArgumentos();

  if (!args.libro || !args.capitulo) {
    console.log(`
Uso:
  node src/cliIncorporarImagenes.js --libro=galatas --capitulo=3 \\
    --portada="https://.../portada.png" \\
    --imagenes="https://.../imagen1.png,https://.../imagen2.png,https://.../imagen3.png"

Notas:
  --portada   es opcional (una sola URL). Si no la tienes lista, omite este parámetro.
  --imagenes  es una lista separada por comas, EN EL MISMO ORDEN que te mostró
              el agente "Listar imágenes pendientes" (imagen 1, imagen 2, imagen 3...).
              Si aún no tienes todas, pasa solo las que ya tengas — las demás
              quedan pendientes para una próxima corrida.
`);
    process.exit(1);
  }

  const urlPortada = args.portada && args.portada.trim() ? args.portada.trim() : null;
  const urlsContenido = args.imagenes
    ? args.imagenes
        .split(",")
        .map((url) => url.trim())
        .filter((url) => url.length > 0)
    : [];

  const resultado = await incorporarImagenes({
    libro: args.libro,
    capitulo: parseInt(args.capitulo, 10),
    urlPortada,
    urlsContenido,
  });

  process.exit(resultado.exito ? 0 : 2);
}

main().catch((error) => {
  console.error("\n💥 Error inesperado:", error.message);
  process.exit(1);
});
