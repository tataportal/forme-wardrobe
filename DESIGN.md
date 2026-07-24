# Formé V2

Formé es un closet digital y un asistente de estilo. La interfaz debe sentirse como una herramienta personal de moda: editorial, precisa y táctil. Nunca como un dashboard genérico, un panel técnico o una colección de experimentos visuales.

## Principio rector

La prenda y el look son el contenido. La interfaz los organiza, no compite con ellos.

## Sistema

### Color

- Fondo principal: `#F1F1EC`
- Superficie: `#E7E8E3`
- Superficie elevada: `#F8F8F4`
- Tinta: `#111310`
- Texto secundario: `rgba(17, 19, 16, .58)`
- Línea: `rgba(17, 19, 16, .14)`
- Señal Formé: `#F0442F`
- Refracción: violeta y azul solo como luz ambiental muy tenue, nunca como gradiente de control.

El rojo identifica acción, selección y marca. No se usa para decorar secciones completas dentro de la aplicación.

### Tipografía

- Interfaz y display: Helvetica Neue, Helvetica, Arial, sans-serif.
- Monoespaciada: `ui-monospace` solo para cantidades, fechas, estados compactos y metadata.
- Los títulos usan peso 500-700. No se escriben en mayúsculas completas.
- Los controles usan 11-13 px, peso 600 y tracking moderado.
- El cuerpo nunca baja de 14 px en mobile.

### Geometría

- Controles: radio de 9 px.
- Cards y paneles: radio de 16 px.
- Modales y superficies mayores: radio de 20 px.
- Pills únicamente para toggles, estados binarios y chips.
- Una superficie puede tener borde o sombra, no ambos salvo un modal.

### Espaciado

Escala base: `4, 8, 12, 16, 24, 32, 48, 64, 96`.

- Desktop: margen exterior de 32-48 px.
- Mobile: margen exterior de 16 px.
- Las páginas de trabajo comienzan con contenido útil en el primer viewport.
- No se apilan hero, explicación y segundo bloque introductorio antes del contenido.

## Navegación

El shell de producto es único:

- Izquierda: Formé.
- Centro: Closet, Looks, Asistente.
- Derecha: Canvas y cuenta.
- Mobile: Closet, Looks y Asistente en navegación inferior. Canvas se abre desde las acciones contextuales.

Landing y Pricing comparten altura, márgenes, geometría y tratamiento de controles con el shell de producto, aunque la landing pueda usar el rojo como momento de marca.

## Pantallas

### Closet

- Título, resumen y acciones Filtros / Agregar en el mismo bloque.
- La grilla de prendas es protagonista.
- Básicos Formé aparece después del closet personal.
- Sin scanner animado ni dashboard de métricas decorativo.

### Looks

- Looks guardados y semana viven en la misma ruta.
- El primer bloque muestra looks reales o un empty state accionable.
- Planificación semanal se presenta como herramienta, no como panel analítico.

### Asistente

- La pregunta es el primer contenido.
- Perfil, Closet y Looks aparecen como contexto secundario y legible.
- Las recomendaciones muestran el porqué sin gráficos decorativos.

### Perfil y Ajustes

- Son páginas reales, no drawers sobre otra ruta.
- Perfil concentra identidad y capa pública.
- Ajustes concentra preferencias y calibración.
- Guest y loading tienen estados completos, nunca una pantalla vacía.

### Canvas

- Fondo greige único.
- Panel izquierdo de prendas y panel derecho de Looks pueden coexistir en desktop.
- El frame solo indica el área guardada.
- La selección usa cuatro controles: duplicar, borrar, rotar y escalar.
- La barra inferior contiene Guardar look, Duplicar, Mezclar y Compartir.

## Movimiento

- Intensidad 4/10.
- Movimiento solo para feedback, cambios de estado y entrada de contenido.
- Sin scanlines animadas, glows móviles ni efectos perpetuos en pantallas de trabajo.
- Respetar `prefers-reduced-motion`.

## Copy

- Español.
- Formé con tilde.
- Usar `look`, nunca `conjunto`.
- Microcopy funcional. Evitar lenguaje técnico, labels redundantes y frases decorativas.

## Reglas de consistencia

1. No crear otra versión visual paralela.
2. No añadir tokens locales por pantalla.
3. No duplicar navegación dentro del contenido.
4. No crear excepciones visuales por lote o carpeta de prendas.
5. No hornear sombras, bordes ni halos en los assets.
6. Toda nueva pantalla debe reutilizar el shell, tokens, botones, campos y estados de este documento.
