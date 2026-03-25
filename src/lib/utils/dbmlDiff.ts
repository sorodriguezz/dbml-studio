/**
 * DBML Diff — compares two ParsedSchema objects and produces a structured diff.
 */
import type { ParsedSchema, DBMLTable, DBMLField, DBMLEnum } from "@/types";

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface FieldDiff {
  name: string;
  status: DiffStatus;
  oldField: DBMLField | null;
  newField: DBMLField | null;
  changes: string[];
}

export interface TableDiff {
  name: string;
  status: DiffStatus;
  fields: FieldDiff[];
}

export interface EnumDiff {
  name: string;
  status: DiffStatus;
  addedValues: string[];
  removedValues: string[];
}

export interface RefDiff {
  key: string;
  status: "added" | "removed";
}

export interface SchemaDiff {
  tables: TableDiff[];
  enums: EnumDiff[];
  refs: RefDiff[];
  hasChanges: boolean;
  stats: { added: number; removed: number; modified: number };
}

function fieldKey(f: DBMLField): string {
  const ref = f.refs.map(r => `${r.type}${r.toTable}.${r.toField}`).join(",");
  return [f.type, f.isPk, f.isNotNull, f.isUnique, f.isIncrement, f.default ?? "", f.note ?? "", ref].join("|");
}

function diffFields(oldFields: DBMLField[], newFields: DBMLField[]): FieldDiff[] {
  const oldMap = new Map(oldFields.map(f => [f.name, f]));
  const newMap = new Map(newFields.map(f => [f.name, f]));
  const names = new Set(Array.from(oldMap.keys()).concat(Array.from(newMap.keys())));
  const result: FieldDiff[] = [];

  for (const name of Array.from(names)) {
    const oldF = oldMap.get(name) ?? null;
    const newF = newMap.get(name) ?? null;

    if (!oldF) {
      result.push({ name, status: "added", oldField: null, newField: newF, changes: [] });
    } else if (!newF) {
      result.push({ name, status: "removed", oldField: oldF, newField: null, changes: [] });
    } else {
      const changes: string[] = [];
      if (oldF.type !== newF.type) changes.push(`type: ${oldF.type} → ${newF.type}`);
      if (oldF.isPk !== newF.isPk) changes.push(`pk: ${oldF.isPk} → ${newF.isPk}`);
      if (oldF.isNotNull !== newF.isNotNull) changes.push(`not null: ${oldF.isNotNull} → ${newF.isNotNull}`);
      if (oldF.isUnique !== newF.isUnique) changes.push(`unique: ${oldF.isUnique} → ${newF.isUnique}`);
      if (oldF.isIncrement !== newF.isIncrement) changes.push(`increment: ${oldF.isIncrement} → ${newF.isIncrement}`);
      if (oldF.default !== newF.default) changes.push(`default: ${oldF.default ?? "—"} → ${newF.default ?? "—"}`);
      if (oldF.note !== newF.note) changes.push(`note: "${oldF.note ?? ""}" → "${newF.note ?? ""}"`);
      const status: DiffStatus = changes.length > 0 ? "modified" : "unchanged";
      result.push({ name, status, oldField: oldF, newField: newF, changes });
    }
  }

  // Sort: added first, then modified, then unchanged, removed last (for easy reading)
  const order: DiffStatus[] = ["added", "modified", "unchanged", "removed"];
  result.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return result;
}

export function diffSchemas(oldSchema: ParsedSchema | null, newSchema: ParsedSchema | null): SchemaDiff {
  const empty: ParsedSchema = { tables: [], refs: [], enums: [], errors: [] };
  const a = oldSchema ?? empty;
  const b = newSchema ?? empty;

  // ── Tables ──────────────────────────────────────────────────────────
  const aTableMap = new Map<string, DBMLTable>(a.tables.map(t => [t.name, t]));
  const bTableMap = new Map<string, DBMLTable>(b.tables.map(t => [t.name, t]));
  const tableNames = new Set(Array.from(aTableMap.keys()).concat(Array.from(bTableMap.keys())));

  const tables: TableDiff[] = [];
  for (const name of Array.from(tableNames)) {
    const aT = aTableMap.get(name);
    const bT = bTableMap.get(name);
    if (!aT) {
      tables.push({ name, status: "added", fields: diffFields([], bT!.fields) });
    } else if (!bT) {
      tables.push({ name, status: "removed", fields: diffFields(aT.fields, []) });
    } else {
      const fields = diffFields(aT.fields, bT.fields);
      const hasChanges = fields.some(f => f.status !== "unchanged");
      tables.push({ name, status: hasChanges ? "modified" : "unchanged", fields });
    }
  }
  tables.sort((a, b) => {
    const order: DiffStatus[] = ["added", "modified", "unchanged", "removed"];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  // ── Enums ───────────────────────────────────────────────────────────
  const aEnumMap = new Map<string, DBMLEnum>(a.enums.map(e => [e.name, e]));
  const bEnumMap = new Map<string, DBMLEnum>(b.enums.map(e => [e.name, e]));
  const enumNames = new Set(Array.from(aEnumMap.keys()).concat(Array.from(bEnumMap.keys())));

  const enums: EnumDiff[] = [];
  for (const name of Array.from(enumNames)) {
    const aE = aEnumMap.get(name);
    const bE = bEnumMap.get(name);
    if (!aE) {
      enums.push({ name, status: "added", addedValues: bE!.values, removedValues: [] });
    } else if (!bE) {
      enums.push({ name, status: "removed", addedValues: [], removedValues: aE.values });
    } else {
      const aSet = new Set(aE.values);
      const bSet = new Set(bE.values);
      const addedValues = bE.values.filter(v => !aSet.has(v));
      const removedValues = aE.values.filter(v => !bSet.has(v));
      const status: DiffStatus = (addedValues.length > 0 || removedValues.length > 0) ? "modified" : "unchanged";
      enums.push({ name, status, addedValues, removedValues });
    }
  }

  // ── Refs ────────────────────────────────────────────────────────────
  const aRefKeys = new Set(a.refs.map(r => `${r.from}${r.type}${r.to}`));
  const bRefKeys = new Set(b.refs.map(r => `${r.from}${r.type}${r.to}`));
  const refs: RefDiff[] = [
    ...b.refs.filter(r => !aRefKeys.has(`${r.from}${r.type}${r.to}`)).map(r => ({ key: `${r.from} ${r.type} ${r.to}`, status: "added" as const })),
    ...a.refs.filter(r => !bRefKeys.has(`${r.from}${r.type}${r.to}`)).map(r => ({ key: `${r.from} ${r.type} ${r.to}`, status: "removed" as const })),
  ];

  // ── Stats ───────────────────────────────────────────────────────────
  const all = [...tables, ...enums];
  const stats = {
    added:    all.filter(x => x.status === "added").length,
    removed:  all.filter(x => x.status === "removed").length,
    modified: all.filter(x => x.status === "modified").length,
  };
  const hasChanges = stats.added > 0 || stats.removed > 0 || stats.modified > 0 || refs.length > 0;

  return { tables, enums, refs, hasChanges, stats };
}
