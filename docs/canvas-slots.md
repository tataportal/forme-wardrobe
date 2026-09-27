# Alturas de prendas en Canvas

`app/garment-layout.ts` define una única colocación inicial por slots. Un slot
visual equivale al 9.2% de la altura del área de trabajo. La referencia aprobada
es el look crema de la captura del 02/09: hombros cerca del 20%, cintura cerca
del 40% (39% en la calibración) y una ligera superposición entre casaca y pantalón.
El borde visible de los inferiores se alinea a esa línea. En superiores no se alinea el punto
más alto del archivo: un cuello alto o una capucha sobresale sobre los hombros.
Un cuerpo cropped ocupa 2.2 slots visuales y la pierna completa 5: relación 44%,
sin contar cuello ni mangas. La basta cropped queda en el 40.24%, por debajo
de la cintura del 39%, sin una franja vacía. Un superior regular de 3 slots llega
a la cadera. El pantalón largo termina en el 85% y el calzado en el 90%.
La antigua cintura obligatoria del 50% no reproducía la referencia: bajaba el
look y separaba las prendas cropped del pantalón.
En pantallas de menor altura se reduce esta referencia completa alrededor de
la cintura del 39%, reservando 72 px abajo (barra de 44 px, margen de 12 px y
separación de 16 px). La relación torso/pierna se conserva y el calzado no invade
los botones. Esos porcentajes describen la referencia máxima, no un recorte.
Los overoles son piezas completas: se mide su silueta total, sin confundir el largo de pierna con torso.

El catálogo tiene mediciones de alfa en `app/garment-layout-data.json`. Incluye
contorno, hombros, basta, subida del cuello, extremos de ambas mangas, slots,
región y hash del archivo. El largo del cuerpo va de hombros a basta, sin contar
cuellos ni mangas. La basta se mide en el tercio central para excluir los puños
y los tiradores. Las mangas pueden sobresalir sin cambiar los slots del cuerpo.
La variante abierta conserva los puntos anatómicos y slots de la cerrada,
normalizados por su contorno: su hueco central no sirve para medir la basta.
Las nuevas subidas procesadas por la app reciben anatomía persistida desde el
backend, descrita abajo. El análisis por alfa del cliente queda como fallback
para prendas antiguas y recortes adjuntados manualmente sin anatomía verificada.

Los slots persistidos describen clases de largo; `canvasSlotSpan` las proyecta
a una referencia corporal compartida por el catálogo y las nuevas subidas.
No se reescriben la anatomía almacenada ni las imágenes. Ejemplos de spans
visuales: cropped 2.2; regular 3; blazer 3.75; abrigo 5–7; shorts 1.75;
pantalón largo 5. Hombros, cintura, rodillas y tobillos tienen así una relación
común: no se fuerza a un torso a medir casi lo mismo que una pierna completa.
Esos spans son el largo nominal máximo. En superiores, la proyección también
limita el ancho visible según la clase de largo: cropped 3.1 unidades; regular
3.3 para tops y 3.6 para capas; hip 3.8; long 4.2; maxi 4.6. Las siluetas
oversized y drapeadas tienen 0.25 unidades adicionales. Se usa la menor escala
entre largo nominal y ancho permitido, manteniendo los hombros alineados. Esto
evita inflar una sweatshirt ancha por tener el torso relativamente corto.
El cuerpo, mangas y cuello se reducen juntos; nunca se deforman por separado.
La referencia cropped crema y las prendas que ya caben conservan su tamaño.

El tamaño de la imagen se calcula proporcionalmente: no se estira,
recorta ni modifica ningún asset. Los slots se infieren del tipo/largo y las
mediciones del cuerpo. La clasificación cropped usa el largo declarado en
metadata (`bodyLength`, silueta o nombre), nunca la relación entre cuerpo y
mangas. Las mediciones por alfa son estimaciones de contorno, no segmentación
semántica; por eso se revisan sobre las imágenes antes de publicar.
Para prendas antiguas sin anatomía de servidor, los abrigos, capas y sobrecamisas
cuyo cuerpo baja claramente de ambos puños se reconocen como largos aunque sean
anchos. El fallback entiende largo/larga y long; excluye «manga larga» y
«long-sleeved». No aplica esta inferencia a camisetas de manga corta. Las medidas
de servidor y una corrección explícita del largo siguen teniendo prioridad.
Una capucha que tapa la referencia interior de los hombros se declara como
`neckline: "wide-hood"` tras la revisión, para usar el contorno exterior sin
confundirla con el torso. No se usan costuras caídas de manga como hombro.

