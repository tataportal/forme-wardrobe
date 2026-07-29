# Auditoría de procedencia de prendas Formé — 2026-07-26

Esta lista cruza el catálogo que carga `app/garments.ts` con:

- las fuentes de `Tata's Closet/Outwear`;
- las fuentes y el manifiesto de `Pants & Sneakers`;
- los recibos del lote `FORME-BURNED-BORDER-2026-07-26`;
- los assets actualmente presentes en `public/wardrobe`.

## Cómo leer la lista

- `GENERADA`: la imagen visible fue reconstruida mediante ImageGen.
- `RECORTE DIRECTO CONFIRMADO`: la geometría de la prenda coincide con la foto fuente y solo cambió el fondo. Esta categoría exige evidencia visual; no se infiere de un estado de aprobación.
- `ALPHA/BORDE`: no se reconstruyó la prenda; se corrigió el canal alpha o el borde.
- `INTENTO DESCARTADO`: sí hubo una generación durante el pipeline, pero esa generación no es el asset publicado.
- `SIN RECIBO`: el repositorio no contiene una fuente o recibo que permita afirmar honestamente si fue generada o recortada.

## Resumen

| Grupo | Total | Imagen generada | Recorte directo confirmado | QA reabierto | Regenerar | Sin recibo |
|---|---:|---:|---:|---:|---:|---:|
| Closet personal: Outwear | 50 | 50 | 0 | 0 | 0 | 0 |
| Closet personal: Pants & Sneakers | 104 | 104 | 0 | 37 | 1 | 0 |
| Básicos Formé | 16 | 0 confirmadas | 0 confirmadas | 0 | 0 | 16 |
| **Total visible** | **170** | **154 confirmadas** | **0 confirmadas** | **37** | **1** | **16** |

El lote de bordes del 26 de julio afectó 45 imágenes principales de Outwear:

- 44 fueron regeneradas y publicadas.
- `031_DSC01835.webp` conservó la imagen previa y recibió solo limpieza determinística de alpha/borde; los intentos generados fueron descartados.
- Las otras 5 imágenes principales de Outwear no se tocaron en ese lote.
- Las 42 variantes abiertas para Canvas no se tocaron en ese lote y no se cuentan como prendas adicionales.

## Outwear — 50 prendas

Todas las imágenes principales de este grupo provienen de renders generados. La columna final indica qué ocurrió específicamente en el lote de bordes del 26 de julio.

