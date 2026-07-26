# Formé Design System

Status: sistema minimal aprobado para producto

Scope activo: Portada, Closet, Looks, Canvas, Asistente, Perfil, Ajustes, About y Pricing

Idioma de producto: español

## Brand contract

Formé es un archivo personal de ropa y un asistente de estilo. No debe sentirse como ecommerce, SaaS genérico ni una herramienta de edición improvisada.

La Portada es la expresión editorial de la marca. Closet es la expresión funcional del mismo sistema. Cambia la intensidad, no cambia el lenguaje.

## Principios

1. La prenda es el contenido principal. La interfaz la organiza y nunca compite con ella.
2. Toda prenda se muestra completa en Portada y Closet. El recorte o la oclusión deliberada solo pertenecen al Canvas cuando sirven al layering.
3. El asset no lleva borde blanco, halo, sticker outline ni sombra horneada. La UI puede aplicar una sombra neutra y suave.
4. La jerarquía se construye con escala, espacio y contraste. No con una colección de cajas y líneas.
5. Una acción primaria por contexto. Las acciones secundarias conservan el mismo tamaño y geometría.
6. Mobile no es una versión recortada de desktop. Debe conservar la prenda completa y el orden de lectura.
7. Cada elemento pasa tres preguntas: si necesita existir, si necesita estar visible y si puede aparecer por hover, foco, tap o apertura explícita.
8. La prenda es la única capa permanente. Metadata, favorito y acción de Canvas son contextuales.

## Regla de visibilidad

| Elemento | Estado normal | Revelado |
| --- | --- | --- |
| Prenda completa | Siempre visible | Nunca se oculta |
| Nombre, marca y acciones | Ocultos en desktop | Una sola franja en hover o foco |
| Favorito | Oculto | Hover o foco |
| Ficha de prenda | Cerrada | Clic en la prenda o `Editar` |
| Añadir al Canvas | Oculto | `Añadir` en la franja contextual |
| Filtros | Cerrados | Botón `Filtrar` |
| Nombre de grupo | Visible solo cuando cambia la procedencia | Inicio de Básicos Formé |
| Datos técnicos de foto | Nunca visibles en la card | Editor |

En dispositivos sin hover, tocar la prenda ejecuta la acción principal. No se depende de un gesto inexistente ni se imprime metadata permanente para compensarlo.

## Foundations

### Color

| Token | Valor | Uso |
| --- | --- | --- |
| `canvas` | `#F1F1EC` | Fondo de producto |
| `surface` | `#E7E8E3` | Media stages y cards |
| `surface-raised` | `#F8F8F4` | Estados elevados |
| `ink` | `#111310` | Texto y controles |
| `muted` | `rgba(17,19,16,.60)` | Texto secundario |
| `line` | `rgba(17,19,16,.14)` | Divisores necesarios |
| `signal` | `#F0442F` | Marca, foco y acción |

Portada usa `signal` como campo dominante. Closet usa `canvas` como campo dominante. Ambos comparten tinta, superficies y contraste.

El rojo identifica marca, acción y selección. Dentro de la aplicación no se usa para decorar secciones completas. Violeta y azul pueden aparecer únicamente como refracción ambiental tenue, nunca como gradiente de control.

### Tipografía

- Display y UI: `"Helvetica Neue", Helvetica, Arial, sans-serif`.
- Datos y estados técnicos: `ui-monospace, SFMono-Regular, Menlo, monospace`.
- Display: peso 500 o 600, tracking negativo.
- UI: peso 600, sin mayúsculas automáticas.
- Labels: 10–11 px, tracking leve.
- Body: 15–18 px.
- El cuerpo nunca baja de 14 px en mobile.

### Escala y espacio

- Escala: 4, 8, 12, 16, 24, 32, 48, 64 y 96 px.
- Gutter exterior de página: 0 px en desktop y mobile.
- Portada y superficies principales son full-bleed: sin marco exterior, contenedor centrado ni margen lateral.
- El espaciado vive dentro de cada módulo, nunca entre la aplicación y el borde del viewport.
- Ancho máximo de página: ninguno.
- Secciones principales: 48–96 px.
- Separación de cards: 10–14 px horizontal, 28–36 px vertical.

### Forma

- Control: 10 px.
- Media/card: 18 px.
- Stage editorial: 24 px.
- Pill solo para estados o selección compacta. No como geometría universal.
- Ninguna superficie, card, stage, contenedor o control lleva marco, borde ni box-shadow.
- Tampoco se simula un marco mediante un rectángulo de fondo o una cápsula envolvente.
- La jerarquía se resuelve con campos de color, espacio, escala y tipografía.

### Movimiento

