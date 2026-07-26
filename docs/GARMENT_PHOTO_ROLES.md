# Roles de foto de prendas

Fuente de verdad: `app/garments.ts`.

## Tags

| Tag | Campo | Superficie |
| --- | --- | --- |
| `COMPLETA` | `image` | Portada, Closet, ficha y superficies normales |
| `CANVAS` | `openImage` | Canvas y layering |

La clasificación pertenece a cada foto, no a la prenda completa ni a sus tags personalizados.

## Estado actual

- 170 fotos `COMPLETA`.
  - 50 prendas del archivo Outwear.
  - 104 prendas reconciliadas de Pants & Sneakers.
  - 16 básicos Formé.
- 42 fotos adicionales `CANVAS`.
- Toda prenda tiene una foto `COMPLETA`.
- Si Canvas no tiene variante propia, usa la foto `COMPLETA` y conserva ese tag. No se renombra como `CANVAS`.

## Fotos CANVAS

```text
001_DSC01768-open.webp
002_DSC01771-open.webp
003_DSC01773-open.webp
004_DSC01775-open.webp
005_DSC01777-open.webp
006_DSC01779-open.webp
007_DSC01781-open.webp
008_DSC01783-open.webp
009_DSC01785-open.webp
010_DSC01787-open.webp
011_DSC01789-open.webp
012_DSC01791-open.webp
013_DSC01793-open.webp
014_DSC01795-open.webp
015_DSC01797-open.webp
016_DSC01799-open.webp
018_DSC01803-open.webp
019_DSC01804-open.webp
020_DSC01806-open.webp
021_DSC01808-open.webp
022_DSC01810-open.webp
023_DSC01814-open.webp
025_DSC01819-open.webp
026_DSC01822-open.webp
027_DSC01824-open.webp
029_DSC01830-open.webp
030_DSC01833-open.webp
032_DSC01838-open.webp
033_DSC01840-open.webp
034_DSC01842-open.webp
035_DSC01845-open.webp
036_DSC01848-open.webp
037_DSC01850-open.webp
039_DSC01859-open.webp
040_DSC01861-open.webp
042_DSC01867-open.webp
045_DSC01875-open.webp
046_DSC01878-open.webp
047_DSC01880-open.webp
048_DSC01882-open.webp
049_DSC01884-open.webp
050_DSC01888-open.webp
```

## Reglas de consumo

1. Portada y Closet nunca solicitan `openImage`.
2. La grilla de Closet consume `COMPLETA`, pero no imprime el tag técnico.
3. La biblioteca del Canvas solicita `CANVAS`, pero no imprime el tag técnico ni el fallback.
4. La ficha permite alternar entre ambas fotos como `PRINCIPAL` y `PARA CAPAS`, sin mezclar sus roles internos.
5. Los archivos no cambian de tag por la página donde aparecen.

## Limpieza de alpha de Básicos Formé

Verificados visualmente sobre fondos `#151515` y `#F0442F`.

Los siguientes ocho assets `COMPLETA` tenían un sticker outline blanco y fueron
corregidos por erosión controlada del alpha, sin regenerar ni alterar la prenda:

```text
blue-straight-jeans.webp
washed-black-jeans.webp
black-wide-trousers.webp
stone-pleated-chinos.webp
basic-white-tee.webp
oversized-black-tee.webp
blue-long-sleeve-shirt.webp
black-short-sleeve-shirt.webp
```

Calzado y accesorios de `public/wardrobe/basics` se revisaron en los mismos
fondos y no requirieron esta limpieza.
