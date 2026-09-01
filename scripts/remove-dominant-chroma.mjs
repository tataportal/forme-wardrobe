import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error("Uso: node scripts/remove-dominant-chroma.mjs <input> <output.png>");
}

const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = decoded.info;
const pixels = Buffer.from(decoded.data);

const samples = [[], [], []];
const addSample = (point) => {
  for (let channel = 0; channel < 3; channel += 1) {
    samples[channel].push(pixels[point * channels + channel]);
  }
};
const stride = Math.max(1, Math.floor(Math.min(width, height) / 256));
for (let x = 0; x < width; x += stride) {
  addSample(x);
  addSample((height - 1) * width + x);
}
for (let y = stride; y < height - stride; y += stride) {
  addSample(y * width);
  addSample(y * width + width - 1);
}
const key = samples.map((values) => {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
});

const greenKey = key[1] > key[0] + 80 && key[1] > key[2] + 80;
const magentaKey = key[0] > key[1] + 80 && key[2] > key[1] + 80;
if (!greenKey && !magentaKey) {
  throw new Error(`El borde no es chroma verde ni magenta: ${key.join(",")}`);
}

const opaqueStrength = 24;
const transparentStrength = 112;
let transparent = 0;
let partial = 0;
let opaque = 0;

for (let point = 0; point < width * height; point += 1) {
  const offset = point * channels;
  const r = pixels[offset];
  const g = pixels[offset + 1];
  const b = pixels[offset + 2];
  const strength = greenKey ? g - Math.max(r, b) : Math.min(r, b) - g;
  const ratio = Math.max(0, Math.min(1, (strength - opaqueStrength) / (transparentStrength - opaqueStrength)));
  const smooth = ratio * ratio * (3 - 2 * ratio);
  const alpha = Math.round((1 - smooth) * pixels[offset + 3]);
  pixels[offset + 3] = alpha;

  if (alpha === 0) {
    pixels[offset] = 0;
    pixels[offset + 1] = 0;
    pixels[offset + 2] = 0;
    transparent += 1;
  } else if (alpha < 255) {
    if (greenKey) {
      pixels[offset + 1] = Math.min(g, Math.max(r, b));
    } else {
      const neutral = Math.max(g, Math.min(r, b));
      pixels[offset] = Math.min(r, neutral);
      pixels[offset + 2] = Math.min(b, neutral);
    }
    partial += 1;
  } else {
    opaque += 1;
  }
}

await sharp(pixels, { raw: { width, height, channels } }).png({ compressionLevel: 9 }).toFile(output);
console.log(JSON.stringify({
  output,
  key: `#${key.map((value) => value.toString(16).padStart(2, "0")).join("")}`,
  mode: greenKey ? "green" : "magenta",
  transparent,
  partial,
  opaque,
}));
