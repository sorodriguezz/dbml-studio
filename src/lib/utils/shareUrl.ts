import LZString from "lz-string";
import pako from "pako";

/** Legacy prefix (lz-string base64). */
const HASH_KEY_V1 = "#d=";
/** New prefix (pako deflateRaw + base64url). */
const HASH_KEY_V2 = "#d2=";

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

/* ── base64url helpers ─────────────────────────────────────── */

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUint8(b64url: string): Uint8Array {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (s.length % 4)) % 4;
  if (pad) s += "=".repeat(pad);
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ── legacy base64url (for v1 decode) ──────────────────────── */

function fromBase64Url(b64url: string): string {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (s.length % 4)) % 4;
  if (pad) s += "=".repeat(pad);
  return s;
}

/* ── public API ────────────────────────────────────────────── */

/**
 * Compresses DBML content using pako deflateRaw (level 9) + base64url.
 */
export function encodeDBMLToUrl(dbml: string): string {
  const minified = minifyDBML(dbml);
  const deflated = pako.deflateRaw(new TextEncoder().encode(minified), { level: 9 });
  const urlSafe = uint8ToBase64Url(deflated);
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  return `${base}${HASH_KEY_V2}${urlSafe}`;
}

/**
 * Reads the URL hash and decompresses DBML content if present.
 * Supports both v2 (pako) and legacy v1 (lz-string) formats.
 */
export function decodeDBMLFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;

  // v2 – pako deflateRaw
  if (hash.startsWith(HASH_KEY_V2)) {
    const urlSafe = hash.slice(HASH_KEY_V2.length);
    if (!urlSafe) return null;
    try {
      const bytes = base64UrlToUint8(urlSafe);
      const inflated = pako.inflateRaw(bytes);
      return new TextDecoder().decode(inflated) || null;
    } catch {
      return null;
    }
  }

  // v1 – lz-string (backward compatibility)
  if (hash.startsWith(HASH_KEY_V1)) {
    const urlSafe = hash.slice(HASH_KEY_V1.length);
    if (!urlSafe) return null;
    try {
      const b64 = fromBase64Url(urlSafe);
      const decompressed = LZString.decompressFromBase64(b64);
      return decompressed || null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Clears the DBML hash from the URL without page reload.
 */
export function clearDBMLFromUrl(): void {
  if (typeof window === "undefined") return;
  history.replaceState(null, "", window.location.pathname);
}