- UI: 180–220 ms.
- Entrada editorial: 700–1100 ms.
- Curva principal: `cubic-bezier(.22,1,.36,1)`.
- Ninguna animación debe ocultar o recortar una prenda.
- En pantallas de trabajo, el movimiento solo comunica feedback o cambio de estado. No hay scanlines, glows móviles ni efectos perpetuos.
- Respetar `prefers-reduced-motion`.

## Componentes

### Header

72 px en desktop, 64 px en mobile. Wordmark a la izquierda, navegación centrada cuando hay espacio, acción o cuenta a la derecha.

### Botón

Altura mínima 36–42 px. En Portada y Closet es texto sin contenedor. El estado de foco usa outline accesible. El texto describe una acción concreta.

### Garment stage

Superficie neutra sin marco, radio 18 px, `object-fit: contain`, centro óptico y padding suficiente. La única sombra permitida es la sombra suave aplicada a la silueta de la prenda:

```css
filter: drop-shadow(0 14px 18px rgba(17, 19, 16, 0.14));
```

Nunca agregar outlines blancos con `drop-shadow`.

### Roles de foto

Los roles pertenecen al asset, no a las etiquetas libres de la prenda:

| Tag | Campo | Uso |
| --- | --- | --- |
| `COMPLETA` | `image` | Portada, Closet, ficha y cualquier superficie normal |
| `CANVAS` | `openImage` | Canvas y layering |

- Portada y Closet siempre solicitan `COMPLETA`.
- Canvas solicita `CANVAS`; si no existe, usa `COMPLETA` como fallback y conserva ese tag internamente.
- Un archivo `-open` es `CANVAS`. Nunca se usa en Portada o en la grilla de Closet.
- `COMPLETA` y `CANVAS` son contratos técnicos: no se imprimen en cards, hero ni biblioteca del Canvas.
- El editor traduce esos roles a lenguaje de producto: `PRINCIPAL` y `PARA CAPAS`.

### Garment card

Media 4:5, prenda completa y sin superficie encapsulada. Metadata y acciones aparecen por hover o foco. Movimiento vertical máximo de 2 px, sin zoom que corte la silueta. En touch, toda la prenda es el target principal.

### Section heading

Título editorial, conteo alineado al extremo y un divisor solo cuando separa grupos reales.

## Navegación

El shell de producto es único:

- Izquierda: Formé.
- Centro: Closet, Canvas y Asistente.
- Derecha: cuenta.
- Mobile: Closet, Canvas y Asistente en navegación inferior.
- Closet y Looks comparten un selector local `Closet / Looks` dentro de ambas rutas.

Landing y Pricing comparten altura, márgenes, geometría y tratamiento de controles con el shell de producto, aunque la landing pueda usar el rojo como momento de marca.

## Composición de página

### Portada

- Campo de marca `signal`.
- Una promesa clara.
- Una prenda hero completa.
- Una única acción hacia Closet.
- Una sola pantalla. Navegación secundaria dentro de `Menú`.

### Closet

- Campo de producto `canvas`.
- Barra compacta con título, conteo y acciones.
- Sin hero, preview duplicado, métricas de relleno ni texto explicativo.
- Grilla 4 columnas desktop, 2 mobile.
- Básicos Formé como segundo grupo, nunca como tab.
- Filtros cerrados por defecto.
- Nombre, marca, favorito y Canvas aparecen solo por hover o foco.

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

Todas las rutas usan el mismo sistema. No se mantienen pantallas V2 con cápsulas, marcos o vitrinas decorativas.

## Copy

- Español.
- Formé con tilde.
- Usar `look`, nunca `conjunto`.
- Microcopy funcional. Evitar lenguaje técnico, labels redundantes y frases decorativas.

## Reglas de consistencia

1. No crear otra versión visual paralela.
2. Los tokens del piloto se aplican por scope de ruta hasta su aprobación; después se promueven al sistema global.
3. No duplicar navegación dentro del contenido.
4. No crear excepciones visuales por lote o carpeta de prendas.
5. No hornear sombras, bordes ni halos en los assets.
6. Toda nueva pantalla debe reutilizar shell, tokens, botones, campos y estados de este documento.

## QA obligatorio

- Captura desktop y mobile antes de publicar.
- Captura del estado normal y del estado contextual.
- Verificar las cuatro esquinas de cada prenda visible.
- Verificar transparencia sobre una superficie distinta al blanco.
- Verificar que hover, animación y responsive no cambien `contain` por `cover`.
- Verificar que en touch toda prenda siga siendo accionable sin controles flotantes.
- No extender el sistema a otras rutas hasta aprobar Portada y Closet.
