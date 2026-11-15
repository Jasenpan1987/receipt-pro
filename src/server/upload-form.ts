// Validates the multipart body of `POST /api/receipts`. Error messages are shown on the phone.

/** Lambda caps a request at 6 MB, less after base64. A re-encoded 2048 px JPEG is far smaller. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** The list's small copy (T-019); the phone makes it about 400 px, a few tens of KB. */
export const MAX_THUMB_BYTES = 256 * 1024;

/** A phone clock this far from the server's is wrong; the server's time is used instead. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/** Lower-case UUID v4, as `src/client/random-id.ts` makes it. */
const RECEIPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** `thumb` is optional: a page loaded before T-019 uploads without one, and the list shows the photo. */
export type UploadInput = {
  receiptId: string;
  createdAt: string;
  photo: Uint8Array;
  thumb?: Uint8Array;
};

export type UploadParse =
  | { ok: true; value: UploadInput }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): UploadParse => ({ ok: false, status, error });

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * The phone's time orders the list and makes a retry hit the same item, so it is kept unless it
 * is missing, unparsable, or more than a day from the server's time.
 */
function normaliseCreatedAt(value: FormDataEntryValue | null, now: Date): string {
  if (typeof value === "string") {
    const time = Date.parse(value);
    if (!Number.isNaN(time) && Math.abs(time - now.getTime()) <= MAX_CLOCK_SKEW_MS) {
      return new Date(time).toISOString();
    }
  }
  return now.toISOString();
}

export async function parseUploadForm(form: FormData, now = new Date()): Promise<UploadParse> {
  const photo = form.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) {
    return fail(400, "没有收到照片，请重试。");
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return fail(413, "照片太大，请重新拍一张。");
  }
  // Checked by content, not by the declared type.
  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!isJpeg(bytes)) {
    return fail(415, "照片格式不对，请重新拍一张。");
  }
  const receiptId = form.get("receiptId");
  if (typeof receiptId !== "string" || !RECEIPT_ID.test(receiptId)) {
    return fail(400, "上传的信息不完整，请重试。");
  }
  let thumb: Uint8Array | undefined;
  const thumbEntry = form.get("thumb");
  if (thumbEntry !== null) {
    if (
      !(thumbEntry instanceof Blob) ||
      thumbEntry.size === 0 ||
      thumbEntry.size > MAX_THUMB_BYTES
    ) {
      return fail(400, "上传的信息不完整，请重试。");
    }
    thumb = new Uint8Array(await thumbEntry.arrayBuffer());
    if (!isJpeg(thumb)) {
      return fail(415, "照片格式不对，请重新拍一张。");
    }
  }
  return {
    ok: true,
    value: {
      receiptId,
      createdAt: normaliseCreatedAt(form.get("createdAt"), now),
      photo: bytes,
      ...(thumb ? { thumb } : {})
    }
  };
}