| Archivo | Nombre | Procedencia visible | Acción 2026-07-26 |
|---|---|---|---|
| `001_DSC01768.webp` | Daisy Coach Jacket | GENERADA | REGENERADA y publicada |
| `002_DSC01771.webp` | WFP Bomber | GENERADA | REGENERADA y publicada |
| `003_DSC01773.webp` | Navy Peacoat | GENERADA | REGENERADA y publicada |
| `004_DSC01775.webp` | Leather Hooded Shirt | GENERADA | REGENERADA y publicada |
| `005_DSC01777.webp` | Utility Field Jacket | GENERADA | REGENERADA y publicada |
| `006_DSC01779.webp` | Leather Blazer | GENERADA | REGENERADA y publicada |
| `007_DSC01781.webp` | Asymmetric Trench | GENERADA | REGENERADA y publicada |
| `008_DSC01783.webp` | Padded Collar Jacket | GENERADA | REGENERADA y publicada |
| `009_DSC01785.webp` | Belted Short Coat | GENERADA | REGENERADA y publicada |
| `010_DSC01787.webp` | Leather Bomber | GENERADA | REGENERADA y publicada |
| `011_DSC01789.webp` | Single-Breasted Blazer | GENERADA | REGENERADA y publicada |
| `012_DSC01791.webp` | Track Shell | GENERADA | REGENERADA y publicada |
| `013_DSC01793.webp` | Leather Sports Bomber | GENERADA | REGENERADA y publicada |
| `014_DSC01795.webp` | Drawcord Bomber | GENERADA | REGENERADA y publicada |
| `015_DSC01797.webp` | Graphic Tailored Blazer | GENERADA | REGENERADA y publicada |
| `016_DSC01799.webp` | Camel Wrap Coat | GENERADA | REGENERADA y publicada |
| `017_DSC01801.webp` | Funnel-Neck Cape | GENERADA | REGENERADA y publicada |
| `018_DSC01803.webp` | Leather Hooded Bomber | GENERADA | REGENERADA y publicada |
| `019_DSC01804.webp` | Leather Zip Blouson | GENERADA | REGENERADA y publicada |
| `020_DSC01806.webp` | Long Black Trench | GENERADA | REGENERADA y publicada |
| `021_DSC01808.webp` | Lightweight Shell | GENERADA | REGENERADA y publicada |
| `022_DSC01810.webp` | Tiger Fleece | GENERADA | REGENERADA y publicada |
| `023_DSC01814.webp` | Graphic Varsity Jacket | GENERADA | REGENERADA y publicada |
| `024_DSC01816.webp` | Essentials Crewneck | GENERADA | REGENERADA y publicada |
| `025_DSC01819.webp` | Fur-Trim Leather Bomber | GENERADA | REGENERADA y publicada |
| `026_DSC01822.webp` | Tan Coach Jacket | GENERADA | REGENERADA y publicada |
| `027_DSC01824.webp` | Hooded Field Parka | GENERADA | REGENERADA y publicada |
| `028_DSC01826.webp` | Open-Knit Sweater | GENERADA | REGENERADA y publicada |
| `029_DSC01830.webp` | Sage Puffer | GENERADA | REGENERADA y publicada |
| `030_DSC01833.webp` | Kimono Blazer | GENERADA | REGENERADA y publicada |
| `031_DSC01835.webp` | Embroidered Cape Coat | GENERADA previamente | ALPHA/BORDE solamente; intentos generados descartados |
| `032_DSC01838.webp` | Greige Technical Shell | GENERADA | REGENERADA y publicada |
| `033_DSC01840.webp` | Brown Shearling Coat | GENERADA | REGENERADA y publicada |
| `034_DSC01842.webp` | Floral Fleece | GENERADA | REGENERADA y publicada |
| `035_DSC01845.webp` | Embroidered Coach Jacket | GENERADA | REGENERADA y publicada |
| `036_DSC01848.webp` | Technical Long Parka | GENERADA | REGENERADA y publicada |
| `037_DSC01850.webp` | Transparent Rain Shell | GENERADA | REGENERADA y publicada |
| `038_DSC01857.webp` | Cape Coat | GENERADA | REGENERADA y publicada |
| `039_DSC01859.webp` | Ivory Collarless Jacket | GENERADA | Sin cambio en este lote |
| `040_DSC01861.webp` | Light Denim Jacket | GENERADA | REGENERADA y publicada |
| `041_DSC01863.webp` | Draped Wool Poncho | GENERADA | REGENERADA y publicada |
| `042_DSC01867.webp` | Frog-Closure Jacket | GENERADA | REGENERADA y publicada |
| `043_DSC01871.webp` | Contrast-Piped Shirt | GENERADA | REGENERADA y publicada |
| `044_DSC01873.webp` | Draped Black Shirt | GENERADA | REGENERADA y publicada |
| `045_DSC01875.webp` | Human Made Jacket | GENERADA | Sin cambio en este lote |
| `046_DSC01878.webp` | MA-1 Bomber | GENERADA | REGENERADA y publicada |
| `047_DSC01880.webp` | Toggle Jacket | GENERADA | Sin cambio en este lote |
| `048_DSC01882.webp` | White Track Shell | GENERADA | Sin cambio en este lote |
| `049_DSC01884.webp` | Ivory Technical Shell | GENERADA | Sin cambio en este lote |
| `050_DSC01888.webp` | Cropped Double Blazer | GENERADA | REGENERADA y publicada |

## Pants & Sneakers — 104 prendas

Corrección importante: el estado histórico `aceptada` significaba que ese output pasó una revisión, no que fuera una fotografía recortada. En las 37 filas con ese estado, la comparación entre RAW y resultado muestra cambios de pose, silueta, volumen o pliegues; por tanto también son imágenes generadas. En este grupo no hay ningún recorte directo confirmado. Además, esas 37 aprobaciones históricas quedan con `QA REABIERTO`: el asset activo no se considera correcto hasta revisar su fidelidad contra el RAW.

