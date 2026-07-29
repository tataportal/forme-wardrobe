import decodePng, { init as initPngDecode } from "@jsquash/png/decode";
import encodePng, { init as initPngEncode } from "@jsquash/png/encode";
import PNG_CODEC_WASM from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
import {
  pixelMaskPolygon,
  planInteriorOpening,
  type NormalizedMaskPoint,
  type OpeningSpan,
} from "./layering-mask";

type ContourCutout = {
  png: ArrayBuffer;
  coverage: number;
  passed: boolean;
  notes: string;
  canvasPng: ArrayBuffer | null;
  canvasCoverage: number | null;
  canvasPassed: boolean;
  canvasNotes: string;
  canvasQaPng: ArrayBuffer | null;
};

let codecReady: Promise<unknown> | null = null;

function initializeCodec(): Promise<unknown> {
  if (!codecReady) {
    codecReady = Promise.all([
      initPngDecode(PNG_CODEC_WASM),
      initPngEncode(PNG_CODEC_WASM),
    ]);
  }
  return codecReady;
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function clearOpeningAlpha(
  data: Uint8ClampedArray,
  width: number,
  spans: OpeningSpan[],
): { removed: number; maskPixels: number } {
  let removed = 0;
  let maskPixels = 0;
  for (const { y, start, end } of spans) {
    for (let x = start; x <= end; x += 1) {
      maskPixels += 1;
      const alphaOffset = (y * width + x) * 4 + 3;
      if (data[alphaOffset] >= 24) {
        data[alphaOffset] = 0;
        removed += 1;
      }
    }
  }
  return { removed, maskPixels };
}

function opaqueTransparencyPreview(
  data: Uint8ClampedArray,
): Uint8ClampedArray {
  const preview = new Uint8ClampedArray(data);
  const matte = [236, 0, 140];
  for (let offset = 0; offset < preview.length; offset += 4) {
    const alpha = preview[offset + 3] / 255;
    preview[offset] = Math.round(preview[offset] * alpha + matte[0] * (1 - alpha));
    preview[offset + 1] = Math.round(preview[offset + 1] * alpha + matte[1] * (1 - alpha));
    preview[offset + 2] = Math.round(preview[offset + 2] * alpha + matte[2] * (1 - alpha));
    preview[offset + 3] = 255;
  }
  return preview;
}

export async function contourCutoutPng(
  bytes: Uint8Array,
  layeringPolygon: NormalizedMaskPoint[] = [],
): Promise<ContourCutout> {
  await initializeCodec();
  const image = await decodePng(exactBuffer(bytes));
  const { data, width, height } = image;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isStudioWhite = (index: number) => {
    const offset = index * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return data[offset + 3] < 24
      || (Math.min(red, green, blue) >= 244 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 18);
  };
  const seed = (index: number) => {
    if (!visited[index] && isStudioWhite(index)) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  };

  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) seed(index - 1);
    if (x + 1 < width) seed(index + 1);
    if (y > 0) seed(index - width);
    if (y + 1 < height) seed(index + width);
  }
  for (let index = 0; index < total; index += 1) {
    if (visited[index]) data[index * 4 + 3] = 0;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foreground = 0;
  for (let index = 0; index < total; index += 1) {
    if (data[index * 4 + 3] < 24) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    foreground += 1;
  }

  const coverage = foreground / total;
  const marginX = foreground ? Math.min(minX, width - 1 - maxX) / width : 0;
  const marginY = foreground ? Math.min(minY, height - 1 - maxY) / height : 0;
  const passed = foreground > 0 && coverage >= 0.055 && coverage <= 0.82 && marginX >= 0.012 && marginY >= 0.012;
  const notes = passed
    ? "Silueta completa, márgenes correctos y fondo exterior transparente."
    : "El control automático del calado detectó una silueta vacía, desproporcionada o demasiado cerca del borde.";
  const closetData = new Uint8ClampedArray(data);
  let canvasPng: ArrayBuffer | null = null;
  let canvasCoverage: number | null = null;
  let canvasPassed = layeringPolygon.length === 0;
  let canvasNotes = layeringPolygon.length === 0
    ? "La prenda no necesita una máscara interior para layering."
    : "La máscara interior propuesta no conserva correctamente cuello, solapas y paneles.";
  let canvasQaPng: ArrayBuffer | null = null;
  const proposedPolygon = layeringPolygon.length ? pixelMaskPolygon(layeringPolygon, width, height) : null;
  if (proposedPolygon) {
    const plan = planInteriorOpening(proposedPolygon, width, height, { minX, minY, maxX, maxY });
    if (!plan.passed) {
      return {
        png: await encodePng({ data: closetData, width, height } as ImageData),
        coverage,
        passed,
        notes,
        canvasPng: null,
        canvasCoverage: null,
        canvasPassed: false,
        canvasNotes: plan.notes,
        canvasQaPng: null,
      };
    }
    const { removed, maskPixels } = clearOpeningAlpha(data, width, plan.spans);
    const removedCoverage = removed / total;
    const overlap = maskPixels ? removed / maskPixels : 0;
    canvasCoverage = (foreground - removed) / total;
    canvasPassed = passed
      && removedCoverage >= 0.02
      && removedCoverage <= 0.30
      && overlap >= 0.55
      && canvasCoverage >= 0.05;
    canvasNotes = canvasPassed
      ? "Centro transparente según el contorno interior detectado; cuello, solapas y paneles conservados."
      : "El control automático rechazó la máscara interior porque quitó demasiado, demasiado poco o no siguió la abertura.";
    if (canvasPassed) {
      [canvasPng, canvasQaPng] = await Promise.all([
        encodePng({ data, width, height } as ImageData),
        encodePng({ data: opaqueTransparencyPreview(data), width, height } as ImageData),
      ]);
    }
  }

  return {
    png: await encodePng({ data: closetData, width, height } as ImageData),
    coverage,
    passed,
    notes,
    canvasPng,
    canvasCoverage,
    canvasPassed,
    canvasNotes,
    canvasQaPng,
  };
}
