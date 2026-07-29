# Piloto Footwear Retail v2 · 2026-07-26

Batch: `FORME-FOOTWEAR-RETAIL-PILOT-2026-07-26`

Objetivo: probar la puerta de identificación y los prompts por subtipo con dos pares difíciles antes de procesar las otras 23 piezas. Se usó ImageGen integrado con la suscripción; no se usó API ni CLI.

| Source ID | Subtipo | Primera salida | Retry aprobado | Fidelidad | Técnico | Integración |
|---|---|---|---|---:|---|---|
| `047_DSC01989` | `sneaker-low` | `TECH_CROP`: cortó el zapato posterior | misma ficha + framing seguro | `PASS 95/100` | `TECH_PASSED` | no integrada |
| `050_DSC01994` | `boot-lace-up` | `REJECT 72/100`: reinterpretó cordones y desgaste | `CUTOUT_ONLY / background-only` | `PASS 95/100` | `TECH_PASSED` | no integrada |

## Conclusión operativa

La identificación por construcción y el prompt por subtipo evitan la recomposición genérica, pero el modo correcto para una fuente completa es `CUTOUT_ONLY`. “Retail” define el estándar de presentación; no autoriza relighting o reconstrucción si eso altera el producto.

El pipeline queda:

1. inventariar fuente y par;
2. identificar subtipo, construcción, pose, detalles protegidos y oclusiones;
3. seleccionar el modo menos destructivo;
4. ensamblar prompt base + módulo de operación + módulo de subtipo;
5. generar un intermedio chroma con la suscripción;
6. normalizar a WebP transparente `1024 × 1280`;
7. comparar fuente y resultado a tamaño completo;
8. validar archivo, alpha, safe area y escala;
9. mostrar el piloto antes de integrar o procesar el lote.

## Rutas de evidencia

- Contrato/prompt: `docs/agent-pipeline/FORME-FOOTWEAR-RETAIL-v2.md`
- Fuentes: `tmp/garment-rework-2026-07-26/footwear/sources/`
- Fichas: `tmp/garment-pipeline/FORME-FOOTWEAR-RETAIL-PILOT-2026-07-26/spec/`
- Prompts exactos: `tmp/garment-pipeline/FORME-FOOTWEAR-RETAIL-PILOT-2026-07-26/generated/`
- Masters aprobados del piloto: `tmp/garment-pipeline/FORME-FOOTWEAR-RETAIL-PILOT-2026-07-26/normalized/retry-1/`
- Recibos de fidelidad: `tmp/garment-pipeline/FORME-FOOTWEAR-RETAIL-PILOT-2026-07-26/fidelity/retry-1/`
- Recibos técnicos: `tmp/garment-pipeline/FORME-FOOTWEAR-RETAIL-PILOT-2026-07-26/technical/retry-1/`

Los dos masters permanecen aislados. No sustituyen `public/wardrobe/` y no se publican hasta la aprobación visual del usuario y los pases de presentación, reconciliación, integración y release.
