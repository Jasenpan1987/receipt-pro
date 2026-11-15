import { MAX_PHOTO_BYTES, MAX_THUMB_BYTES, parseUploadForm } from "src/server/upload-form";

const NOW = new Date("2026-11-15T10:00:00.000Z");
const RECEIPT_ID = "3f2b8c1e-9a4d-4b6f-8e2a-1c5d7e9f0a3b";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function form(fields: { photo?: Blob; thumb?: Blob; receiptId?: string; createdAt?: string }) {
  const data = new FormData();
  if (fields.photo) {
    data.append("photo", fields.photo, "receipt.jpg");
  }
  if (fields.thumb) {
    data.append("thumb", fields.thumb, "receipt.thumb.jpg");
  }
  if (fields.receiptId !== undefined) {
    data.append("receiptId", fields.receiptId);
  }
  if (fields.createdAt !== undefined) {
    data.append("createdAt", fields.createdAt);
  }
  return data;
}

const valid = () => ({
  photo: new Blob([JPEG], { type: "image/jpeg" }),
  receiptId: RECEIPT_ID,
  createdAt: "2026-11-15T09:59:58.123Z"
});

describe("parseUploadForm: the small copy (T-019)", () => {
  it("accepts a small JPEG copy with the photo", async () => {
    const thumb = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
    const result = await parseUploadForm(
      form({ ...valid(), thumb: new Blob([thumb], { type: "image/jpeg" }) }),
      NOW
    );
    expect(result).toMatchObject({ ok: true, value: { thumb } });
  });

  // A page opened before T-019 uploads without one; the list then shows the photo.
  it("accepts a photo without a small copy", async () => {
    const result = await parseUploadForm(form(valid()), NOW);
    expect(result.ok && result.value.thumb).toBeUndefined();
  });

  it("refuses a small copy that is not JPEG or too big", async () => {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]);
    const big = new Blob([JPEG, new Uint8Array(MAX_THUMB_BYTES)]);
    expect(await parseUploadForm(form({ ...valid(), thumb: png }), NOW)).toMatchObject({
      ok: false,
      status: 415
    });
    expect(await parseUploadForm(form({ ...valid(), thumb: big }), NOW)).toMatchObject({
      ok: false,
      status: 400
    });
  });
});

describe("parseUploadForm", () => {
  it("accepts a JPEG with a receipt ID and the phone's time", async () => {
    const result = await parseUploadForm(form(valid()), NOW);
    expect(result).toEqual({
      ok: true,
      value: { receiptId: RECEIPT_ID, createdAt: "2026-11-15T09:59:58.123Z", photo: JPEG }
    });
  });

  it("refuses a request without a photo", async () => {
    const result = await parseUploadForm(form({ ...valid(), photo: undefined }), NOW);
    expect(result).toEqual({ ok: false, status: 400, error: "没有收到照片，请重试。" });
  });

  // Checked by content, not by the declared type: the phone always re-encodes to JPEG.
  it("refuses a photo that is not JPEG", async () => {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/jpeg" });
    const result = await parseUploadForm(form({ ...valid(), photo: png }), NOW);
    expect(result).toEqual({ ok: false, status: 415, error: "照片格式不对，请重新拍一张。" });
  });

  it("refuses a photo over the size limit", async () => {
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(JPEG);
    const result = await parseUploadForm(form({ ...valid(), photo: new Blob([big]) }), NOW);
    expect(result).toEqual({ ok: false, status: 413, error: "照片太大，请重新拍一张。" });
  });

  it("refuses a missing or malformed receipt ID", async () => {
    for (const receiptId of [undefined, "", "not-a-uuid", RECEIPT_ID.toUpperCase()]) {
      const result = await parseUploadForm(form({ ...valid(), receiptId }), NOW);
      expect(result).toEqual({ ok: false, status: 400, error: "上传的信息不完整，请重试。" });
    }
  });

  // createdAt orders the list and makes a retry hit the same item, so it comes from the phone,
  // unless the phone's clock is clearly wrong.
  it("uses the server time when the phone's time is missing, invalid, or more than a day off", async () => {
    for (const createdAt of [
      undefined,
      "yesterday",
      "2026-11-13T09:59:59.000Z",
      "2026-11-16T10:00:01.000Z"
    ]) {
      const result = await parseUploadForm(form({ ...valid(), createdAt }), NOW);
      expect(result.ok && result.value.createdAt).toBe("2026-11-15T10:00:00.000Z");
    }
  });

  it("normalises the phone's time to ISO in UTC", async () => {
    const result = await parseUploadForm(
      form({ ...valid(), createdAt: "2026-11-15T20:30:00+11:00" }),
      NOW
    );
    expect(result.ok && result.value.createdAt).toBe("2026-11-15T09:30:00.000Z");
  });
});
