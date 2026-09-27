# Reconocimiento al subir prendas

La subida de consumidor usa `/api/intake-batches` y `/api/upload`. No necesita
nombre, categoría ni atributos escritos por el cliente. El nombre del archivo
no se usa para reconocer ni para generar.

1. La foto original se conserva en R2; su copia optimizada se reconoce una vez
   con Responses y un esquema estricto (`worker/garment-recognition.ts`).
2. El resultado se guarda en `recognition_json`, ligado a la clave y SHA-256 de
   la foto, con modelo, request ID, fecha, versión de plantilla y prompt final.
3. Dos mensajes independientes de la cola reciben ese checkpoint:
   - `metadata`: guarda nombre, descripción, categoría, atributos y tags.
   - `generate`: foto + plantilla JSON rellenada → una imagen maestra.
4. QA automático compara fuente/maestra, mide torso/cuello/mangas y aprueba la
   imagen. La maestra aprobada se puede mostrar mientras termina el calado.
5. Se entrega un calado normal y, si existe apertura frontal completa apta para
   layering, otro interior. Comparten maestra y medidas anatómicas.

## Independencia y reintentos

- La rama de datos no requiere generación, QA ni calado. Se puede abrir la ficha
  desde la cola de subida y editarla mientras se prepara la imagen.
- La generación usa el reconocimiento inmutable, no el nombre o los tags que el
  usuario vaya editando. Su finalización solo actualiza imágenes/estado/anatomía.
- `metadata_revision` protege todas las ediciones del usuario, incluidos tags
  eliminados deliberadamente. Mensajes repetidos no vuelven a aplicar metadata.
- La etapa persistida en `processing_jobs.stage` impide que una entrega vieja
  vuelva a generar después de alcanzar postproceso. `generated_key` permite
  recuperar esa etapa sin comprar otra imagen.
- Un fallo transitorio reintenta solo la etapa afectada. Una foto no reconocible
  se detiene antes de la generación. No hay aprobación humana obligatoria.
- En batch, el reconocimiento y la ficha son inmediatos. Solo las imágenes se
  envían al proveedor batch después de reconocer; se conserva el mismo prompt.
  La cola también despacha el batch desde el servidor: cerrar la pestaña después
  de subir las fotos no deja las imágenes esperando a una llamada del navegador.
- El catálogo existente y las operaciones internas de importación explícita
  conservan su tratamiento legacy: esta migración no regenera prendas guardadas.

## Configuración y comprobación

Migración aditiva: `drizzle/0010_garment_recognition.sql`.
Reconocimiento: `OPENAI_RECOGNITION_MODEL`, o el `OPENAI_QA_MODEL` existente.
Generación: `OPENAI_IMAGE_MODEL` y calidad existentes, sin cambio de modelo.
Plantillas: `worker/garment-prompts.json`; no se llama a otro modelo para escribir
un prompt libre. Contrato de Responses verificado contra la
[documentación oficial de Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

`npm test` incluye HTTP de subida → cola → SQL, independencia de ramas, fallo de
metadata/generación, entrega duplicada, edición concurrente, batch y calados PNG
reales con anatomía. El proveedor es simulado en esas pruebas; una prueba live con
API real debe registrarse separadamente, no inferirse de los tests.

## Recuperación de postprocesado

Un reintento de una prenda fallida con imagen maestra guardada reanuda el mismo
job en `postprocess`: no compra otra generación ni reescribe la descripción o
los tags. Los dobles clics reutilizan el job activo. Si falta la maestra, se
devuelve un error explícito; nunca se regenera silenciosamente. Una petición
explícita de otra calidad conserva el flujo de nueva generación.

La confianza anatómica es un porcentaje de 0 a 100. No se convierte `9` en `90`
ni se relaja el mínimo de 80. Una medición inválida recibe una sola corrección
con el contorno alfa real y una copia con coordenadas numeradas. El modelo
elige IDs de puntos existentes; el servidor resuelve las coordenadas exactas
sin permitir conversiones de escala. Esta copia
es solo una referencia de medición: nunca reemplaza el PNG del cliente.

Si falla el calado interior, se corrige exclusivamente su máscara sobre la
misma maestra aprobada. La revisión recibe la imagen, una guía de coordenadas
y el recorte rechazado; luego vuelve a pasar el control visual de calado.
La aprobación de fidelidad y la anatomía válida se conservan.

La propuesta interior se ajusta a las costuras de la imagen y a la abertura
transparente natural del ruedo. Un margen conservador protege botones y tela
frontal. El QA permite retirar el forro central, pero exige conservar la banda
posterior del cuello, solapas, estampados y paneles. Sin una abertura natural
fiable no se inventa una; se mantiene la propuesta y su revisión obligatoria.

Una interrupción capturada libera inmediatamente el job para el próximo
intento. Solo el consumidor que adquirió el job puede liberarlo; un mensaje
duplicado no puede hacerlo. La recuperación de un postprocesado que perdió
su proceso usa un lease de 3 minutos, separado de los 14 de generación.

## Ficha y subida simplificadas (septiembre 2026)

La selección valida peso, formato y decodificación antes de registrar el lote.
La copia JPEG se prepara una sola vez y también sirve de vista previa; un HEIC
que el navegador no pueda decodificar recibe una indicación para exportar JPG.
Se omiten fotos repetidas en la misma selección o ya presentes en la cola.
La cola muestra una sola miniatura por foto, estado y acceso a la ficha tras el
reconocimiento. No hace falta completar datos para subir.

La ficha agrupa los tipos por categoría: al elegir un tipo, la categoría se
resuelve automáticamente. Incluye vestidos, enterizos, overoles, cinturones y
bufandas. Los accesorios con tipo explícito mantienen su escala al renombrarse.

`length_override` (migración 0012) guarda la corrección de «Largo en el Canvas».
Es independiente de `layout_json` y de las futuras medidas físicas para venta.
La generación y sus reintentos no la sobrescriben. Una petición antigua que
omite el campo la conserva; `null` restaura Automático. Se valida por región y
se aplica a ambos calados. Los looks con colocación manual mantienen sus
coordenadas; la corrección se utiliza al añadir o ajustar proporciones.

Después del QA de calados PNG, `worker/garment-webp.ts` convierte la entrega a
WebP transparente 1024 × 1280 con calidad 92 mediante el binding Images. El QA
sigue trabajando con PNG, y la anatomía normalizada no cambia. No se convierten
ni regeneran las prendas existentes. API del binding contrastada con la
[documentación de Cloudflare](https://developers.cloudflare.com/images/optimization/binding/).
