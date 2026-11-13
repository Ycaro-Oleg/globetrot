/**
 * Photos from the browser: resized to at most `MAX_SIDE` pixels and re-encoded as JPEG on a canvas (which also
 * drops EXIF and GPS, after applying the camera's orientation), then sent to `POST /v1/media` through the web
 * origin's proxy. The API checks the bytes again and strips any metadata left.
 */

export const MAX_SIDE = 2048;
export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export interface UploadedMedia {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export type UploadError = 'unsupported' | 'tooMany' | 'failed';

/** The photo as a smaller JPEG, or null when the browser cannot read it (some HEIC files, broken images). */
export async function resizeImage(file: File, maxSide = MAX_SIDE): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  // White under transparent PNGs, since JPEG has no transparency.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
}

/** Resizes and uploads one photo. */
export async function uploadPhoto(file: File): Promise<UploadedMedia | UploadError> {
  const blob = await resizeImage(file);
  if (!blob) return 'unsupported';
  try {
    const response = await fetch('/v1/media', {
      method: 'POST',
      body: blob,
      headers: { 'content-type': 'image/jpeg' },
      credentials: 'same-origin',
    });
    if (response.status === 201) return (await response.json()) as UploadedMedia;
    if (response.status === 429) return 'tooMany';
    if (response.status === 422 || response.status === 413) return 'unsupported';
    return 'failed';
  } catch {
    return 'failed';
  }
}

/** Where the browser loads an image (through the same proxy, with the session cookie). */
export const mediaUrl = (mediaId: string) => `/v1/media/${mediaId}`;
