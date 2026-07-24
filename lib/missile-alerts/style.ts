/** WhatsApp bold: wrap every non-empty line with *…* */
export function boldEveryLine(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      // Avoid double-wrapping already-bold full lines.
      if (/^\*[^*].*\*$/.test(trimmed) && !trimmed.slice(1, -1).includes("*")) {
        return trimmed;
      }
      // Strip existing * so we can re-bold the whole line cleanly.
      const plain = trimmed.replace(/\*/g, "");
      return `*${plain}*`;
    })
    .join("\n");
}
