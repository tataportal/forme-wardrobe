# Formé — contrato operativo del repositorio

Estas reglas son obligatorias para cualquier agente que trabaje en este repositorio. No son sugerencias. Si una solicitud entra en conflicto con ellas, el agente debe detenerse, señalar el conflicto y pedir una decisión explícita antes de cambiar el sistema.

## Fuente de verdad

- Producto y marca: **Formé**.
- Producción: `https://forme.gallery`.
- La dirección visual vigente es **Formé V2**. No crear versiones paralelas, no revivir la UI anterior y no añadir estilos por lote.
- La interfaz para consumidor final está en español. Usar `prenda`, `look`, `Mi closet`, `Looks` y `Asistente`; no introducir sinónimos técnicos o residuos como `conjunto`.
- Antes de editar, revisar el estado real del repo y el flujo existente. Preservar cambios ajenos y archivos no relacionados.

## Regla principal: escoger el carril correcto

No ejecutar diez agentes seriales por defecto. Los nombres de rol describen
responsabilidades, no obligan a crear diez tasks ni diez handoffs.

### Carril A · auditoría

Cuando todavía no existe una lista aprobada:

1. reconciliar fuente y outputs 1:1;
2. clasificar `OK`, `LIMPIAR_ALPHA`, `REGENERAR` o `FALTANTE`;
3. pedir autorización únicamente para las regeneraciones.

No generar ni calar durante la auditoría.

### Carril B · generación por API

Solo para piezas `REGENERAR` o `FALTANTE`:

1. identificar la prenda y escoger el prompt corto por tipo;
2. generar una sola propuesta retail por pieza mediante la API configurada;
3. guardar modelo, request ID, prompt, hash de fuente y hash del resultado;
4. mostrar los resultados al usuario;
5. registrar `generationApproved: true` solo en los resultados aprobados.

La aprobación post-generación es obligatoria. Un resultado no aprobado no pasa
a calado, no consume normalización y no se integra.

La app no depende de una sesión o suscripción de ChatGPT. El frontend llama al
backend de Formé y las credenciales del proveedor viven únicamente en servidor.

### Carril C · fast path de calado y release

Para retail API ya aprobado:

1. bloquear manifest e inputs aprobados;
2. enviar únicamente los aprobados al API de segmentación, nunca a una segunda
   generación;
3. ejecutar normalización y QA técnico en paralelo con
   `npm run garments:prepare`;
4. revisar una sola evidencia conjunta sobre gris y negro;
5. si todo pasa, integrar, probar, publicar una vez y verificar live con
   `npm run garments:release -- --deploy`.

Después de la aprobación post-generación no se espera otra respuesta humana.
El lote solo se detiene si el QA encuentra un defecto; se reabre únicamente esa
pieza, no el lote completo.

Los contratos completos están en `docs/agent-pipeline/README.md`. Los prompts
especializados de `.agents/garment-pipeline/` son herramientas de excepción,
no una cadena serial obligatoria.

## Estándar no negociable de prenda terminada

- WebP transparente, 1024 × 1280 px, relación 4:5.
- Una sola prenda por archivo, centrada y con ocupación visual consistente frente a piezas comparables de la misma categoría.
- Alfa limpio. Sin fondo, halo oscuro, huecos falsos, restos de cama/piso, barras, hanger ni maniquí visible.
- Fidelidad a la fuente: no inventar ni eliminar estampados, logos, bordados, cierres, botones, bolsillos, costuras, proporciones o color. El desgaste solo puede limpiarse si el usuario pidió explícitamente “hacerla como nueva” y esa autorización queda registrada en la ficha.
- Las etiquetas interiores no se muestran. La información de marca vive en metadata, no como una etiqueta inventada o expuesta.
- Outerwear se entrega abierta cuando corresponde. Tops, pantalones, calzado y accesorios conservan su forma natural de catálogo.
- El archivo no lleva borde, halo ni sombra horneados. La sombra de presentación pertenece exclusivamente al renderer.
- Toda prenda se presenta con el único tratamiento Formé: sombra suave, sin contorno, definida por `--garment-sticker-filter`.
- Prohibido crear variables, selectores, filtros inline o excepciones por carpeta, fecha, lote o prenda.

## Definition of done

Una prenda no está terminada porque “existe un archivo”. Está terminada únicamente cuando:

1. El manifiesto de ingesta tiene correspondencia 1:1 con la fuente.
2. Si fue generada, tiene aprobación post-generación explícita.
3. El fast path produjo WebP válido y sus checks técnicos pasaron.
4. La evidencia conjunta confirmó fidelidad, borde y escala sin excepciones.
5. El conteo final coincide con el manifest y no hay duplicados.
6. `npm test` pasó.
7. Los cambios fueron publicados una sola vez y los hashes live coinciden.

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
- Un batch produce un solo deploy. No publicar pilotos, retries ni estados intermedios.
