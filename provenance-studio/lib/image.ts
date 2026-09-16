/**
 * Préparation des photos d'étape côté client : recadrage 4:5 centré,
 * réduction à 1080 × 1350 max, compression JPEG jusqu'à passer sous 500 Ko.
 */
export const PHOTO_ASPECT = 4 / 5;
export const PHOTO_MAX_WIDTH = 1080;
export const PHOTO_TARGET_BYTES = 500 * 1024;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function isAcceptedPhoto(file: File): boolean {
  return ACCEPTED.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Formats non décodables nativement (HEIC sur certains navigateurs).
    throw new Error("Ce format d'image n'est pas pris en charge. Utilisez un JPEG ou un PNG.");
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression impossible."))),
      "image/jpeg",
      quality,
    );
  });
}

export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  // Recadrage centré au ratio 4:5.
  let cropW = srcW;
  let cropH = Math.round(srcW / PHOTO_ASPECT);
  if (cropH > srcH) {
    cropH = srcH;
    cropW = Math.round(srcH * PHOTO_ASPECT);
  }
  const sx = Math.round((srcW - cropW) / 2);
  const sy = Math.round((srcH - cropH) / 2);

  const outW = Math.min(PHOTO_MAX_WIDTH, cropW);
  const outH = Math.round(outW / PHOTO_ASPECT);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de préparer l'image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, outW, outH);
  bitmap.close();

  let blob = await toBlob(canvas, 0.86);
  for (const quality of [0.78, 0.7, 0.62, 0.54, 0.46]) {
    if (blob.size <= PHOTO_TARGET_BYTES) break;
    blob = await toBlob(canvas, quality);
  }
  if (blob.size > PHOTO_TARGET_BYTES) {
    // Dernier recours : on réduit la définition.
    const small = document.createElement("canvas");
    small.width = Math.round(outW * 0.7);
    small.height = Math.round(outH * 0.7);
    small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
    blob = await toBlob(small, 0.6);
  }
  return blob;
}
