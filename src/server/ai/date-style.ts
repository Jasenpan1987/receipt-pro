// The date at the start of the line, written exactly as the user's template writes it: with or
// without 日, and with the template's own spacing after it. Exact spacing is where the model is
// least reliable (T-006: with a template of "1   Costco", 6 of 6 outputs wrote "1 日 Costco"), so
// code makes it exact rather than the prompt alone.

/** "2026 年 10 月 1" + optional " 日", then the whitespace that follows it in the template. */
const TEMPLATE_DATE = /^\d{4} 年 \d{1,2} 月 \d{1,2}( 日)?(\s+)/;

/** The same date in the output, however it is spaced, with or without 日. */
const OUTPUT_DATE = /^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日)?\s*/;

export function applyTemplateDateStyle(text: string, template: string): string {
  const style = TEMPLATE_DATE.exec(template);
  const date = OUTPUT_DATE.exec(text);
  if (!style || !date) {
    return text;
  }
  const [whole, year, month, day] = date;
  return `${year} 年 ${month} 月 ${day}${style[1] ?? ""}${style[2]}${text.slice(whole.length)}`;
}
