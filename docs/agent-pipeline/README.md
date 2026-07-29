# Pipeline operativo de prendas Formé

Este procedimiento prioriza dos cosas: no gastar generación ni postproceso en
imágenes que el usuario no aprobó, y no convertir verificaciones simples en una
cadena de agentes seriales.

Los roles de `.agents/garment-pipeline/` son responsabilidades especializadas.
No equivalen a diez tasks obligatorias.

## Flujo principal

```text
AUDITADO
→ RETAIL_GENERADO_POR_API
→ APROBADO_POR_USUARIO
→ CALADO_EN_PARALELO
→ QA_CONJUNTO
→ INTEGRADO_Y_TESTEADO
→ LIVE_VERIFICADO
```

Hay un solo bloqueo humano obligatorio:

```text
RETAIL_GENERADO_POR_API → APROBADO_POR_USUARIO
```

Nada se cala antes de esa aprobación. Después, el lote corre seguido y solo se
detiene por un error real de QA.

## 1. Auditoría

Antes de generar:

1. unir las carpetas fuente autorizadas;
2. agrupar tomas alternativas, reversos y duplicados;
3. reconciliar fuente y resultado actual 1:1;
4. clasificar cada pieza:
   - `OK`
   - `LIMPIAR_ALPHA`
   - `REGENERAR`
   - `FALTANTE`

La tabla mínima usa:

```text
ID | FUENTE | OUTPUT | CATEGORÍA | ESTADO | RAZÓN | ACCIÓN
```

`LIMPIAR_ALPHA` nunca debe enviarse a generación. `REGENERAR` exige un defecto
estructural: silueta, proporción, parte faltante, gráfico perdido, textura
inventada, etiqueta interior visible o calado roto.

## 2. Generación

Solo se generan `REGENERAR` y `FALTANTE`.

1. Identificar la prenda y su subtipo.
2. Elegir el prompt retail corto por tipo.
3. Enviar una sola edición por pieza a la Image API desde el backend.
4. Generar retail limpio sobre fondo simple con `n: 1`.
5. Guardar request ID, modelo, prompt y hashes de entrada/salida.
6. Mostrar el resultado al usuario antes de cualquier calado.

La generación de producción no usa la interfaz ni la suscripción de ChatGPT.
La clave API nunca llega al navegador. Los errores transitorios `429` y `5xx`
pueden reintentarse con backoff; un error de usuario o moderación no se reintenta
sin cambiar la entrada.

Para una edición aislada de una fuente, la Image API es la ruta directa. El
modelo de generación vigente se declara en el manifest y no se cambia
silenciosamente. Si se usa `gpt-image-2`, el retail de aprobación es opaco:
ese modelo no acepta `background: "transparent"`. El calado posterior sigue
siendo una operación separada y no una segunda reinterpretación de la prenda.

El manifest registra por pieza:

```json
{
  "id": "000000",
  "source": "/ruta/a/la/fuente.png",
  "input": "/ruta/al/retail-aprobado.png",
  "destination": "public/wardrobe/imports/fecha/000000.webp",
  "category": "Footwear",
  "generation": {
    "channel": "api",
    "provider": "openai",
    "model": "gpt-image-2",
    "endpoint": "images.edits",
    "requestId": "req_...",
    "sourceSha256": "...",
    "outputSha256": "..."
  },
  "generationApproved": true
}
```

`generationApproved: true` significa que el usuario aprobó esa imagen concreta.
No se hereda desde un README, un intento anterior o una aprobación de otra
vista. Una pieza sin ese flag queda fuera del calado.

## 3. Fast path de calado

Preparar un manifest a partir de
`docs/agent-pipeline/fast-batch.example.json` y ejecutar:

```bash
npm run garments:prepare -- --manifest ruta/al/manifest.json
```

Antes del comando, el worker de backend envía únicamente los retail aprobados
al proveedor de background removal configurado. Ese proveedor debe ser de
segmentación, no de generación: el calado no puede reinterpretar la prenda.
Su PNG transparente se registra como `cutout` en el manifest.

El comando:

- valida IDs, inputs, categorías y aprobación post-generación;
- valida la procedencia API y los hashes de lotes nuevos;
- consume el calado API sin volver a generar la prenda;
- procesa hasta seis piezas en paralelo;
- elimina fondo, sombra de estudio y contaminación blanca;
- normaliza a WebP lossless transparente `1024 × 1280`;
- aplica fit y anchor por categoría;
- comprueba alpha, safe area, dimensiones y borde de canvas;
- genera `review-gray.png` y `review-black.png`;
- escribe un resumen de lote y un recibo pequeño por pieza.

