# Arquitectura de Momentos Narrativos

## Problema actual

En el pipeline actual, el guion SSML y los prompts de imágenes se generan **por separado**, sin conocerse entre sí:

1. El guion SSML se genera con un prompt que pide insertar 12 marcas `<mark>` "distribuidas equitativamente".
2. Los prompts de imágenes se generan con otro prompt independiente que pide 12 escenas narrativas.

**Resultado:** desincronización entre lo que dice el narrador y la imagen que se muestra. Ejemplo real de Génesis 25:

- Se habla de "Esaú cazador" → pero se sigue mostrando "Rebekah dando a luz".
- Se habla del "plato de lentejas" → la imagen aparece recién después.
- Se habla de "Cristo como cumplimiento" → nunca aparece una imagen de eso.
- La conclusión final → no tiene imagen correspondiente.

## Arquitectura propuesta

**Flujo nuevo de `generarArtefactosVideo`:**

### Paso 1 — Generar el guion SSML SIN marcas

- El prompt pide el guion completo con los `<break>` y las secciones, pero sin `<mark>`.
- El SSML sale limpio.

### Paso 2 — Parsear el SSML y extraer segmentos por `<break>`

- Cortar por `<break time="1.5s"/>` y `<break time="800ms"/>`.
- Cada segmento tiene: `{ texto, posicion_en_ssml, posicion_estimada_en_audio }`.

### Paso 3 — Refinar con IA (DeepSeek)

- Le pasamos los segmentos a DeepSeek.
- Le pedimos: "Fusioná los segmentos que hablan del mismo tema o personaje. Devolvé una lista JSON con 10-15 momentos narrativos, cada uno con: indice, inicio_segmento, fin_segmento, descripcion_visual, titulo_corto."

### Paso 4 — Validación y ajuste

- Si un momento dura <45s (estimando por caracteres), fusionarlo con el siguiente.
- Si un momento dura >100s, dividirlo.

### Paso 5 — Insertar las marcas `<mark>` en el SSML

- En la posición exacta donde empieza cada momento.
- Nombres: `imagen_1`, `imagen_2`, ..., `imagen_N` (N variable, 10-15).

### Paso 6 — Generar los prompts de imágenes

- Un prompt por momento narrativo.
- Guardar en `prompts_imagenes_video.json`.

### Paso 7 — Guardar el SSML final con las marcas

## Parámetros definidos

| Parámetro                  | Valor                                |
| -------------------------- | ------------------------------------ |
| Cantidad de momentos       | 10-15 por capítulo (dinámico)        |
| Tipo de detección          | Cambio de tema + cambio de personaje |
| Duración mínima por imagen | 45 segundos                          |
| Duración máxima por imagen | 100 segundos                         |
| Validación visual          | Mostrar en consola, sin bloqueo      |

## Archivos afectados

| Archivo                       | Cambio                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `scripts/generate-prompts.js` | Reescribir `generarArtefactosVideo`: separar generación de SSML y detección de momentos. Agregar paso de refinamiento con IA. |
| `scripts/generar-imagenes.js` | Leer cantidad dinámica de prompts del JSON. Generar N imágenes (no 12 fijas).                                                 |
| `video/ensamblar-video.js`    | Leer N marcas del JSON de timestamps. Procesar N imágenes. Calcular duraciones por diferencia.                                |
| `audio-tts/generar-audio.js`  | Verificar que funciona con N variable (probablemente ya funciona).                                                            |

## Orden de implementación

1. **Guardar propuesta en .md** (este archivo).
2. **Fix del zoom en `ensamblar-video.js`** (brinco/tembladera).
3. **Rediseño de `generarArtefactosVideo`** (sistema de momentos).
4. **Adaptar `generar-imagenes.js`.**
5. **Adaptar `ensamblar-video.js` para N variable.**
6. **Pruebas con Génesis 25.**
7. **Commit.**

## Estimación de tiempo

- Fix del zoom: 15-30 min.
- Rediseño completo: 2-2.5 horas.
- Pruebas: 30 min.
- **Total:** ~3 horas.
