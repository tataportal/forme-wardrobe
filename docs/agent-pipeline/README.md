# Cadena de agentes para prendas Formé

La cadena separa inventario, interpretación, generación, calado, tres tipos de QA, reconciliación, integración y release. Cada agente produce una sola cosa y ningún productor aprueba su propia salida.

## Máquina de estados

```text
RECEIVED
→ INVENTORIED
→ SPECCED
→ GENERATED
→ NORMALIZED
→ FIDELITY_PASSED
→ TECH_PASSED
→ PRESENTATION_PASSED
→ RECONCILED
→ INTEGRATED
→ LIVE_PASSED
```

Un rechazo vuelve únicamente al productor responsable:

- Fidelidad → `garment-generator`.
- Alfa, canvas, crop o escala → `asset-normalizer`.
- Estilo dentro del app → renderer compartido / `catalog-integrator`.
- Conteo o duplicados → `intake-auditor` / orquestador.

Máximo dos reintentos automáticos. Después la pieza queda `BLOCKED`; nunca se convierte en “good enough”.

## 0. Orquestador

**Única función:** mover el lote entre estados y conservar los recibos.

**Recibe:** carpeta fuente y objetivo del lote.

**Entrega:** `batch_id`, rutas, estado por pieza y siguiente handoff.

**Bloquea:** artefactos sin hash, estado previo incompleto, conteos que no cierran o aprobaciones faltantes.

**Prohibido:** editar imágenes, cambiar metadata, aprobar calidad, saltar etapas o publicar.

## 1. `intake-auditor`

**Única función:** registrar exactamente qué fuentes y prendas únicas existen.

**Recibe:** RAW/JPG/HEIF/PNG y tomas alternativas.

**Entrega:** manifest 1:1 con `source_id`, ruta, SHA-256, vista principal, vistas de apoyo, dimensiones, orientación y cantidad esperada.

**Rechaza:** duplicados, archivos ilegibles, dos prendas principales mezcladas o fuente insuficiente.

**Prohibido:** generar, recortar, omitir por criterio estético o decidir detalles de styling.

## 2. `visual-specifier`

**Única función:** describir la prenda antes de generar.

**Recibe:** fuente inventariada.

**Entrega:** ficha inmutable con categoría, tipo, color, silueta, material, variante abierta/cerrada, gráficos, texto exterior, logos, herrajes, bolsillos, cierres y detalles protegidos.

**Rechaza:** fuente demasiado ambigua para identificar detalles críticos.

**Prohibido:** generar, embellecer, corregir la fuente o aprobar resultados.

## 3. `garment-generator`

**Única función:** producir una representación de catálogo fiel.

**Recibe:** fuente, ficha visual, variante y versión fija del prompt.

**Entrega:** render 1024 × 1280 y recibo con modelo/calidad, prompt version, job ID y hash.

**Rechaza:** fallo del proveedor, moderación, detalle crítico imposible de conservar o generación inconsistente.

**Prohibido:** calar, añadir borde/sombra, cambiar metadata, sustituir una prenda o aprobar su imagen.

La fuente manda. Outerwear se entrega abierta cuando corresponde; sin etiqueta interior visible, hanger, barras, cuerpo, maniquí ni fondo. Logos, estampados, textos, parches y herrajes exteriores se conservan.

## 4. `asset-normalizer`

**Única función:** producir el master transparente uniforme.

**Recibe:** render generado.

**Entrega:** WebP transparente 1024 × 1280, bbox, cobertura alpha, anchor y scale class por categoría.

**Rechaza:** fondo residual, halo, prenda cortada, agujeros falsos, bordes dañados o bbox fuera de template.

**Prohibido:** regenerar detalles, cambiar color, reparar logos, aprobar fidelidad o hornear borde/sombra.

## 5. `fidelity-qa`

**Única función:** comparar fuente, ficha visual y master.

**Entrega:** `PASS` o `REJECT` con score y códigos concretos.

**Rechaza:** cambio u omisión en silueta, proporción, color, material, gráfico, texto, logo, bolsillo, cierre, hardware, desgaste o detalle exterior; también etiqueta interior, hanger, cuello/maniquí, objeto residual o estado abierto incorrecto.

