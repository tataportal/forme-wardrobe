import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { unpartition } from "@gltf-transform/functions";

const SOURCE = new URL("../public/models/star2.gltf", import.meta.url);
const OUTPUT = new URL("../public/models/star2-forme.glb", import.meta.url);
const SOURCE_PATH = fileURLToPath(SOURCE);
const OUTPUT_PATH = fileURLToPath(OUTPUT);

const io = new NodeIO();
const document = await io.read(SOURCE_PATH);
const root = document.getRoot();
const rotationChannel = root
  .listAnimations()
  .flatMap((animation) => animation.listChannels())
  .find(
    (channel) =>
      channel.getTargetNode()?.getName() === "Star" &&
      channel.getTargetPath() === "rotation",
  );

if (!rotationChannel) {
  throw new Error("No se encontró el track de rotación del nodo Star.");
}

const sampler = rotationChannel.getSampler();
const input = sampler.getInput()?.getArray();
const output = sampler.getOutput();
const rotations = output?.getArray();

if (!input || !output || !rotations) {
  throw new Error("El track de rotación no tiene keyframes válidos.");
}

const sourceDuration = input[input.length - 1];
const sourceHalfDuration = sourceDuration / 2;
const firstHalfDuration = 4;
const secondHalfDuration = 6;

for (let index = 0; index < input.length; index += 1) {
  const sourceTime = input[index];
  let angle;

  if (sourceTime <= sourceHalfDuration) {
    const progress = sourceTime / sourceHalfDuration;
    input[index] = progress * firstHalfDuration;
    angle = progress * Math.PI;
  } else {
    const progress =
      (sourceTime - sourceHalfDuration) /
      (sourceDuration - sourceHalfDuration);

    input[index] =
      firstHalfDuration + progress * secondHalfDuration;
    angle = Math.PI + progress * Math.PI;
  }

  const offset = index * 4;

  // Mantiene el signo del quaternion original al inicio y completa 360°.
  rotations[offset] = 0;
  rotations[offset + 1] = -Math.sin(angle / 2);
  rotations[offset + 2] = 0;
  rotations[offset + 3] = -Math.cos(angle / 2);
}

sampler.getInput().setArray(input);
output.setArray(rotations);
await document.transform(unpartition());
await io.write(OUTPUT_PATH, document);

const first = Array.from(rotations.slice(0, 4));
const halfway = Array.from(
  rotations.slice(Math.floor(input.length / 2) * 4, Math.floor(input.length / 2) * 4 + 4),
);
const last = Array.from(rotations.slice(-4));

console.log(
  JSON.stringify(
    {
      duration: input[input.length - 1],
      firstHalfDuration,
      secondHalfDuration,
      firstHalfSpeedDegreesPerSecond: 45,
      secondHalfSpeedDegreesPerSecond: 30,
      keyframes: input.length,
      quaternions: { first, halfway, last },
      bytes: (await stat(OUTPUT_PATH)).size,
    },
    null,
    2,
  ),
);
