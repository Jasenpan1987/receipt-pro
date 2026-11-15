import { copyText } from "src/client/copy-text";

const TEXT = "2026 年 10 月 1 日 Costco 青菜 3.25 共3.25，现金";

function fakeDocument(execResult: boolean) {
  const textarea = {
    value: "",
    style: {} as Record<string, string>,
    setAttribute: vi.fn(),
    focus: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn()
  };
  const document = {
    createElement: vi.fn(() => textarea),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
    execCommand: vi.fn(() => execResult)
  };
  return { document, textarea };
}

describe("copyText", () => {
  it("uses the Clipboard API in a secure context", async () => {
    const writeText = vi.fn(async () => undefined);
    const { document } = fakeDocument(true);
    await expect(
      copyText(TEXT, { secure: true, clipboard: { writeText }, document })
    ).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(TEXT);
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  // The phone reaches the dev server over plain HTTP, where navigator.clipboard does not exist.
  it("falls back to a selected textarea and execCommand outside a secure context", async () => {
    const { document, textarea } = fakeDocument(true);
    await expect(copyText(TEXT, { secure: false, clipboard: undefined, document })).resolves.toBe(
      true
    );
    expect(textarea.value).toBe(TEXT);
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(0, TEXT.length);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(document.body.removeChild).toHaveBeenCalledWith(textarea);
  });

  it("falls back when the Clipboard API refuses", async () => {
    const writeText = vi.fn(async () => Promise.reject(new Error("NotAllowedError")));
    const { document } = fakeDocument(true);
    await expect(
      copyText(TEXT, { secure: true, clipboard: { writeText }, document })
    ).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports a failed copy", async () => {
    const { document } = fakeDocument(false);
    await expect(copyText(TEXT, { secure: false, clipboard: undefined, document })).resolves.toBe(
      false
    );
  });
});
