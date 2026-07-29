# Formé Footwear Retail

`PROMPT_VERSION: FORME-FOOTWEAR-RETAIL-SHORT-v1`

Esta versión reemplaza el prompt técnico largo. La generación usa lenguaje corto y natural. La identificación detallada existe para routing y QA; **no se inyecta completa en ImageGen**.

## 1. Identificación silenciosa

Antes de generar, el `visual-specifier` registra internamente:

- `source_id`;
- par o pieza individual;
- subtipo;
- producto completo o incompleto;
- pose y orientación;
- color/material;
- detalles que no pueden perderse;
- defecto concreto que el usuario quiere corregir.

La ficha decide qué prompt corto usar y qué revisar después. No se copia dentro del prompt.

## 2. Prompt base

Usar este texto sin convertirlo en un brief:

```text
¿Puedes rehacer esto como foto retail para ecommerce? Clean studio lighting.
```

La primera salida debe tener:

- fondo blanco de estudio;
- iluminación limpia y natural;
- producto completo;
- composición retail reconocible;
- sombra de contacto suave;
- sin props, cuerpo, pie, texto ni watermark.

## 3. Segundo turno opcional

Solo se pide una corrección concreta después de ver la primera salida. No se reescribe todo el prompt.

### Sneakers

```text
¿Puedes ordenar los pasadores y hacerlas como nuevas?
```

### Botas con cordones

```text
¿Puedes ordenar los pasadores, limpiar el cuero y hacerlas como nuevas?
```

### Chelsea boots

```text
¿Puedes limpiar el cuero y hacerlas como nuevas?
```

### Zapatos formales y loafers

```text
¿Puedes pulir el cuero y hacerlos como nuevos?
```

### Sandalias

```text
¿Puedes ordenar las tiras y hacerlas como nuevas?
```

### Heels y slingbacks

```text
¿Puedes ordenar las tiras, limpiar el acabado y hacerlos como nuevos?
```

### Mules y clogs

```text
¿Puedes limpiar el material y hacerlos como nuevos?
```

No combinar varios subtipos ni añadir detalles no pedidos.

## 4. Qué no se pone en el prompt

No incluir:

- ficha YAML/JSON;
- conteos de píxeles, alpha o canvas;
- listas extensas de cordones, ojales, costuras o paneles;
- `source lock`, `protected features`, hashes o códigos QA;
- chroma key;
- prohibiciones repetidas;
- instrucciones de normalización;
- nombres de agentes o estados del pipeline.

Todo eso pertenece a QA o postproceso.

## 5. Fondo transparente

La generación retail termina en fondo blanco. La transparencia es una etapa separada:

1. aprobar primero la foto retail;
2. extraer fondo y sombra sin volver a generar el producto;
3. normalizar a WebP transparente `1024 × 1280`;
4. añadir únicamente la sombra compartida desde la UI; nunca contorno.

No pedir retail lighting y chroma en la misma llamada.

## 6. QA

El QA compara fuente, primera salida y corrección:

- debe seguir siendo el mismo modelo/par;
- puede ordenar cordones y limpiar el producto cuando el usuario lo pidió;
- no puede deformar puntera, caña, horma, suela o taco;
- no puede mover, borrar o inventar logos, cierres, straps o paneles;
- no puede duplicar o espejar un zapato;
- el par debe estar completo y con margen;
- la foto debe sentirse como ecommerce real, no como cutout flotante.

La referencia visual aprobada del piloto es:

`tmp/garment-pipeline/FORME-FOOTWEAR-RETAIL-PILOT-2026-07-26/references/047-user-approved-retail-new.png`

Prompts usados por el usuario:

```text
¿Puedes rehacer esto como foto retail para ecommerce? Clean studio lighting.
```

```text
¿Puedes ordenar los pasadores, hacerlas como nueva?
```
