import type { ReactNode } from "react";

/**
 * The output text with every number in its own element, so the computer can show prices in bold
 * for checking against the photo (T-021). The characters are unchanged: selecting the text by
 * hand gives exactly what 复制 copies.
 */
export function withNumbers(text: string, className: string): ReactNode[] {
  return text.split(/(\d+(?:\.\d+)?)/).map((part, index) =>
    index % 2 === 1 ? (
      <b key={index} className={className}>
        {part}
      </b>
    ) : (
      part
    )
  );
}
