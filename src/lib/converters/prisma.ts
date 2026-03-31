import type { ParsedSchema } from "@/types";

const PRISMA_TYPE: Record<string, string> = {
  int: "Int", integer: "Int", bigint: "BigInt", smallint: "Int",
  tinyint: "Int", mediumint: "Int", serial: "Int", bigserial: "BigInt",
  varchar: "String", text: "String", char: "String", nvarchar: "String",
  boolean: "Boolean", bool: "Boolean",
  float: "Float", double: "Float", real: "Float",
  decimal: "Decimal", numeric: "Decimal", money: "Decimal",
  date: "DateTime", datetime: "DateTime", timestamp: "DateTime",
  timestamptz: "DateTime", time: "String",
  json: "Json", jsonb: "Json",
  uuid: "String",
  bytea: "Bytes", binary: "Bytes", blob: "Bytes",
};

function pascal(s: string) {
  return s
    .replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
    .replace(/^\w/, (c) => c.toUpperCase());
}

function camel(s: string) {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function base(type: string) {
  return type.replace(/\(.*\)/, "").replace(/\[\]/, "").toLowerCase().trim();
}

/** Derive a relation accessor name from the FK field (strips _id / _fk / _key suffixes). */
function fkToAccessor(fkField: string): string {
  const stripped = fkField
    .replace(/_id$/i, "")
    .replace(/_fk$/i, "")
    .replace(/_key$/i, "");
  return camel(stripped || fkField);
}

// ─────────────────────────────────────────────────────────────────────────────

export function toPrisma(schema: ParsedSchema): string {

  // ── 1. Normalize refs to { fkTable, fkField, pkTable, pkField, kind } ────
  type RelKind = "many-to-one" | "one-to-one" | "many-to-many";

  interface NRef {
    fkTable: string; fkField: string;
    pkTable: string; pkField: string;
    kind: RelKind;
    relName: string | null;          // disambiguating @relation name
  }

  const nrefs: NRef[] = schema.refs.map((ref) => {
    const [ft, ff] = ref.from.split(".");
    const [tt, tf] = ref.to.split(".");
    // ">" → from has FK, to has PK (many-to-one)
    // "<" → from has PK, to has FK (one-to-many seen from from-side → to is FK side)
    // "-" → one-to-one, from has FK
    // "<>" → many-to-many
    if (ref.type === ">")  return { fkTable: ft, fkField: ff, pkTable: tt, pkField: tf, kind: "many-to-one",  relName: null };
    if (ref.type === "<")  return { fkTable: tt, fkField: tf, pkTable: ft, pkField: ff, kind: "many-to-one",  relName: null };
    if (ref.type === "-")  return { fkTable: ft, fkField: ff, pkTable: tt, pkField: tf, kind: "one-to-one",   relName: null };
    /* "<>" */             return { fkTable: ft, fkField: ff, pkTable: tt, pkField: tf, kind: "many-to-many", relName: null };
  });

  // ── 2. Assign disambiguating relation names where the same table pair has
  //        more than one relation (Prisma requirement). ───────────────────────
  const pairCount: Record<string, number> = {};
  for (const nr of nrefs) {
    if (nr.kind === "many-to-many") continue;
    const key = [nr.fkTable, nr.pkTable].sort().join("|");
    pairCount[key] = (pairCount[key] ?? 0) + 1;
  }
  for (const nr of nrefs) {
    if (nr.kind === "many-to-many") continue;
    const key = [nr.fkTable, nr.pkTable].sort().join("|");
    if (pairCount[key] > 1) {
      // Use FK field accessor as unique suffix so each relation has a stable name
      const suffix = pascal(fkToAccessor(nr.fkField));
      nr.relName = `${pascal(nr.fkTable)}${pascal(nr.pkTable)}_${suffix}`;
    }
  }

  // ── 3. Build per-table relation field lists ───────────────────────────────
  interface RelField {
    fieldName: string;
    modelType: string;
    isArray: boolean;
    isOptional: boolean;
    fkFields?: string[];   // only on FK side
    refFields?: string[];  // only on FK side
    relName: string | null;
  }

  const tableRels: Record<string, RelField[]> = {};
  for (const t of schema.tables) tableRels[t.name] = [];

  for (const nr of nrefs) {
    const fkIsOptional = (() => {
      const tbl = schema.tables.find((t) => t.name === nr.fkTable);
      const fld = tbl?.fields.find((f) => f.name === nr.fkField);
      return fld ? !fld.isNotNull : true;
    })();

    if (nr.kind === "many-to-one") {
      const fkAccessor = fkToAccessor(nr.fkField) || camel(nr.pkTable);
      const pkAccessor = camel(nr.fkTable) + "s";

      tableRels[nr.fkTable]?.push({
        fieldName: fkAccessor, modelType: pascal(nr.pkTable),
        isArray: false, isOptional: fkIsOptional,
        fkFields: [nr.fkField], refFields: [nr.pkField],
        relName: nr.relName,
      });
      tableRels[nr.pkTable]?.push({
        fieldName: pkAccessor, modelType: pascal(nr.fkTable),
        isArray: true, isOptional: false,
        relName: nr.relName,
      });

    } else if (nr.kind === "one-to-one") {
      const fkAccessor = fkToAccessor(nr.fkField) || camel(nr.pkTable);
      const pkAccessor = camel(nr.fkTable);

      tableRels[nr.fkTable]?.push({
        fieldName: fkAccessor, modelType: pascal(nr.pkTable),
        isArray: false, isOptional: fkIsOptional,
        fkFields: [nr.fkField], refFields: [nr.pkField],
        relName: nr.relName,
      });
      tableRels[nr.pkTable]?.push({
        fieldName: pkAccessor, modelType: pascal(nr.fkTable),
        isArray: false, isOptional: true,   // back-side of 1-1 is always optional
        relName: nr.relName,
      });

    } else /* many-to-many */ {
      tableRels[nr.fkTable]?.push({
        fieldName: camel(nr.pkTable) + "s", modelType: pascal(nr.pkTable),
        isArray: true, isOptional: false, relName: nr.relName,
      });
      tableRels[nr.pkTable]?.push({
        fieldName: camel(nr.fkTable) + "s", modelType: pascal(nr.fkTable),
        isArray: true, isOptional: false, relName: nr.relName,
      });
    }
  }

  // ── 4. Render ─────────────────────────────────────────────────────────────
  const out: string[] = [];
  out.push("// Prisma Schema — generated by DBML Studio\n");
  out.push('generator client {\n  provider = "prisma-client-js"\n}\n');
  out.push('datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n');

  for (const en of schema.enums) {
    out.push(`enum ${pascal(en.name)} {`);
    en.values.forEach((v) => out.push(`  ${v}`));
    out.push("}\n");
  }

  for (const table of schema.tables) {
    const model = pascal(table.name);
    out.push(`model ${model} {`);

    // ── Scalar fields ──────────────────────────────────────────────────────
    const scalarNames = new Set(table.fields.map((f) => f.name));

    for (const f of table.fields) {
      const b = base(f.type);
      const isEnum = schema.enums.some((e) => e.name.toLowerCase() === b.toLowerCase());
      const pType = isEnum ? pascal(b) : (PRISMA_TYPE[b] ?? "String");

      const decs: string[] = [];

      if (f.isPk) decs.push("@id");

      // Default value
      if (f.isIncrement || b === "serial" || b === "bigserial") {
        decs.push("@default(autoincrement())");
      } else if (b === "uuid" && f.isPk) {
        decs.push("@default(uuid())");
      } else if (f.default !== null && !f.isIncrement) {
        const d = String(f.default).trim();
        if (/^now\(\)$/i.test(d) || /current_timestamp/i.test(d)) {
          decs.push("@default(now())");
        } else {
          decs.push(`@default(${d})`);
        }
      }

      if (f.isUnique && !f.isPk) decs.push("@unique");

      // DB-specific type hints
      const varcharLen = f.type.match(/(?:n?varchar|char)\((\d+)\)/i);
      if (varcharLen) {
        decs.push(`@db.VarChar(${varcharLen[1]})`);
      } else if (b === "text" || b === "nvarchar") {
        decs.push("@db.Text");
      }
      const decScale = f.type.match(/(?:decimal|numeric)\((\d+),\s*(\d+)\)/i);
      if (decScale) decs.push(`@db.Decimal(${decScale[1]}, ${decScale[2]})`);

      if (b === "timestamptz") decs.push("@db.Timestamptz(6)");

      const opt = !f.isNotNull && !f.isPk ? "?" : "";
      const decStr = decs.length ? `  ${decs.join(" ")}` : "";
      out.push(`  ${f.name.padEnd(24)} ${pType}${opt}${decStr}`);
    }

    // ── Relation fields ────────────────────────────────────────────────────
    const rels = tableRels[table.name] ?? [];
    if (rels.length > 0) out.push("");

    // Deduplicate relation field names (collision with scalar or sibling relation)
    const usedNames = new Set<string>(scalarNames);

    for (const rel of rels) {
      let fieldName = rel.fieldName;
      if (usedNames.has(fieldName)) fieldName = fieldName + "Rel";
      usedNames.add(fieldName);

      const typeStr = rel.isArray
        ? `${rel.modelType}[]`
        : `${rel.modelType}${rel.isOptional ? "?" : ""}`;

      let decStr = "";
      if (rel.fkFields && rel.refFields) {
        const nameArg = rel.relName ? `"${rel.relName}", ` : "";
        decStr = `  @relation(${nameArg}fields: [${rel.fkFields.join(", ")}], references: [${rel.refFields.join(", ")}])`;
      } else if (rel.relName) {
        decStr = `  @relation("${rel.relName}")`;
      }

      out.push(`  ${fieldName.padEnd(24)} ${typeStr}${decStr}`);
    }

    out.push(`\n  @@map("${table.name}")`);
    out.push("}\n");
  }

  return out.join("\n");
}
