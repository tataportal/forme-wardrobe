import decodePng, { init as initDecode } from "@jsquash/png/decode";
import encodePng, { init as initEncode } from "@jsquash/png/encode";
import PNG_WASM from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";

// A measurement-only copy. Never stored or served as a garment image. The
// numbered grid makes whole-image coordinates explicit to the vision model.
const digits = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];
let ready: Promise<unknown> | null = null;
export async function coordinateGuidePng(bytes: Uint8Array): Promise<ArrayBuffer> {
  ready ??= Promise.all([initDecode(PNG_WASM), initEncode(PNG_WASM)]);
  await ready;
  const image = await decodePng(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const { width, height, data } = image;
  const pixel = (x: number, y: number, rgb: number[]) => {
    if (x >= 0 && x < width && y >= 0 && y < height) data.set([...rgb, 255], (y * width + x) * 4);
  };
  const label = (value: number, x: number, y: number) => {
    const text = String(value), scale = Math.max(2, Math.round(width / 400));
    for (let py = -2; py < 5 * scale + 2; py++) for (let px = -2; px < text.length * 4 * scale; px++) pixel(x + px, y + py, [255, 255, 255]);
    for (let i = 0; i < text.length; i++) for (let dot = 0; dot < 15; dot++) if (digits[Number(text[i])][dot] === "1") {
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) pixel(x + (i * 4 + dot % 3) * scale + dx, y + Math.floor(dot / 3) * scale + dy, [0, 60, 210]);
    }
  };
  for (let value = 100; value < 1000; value += 100) {
    const x = Math.round(value / 1000 * width), y = Math.round(value / 1000 * height);
    for (let py = 0; py < height; py++) if (py % 12 < 4) pixel(x, py, [0, 150, 255]);
    for (let px = 0; px < width; px++) if (px % 12 < 4) pixel(px, y, [0, 150, 255]);
    label(value, x + 3, 8);
    label(value, 8, y + 3);
  }
  return encodePng(image);
}
