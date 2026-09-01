import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const SOURCE = new URL("../public/models/forme_F_3.glb", import.meta.url);
const OUTPUT = new URL("../public/models/forme_F_web.glb", import.meta.url);
const SOURCE_PATH = fileURLToPath(SOURCE);
const OUTPUT_PATH = fileURLToPath(OUTPUT);
const TARGET_NODE = "F";

function meshStats(document) {
  let vertices = 0;
  let triangles = 0;

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      const indices = primitive.getIndices();
      vertices += position?.getCount() ?? 0;
      triangles += Math.floor((indices?.getCount() ?? 0) / 3);
    }
  }

  return { vertices, triangles };
}

const io = new NodeIO();
const document = await io.read(SOURCE_PATH);
const root = document.getRoot();
const formeNode = root.listNodes().find((node) => node.getName() === TARGET_NODE);

if (!formeNode?.getMesh()) {
  throw new Error(`No se encontró el nodo ${TARGET_NODE} en el modelo maestro.`);
}

const before = meshStats(document);

for (const scene of root.listScenes()) {
  for (const child of scene.listChildren()) {
    if (child !== formeNode) child.dispose();
  }
}

for (const node of root.listNodes()) {
  if (node !== formeNode) node.dispose();
}

for (const primitive of formeNode.getMesh().listPrimitives()) {
  primitive.setAttribute("TEXCOORD_0", null);
}

await document.transform(
  weld(),
  simplify({
    simplifier: MeshoptSimplifier,
    ratio: 0.12,
    error: 0.0005,
    lockBorder: true,
  }),
  prune(),
);

await io.write(OUTPUT_PATH, document);

const after = meshStats(document);
const sourceBytes = (await stat(SOURCE_PATH)).size;
const outputBytes = (await stat(OUTPUT_PATH)).size;

console.log(
  JSON.stringify(
    {
      source: {
        bytes: sourceBytes,
        ...before,
      },
      output: {
        bytes: outputBytes,
        ...after,
      },
      reduction: {
        bytesPercent: Number(
          ((1 - outputBytes / sourceBytes) * 100).toFixed(1),
        ),
        trianglesPercent: Number(
          ((1 - after.triangles / before.triangles) * 100).toFixed(1),
        ),
      },
    },
    null,
    2,
  ),
);