El extractor local queda únicamente como compatibilidad para lotes legacy de
tres dígitos. Un lote nuevo de seis dígitos no puede depender de Vision/ANE.

No toca `public/`, catálogo ni producción.

## 4. QA conjunto

Se revisan una vez las dos contact sheets.

Cada tile muestra:

```text
RETAIL APROBADO | CALADO
```

Revisar:

- prenda o par completo;
- silueta y detalle fiel;
- ausencia de fondo, halo y contorno blanco;
- transparencias reales conservadas;
- escala consistente con su categoría;
- nada tocando el canvas.

Esto es una sola revisión del lote, no 25 handoffs. Si una pieza falla:

1. marcar únicamente ese ID;
2. corregir solo normalización si la generación sigue siendo fiel;
3. volver a generación únicamente si el defecto es estructural;
4. reconstruir las contact sheets;
5. continuar cuando el conteo vuelva a cerrar.

## 5. Integración y release

Cuando `prepare` entrega `READY_FOR_RELEASE`:

```bash
npm run garments:release -- --manifest ruta/al/manifest.json --deploy
```

El comando:

- hace backup recuperable de cada destino;
- copia masters y verifica hashes;
- ejecuta `npm test`;
- restaura backups automáticamente si los tests fallan;
- publica una sola vez;
- descarga los assets live en paralelo;
- compara SHA-256 live contra cada master;
- escribe `release-summary.json`.

El resultado final debe ser:

```text
expected = integrated = liveMatches
status = LIVE_PASSED
```

## Política de agentes

El operador principal ejecuta el fast path. No se crean agentes separados para
normalizer, technical QA, reconciler, integrator y release verifier cuando esas
funciones ya están automatizadas.

Usar un rol especializado únicamente cuando exista trabajo independiente:

- `intake-auditor`: reconciliación ambigua o fuentes mezcladas;
- `visual-specifier`: prenda difícil de identificar;
- `garment-generator`: generación autorizada;
- `fidelity-qa`: discrepancia visual real;
- `asset-normalizer`: excepción de máscara o transparencia;
- `presentation-qa`: regresión del renderer compartido;
- `release-verifier`: fallo live o cache inconsistente.

Un agente de excepción entrega la corrección o el diagnóstico del ID afectado.
No vuelve a ejecutar todo el lote.

## Presupuesto operativo

Para 25 imágenes retail ya aprobadas, el objetivo es:

| Etapa | Presupuesto |
|---|---:|
| Preflight y compilación | ≤ 1 min |
| Calado paralelo | ≤ 4 min |
| Contact sheets y QA conjunto | ≤ 2 min |
| Integración, tests y deploy | ≤ 5 min |
| Total activo | ≤ 12 min |

La espera del usuario durante la aprobación post-generación no cuenta como
tiempo de procesamiento. Si una etapa supera su presupuesto:

1. no encadenar waits silenciosos;
2. reportar el ID lento o fallido;
3. dejar avanzar las piezas correctas dentro del batch temporal;
4. resolver solo la excepción antes del release;
5. no publicar parcialmente.

## Contratos que siguen siendo obligatorios

- Fuente y resultado 1:1.
- IDs simples: seis dígitos para lotes nuevos; tres dígitos legacy permitidos.
- Toda generación nueva corre por API desde el backend; nunca desde una sesión
  o suscripción interactiva.
- La API solo se llama para `REGENERAR` y `FALTANTE`.
- Cero calado antes de aprobación post-generación.
- Cero borde, halo o sombra horneada.
- Cero CSS por lote o prenda.
- Cero regeneración para un problema superficial de alpha.
- Un solo deploy por batch.
- Verificación live por hash, no por confianza en el comando de deploy.

## Rechazos canónicos

- `TECH_FORMAT`, `TECH_SIZE`, `TECH_ALPHA`, `TECH_CROP`, `TECH_SCALE`
- `TECH_BAKED_STYLE`, `TECH_TRANSLUCENCY`
- `FID_SHAPE`, `FID_COLOR`, `FID_DETAIL`, `FID_GRAPHIC`, `FID_TEXT`
- `FID_LABEL`, `FID_ARTIFACT`, `FID_HALLUCINATION`
- `BATCH_MISSING`, `BATCH_DUPLICATE`, `RELEASE_REGRESSION`
