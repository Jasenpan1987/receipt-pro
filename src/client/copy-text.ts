type ClipboardLike = { writeText(text: string): Promise<void> };
type TextareaLike = {
  value: string;
  style: Record<string, string> | CSSStyleDeclaration;
  setAttribute(name: string, value: string): void;
  focus(): void;
  select(): void;
  setSelectionRange(start: number, end: number): void;
};
type DocumentLike = {
  createElement(tag: "textarea"): TextareaLike;
  body: { appendChild(node: any): unknown; removeChild(node: any): unknown };
  execCommand(command: string): boolean;
};

/**
 * Copies exactly `text` as plain text. The Clipboard API exists only in secure contexts, and the
 * phone uses the dev server over plain HTTP, so a selected hidden textarea and
 * `execCommand("copy")` take over there. Call it straight from the click handler: both paths need
 * the user's gesture. Returns whether the copy worked.
 */
export async function copyText(
  text: string,
  env: { secure: boolean; clipboard: ClipboardLike | undefined; document: DocumentLike } = {
    secure: window.isSecureContext,
    clipboard: navigator.clipboard,
    document
  }
): Promise<boolean> {
  if (env.secure && env.clipboard) {
    try {
      await env.clipboard.writeText(text);
      return true;
    } catch {
      // Refused (permissions, focus): try the old way.
    }
  }
  const textarea = env.document.createElement("textarea");
  textarea.value = text;
  // readonly keeps the iPhone keyboard from opening; 16px keeps Safari from zooming in.
  textarea.setAttribute("readonly", "");
  Object.assign(textarea.style, {
    position: "fixed",
    top: "0",
    left: "0",
    opacity: "0",
    fontSize: "16px"
  });
  env.document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    // iOS Safari copies only an explicit selection range.
    textarea.setSelectionRange(0, text.length);
    return env.document.execCommand("copy");
  } catch {
    return false;
  } finally {
    env.document.body.removeChild(textarea);
  }
}
