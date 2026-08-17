# mahanaim-agents

Agentes de automatización para generar recursos (estudios expositivos
por capítulo, con imágenes) del Centro de Recursos Bíblicos Mahanaim,
usando la API de DeepSeek y guardando todo en Supabase como borrador
hasta que tú decidas publicarlo.

Este proyecto es independiente de `mahanaim-app` — no la modifica,
solo se conecta a la misma base de datos Supabase.

---

## Cómo funciona el pipeline completo (3 etapas)

ETAPA 1 — Generar el estudio (DeepSeek)
↓ Se guarda en Supabase con publicado: false

ETAPA 2A — Listar imágenes pendientes (solo lectura)
↓ Te da un .txt con los prompts de cada imagen sugerida

(Generas las imágenes tú mismo, gratis, donde prefieras — ej. Qwen)
(Subes cada imagen a Supabase Storage y copias su URL pública)

ETAPA 2B — Incorporar imágenes
↓ Reemplaza los marcadores por las imágenes reales en el mismo registro

PASO FINAL — Publicar (manual, lo haces tú)
↓ Cambias "publicado" de false a true cuando estés conforme


---

## 1. Configuración inicial (una sola vez, por computadora)

### a) Clonar el repo
```bash
git clone https://github.com/TU-USUARIO/mahanaim-agents.git
cd mahanaim-agents
```

