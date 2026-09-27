export const maxUploadBytes = 20 * 1024 * 1024;
export const uploadFileAccept = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.heic,.heif";
export const uploadFingerprint = (file: Pick<File, "name" | "size" | "lastModified">) => `${file.name}:${file.size}:${file.lastModified}`;
export function uploadFileError(file: Pick<File, "name" | "size" | "type">): string | null {
  if (!file.size) return "El archivo está vacío.";
  if (file.size > maxUploadBytes) return "Supera los 20 MB. Elige una foto más liviana.";
  if (!/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(file.type) && !(file.type === "" && /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name))) return "Usa una foto JPG, PNG o WebP.";
  return null;
}

export async function processingFileFor(file: File): Promise<File> {
  const invalid = uploadFileError(file);
  if (invalid) throw new Error(invalid);
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const ratio = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error();
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error();
    return new File([blob], "processing.jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    throw new Error(/hei[cf]/i.test(file.type + file.name)
      ? "Este navegador no puede abrir HEIC. Exporta la foto como JPG y vuelve a añadirla."
      : "No se pudo abrir la foto. Prueba con otra imagen JPG, PNG o WebP.");
  } finally { bitmap?.close(); }
}