Corrección Footwear del 26 de julio: el primer lote de 25 piezas (`016` y `047`–`070`) sí fue generado mediante la suscripción de ImageGen, sin API, pero queda **invalidado**. Las comprobaciones de tamaño, alpha y lámina conjunta no demostraron fidelidad estructural; varias piezas alteraron construcción, proporciones, cordones, paneles o pose. Los WebP activos de ese lote no se consideran aprobados para producción.

Piloto `FORME-FOOTWEAR-RETAIL-v2`: `047_DSC01989` y `050_DSC01994` se procesaron en un batch aislado con identificación previa, prompt por subtipo, fuente bloqueada, normalización separada y QA independiente. Los retries finales pasaron fidelidad `95/100` y validación técnica como WebP transparente `1024 × 1280`; `047` corrigió framing y `050` cambió a `background-only`. Los masters permanecen en `tmp/garment-pipeline/FORME-FOOTWEAR-RETAIL-PILOT-2026-07-26/normalized/retry-1/`; todavía no sustituyen assets públicos ni prueban el lote restante.

| Archivo | Nombre | Procedencia visible | Evidencia del manifiesto |
|---|---|---|---|
| `001_DSC01931.webp` | Short negro recto | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `002_DSC01934.webp` | Short gráfico verde | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `003_DSC01935.webp` | Short cargo gris | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `004_DSC01936.webp` | Camisa utility oliva | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `005_DSC01937.webp` | Short rosado | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `006_DSC01938.webp` | Cardigan rosado | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `007_DSC01940.webp` | Jogger marrón | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `008_DSC01941.webp` | Falda plisada negra | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `009_DSC01942.webp` | Pantalón gráfico geométrico | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `010_DSC01943.webp` | Jean gris claro | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `011_DSC01944.webp` | Pantalón negro ancho | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `012_DSC01945.webp` | Falda plisada corta | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `013_DSC01946.webp` | Short drapeado negro | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `014_DSC01947.webp` | Falda plisada midi | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `015_DSC01948.webp` | Overol negro | GENERADA | output marcado rojo y rehecho con ImageGen |
| `016_DSC01949.webp` | Botas Chelsea negras | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `017_DSC01950.webp` | T-shirt blanca minimal | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `018_DSC01952.webp` | Top blanco sin mangas | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `019_DSC01953.webp` | Polo manga larga salvia | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `020_DSC01955.webp` | Polo navy | GENERADA | output marcado rojo y rehecho con ImageGen |
| `021_DSC01956.webp` | T-shirt gris jaspe | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `022_DSC01957.webp` | Tank negro | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `023_DSC01958.webp` | T-shirt gris oversized | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `024_DSC01959.webp` | Sweatshirt negro con cuello | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `025_DSC01960.webp` | T-shirt turquesa gráfica | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `026_DSC01961.webp` | T-shirt negra gráfica | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `027_DSC01962.webp` | T-shirt roja gráfica | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `028_DSC01963.webp` | T-shirt crema The Child | REVISAR | sigue rechazada; la app aún la carga con `status: review` |
| `029_DSC01965.webp` | Camisa tartán sin mangas | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `030_DSC01966.webp` | Camisa abstracta rosada | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `031_DSC01967.webp` | Sobrecamisa gráfica larga | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `032_DSC01969.webp` | Hoodie amarillo pálido | GENERADA | output marcado rojo y rehecho con ImageGen |
| `033_DSC01970.webp` | Hoodie blanco mangas gráficas | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `034_DSC01971.webp` | Hoodie gris gráfico | GENERADA | output marcado rojo y rehecho con ImageGen |
| `035_DSC01972.webp` | Sweatshirt crema gráfico | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `036_DSC01973.webp` | Sweatshirt mostaza | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `037_DSC01975.webp` | Hoodie azul gráfico | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `038_DSC01976.webp` | Hoodie gris cargo | GENERADA | output marcado rojo y rehecho con ImageGen |
| `039_DSC01977.webp` | Hoodie negro gráfico | GENERADA | output marcado rojo y rehecho con ImageGen |
| `040_DSC01980.webp` | Hoodie taupe | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `041_DSC01981.webp` | Camisa verde gráfica | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `042_DSC01982.webp` | T-shirt neón gráfica | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `043_DSC01983.webp` | Hoodie beige | GENERADA | output marcado rojo y rehecho con ImageGen |
| `044_DSC01984.webp` | Camisa camp multicolor | GENERADA | output marcado rojo y rehecho con ImageGen |
| `045_DSC01985.webp` | Camisa texturada estampada | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `046_DSC01986.webp` | T-shirt blanca básica | GENERADA | comparación RAW → resultado; `aceptada` era estado de QA |
| `047_DSC01989.webp` | Sneakers plateadas | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `048_DSC01992.webp` | Botas Chelsea negras | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `049_DSC01993.webp` | Sneakers blancas y azules | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `050_DSC01994.webp` | Botas combat bicolor | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `051_DSC01995.webp` | Sneakers técnicas grises | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `052_DSC01996.webp` | High-tops azules y doradas | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha conectado |
| `053_DSC01997.webp` | High-tops blancas | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `054_DSC01998.webp` | Sneakers negras swoosh turquesa | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `055_DSC01999.webp` | Sneakers pastel multicolor | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `056_DSC02000.webp` | Sneakers técnicas negras | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `057_DSC02001.webp` | Derbies con suela verde | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `058_DSC02003.webp` | High-tops tipográficas | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `059_DSC02004.webp` | Botas negras suela ámbar | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `060_DSC02005.webp` | High-tops multicolor | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `061_DSC02008.webp` | Slingbacks negras de pelo | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `062_DSC02009.webp` | Sandalias técnicas blancas | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `063_DSC02011.webp` | Sneakers blancas y champagne | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `064_DSC02013.webp` | Sneakers knit negras | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `065_DSC02015.webp` | Mules negras de espuma | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `066_DSC02017.webp` | High-tops bronce y naranja | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `067_DSC02019.webp` | Sneakers negras clásicas | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `068_DSC02022.webp` | High-tops amarillas | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `069_DSC02024.webp` | Sneakers negras air sole | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `070_DSC02026.webp` | Sneakers negras con verde neón | GENERADA | RAW exacto → ImageGen suscripción; QA fuente/resultado + alpha |
| `071_DSC02028.webp` | Bucket hat gráfico | GENERADA | output marcado rojo y rehecho con ImageGen |
| `072_DSC02029.webp` | Bucket hat con parche | GENERADA | output marcado rojo y rehecho con ImageGen |
| `073_DSC01894.webp` | Pantalón cargo grafito | GENERADA | prenda omitida y generada con ImageGen |
| `074_DSC01896.webp` | Pantalón blanco ancho | GENERADA | prenda omitida y generada con ImageGen |
| `075_DSC01897.webp` | Pantalón beige recto | GENERADA | prenda omitida y generada con ImageGen |
| `076_DSC01898.webp` | Jogger negro panelado | GENERADA | prenda omitida y generada con ImageGen |
| `077_DSC01899.webp` | Pantalón negro ancho | GENERADA | prenda omitida y generada con ImageGen |
| `078_DSC01900.webp` | Jean azul flare | GENERADA | prenda omitida y generada con ImageGen |
| `079_DSC01901.webp` | Pantalón de cuero negro | GENERADA | prenda omitida y generada con ImageGen |
| `080_DSC01903.webp` | Pantalón negro recto | GENERADA | prenda omitida y generada con ImageGen |
| `081_DSC01904.webp` | Pantalón negro slim | GENERADA | prenda omitida y generada con ImageGen |
| `082_DSC01905.webp` | Pantalón azul recto | GENERADA | prenda omitida y generada con ImageGen |
| `083_DSC01906.webp` | Jogger negro con broches | GENERADA | prenda omitida y generada con ImageGen |
| `084_DSC01908.webp` | Jogger rosa viejo | GENERADA | prenda omitida y generada con ImageGen |
| `085_DSC01909.webp` | Short denim azul | GENERADA | prenda omitida y generada con ImageGen |
| `086_DSC01910.webp` | Short cargo oliva | GENERADA | prenda omitida y generada con ImageGen |
| `087_DSC01911.webp` | Short boxer marfil | GENERADA | prenda omitida y generada con ImageGen |
| `088_DSC01912.webp` | Short piedra | GENERADA | prenda omitida y generada con ImageGen |
| `089_DSC01913.webp` | Short celeste | GENERADA | prenda omitida y generada con ImageGen |
| `090_DSC01914.webp` | Short verde | GENERADA | prenda omitida y generada con ImageGen |
| `091_DSC01915.webp` | Short crema | GENERADA | prenda omitida y generada con ImageGen |
| `093_DSC01917.webp` | Short denim gris | GENERADA | prenda omitida y generada con ImageGen |
| `094_DSC01918.webp` | Jogger blanco rayado | GENERADA | prenda omitida y generada con ImageGen |
| `095_DSC01919.webp` | Pantalón camel | GENERADA | prenda omitida y generada con ImageGen |
| `096_DSC01920.webp` | Pantalón gris recto | GENERADA | prenda omitida y generada con ImageGen |
| `097_DSC01922.webp` | Pantalón de cuero slim | GENERADA | prenda omitida y generada con ImageGen |
| `098_DSC01923.webp` | Pantalón negro ceñido | GENERADA | prenda omitida y generada con ImageGen |
| `099_DSC01924.webp` | Pantalón negro plisado | GENERADA | prenda omitida y generada con ImageGen |
| `100_DSC01925.webp` | Pantalón negro amplio | GENERADA | prenda omitida y generada con ImageGen |
| `101_DSC01926.webp` | Jogger negro | GENERADA | prenda omitida y generada con ImageGen |
| `103_DSC01928.webp` | Cargo jogger gris | GENERADA | prenda omitida y generada con ImageGen |
| `104_DSC01930.webp` | Cargo camuflado oscuro | GENERADA | prenda omitida y generada con ImageGen |
| `105_DSC01932.webp` | Short negro deportivo | GENERADA | prenda omitida y generada con ImageGen |
| `106_DSC01968.webp` | Sobrecamisa camuflada | GENERADA | prenda omitida y generada con ImageGen |

