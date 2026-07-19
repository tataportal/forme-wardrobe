# Formé — contrato operativo del repositorio

Estas reglas son obligatorias para cualquier agente que trabaje en este repositorio. No son sugerencias. Si una solicitud entra en conflicto con ellas, el agente debe detenerse, señalar el conflicto y pedir una decisión explícita antes de cambiar el sistema.

## Fuente de verdad

- Producto y marca: **Formé**.
- Producción: `https://forme.gallery`.
- La dirección visual vigente es **Formé V2**. No crear versiones paralelas, no revivir la UI anterior y no añadir estilos por lote.
- La interfaz para consumidor final está en español. Usar `prenda`, `look`, `Mi closet`, `Looks` y `Asistente`; no introducir sinónimos técnicos o residuos como `conjunto`.
- Antes de editar, revisar el estado real del repo y el flujo existente. Preservar cambios ajenos y archivos no relacionados.

## Regla principal: cadena de agentes

Un lote de prendas siempre pasa por esta cadena, en este orden:

1. `intake-auditor`
2. `visual-specifier`
3. `garment-generator`
4. `asset-normalizer`
5. `fidelity-qa`
6. `technical-qa`
7. `presentation-qa`
8. `batch-reconciler`
9. `catalog-integrator`
10. `release-verifier`

Cada agente tiene una sola responsabilidad. Ningún agente puede aprobar su propia salida. El orquestador solo coordina, registra estados y mueve el lote al siguiente agente; no genera, corrige ni aprueba imágenes.

Los contratos completos están en `docs/agent-pipeline/README.md` y los prompts de rol en `.agents/garment-pipeline/`.

## Estándar no negociable de prenda terminada

- WebP transparente, 1024 × 1280 px, relación 4:5.
- Una sola prenda por archivo, centrada y con ocupación visual consistente frente a piezas comparables de la misma categoría.
- Alfa limpio. Sin fondo, halo oscuro, huecos falsos, restos de cama/piso, barras, hanger ni maniquí visible.
- Fidelidad a la fuente: no inventar ni eliminar estampados, logos, bordados, cierres, botones, bolsillos, costuras, proporciones o color.
- Las etiquetas interiores no se muestran. La información de marca vive en metadata, no como una etiqueta inventada o expuesta.
- Outerwear se entrega abierta cuando corresponde. Tops, pantalones, calzado y accesorios conservan su forma natural de catálogo.
- El archivo no lleva borde ni sombra horneados. El tratamiento sticker pertenece exclusivamente al renderer.
- Toda prenda se presenta con el único tratamiento Formé: contorno `#f4f4f4` y sombra suave definidos por `--garment-sticker-filter`.
- Prohibido crear variables, selectores, filtros inline o excepciones por carpeta, fecha, lote o prenda.

## Definition of done

Una prenda no está terminada porque “existe un archivo”. Está terminada únicamente cuando:

1. El manifiesto de ingesta tiene correspondencia 1:1 con la fuente.
2. Pasó validación técnica automática.
3. `fidelity-qa` comparó la salida contra la fuente y la aprobó.
4. `technical-qa` aprobó archivo, alfa, dimensiones y escala por categoría.
5. `presentation-qa` aprobó card de Closet, Canvas y miniatura de Look.
6. `batch-reconciler` confirmó que no falta ni se duplicó ninguna prenda.
7. Se verificó en mobile y desktop.
8. El lote pasó `npm run validate:garments` y `npm test`.
9. Los cambios fueron publicados y verificados en `forme.gallery`.

No publicar lotes parciales, no marcar como aprobado lo que requiere revisión y no compensar un asset incorrecto con CSS específico.

## Cambios de UI

- Reutilizar tokens y módulos de Formé V2; no diseñar una estética nueva para una pantalla aislada.
- Mantener la navegación y los márgenes del canvas alineados al mismo sistema.
- Evitar cajas, líneas, texto explicativo y controles duplicados sin una función clara.
- En Canvas, el fondo es uno solo y el frame indica el área del snapshot. Los paneles de prendas y Looks pueden coexistir abiertos en desktop.
- Los cambios experimentales solo viven en una ruta hermana cuando el usuario lo pide expresamente. Una vez aprobados como V2 final, reemplazan la versión anterior.

## Publicación

- Para este proyecto, publicar por defecto después de una modificación validada.
- Antes de publicar: revisar diff, ejecutar validaciones y confirmar que no se incluyeron archivos temporales, RAW, contactos de auditoría innecesarios o secretos.
- Después de publicar: verificar la URL real y la vista afectada. Un push exitoso no sustituye la verificación visual.
