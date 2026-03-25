/**
 * DBML Parser — @dbml/core with regex fallback.
 * Pure function, fully testable, no side effects.
 */
import type { ParsedSchema, DBMLTable, DBMLField, DBMLRef, DBMLEnum, RefType } from "@/types";

function parseWithDBMLCore(input: string): ParsedSchema | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Parser } = require("@dbml/core");
    const database = Parser.parse(input, "dbml");
    const schema = database.schemas[0];
    const tables: DBMLTable[] = [];
    const refs: DBMLRef[] = [];
    const enums: DBMLEnum[] = [];

    for (const en of schema.enums ?? []) {
      enums.push({ name: en.name, values: en.values.map((v: { name: string }) => v.name), x: 0, y: 0 });
    }
    for (const table of schema.tables ?? []) {
      const fields: DBMLField[] = (table.fields ?? []).map((f: Record<string,unknown>) => ({
        name: f.name as string,
        type: ((f.type as Record<string,unknown>)?.type_name as string) ?? "varchar",
        isPk: (f.pk as boolean) ?? false,
        isNotNull: (f.not_null as boolean) ?? (f.pk as boolean) ?? false,
        isUnique: (f.unique as boolean) ?? (f.pk as boolean) ?? false,
        isIncrement: (f.increment as boolean) ?? false,
        default: ((f.dbdefault as Record<string,unknown>)?.value as string)?.toString() ?? null,
        note: ((f.note as Record<string,unknown>)?.value as string) ?? null,
        refs: [],
      }));
      tables.push({ name: table.name as string, alias: (table.alias as string) ?? null, fields, note: null, x: 0, y: 0 });
    }
    for (const ref of schema.refs ?? []) {
      const endpoints = ref.endpoints as Array<Record<string,unknown>>;
      if (endpoints.length >= 2) {
        const e1 = endpoints[0]; const e2 = endpoints[1];
        refs.push({
          from: `${e1.tableName}.${(e1.fieldNames as string[])[0]}`,
          to: `${e2.tableName}.${(e2.fieldNames as string[])[0]}`,
          type: mapRelation(e1.relation as string, e2.relation as string),
        });
      }
    }
    autoLayout(tables, enums);
    return { tables, refs, enums, errors: [] };
  } catch { return null; }
}

function mapRelation(r1: string, r2: string): RefType {
  if (r1 === "1" && r2 === "*") return "<";
  if (r1 === "*" && r2 === "1") return ">";
  if (r1 === "1" && r2 === "1") return "-";
  return "<>";
}

function parseWithRegex(input: string): ParsedSchema {
  const tables: DBMLTable[] = [];
  const refs: DBMLRef[] = [];
  const enums: DBMLEnum[] = [];
  const errors: string[] = [];
  const clean = input.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  let m: RegExpExecArray | null;

  const enumRegex = /[Ee]num\s+["\']?(\w+)["\']?\s*\{([^}]*)\}/g;
  while ((m = enumRegex.exec(clean)) !== null) {
    const values = m[2].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("Note"));
    enums.push({ name: m[1], values, x: 0, y: 0 });
  }

  const tableRegex = /[Tt]able\s+["\']?(\w+)["\']?\s*(?:as\s+(\w+)\s*)?\{([^}]*)\}/g;
  while ((m = tableRegex.exec(clean)) !== null) {
    const tableName = m[1];
    const fields: DBMLField[] = [];
    // Strip Note blocks (single and multi-line) before processing field lines
    const tableBody = m[3]
      .replace(/\bNote\s*:\s*'''[\s\S]*?'''/gi, "")
      .replace(/\bNote\s*:\s*"""[\s\S]*?"""/gi, "")
      .replace(/\bNote\s*:\s*'[^']*'/gi, "")
      .replace(/\bNote\s*:\s*"[^"]*"/gi, "");
    for (const rawLine of tableBody.split("\n")) {
      const line = rawLine.trim();
      if (!line || /^(indexes|Note|\{|\})/.test(line)) continue;
      const fm = line.match(/^["\']?(\w+)["\']?\s+([\w.]+(?:\([^)]*\))?(?:\[\])?)\s*(\[[\s\S]*?\])?/);
      if (!fm) continue;
      const opts = fm[3] ?? "";
      const isPk = /\bpk\b/i.test(opts);
      const isIncrement = /\bincrement\b/i.test(opts);
      const inlineRef = opts.match(/\bref:\s*([<>\-])\s*(\w+)\.(\w+)/i);
      if (inlineRef) refs.push({ from: `${tableName}.${fm[1]}`, to: `${inlineRef[2]}.${inlineRef[3]}`, type: inlineRef[1] as RefType });
      fields.push({
        name: fm[1], type: fm[2],
        isPk: isPk || isIncrement,
        isNotNull: /\bnot\s+null\b/i.test(opts) || isPk || isIncrement,
        isUnique: /\bunique\b/i.test(opts) || isPk || isIncrement,
        isIncrement,
        default: opts.match(/\bdefault:\s*(`[^`]*`|'[^']*'|"[^"]*"|\w+)/i)?.[1] ?? null,
        note: opts.match(/\bnote:\s*['"]([^'"]+)['"]/i)?.[1] ?? null,
        refs: inlineRef ? [{ type: inlineRef[1] as RefType, toTable: inlineRef[2], toField: inlineRef[3] }] : [],
      });
    }
    tables.push({ name: tableName, alias: m[2] ?? null, fields, note: null, x: 0, y: 0 });
  }

  const refRegex = /[Rr]ef\s*\w*\s*:\s*(\w+)\.(\w+)\s*([<>\-])\s*(\w+)\.(\w+)/g;
  while ((m = refRegex.exec(clean)) !== null) {
    refs.push({ from: `${m[1]}.${m[2]}`, to: `${m[4]}.${m[5]}`, type: m[3] as RefType });
  }

  if (tables.length === 0 && clean.trim().length > 20) errors.push("No tables found. Check DBML syntax.");
  autoLayout(tables, enums);
  return { tables, refs, enums, errors };
}

function autoLayout(tables: DBMLTable[], enums: DBMLEnum[] = []): void {
  const COLS = Math.max(1, Math.ceil(Math.sqrt(tables.length)));
  let maxX = 0, maxY = 0;
  tables.forEach((t, i) => {
    t.x = (i % COLS) * 360 + 60;
    t.y = Math.floor(i / COLS) * 340 + 60;
    maxX = Math.max(maxX, t.x + 360);
    maxY = Math.max(maxY, t.y);
  });
  // Place enums to the right of all tables
  const ENUM_W = 200;
  const ENUM_GAP = 40;
  enums.forEach((en, i) => {
    en.x = maxX + ENUM_GAP;
    en.y = 60 + i * (32 + en.values.length * 24 + 20);
  });
}

export function parseDBML(input: string): ParsedSchema {
  if (!input.trim()) return { tables: [], refs: [], enums: [], errors: [] };
  const coreResult = parseWithDBMLCore(input);
  if (coreResult && coreResult.tables.length > 0) return coreResult;
  return parseWithRegex(input);
}
