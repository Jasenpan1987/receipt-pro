// Re-encodes a phone photo to JPEG before upload: smaller on mobile data, and the one format
// the server and DeepSeek both accept. iPhone HEIC becomes JPEG here too.

export const MAX_SIDE = 2048;
const JPEG_QUALITY = 0.85;

/** The photo could not be decoded by this browser (for example HEIF on Android Chrome). */
export class ImageDecodeError extends Error {
  override name = "ImageDecodeError";
}

/** Scales down to fit `max` on the longest side; never scales up. */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: Blob): Promise<Decoded> {
  try {
    // Applies the EXIF rotation, so a portrait photo stays portrait.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close()
    };
  } catch {
    // Some browsers decode a format in <img> but not in createImageBitmap.
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url)
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageDecodeError("This browser cannot decode the photo.");
  }
}

export async function compressImage(file: Blob): Promise<Blob> {
  const decoded = await decode(file);
  const { width, height } = fitWithin(decoded.width, decoded.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new ImageDecodeError("No 2D canvas.");
    }
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) {
      throw new ImageDecodeError("The canvas produced no JPEG.");
    }
    return blob;
  } finally {
    decoded.release();
    // iOS keeps canvas memory until the size is reset; a batch of photos would otherwise add up.
    canvas.width = 0;
    canvas.height = 0;
  }
}