Todos los accesorios se escalan y centran por su contorno visible, no por el marco
transparente del PNG. El ancho objetivo es 1.2 unidades para lentes, 1.4 para
gorros, 1.6 para bolsos, 2.1 para cinturones y 1.35 para pañuelos y otros accesorios.
Los gorros admiten hasta 1.2 unidades de alto dentro del espacio de la cabeza.
Un límite de alto evita que un gorro alto o un bolso con asas invada otras zonas.
Los gorros quedan sobre los lentes, los cinturones en la cintura, los pañuelos
en el cuello y los bolsos al costado de la cadera. Ya no hay una escala fija
de 0.22 ni una posición de gorro aplicada a todos los accesorios.
Comparten la escala corporal y el ajuste por altura de pantalla. Son posiciones
iniciales: mover, escalar o guardar una composición conserva el control del usuario.
El menú del look ofrece «Ajustar proporciones» para recolocar y escalar
explícitamente una composición existente. Conserva sus prendas, variantes,
giros y orden de capas; se puede deshacer en un solo paso. Abrir un look guardado
no ejecuta ese ajuste.

Para recalcular y revisar el catálogo:

```sh
npm run garments:analyze-layout
npm test
```

El análisis produce contactos y el reporte de revisión en
`.wrangler/layout-audit/`, fuera de los assets publicados. Las pruebas detectan
assets cuyo hash cambió sin volver a medirlos.
En los contactos, rojo = hombros, azul = basta y verde = extremos de mangas.

Solo las piezas colocadas automáticamente se reajustan al cambiar el tamaño de
la ventana. Arrastrar, rotar o escalar devuelve el control al usuario. Guardar y
abrir un look conserva sus coordenadas: no se migran las composiciones previas.

## Subidas nuevas: pipeline de servidor

1. La misma revisión visual post-generación devuelve `anatomy`: región, largo
   de cuerpo, tipo de cuello/capucha, largo de mangas, confianza y puntos de
   hombros, basta y ambos puños. No se añade otra generación ni otra llamada de
   análisis en el caso normal. La fidelidad de la imagen y la confianza de las
   medidas son controles independientes.
2. `shared/garment-anatomy.ts` valida las combinaciones región/largo y asigna
   slots mediante una tabla fija, nunca desde el nombre. La clasificación del
   cuerpo no depende de cuánto sobresalgan el cuello o las mangas.
3. Cloudflare contrasta los puntos con bordes reales del alfa del calado completo
   y ajusta pequeñas diferencias (2.5% horizontal / 3.5% vertical como máximo).
   Calcula las medidas antes de quitar el centro para layering. Ambos PNG
   mantienen las dimensiones del master y comparten hombros, basta y puños.
   Este cálculo no corta, estira ni modifica la prenda.
4. Si faltan puntos, confianza o coherencia geométrica, hay un único reintento
   de medición sobre el mismo master aprobado. Si vuelve a fallar, la prenda
   queda en fallo automático; el master se conserva y no se entrega un layout
   inventado. La aprobación se almacena junto al master para no regenerarlo
   cuando se reintenta el postprocesamiento.
5. La migración `0009_garment_anatomy.sql` añade `garments.layout_json`, nullable
   para registros anteriores. Guarda versión, claves de los PNG, medidas,
   confianza y fecha; se actualiza atómicamente con los calados finales.
6. La API entrega `anatomy` sin claves internas y solo si corresponde a los
   PNG actuales. Canvas prioriza estas medidas y no vuelve a analizar esas
   imágenes. Cambiar el nombre conserva la anatomía; reemplazar un PNG invalida
   su referencia. Una nueva foto fuente invalida las imágenes y medidas viejas.

Los reintentos de máscaras continúan por la cola existente. El QA de calado de
layering sigue siendo obligatorio. Las prendas antiguas no se regeneran ni se
reanalizan con IA automáticamente, y los looks guardados no se recolocan.

La respuesta de IA usa JSON Schema estricto con todos los campos requeridos,
puntos anulables cuando no corresponden y objetos sin propiedades adicionales,
según [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

`tests/garment-anatomy-pipeline.test.mjs` recorre generación en cola, QA, calado
PNG real, SQL SQLite con todas las migraciones, serialización API y colocación
en Canvas. Solo simula el proveedor y los transportes D1/R2; no hace llamadas
facturables ni sustituye una prueba de calidad con imágenes reales del proveedor.

## Random y bloqueo en Canvas

Random reemplaza directamente las piezas sin bloquear por prendas listas del
mismo grupo. No hay recetas de cinco variaciones ni un panel de resultados.
Conserva la cantidad de piezas: no añade accesorios o abrigos inesperadamente,
y los accesorios se reemplazan por su mismo tipo (bolso por bolso, lentes por
lentes). Tops y pantalones participan igual que el resto.

El candado aparece al seleccionar una pieza y permanece visible mientras esté
bloqueada. El bloqueo conserva identidad, variante, posición, escala y rotación
durante Random; no impide editarla manualmente. Vive en la sesión actual del
Canvas y se limpia al vaciarlo, abrir otro look o duplicar el look. Los controles
son una capa separada para que un abrigo no oculte el candado del pantalón.