**Prohibido:** editar, regenerar, recortar o aceptar por parecido general.

## 6. `technical-qa`

**Única función:** validar el archivo normalizado.

**Entrega:** reporte de WebP, 1024 × 1280, alpha, safe area, bbox, márgenes, peso, integridad y escala de categoría.

**Rechaza:** cualquier incumplimiento técnico.

**Prohibido:** juzgar fidelidad, moda o estética; no modifica el asset.

Todos los assets comparten canvas 1024 × 1280. La ocupación no usa un solo porcentaje global: tops, outerwear, pantalones, shorts, calzado, bolsos, lentes y headwear tienen template, anchor y tolerancia propios.

## 7. `presentation-qa`

**Única función:** comprobar el master dentro del producto real.

**Recibe:** renders automáticos en Closet, Canvas, miniatura de Look, perfil y share.

**Entrega:** `PASS/REJECT` por superficie.

**Rechaza:** contorno `#f4f4f4` desigual, sombra diferente, escala aparente inconsistente, miniatura descentrada o diferencia entre Canvas y Look guardado.

**Prohibido:** tocar el master, compensar una pieza con CSS especial o crear otra estética.

## 8. `batch-reconciler`

**Única función:** demostrar que no falta ni sobra ninguna prenda.

**Recibe:** manifest fuente y recibos aprobados.

**Entrega:** matriz 1:1 `source_id → final_asset_id`.

**Rechaza:** `expected_count !== passed_count`, fuente ausente, duplicado, sustitución, variante obligatoria faltante o cualquier estado pendiente/fallido.

**Prohibido:** generar assets, perdonar faltantes o inventar excepciones.

## 9. `catalog-integrator`

**Única función:** registrar assets reconciliados en app/DB.

**Recibe:** tres pases por pieza —fidelidad, técnico y presentación— más reconciliación del lote.

**Entrega:** rutas, records, metadata, filtros y revision IDs.

**Rechaza:** aprobaciones incompletas, hashes distintos, IDs duplicados o cualquier asset que exija CSS especial.

**Prohibido:** editar imágenes, declarar calidad o publicar.

## 10. `release-verifier`

**Única función:** validar y comprobar producción después de integrar.

**Ejecuta:** `npm run validate:garments`, `npm test`, revisión del diff, publicación y verificación visual en `forme.gallery` mobile/desktop.

**Entrega:** commit, deploy, conteos y capturas de Closet, Canvas y Looks.

**Bloquea:** assets ausentes, rutas rotas, renders inconsistentes, conteo incorrecto, regresión visual o live desactualizado.

**Prohibido:** corregir producción directamente o aprobar basándose solo en el push.

## Handoff obligatorio

```text
BATCH_ID:
SOURCE_ID:
FROM_STAGE:
TO_STAGE:
SOURCE_SHA256:
ARTIFACT_SHA256:
VARIANT:
PROMPT_VERSION:
STYLE_VERSION:
CATEGORY_TEMPLATE_VERSION:
INPUT_COUNT:
OUTPUT_COUNT:
APPROVED_IDS:
REJECTED_IDS:
EVIDENCE:
OPEN_ISSUES:
STATUS:
```

Los artefactos son inmutables. Una corrección crea una revisión nueva. Si `INPUT_COUNT` no coincide con `OUTPUT_COUNT + REJECTED_IDS`, el lote no avanza.

## Rechazos canónicos

- `TECH_FORMAT`, `TECH_SIZE`, `TECH_ALPHA`, `TECH_CROP`, `TECH_SCALE`, `TECH_BAKED_STYLE`
- `FID_SHAPE`, `FID_COLOR`, `FID_DETAIL`, `FID_GRAPHIC`, `FID_TEXT`, `FID_LABEL`, `FID_OUTERWEAR`, `FID_ARTIFACT`, `FID_HALLUCINATION`
- `RENDER_STYLE`, `RENDER_SCALE`, `BATCH_MISSING`, `BATCH_DUPLICATE`, `RELEASE_REGRESSION`

