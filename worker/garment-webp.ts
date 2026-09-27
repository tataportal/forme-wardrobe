import type { WardrobeEnv } from "./wardrobe-api";

export async function garmentWebp(env: WardrobeEnv, png: ArrayBuffer): Promise<Uint8Array> {
  if (!env.IMAGES) throw new Error("La optimización de imágenes no está disponible.");
  // A uniform 4:5 resize preserves normalized anatomy and the original alpha.
  if (png.byteLength < 24) throw new Error("La imagen está incompleta.");
  const view = new DataView(png);
  if ( view.getUint32(16) * 5 !== view.getUint32(20) * 4) {
    throw new Error("La imagen debe conservar una proporción de 4:5.");
  }
  const output = await env.IMAGES.input(new Response(png as BodyInit).body!)
    .transform({ width: 1024, height: 1280, fit: "contain" })
    .output({ format: "image/webp", quality: 92 });
  const response = output.response();
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/webp")) {
    throw new Error("No se pudo optimizar la imagen. Se conservará la maestra para reintentar.");
  }
  return new Uint8Array(await response.arrayBuffer());
}