## Básicos Formé — 16 prendas

Estas prendas no pertenecen a las dos carpetas fuente del closet personal. El repositorio contiene únicamente los assets finales y no conserva recibos suficientes para afirmar si fueron generados o recortados de una foto. No se inventa una procedencia.

| Asset | Nombre | Procedencia visible | Acción local reciente |
|---|---|---|---|
| `blue-straight-jeans.webp` | Classic Straight Jeans | SIN RECIBO | Limpieza determinística de alpha; cambio local aún no publicado |
| `washed-black-jeans.webp` | Washed Black Jeans | SIN RECIBO | Limpieza determinística de alpha; cambio local aún no publicado |
| `black-wide-trousers.webp` | Wide-Leg Trousers | SIN RECIBO | Limpieza determinística de alpha; cambio local aún no publicado |
| `stone-pleated-chinos.webp` | Pleated Chinos | SIN RECIBO | Limpieza determinística de alpha; cambio local aún no publicado |
| `basic-white-tee.webp` | Basic White Tee | SIN RECIBO | Limpieza determinística de alpha; cambio local aún no publicado |
| `oversized-black-tee.webp` | Oversized Black Tee | SIN RECIBO | Limpieza determinística de alpha; cambio local aún no publicado |
| `blue-long-sleeve-shirt.webp` | Blue Long-Sleeve Shirt | SIN RECIBO | Limpieza determinística de alpha; cambio local aún no publicado |
| `black-short-sleeve-shirt.webp` | Black Short-Sleeve Shirt | SIN RECIBO | Limpieza determinística de alpha; cambio local aún no publicado |
| `white-sneakers.webp` | White Leather Sneakers | SIN RECIBO | Sin cambio |
| `black-leather-shoes.webp` | Black Leather Shoes | SIN RECIBO | Sin cambio |
| `brown-leather-shoes.webp` | Brown Leather Shoes | SIN RECIBO | Sin cambio |
| `black-pumps.webp` | Black Pumps | SIN RECIBO | Sin cambio |
| `black-cap.webp` | Black Cap | SIN RECIBO | Sin cambio |
| `black-beanie.webp` | Black Beanie | SIN RECIBO | Sin cambio |
| `black-sunglasses.webp` | Black Rectangular Sunglasses | SIN RECIBO | Sin cambio |
| `black-tote.webp` | Black Tote | SIN RECIBO | Sin cambio |

## Pendiente real

`028_DSC01963.webp` — T-shirt crema The Child — es una generación, pero no tiene una salida aprobada. Está marcada `review` en la app y `rechazada_rojo` en el manifiesto.
