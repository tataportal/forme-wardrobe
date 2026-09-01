import sharp from "sharp";

const [input, output, globalThresholdArg] = process.argv.slice(2);
if (!input || !output) {
  throw new Error(
    "Uso: node scripts/remove-connected-chroma.mjs <input> <output.png> [umbral-global]",
  );
}
const globalThreshold = globalThresholdArg === undefined
  ? null
  : Number(globalThresholdArg);
if (globalThreshold !== null && (!Number.isFinite(globalThreshold) || globalThreshold < 0)) {
  throw new Error("El umbral global debe ser un número mayor o igual a 0.");
}

const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = decoded.info;
const pixels = Buffer.from(decoded.data);

const borderSamples = [[], [], []];
const sample = (point) => {
  for (let channel = 0; channel < 3; channel += 1) {
    borderSamples[channel].push(pixels[point * channels + channel]);
  }
};
const stride = Math.max(1, Math.floor(Math.min(width, height) / 256));
for (let x = 0; x < width; x += stride) {
  sample(x);
  sample((height - 1) * width + x);
}
for (let y = stride; y < height - stride; y += stride) {
  sample(y * width);
  sample(y * width + width - 1);
}
const key = borderSamples.map((values) => {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
});

const distanceAt = (point) => Math.max(
  Math.abs(pixels[point * channels] - key[0]),
  Math.abs(pixels[point * channels + 1] - key[1]),
  Math.abs(pixels[point * channels + 2] - key[2]),
);
const transparentThreshold = 14;
const opaqueThreshold = 180;
const seen = new Uint8Array(width * height);
const queue = [];
for (let x = 0; x < width; x += 1) {
  queue.push(x, (height - 1) * width + x);
}
for (let y = 1; y < height - 1; y += 1) {
  queue.push(y * width, y * width + width - 1);
}

for (let head = 0; head < queue.length; head += 1) {
  const point = queue[head];
  if (seen[point] || distanceAt(point) >= opaqueThreshold) continue;
  seen[point] = 1;
  const x = point % width;
  const y = Math.floor(point / width);
  if (x > 0) queue.push(point - 1);
  if (x + 1 < width) queue.push(point + 1);
  if (y > 0) queue.push(point - width);
  if (y + 1 < height) queue.push(point + width);
}

const spillChannels = key
  .map((value, index) => ({ value, index }))
  .filter(({ value }) => value >= Math.max(...key) - 16 && value >= 128)
  .map(({ index }) => index);
const nonSpillChannels = [0, 1, 2].filter((index) => !spillChannels.includes(index));
let transparent = 0;
let partial = 0;
let isolatedChroma = 0;

for (let point = 0; point < seen.length; point += 1) {
  const offset = point * channels;
  if (!seen[point] && globalThreshold !== null && distanceAt(point) <= globalThreshold) {
    pixels[offset] = 0;
    pixels[offset + 1] = 0;
    pixels[offset + 2] = 0;
    pixels[offset + 3] = 0;
    isolatedChroma += 1;
    continue;
  }
  if (!seen[point]) continue;
  const distance = distanceAt(point);
  let alpha;
  if (distance <= transparentThreshold) {
    alpha = 0;
  } else {
    const ratio = Math.max(0, Math.min(1, (distance - transparentThreshold) / (opaqueThreshold - transparentThreshold)));
    const smooth = ratio * ratio * (3 - 2 * ratio);
    alpha = Math.round(255 * smooth);
  }
  pixels[offset + 3] = Math.round(alpha * (pixels[offset + 3] / 255));
  if (alpha === 0) {
    pixels[offset] = 0;
    pixels[offset + 1] = 0;
    pixels[offset + 2] = 0;
    transparent += 1;
  } else if (alpha < 255) {
    if (spillChannels.length && nonSpillChannels.length) {
      const cap = Math.max(...nonSpillChannels.map((channel) => pixels[offset + channel]));
      for (const channel of spillChannels) {
        pixels[offset + channel] = Math.min(pixels[offset + channel], cap);
      }
    }
    partial += 1;
  }
}

await sharp(pixels, { raw: { width, height, channels } }).png().toFile(output);
console.log(`Wrote ${output}`);
console.log(`Key color: #${key.map((value) => value.toString(16).padStart(2, "0")).join("")}`);
console.log(`Transparent pixels: ${transparent}/${width * height}`);
console.log(`Partially transparent pixels: ${partial}/${width * height}`);
console.log(`Isolated chroma pixels: ${isolatedChroma}/${width * height}`);
