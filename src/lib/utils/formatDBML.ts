/**
 * DBML Formatter — normalizes indentation and spacing.
 */
export function formatDBML(input: string): string {
  // Remove block comments
  let src = input.replace(/\/\*[\s\S]*?\*\//g, "");

  const lines = src.split("\n");
  const out: string[] = [];
  let depth = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      // Only emit a blank line at depth 0, and only if the last line wasn't already blank
      if (depth === 0 && out.length > 0 && out[out.length - 1] !== "") {
        out.push("");
      }
      continue;
    }

    // Closing brace
    if (trimmed === "}") {
      depth = Math.max(0, depth - 1);
      out.push("  ".repeat(depth) + "}");
      if (depth === 0) out.push("");
      continue;
    }

    // Ensure blank line before top-level declarations
    if (depth === 0 && /^(Table|Enum|Ref|TableGroup)\b/i.test(trimmed)) {
      if (out.length > 0 && out[out.length - 1] !== "") {
        out.push("");
      }
    }

    out.push("  ".repeat(depth) + trimmed);

    if (trimmed.endsWith("{")) {
      depth++;
    }
  }

  // Trim trailing blank lines
  while (out.length > 0 && out[out.length - 1] === "") out.pop();

  return out.join("\n") + "\n";
}
