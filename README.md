# mahanaim-agents

Agente de automatización para generar recursos (empezando por el
**estudio expositivo por capítulo**) del Centro de Recursos Bíblicos
Mahanaim, usando la API de DeepSeek y guardando los resultados en
Supabase como borradores para tu revisión.

Este proyecto es independiente de `mahanaim-app` — no la modifica,
solo se conecta a la misma base de datos Supabase.

---

## 1. Configuración inicial (una sola vez, en cada computadora)

### a) Clonar el repo
```bash
git clone https://github.com/TU-USUARIO/mahanaim-agents.git
cd mahanaim-agents
```

### b) Instalar dependencias
Necesitas [Node.js](https://nodejs.org) 18 o superior instalado.
```bash
npm install
```

### c) Configurar tus claves
```bash
cp .env.example .env
```
Abre `.env` y completa:
- `DEEPSEEK_API_KEY`: consíguela en https://platform.deepseek.com
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: los encuentras en tu
  proyecto de Supabase, en Settings → API. **Usa la `service_role key`,
  no la `anon key`** (la service_role tiene permisos de escritura).

El archivo `.env` NUNCA se sube a GitHub (está en `.gitignore`), así
que tienes que repetir este paso c) en cada computadora donde trabajes.

---

## 2. Cómo generar un estudio

```bash
node src/cli.js --libro=genesis --capitulo=4
```

Esto va a:
1. Revisar en Supabase si ya existe un estudio para Génesis 4 (si existe, no hace nada — usa `--forzar=true` para regenerar).
2. Leer `prompts/prompt-maestro.txt` (el Prompt Maestro completo).
3. Leer `indicaciones/genesis.md` por si guardaste alguna indicación especial para ese capítulo.
4. Llamar a la API de DeepSeek.
5. Validar automáticamente el HTML resultante (estructura, longitud mínima, etc.).
6. Guardar una copia local en `output/genesis-4.html` para que la revises.
7. Si pasó la validación, guardarlo en Supabase con `estado: "borrador"`.

### Parámetros opcionales
```bash
node src/cli.js --libro=genesis --capitulo=4 --video=https://youtube.com/watch?v=XXXX --imagen=https://... --minimoPalabras=4000 --forzar=true
```

---

## 3. Cómo agregar indicaciones especiales para un capítulo (Opción A)

Edita el archivo `indicaciones/<libro>.md` (créalo si no existe, copiando
el formato de `indicaciones/genesis.md`) y agrega una línea como:

```
Capítulo 15: Enfócate en el pacto abrahámico y la justificación por fe.
```

Guarda, haz `git add`, `git commit` y `git push` para que quede disponible
la próxima vez que trabajes desde otra computadora.

---

## 4. Trabajar desde distintas computadoras

Como todo vive en GitHub:
- Al llegar a una computadora nueva o distinta: `git pull` antes de empezar.
- Al terminar de trabajar (generaste estudios, editaste indicaciones, etc.):
  `git add .`, `git commit -m "mensaje"`, `git push`.
- Recuerda repetir el paso 1c (configurar `.env`) en cada computadora nueva,
  ya que ese archivo nunca se sincroniza por Git (por seguridad).

---

## 5. Correrlo sin depender de tu computadora (GitHub Actions)

Ya viene incluido un workflow en `.github/workflows/generar-estudio.yml`
que te permite generar un estudio directamente desde GitHub, sin usar tu
propia computadora:

1. Sube este repo a GitHub.
2. En GitHub, ve a **Settings → Secrets and variables → Actions** y agrega
   estos "secrets" (con los mismos valores que tienes en tu `.env`):
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_MODEL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Ve a la pestaña **Actions** del repo → "Generar estudio bíblico" →
   **Run workflow** → escribe el libro y el capítulo → **Run workflow**.
4. Cuando termine, puedes descargar el HTML generado desde los
   "Artifacts" de esa ejecución, y además ya habrá quedado guardado
   como borrador en Supabase.

Esto es gratis para uso normal (GitHub da minutos gratis de Actions
cada mes en repos privados y públicos).

---

## 6. Estructura del proyecto

```
mahanaim-agents/
├── .github/workflows/generar-estudio.yml   ← corre el agente desde GitHub
├── indicaciones/                            ← tus notas por libro/capítulo (Opción A)
│   └── genesis.md
├── prompts/
│   └── prompt-maestro.txt                   ← el Prompt Maestro completo
├── src/
│   ├── cli.js                               ← punto de entrada (línea de comandos)
│   ├── deepseekClient.js                    ← llamadas a la API de DeepSeek
│   ├── generarEstudio.js                    ← lógica principal del generador
│   ├── leerIndicaciones.js                  ← lee indicaciones/<libro>.md
│   ├── supabaseClient.js                    ← lee/guarda en Supabase
│   └── validarEstudio.js                    ← validación automática (sin IA)
├── output/                                  ← copias locales de estudios generados
├── .env.example                             ← plantilla de variables de entorno
└── .gitignore                               ← evita subir .env y node_modules
```

---

## 7. Esquema real de Supabase que usa este código

Ya ajustado a tu base de datos actual:

- **books**: `id`, `nombre`, `slug`, `testamento`, `capitulos`, `nombre_original`, `descripcion`, `orden`
- **chapters**: `id`, `book_id` (FK a books), `numero`, `resumen`
- **resources**: `id`, `chapter_id` (FK a chapters), `tipo`, `titulo` (obligatorio), `descripcion`, `contenido_html`, `slug`, `modo`, `publicado` (boolean), `destacado`, `orden`, `views`, etc.
- **verses**: `id`, `book_id`, `chapter`, `verse`, `text` — el texto real RVR1960, útil para validar tooltips.

El agente:
1. Busca el `id` del libro en `books` por su `slug` (ej: `genesis`).
2. Busca (o crea, si no existe) la fila correspondiente en `chapters`.
3. Guarda el recurso en `resources` con `chapter_id`, `tipo: "estudio"`,
   `titulo` (extraído automáticamente del `<h1>` del HTML generado),
   `slug`, `contenido_html`, `modo: "html"` y **`publicado: false`**
   (así queda como borrador, sin verse en tu sitio hasta que tú lo
   cambies a `true` desde el panel admin).

**Importante sobre los slugs de libros**: el código usa el mismo `slug`
que ya tienes en tu tabla `books` (ej: `genesis`, `1-samuel`). Verifica
el slug exacto de cada libro antes de correr el comando — si escribes
mal el slug, el agente te avisará con un error claro en vez de fallar
en silencio.

---

## 8. Próximos pasos sugeridos

- [ ] Agregar generadores para los demás tipos de recurso (cuestionario,
      ficha de personaje, glosario, devocional, hoja de trabajo, plan de
      lectura), siguiendo el mismo patrón que `generarEstudio.js`.
- [ ] Usar la tabla `verses` para validar automáticamente que los
      tooltips de RVR1960 en el HTML generado coincidan con el texto
      real, en vez de confiar ciegamente en lo que devuelve DeepSeek.
- [ ] Crear el orquestador que recorra todos los libros/capítulos y
      detecte automáticamente qué falta generar.
- [ ] Agregar el paso de audio (texto → voz) a partir del estudio ya guardado.
- [ ] Definir el proceso de video (NotebookLM u otro).
- [ ] Verificar el nombre exacto del modelo de DeepSeek vigente en
      https://api-docs.deepseek.com antes de escalar a producción.
