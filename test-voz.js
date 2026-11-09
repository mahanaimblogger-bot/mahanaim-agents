import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, ".");

// Cargar .env de la raíz y de audio-tts
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, "audio-tts", ".env") });

const API_KEY = process.env.GOOGLE_TTS_API_KEY;
const VOZ = "es-US-Chirp3-HD-Algieba"; // La nueva voz
const IDIOMA = "es-US";

// Un texto corto y representativo de tu canal
const textoPrueba = `
  Mientras estaban reunidos, Jesús les ordenó permanecer en Jerusalén y esperar la promesa del Padre: que serían bautizados con el Espíritu Santo dentro de pocos días. Los discípulos le preguntaron si en ese momento restauraría el reino a Israel, pero Jesús respondió que los tiempos pertenecen solo al Padre. Les aseguró que recibirían poder cuando el Espíritu Santo descendiera sobre ellos y serían sus testigos en Jerusalén, Judea, Samaria y hasta los confines de la tierra. Después de decir esto, Jesús fue elevado y una nube lo ocultó de su vista. Mientras ellos miraban al cielo, aparecieron dos hombres vestidos de blanco que les dijeron que Jesús volvería de la misma manera en que lo habían visto ascender. Los discípulos regresaron a Jerusalén desde el monte de los Olivos, un trayecto corto según la tradición del día de reposo. Allí se reunieron en el aposento alto: Pedro, Juan, Jacobo, Andrés, Felipe, Tomás, Bartolomé, Mateo, Jacobo hijo de Alfeo, Simón el Zelote y Judas hermano de Jacobo, junto con algunas mujeres, María la madre de Jesús y los hermanos de Jesús. En esos días, Pedro se puso de pie ante unas ciento veinte personas y explicó que debía cumplirse lo anunciado en la Escritura sobre Judas, quien había guiado a los que arrestaron a Jesús y luego murió de manera trágica, motivo por el cual el campo que adquirió fue llamado Campo de Sangre. Pedro afirmó que era necesario elegir a alguien que hubiera acompañado al grupo desde el bautismo de Juan hasta la ascensión de Jesús, para ser testigo de su resurrección. Propusieron a dos hombres: José, llamado Barsabás y también Justo, y Matías. Oraron pidiendo que el Señor mostrara a quién había escogido para ocupar el lugar que Judas dejó. Luego echaron suertes, y la elección recayó en Matías, quien fue contado entre los once apóstoles.
`;

async function probarVoz() {
  if (!API_KEY) {
    console.error("❌ Error: Falta GOOGLE_TTS_API_KEY en tus archivos .env");
    return;
  }

  console.log(`🎙️  Generando audio de prueba con la voz: ${VOZ}...`);

  try {
    const respuesta = await fetch(
      `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: textoPrueba },
          voice: { languageCode: IDIOMA, name: VOZ },
          audioConfig: { audioEncoding: "MP3" }, // Pedimos MP3 directo para escucharlo fácil
        }),
      }
    );

    if (!respuesta.ok) {
      const error = await respuesta.text();
      throw new Error(error);
    }

    const datos = await respuesta.json();
    const buffer = Buffer.from(datos.audioContent, "base64");
    
    const nombreArchivo = "prueba-voz-algieba.mp3";
    fs.writeFileSync(nombreArchivo, buffer);
    
    console.log(`\n✅ ¡Listo! Audio guardado como: ${nombreArchivo}`);
    console.log(`🎧 Ábrelo y escúchalo para comparar con la voz anterior.`);

  } catch (error) {
    console.error("❌ Error al generar el audio:", error.message);
  }
}

probarVoz();