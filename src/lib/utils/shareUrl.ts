import LZString from "lz-string";

const HASH_KEY = "#d=";

/** Strip comments and collapse redundant whitespace to shrink input before compression. */
function minifyDBML(dbml: string): string {
  return dbml
    .replace(/\/\/.*$/gm, "")        // remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // remove block comments
    .replace(/\n\s*\n/g, "\n")       // collapse blank lines
    .replace(/^[ \t]+/gm, m => {     // reduce indentation to 1 space
      return m.length > 0 ? " " : "";
    })
    .trim();
}

/** Convert standard base64 to URL-safe base64 (no padding). */
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Restore standard base64 from URL-safe variant. */
function fromBase64Url(b64url: string): string {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (s.length % 4)) % 4;
  if (pad) s += "=".repeat(pad);
  return s;
}

/**
 * Compresses DBML content into a URL-safe string and returns the shareable URL.
 */
export function encodeDBMLToUrl(dbml: string): string {
  const minified = minifyDBML(dbml);
  const compressed = LZString.compressToBase64(minified);
  const urlSafe = toBase64Url(compressed);
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  return `${base}${HASH_KEY}${urlSafe}`;
}

/**
 * Reads the URL hash and decompresses DBML content if present.
 * Returns null if no DBML content is found in the URL.
 */
export function decodeDBMLFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_KEY)) return null;
  const urlSafe = hash.slice(HASH_KEY.length);
  if (!urlSafe) return null;
  try {
    const b64 = fromBase64Url(urlSafe);
    const decompressed = LZString.decompressFromBase64(b64);
    return decompressed || null;
  } catch {
    return null;
  }
}

/**
 * Clears the DBML hash from the URL without page reload.
 */
export function clearDBMLFromUrl(): void {
  if (typeof window === "undefined") return;
  history.replaceState(null, "", window.location.pathname);
}