### b) Instalar dependencias
Necesitas [Node.js](https://nodejs.org) **22 o superior** (versiones anteriores, como la 18 o 20, dan error de WebSocket al conectar con Supabase).
```bash
npm install
```

### c) Configurar tus claves
```bash
cp .env.example .env
```
Abre `.env` y completa:
- `DEEPSEEK_API_KEY` — desde https://platform.deepseek.com (necesita saldo cargado; no hay tier gratis permanente para la API).
- `DEEPSEEK_MODEL` — `deepseek-chat`.
- `SUPABASE_URL` — la URL de tu proyecto, **sin** `/rest/v1/` al final.
- `SUPABASE_SERVICE_ROLE_KEY` — la clave `service_role` (Legacy) de Supabase, con permisos de escritura. **Nunca** la `anon key`.

El archivo `.env` NUNCA se sube a GitHub (está en `.gitignore`), así
que hay que repetir este paso en cada computadora donde trabajes.

### d) Secrets en GitHub (para correr todo desde Actions, sin depender de tu compu)
En GitHub → **Settings → Secrets and variables → Actions**, agrega los mismos 4 valores de arriba como "Repository secrets":
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### e) Permisos en Supabase (una sola vez)
El rol `service_role` necesita permiso explícito sobre algunas tablas. Corre esto una vez en el SQL Editor de Supabase:
```sql
grant select, insert, update, delete on table public.chapters to service_role;
grant select, insert, update, delete on table public.resources to service_role;
grant select, insert, update, delete on table public.resource_tags to service_role;
grant usage, select on all sequences in schema public to service_role;
```

---

## 2. Trabajar desde distintas computadoras (trabajo, casa, etc.)

Como todo vive en GitHub:
- Al llegar a una computadora nueva o distinta: `git pull` antes de empezar.
- Al terminar de trabajar (generaste estudios localmente, editaste indicaciones, etc.): `git add .`, `git commit -m "mensaje"`, `git push`.
- Repite el paso 1c (configurar `.env`) en cada computadora nueva — ese archivo nunca se sincroniza por Git, a propósito, por seguridad.
- Si prefieres no instalar nada en una computadora (ej. la del trabajo), puedes correr todo directamente desde la pestaña **Actions** de GitHub — no depende de tu computadora en absoluto.

---

## 3. ETAPA 1 — Generar un estudio

**Desde GitHub Actions:** pestaña **Actions** → **"Generar estudio bíblico"** → **Run workflow** → completa:
- `libro`: el slug exacto (ver `libros.json`), ej. `genesis`, `1-samuel`.
- `capitulo`: número del capítulo.
- `forzar`: `true` para regenerar uno que ya existe, `false` si es nuevo.
- `indicaciones`: (opcional) una instrucción puntual para este capítulo, ej. "Enfócate en la genealogía cainita". Si lo dejas vacío, el agente busca en `indicaciones/<libro>.md` (Opción A, editable en el repo).

**⚠️ Importante sobre `forzar=true`:** actualmente esto **inserta un registro nuevo** en vez de reemplazar el anterior, dejando un duplicado en la tabla `resources`. Hasta que se corrija esto en el código (ver sección 10, pendientes), si usas `forzar=true`, después borra manualmente el registro viejo:
```sql
select id, titulo, created_at
from resources
where chapter_id = (
  select id from chapters
  where book_id = (select id from books where slug = 'TU_LIBRO')
  and numero = TU_CAPITULO
)
and tipo = 'estudio'
order by created_at;
-- anota el id más antiguo (el duplicado viejo) y bórralo:
delete from resources where id = AQUI_EL_ID;
```

**Desde tu computadora:**
```bash
node src/cli.js --libro=genesis --capitulo=4
```

Parámetros opcionales:
```bash
node src/cli.js --libro=genesis --capitulo=4 --video=https://youtube.com/watch?v=XXXX --imagen=https://... --minimoPalabras=4000 --forzar=true --indicaciones="tu indicación aquí"
```
- `--video`: URL de YouTube a incrustar (opcional).
- `--imagen`: URL de imagen de portada YA existente, si no quieres que el modelo solo sugiera una (opcional).
- `--minimoPalabras`: cambia el mínimo exigido en la validación (por defecto 3500).
- `--indicaciones`: mismo campo que en GitHub Actions, tiene prioridad sobre `indicaciones/<libro>.md`.

**Qué hace:**
1. Busca el `book_id` en `books` por `slug`.
2. Busca (o crea) el `chapter_id` en `chapters`.
3. Revisa si ya existe un recurso tipo "estudio" para ese capítulo (si existe y no usaste `forzar=true`, no hace nada).
4. Arma el prompt con `prompts/prompt-maestro.txt` + tus indicaciones.
5. Llama a DeepSeek (hasta 32,000 tokens de salida).
6. Valida automáticamente la estructura (índice, apéndice, longitud mínima, etc. — ver `src/validarEstudio.js`).
7. Guarda una copia local en `output/<libro>-<capitulo>.html` (para revisar aunque falle la validación).
8. Si pasa la validación, lo guarda en `resources` con `titulo` (extraído automáticamente del `<h1>`), `slug`, `contenido_html`, `modo: "html"` y **`publicado: false`**.

**El estudio generado incluye, por diseño del Prompt Maestro:**
- Estructura verso a verso progresiva: cada bloque temático tiene su propia caja de cita (`cita-versiculo`) seguida de su exposición, cubriendo el capítulo completo de principio a fin.
- Entre 2 y 4 marcadores `<!-- IMAGEN_SUGERIDA: ... -->` (imagen o diagrama conceptual, según convenga) distribuidos en el desarrollo.
- 1 marcador `<!-- IMAGEN_SUGERIDA_PORTADA: ... -->`, con estilo fotorrealista y el título del estudio integrado como texto dorado — pensado como miniatura tipo YouTube/cartel de película.
- Título 100% original (nunca reciclado de los ejemplos de estilo del propio prompt).

---

## 4. ETAPA 2A — Listar imágenes pendientes

Este agente **solo lee** — nunca genera ni crea nada, así que es seguro correrlo cuantas veces quieras.

**Desde GitHub Actions:** **Actions** → **"Listar imágenes pendientes"** → **Run workflow** → `libro` + `capitulo`.

**Desde tu computadora:**
```bash
node src/cliImagenesPendientes.js --libro=galatas --capitulo=3
```

Da mensajes claros si:
- El libro no existe.
- El capítulo no tiene ningún estudio generado todavía (Etapa 1 pendiente).
- El estudio existe pero no tiene marcadores de imagen.

**Resultado:** un archivo `output/<libro>-<capitulo>-imagenes-pendientes.txt` (descargable como artefacto en GitHub Actions) con la lista numerada: portada + cada imagen de contenido, lista para copiar como prompt en tu generador de imágenes favorito (ej. Qwen, gratis).

---

## 5. Generar las imágenes y subirlas (manual, gratis)

1. Copia cada prompt del `.txt` y genera la imagen donde prefieras.
2. Ve a Supabase → **Storage** → bucket **`estudios`** (público).
3. Crea una carpeta por capítulo, ej. `imagenes/galatas/capitulo_3/`.
4. Sube cada imagen (nombre sugerido: `portada`, `imagen1`, `imagen2`, `imagen3` — la extensión es opcional, Supabase sirve el `Content-Type` correcto igual).
5. Copia la URL pública de cada una (clic en el archivo → "Copy URL" o similar).

---

## 6. ETAPA 2B — Incorporar las imágenes al estudio

**Desde GitHub Actions:** **Actions** → **"Incorporar imágenes al estudio"** → **Run workflow** → completa:
- `libro`, `capitulo`.
- `portada`: la URL de la imagen de portada (opcional).
- `imagenes`: las URLs de contenido separadas por comas, **en el mismo orden** que te mostró la Etapa 2A (imagen 1, imagen 2, imagen 3...).

**Desde tu computadora:**
```bash
node src/cliIncorporarImagenes.js --libro=galatas --capitulo=3 \
  --portada="https://.../portada" \
  --imagenes="https://.../imagen1,https://.../imagen2,https://.../imagen3"
```

**Qué hace:** busca el mismo registro en `resources`, reemplaza cada marcador `IMAGEN_SUGERIDA` por su `<img>` real, y actualiza `contenido_html` — sin tocar `publicado` (sigue en `false`). Si le das menos URLs que marcadores había, te avisa cuántos quedan pendientes para una próxima corrida.

---

## 7. Publicar (manual, siempre)

El campo `publicado` nunca se cambia automáticamente — es tu control final.

1. Revisa el estudio completo (contenido + imágenes) en el panel admin o directo en Supabase.
2. Si estás conforme, cambia `publicado` a `true` (desde el panel admin, o con SQL: `update resources set publicado = true where id = ...`).

**⚠️ Pendiente de verificar:** confirmar que el frontend de `mahanaim-app` realmente filtre por `publicado = true` antes de mostrar un recurso — en algún momento se notó que un borrador podía estar visible sin haberlo publicado. Revisar el código del frontend cuando haya tiempo.

---

## 8. Estructura del proyecto

mahanaim-agents/
├── .github/workflows/
│ ├── generar-estudio.yml ← Etapa 1
│ ├── listar-imagenes.yml ← Etapa 2A
│ └── incorporar-imagenes.yml ← Etapa 2B
├── indicaciones/ ← notas por libro/capítulo (Opción A)
│ └── genesis.md
├── prompts/
│ └── prompt-maestro.txt ← Prompt Maestro completo (versión actual)
├── src/
│ ├── cli.js ← CLI de la Etapa 1
│ ├── cliImagenesPendientes.js ← CLI de la Etapa 2A
│ ├── cliIncorporarImagenes.js ← CLI de la Etapa 2B
│ ├── deepseekClient.js ← llamadas a la API de DeepSeek
│ ├── generarEstudio.js ← lógica de la Etapa 1
│ ├── listarImagenesPendientes.js ← lógica de la Etapa 2A
│ ├── incorporarImagenes.js ← lógica de la Etapa 2B
│ ├── extraerImagenesSugeridas.js ← parsea los marcadores IMAGEN_SUGERIDA
│ ├── incorporarImagenesEnHtml.js ← reemplaza marcadores por <img> reales
│ ├── leerIndicaciones.js ← lee indicaciones/<libro>.md
│ ├── supabaseClient.js ← todas las funciones de Supabase
│ └── validarEstudio.js ← validación automática (sin IA)
├── output/ ← copias locales generadas (no se sube a git)
├── libros.json ← los 66 libros con su slug e id exactos
├── .env.example ← plantilla de variables de entorno
└── .gitignore ← evita subir .env y node_modules


---

## 9. Esquema de Supabase usado

- **books**: `id`, `nombre`, `slug`, `testamento`, `capitulos`, `nombre_original`, `descripcion`, `orden`.
- **chapters**: `id`, `book_id` (FK), `numero`, `resumen`.
- **resources**: `id`, `chapter_id` (FK), `tipo`, `titulo` (obligatorio), `descripcion`, `contenido_html`, `slug`, `modo`, `publicado` (boolean), `destacado`, `orden`, `views`, etc.
- **verses**: `id`, `book_id`, `chapter`, `verse`, `text` (RVR1960 real — pendiente de usar para validar tooltips automáticamente).

**Importante sobre los slugs de libros**: el código usa el mismo `slug` que ya tienes en tu tabla `books` (ver `libros.json` para la lista completa). Si escribes mal el slug, el agente te avisará con un error claro en vez de fallar en silencio.

---

## 10. Costos

- **DeepSeek**: no tiene tier gratis permanente para la API (solo créditos de bienvenida, variables según región/promoción). Es muy barato: cada estudio (~7,000-8,000 palabras) cuesta centavos de dólar. $2.50 USD alcanzan para muchas pruebas.
- **Generación de imágenes**: gratis, ya que las generas tú mismo manualmente (ej. Qwen Chat) y las subes a Supabase Storage (plan free).
- **GitHub Actions**: gratis para uso normal en este tipo de repos.
- **Supabase**: dentro del plan free (revisar límites de Storage y base de datos si el proyecto crece mucho).

---

## 11. Solución de problemas conocidos

| Error | Causa | Solución |
|---|---|---|
| `Node.js 20 detected without native WebSocket support` | El workflow o tu Node local usa una versión vieja | Usar Node 22+ en local; los workflows del repo ya usan `node-version: "22"` |
| `permission denied for table chapters` (u otra tabla) | Al rol `service_role` le faltaban permisos (`GRANT`) | Correr el SQL de la sección 1e |
| `Insufficient Balance` (DeepSeek) | Sin saldo en la cuenta de DeepSeek | Cargar saldo en platform.deepseek.com → Top up |
| Estudio con secciones faltantes (apéndice, meditar, cristo) | Se cortó por límite de tokens | Ya se subió el límite a 32,000; si vuelve a pasar, subir aún más en `generarEstudio.js` |
| `terminated` al generar | Corte de red pasajero con la API de DeepSeek | Reintentar — normalmente funciona a la segunda vez |
| `JSON object requested, multiple (or no) rows returned` | Hay un registro duplicado en `resources` (por usar `forzar=true`) | Ver sección 3, limpiar duplicado con SQL |
| `Invalid workflow file... yaml syntax` | Error de indentación al editar un `.yml` a mano | Revisar que los espacios estén alineados exactamente como el ejemplo, o reemplazar el archivo completo en vez de editar fragmentos |
| `Cannot find module '.../src/archivo.js'` | Un archivo que otro archivo importa no llegó a crearse/subirse a GitHub | Verificar en la carpeta `src` que todos los archivos mencionados en la sección 8 realmente existan |

---

## 12. Próximos pasos pendientes

- [ ] Corregir `forzar=true` para que reemplace (`update`) en vez de duplicar (`insert`) el registro existente.
- [ ] Verificar y corregir el filtro `publicado = true` en el frontend de `mahanaim-app`.
- [ ] Usar la tabla `verses` para validar automáticamente los tooltips RVR1960 contra el texto real, en vez de confiar ciegamente en DeepSeek.
- [ ] Agregar generadores para los demás tipos de recurso (cuestionario, ficha de personaje, glosario, devocional, hoja de trabajo, plan de lectura), siguiendo el mismo patrón que `generarEstudio.js`.
- [ ] Automatizar el audio del estudio (texto → voz).
- [ ] Definir el proceso de video relacionado (ej. NotebookLM).
- [ ] Crear el orquestador que recorra todos los libros/capítulos y detecte automáticamente qué falta generar.
- [ ] Verificar el nombre exacto del modelo de DeepSeek vigente en https://api-docs.deepseek.com antes de escalar mucho más el uso.
