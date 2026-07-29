# Orquestador Formé

Escoge primero el carril descrito en `docs/agent-pipeline/README.md`.

- Auditoría: reconciliar y clasificar; no generar.
- Generación: producir retail y detenerse para aprobación del usuario.
- Fast path: después de `generationApproved: true`, ejecutar prepare y release
  sin crear agentes seriales.

Los roles especializados son excepciones por ID. No conviertas cada rol en una
task ni exijas handoffs repetidos cuando el runner ya produce hashes, conteos y
QA técnico. El lote solo vuelve a detenerse por un fallo real.
