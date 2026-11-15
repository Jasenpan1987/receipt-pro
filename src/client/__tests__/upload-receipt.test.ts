import { uploadReceipt, UploadError } from "src/client/upload-receipt";

const input = {
  photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }),
  receiptId: "3f2b8c1e-9a4d-4b6f-8e2a-1c5d7e9f0a3b",
  createdAt: "2026-11-15T10:00:00.000Z"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadReceipt", () => {
  it("sends the photo, ID, and time, and returns the receipt", async () => {
    const receipt = {
      receiptId: input.receiptId,
      status: "processing",
      photoUrl: "u",
      createdAt: input.createdAt
    };
    const fetch = vi.fn(async () => Response.json({ receipt }, { status: 201 }));
    vi.stubGlobal("fetch", fetch);

    await expect(uploadReceipt(input)).resolves.toEqual(receipt);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/receipts");
    const form = init.body as FormData;
    expect(form.get("receiptId")).toBe(input.receiptId);
    expect(form.get("createdAt")).toBe(input.createdAt);
    expect(form.get("photo")).toBeInstanceOf(Blob);
  });

  // Acceptance: Wi-Fi off mid-upload shows a plain message and the retry button.
  it("turns a network failure or timeout into a plain message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch")))
    );
    const error = await uploadReceipt(input).catch(e => e);
    expect(error).toBeInstanceOf(UploadError);
    expect(error.message).toBe("上传失败，请检查网络后重试。");
  });

  it("shows the server's message when it refuses the photo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "照片太大，请重新拍一张。" }, { status: 413 }))
    );
    await expect(uploadReceipt(input)).rejects.toThrow("照片太大，请重新拍一张。");
  });

  it("falls back to a general message when the server's reply is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { status: 502 }))
    );
    await expect(uploadReceipt(input)).rejects.toThrow("上传失败，请重试。");
  });
});
