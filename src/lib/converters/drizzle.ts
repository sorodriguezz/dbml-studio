import type { ParsedSchema, DBMLTable, DBMLEnum } from "@/types";

function camel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function base(type: string): string {
  return type.replace(/\(.*\)/, "").toLowerCase().trim();
}

interface FieldResult {
  importName: string;
  callExpr: string;
  chain: string;
}

function drizzleField(
  f: Pick<import("@/types").DBMLField, "name" | "type" | "isPk" | "isNotNull" | "isUnique" | "isIncrement" | "default">
): FieldResult {
  const b = base(f.type);
  const lenM = f.type.match(/\((\d+)\)/);
  const precM = f.type.match(/\((\d+),\s*(\d+)\)/);

  let importName: string;
  let callExpr: string;

  if ((f.isPk && f.isIncrement) || b === "serial") {
    importName = "serial";
    callExpr = `serial('${f.name}')`;
  } else if (b === "bigserial") {
    importName = "bigserial";
    callExpr = `bigserial('${f.name}', { mode: 'number' })`;
  } else if (b === "int" || b === "integer" || b === "int4") {
    importName = "integer";
    callExpr = `integer('${f.name}')`;
  } else if (b === "bigint" || b === "int8") {
    importName = "bigint";
    callExpr = `bigint('${f.name}', { mode: 'number' })`;
  } else if (b === "smallint" || b === "int2") {
    importName = "smallint";
    callExpr = `smallint('${f.name}')`;
  } else if (b === "varchar" || b === "character varying" || b === "nvarchar") {
    importName = "varchar";
    callExpr = lenM ? `varchar('${f.name}', { length: ${lenM[1]} })` : `varchar('${f.name}')`;
  } else if (b === "char" || b === "nchar") {
    importName = "char";
    callExpr = lenM ? `char('${f.name}', { length: ${lenM[1]} })` : `char('${f.name}')`;
  } else if (b === "text") {
    importName = "text";
    callExpr = `text('${f.name}')`;
  } else if (b === "boolean" || b === "bool") {
    importName = "boolean";
    callExpr = `boolean('${f.name}')`;
  } else if (b === "real" || b === "float4" || b === "float") {
    importName = "real";
    callExpr = `real('${f.name}')`;
  } else if (b === "double" || b === "double precision" || b === "float8") {
    importName = "doublePrecision";
    callExpr = `doublePrecision('${f.name}')`;
  } else if (b === "decimal" || b === "numeric") {
    importName = "numeric";
    callExpr = precM
      ? `numeric('${f.name}', { precision: ${precM[1]}, scale: ${precM[2]} })`
      : `numeric('${f.name}')`;
  } else if (b === "date") {
    importName = "date";
    callExpr = `date('${f.name}')`;
  } else if (b === "timestamp" || b === "datetime") {
    importName = "timestamp";
    callExpr = `timestamp('${f.name}')`;
  } else if (b === "time") {
    importName = "time";
    callExpr = `time('${f.name}')`;
  } else if (b === "json") {
    importName = "json";
    callExpr = `json('${f.name}')`;
  } else if (b === "jsonb") {
    importName = "jsonb";
    callExpr = `jsonb('${f.name}')`;
  } else if (b === "uuid") {
    importName = "uuid";
    callExpr = `uuid('${f.name}')`;
  } else {
    importName = "text";
    callExpr = `text('${f.name}')`;
  }

  const chainParts: string[] = [];

  if (importName === "serial" || importName === "bigserial") {
    chainParts.push(".primaryKey()");
  } else if (f.isPk) {
    chainParts.push(".primaryKey()");
  }
  if (f.isNotNull && !f.isPk && importName !== "serial" && importName !== "bigserial") {
    chainParts.push(".notNull()");
  }
  if (f.isUnique && !f.isPk) {
    chainParts.push(".unique()");
  }
  if (f.default !== null && !f.isIncrement) {
    const d = f.default;
    if (d === "'now()'" || d === "now()" || d === "current_timestamp") {
      chainParts.push(".defaultNow()");
    } else if (d === "gen_random_uuid()" || d === "uuid_generate_v4()") {
      chainParts.push(".defaultRandom()");
    } else {
      chainParts.push(`.default(${d})`);
    }
  }

  return { importName, callExpr, chain: chainParts.join("") };
}

function enumBlock(en: DBMLEnum, allImports: Set<string>): string {
  allImports.add("pgEnum");
  const values = en.values.map(v => `'${v}'`).join(", ");
  return `export const ${camel(en.name)}Enum = pgEnum('${en.name}', [${values}]);`;
}

function tableBlock(table: DBMLTable, refs: Array<{ from: string; to: string; type: string }>, allImports: Set<string>): string {
  // Map FK fields for this table: fieldName → { toTable, toField }
  const fkMap = new Map<string, { toTable: string; toField: string }>();
  for (const ref of refs) {
    if (ref.from.startsWith(table.name + ".") && (ref.type === ">" || ref.type === "-")) {
      const [, ff] = ref.from.split(".");
      const [tt, tf] = ref.to.split(".");
      fkMap.set(ff, { toTable: tt, toField: tf });
    }
  }

  const fieldLines: string[] = [];
  for (const f of table.fields) {
    const { importName, callExpr, chain } = drizzleField(f);
    allImports.add(importName);
    let fieldChain = chain;
    if (fkMap.has(f.name)) {
      const { toTable, toField } = fkMap.get(f.name)!;
      fieldChain += `.references(() => ${camel(toTable)}.${camel(toField)})`;
    }
    fieldLines.push(`  ${camel(f.name)}: ${callExpr}${fieldChain},`);
  }
  const varName = camel(table.name);
  return [`export const ${varName} = pgTable('${table.name}', {`, ...fieldLines, "});"].join("\n");
}

export function toDrizzle(schema: ParsedSchema): string {
  if (!schema || schema.tables.length === 0)
    return "// Paste valid DBML and click Parse to generate code.";

  const allImports = new Set<string>(["pgTable"]);
  const blocks: string[] = ["// Drizzle ORM Schema — generated by DBML Studio", ""];

  if (schema.enums.length > 0) {
    for (const en of schema.enums) blocks.push(enumBlock(en, allImports));
    blocks.push("");
  }

  for (const table of schema.tables) {
    blocks.push(tableBlock(table, schema.refs, allImports));
    blocks.push("");
  }

  const importLine = `import { ${Array.from(allImports).sort().join(", ")} } from 'drizzle-orm/pg-core';`;

  return [importLine, ...blocks].join("\n").trimEnd() + "\n";
}
