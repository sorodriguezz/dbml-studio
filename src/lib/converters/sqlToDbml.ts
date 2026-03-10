/**
 * SQL → DBML Converter
 * Supports PostgreSQL, MySQL, SQL Server DDL statements.
 */

interface ParsedColumn {
  name: string;
  type: string;
  isPk: boolean;
  isUnique: boolean;
  isNotNull: boolean;
  isAutoIncrement: boolean;
  default: string | null;
}

interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
}

interface ParsedRef {
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
}

function stripQuotes(s: string): string {
  return s.replace(/^["'\[`]|["'\]`]$/g, "").trim();
}

function normalizeType(rawType: string): string {
  const upper = rawType.trim().toUpperCase();

  if (upper === "INT" || upper === "INTEGER" || upper === "INT4") return "integer";
  if (upper === "BIGINT" || upper === "INT8") return "bigint";
  if (upper === "SMALLINT" || upper === "INT2" || upper === "TINYINT") return "smallint";
  if (upper === "SERIAL" || upper === "INT GENERATED ALWAYS AS IDENTITY") return "integer";
  if (upper === "BIGSERIAL") return "bigint";
  if (upper === "SMALLSERIAL") return "smallint";
  if (upper === "BIT") return "boolean";
  if (upper === "FLOAT" || upper === "REAL" || upper === "FLOAT4") return "float";
  if (upper === "DOUBLE" || upper === "DOUBLE PRECISION" || upper === "FLOAT8") return "double";
  if (upper.startsWith("DECIMAL") || upper.startsWith("NUMERIC")) {
    const m = rawType.match(/\([\d,\s]+\)/);
    return m ? `decimal${m[0]}` : "decimal";
  }
  if (upper === "MONEY") return "decimal(19,4)";
  if (upper.startsWith("VARCHAR") || upper.startsWith("CHARACTER VARYING") || upper.startsWith("NVARCHAR")) {
    const m = rawType.match(/\((\d+)\)/);
    if (upper === "NVARCHAR(MAX)" || upper === "VARCHAR(MAX)") return "text";
    return m ? `varchar(${m[1]})` : "varchar(255)";
  }
  if (upper === "TEXT" || upper === "NTEXT" || upper === "LONGTEXT" || upper === "MEDIUMTEXT" || upper === "TINYTEXT") return "text";
  if (upper.startsWith("CHAR") || upper.startsWith("NCHAR")) {
    const m = rawType.match(/\((\d+)\)/);
    return m ? `char(${m[1]})` : "char(1)";
  }
  if (upper === "BOOLEAN" || upper === "BOOL") return "boolean";
  if (upper === "DATE") return "date";
  if (upper.startsWith("TIMESTAMP")) return "timestamp";
  if (upper.startsWith("DATETIME") || upper === "SMALLDATETIME") return "datetime";
  if (upper === "TIME") return "time";
  if (upper === "JSON") return "json";
  if (upper === "JSONB") return "jsonb";
  if (upper === "UUID" || upper === "UNIQUEIDENTIFIER") return "uuid";
  if (upper === "BYTEA" || upper === "BLOB" || upper.startsWith("BINARY") || upper.startsWith("VARBINARY")) return "blob";

  return rawType.trim().toLowerCase();
}

// Split a comma-separated string respecting parentheses depth
function splitTopLevel(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of str) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseColumnDef(line: string): ParsedColumn | null {
  // Match identifier + type, then optional constraints
  const colMatch = line.match(/^["'\[`]?(\w+)["'\]`]?\s+([\w\s()[\]`,.']+?)(?:\s+(.*?))?$/i);
  if (!colMatch) return null;

  const name = colMatch[1];
  const typeRaw = colMatch[2].trim();
  const rest = (colMatch[3] ?? "").trim();
  const combined = `${typeRaw} ${rest}`.trim();

  const isAutoIncrement =
    /\bAUTO_INCREMENT\b/i.test(combined) ||
    /\bIDENTITY\s*\(/i.test(combined) ||
    /\bGENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY\b/i.test(combined) ||
    /^SERIAL\b/i.test(typeRaw) ||
    /^BIGSERIAL\b/i.test(typeRaw) ||
    /^SMALLSERIAL\b/i.test(typeRaw);

  const isPk = /\bPRIMARY\s+KEY\b/i.test(combined);
  const isUnique = /\bUNIQUE\b/i.test(combined) && !isPk;
  const isNotNull = /\bNOT\s+NULL\b/i.test(combined) || isPk;

  let defaultVal: string | null = null;
  const defaultMatch = combined.match(/\bDEFAULT\s+('[^']*'|"[^"]*"|`[^`]*`|[\w.]+(?:\(\))?)/i);
  if (defaultMatch && !isAutoIncrement) {
    defaultVal = defaultMatch[1];
  }

  // Strip identity/serial markers from type before normalizing
  const cleanType = typeRaw
    .replace(/\bGENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY\b/gi, "")
    .replace(/\bIDENTITY\s*\(\d+\s*,\s*\d+\)\s*/gi, "")
    .trim();

  return {
    name,
    type: normalizeType(cleanType),
    isPk,
    isUnique,
    isNotNull,
    isAutoIncrement,
    default: defaultVal,
  };
}

export function sqlToDbml(sql: string): string {
  const tables: ParsedTable[] = [];
  const refs: ParsedRef[] = [];

  // Remove SQL comments
  const clean = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  // Match CREATE TABLE [IF NOT EXISTS] [schema.]table_name ( ... );
  const createTableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["'\[`]?\w+["'\]`]?\s*\.\s*)?["'\[`]?(\w+)["'\]`]?\s*\(([^;]*?)\s*\)\s*(?:WITHOUT\s+ROWID\s*)?;?/gi;

  let m: RegExpExecArray | null;
  while ((m = createTableRegex.exec(clean)) !== null) {
    const tableName = m[1];
    const body = m[2];
    const columns: ParsedColumn[] = [];
    const tablePKCols: string[] = [];
    const tableUQCols: string[] = [];

    for (const part of splitTopLevel(body)) {
      const line = part.trim();
      if (!line) continue;

      // TABLE-LEVEL PRIMARY KEY
      if (/^(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(/i.test(line)) {
        const pkm = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkm) pkm[1].split(",").forEach(c => tablePKCols.push(stripQuotes(c)));
        continue;
      }

      // TABLE-LEVEL UNIQUE
      if (/^(?:CONSTRAINT\s+\w+\s+)?UNIQUE\s*(?:INDEX\s*\w*\s*)?\s*\(/i.test(line)) {
        const uqm = line.match(/UNIQUE\s*(?:INDEX\s*\w+\s*)?\s*\(([^)]+)\)/i);
        if (uqm) {
          const cols = uqm[1].split(",").map(c => stripQuotes(c));
          if (cols.length === 1) tableUQCols.push(cols[0]);
        }
        continue;
      }

      // TABLE-LEVEL FOREIGN KEY
      if (/^(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(/i.test(line)) {
        const fkm = line.match(
          /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:["'\[`]?\w+["'\]`]?\s*\.\s*)?["'\[`]?(\w+)["'\]`]?\s*\(([^)]+)\)/i
        );
        if (fkm) {
          refs.push({
            fromTable: tableName,
            fromCol: stripQuotes(fkm[1]),
            toTable: fkm[2],
            toCol: stripQuotes(fkm[3]),
          });
        }
        continue;
      }

      // Skip CHECK, INDEX, KEY (non-PKconstraint), generic CONSTRAINT lines
      if (/^CHECK\s*\(/i.test(line)) continue;
      if (/^(INDEX|KEY)\s+\w/i.test(line)) continue;
      if (/^CONSTRAINT\s+\w+\s+(FOREIGN|CHECK)/i.test(line)) continue;

      const col = parseColumnDef(line);
      if (col) columns.push(col);
    }

    // Apply table-level PK / UQ overrides
    for (const pkCol of tablePKCols) {
      const col = columns.find(c => c.name === pkCol);
      if (col) { col.isPk = true; col.isNotNull = true; }
    }
    for (const uqCol of tableUQCols) {
      const col = columns.find(c => c.name === uqCol);
      if (col && !col.isPk) col.isUnique = true;
    }

    if (columns.length > 0) {
      tables.push({ name: tableName, columns });
    }
  }

  // ALTER TABLE ADD FOREIGN KEY (after CREATE TABLE block)
  const alterFkRegex =
    /ALTER\s+TABLE\s+(?:["'\[`]?\w+["'\]`]?\s*\.\s*)?["'\[`]?(\w+)["'\]`]?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:["'\[`]?\w+["'\]`]?\s*\.\s*)?["'\[`]?(\w+)["'\]`]?\s*\(([^)]+)\)/gi;

  while ((m = alterFkRegex.exec(clean)) !== null) {
    refs.push({
      fromTable: m[1],
      fromCol: stripQuotes(m[2]),
      toTable: m[3],
      toCol: stripQuotes(m[4]),
    });
  }

  if (tables.length === 0) {
    return "// No CREATE TABLE statements found.\n// Paste valid SQL DDL (PostgreSQL, MySQL or SQL Server).";
  }

  // Build DBML output
  const lines: string[] = ["// DBML generated from SQL by DBML Studio", ""];

  for (const table of tables) {
    lines.push(`Table ${table.name} {`);
    for (const col of table.columns) {
      const opts: string[] = [];
      if (col.isPk) opts.push("pk");
      if (col.isAutoIncrement) opts.push("increment");
      if (col.isNotNull && !col.isPk) opts.push("not null");
      if (col.isUnique) opts.push("unique");
      if (col.default !== null) opts.push(`default: ${col.default}`);
      const optsStr = opts.length ? ` [${opts.join(", ")}]` : "";
      lines.push(`  ${col.name} ${col.type}${optsStr}`);
    }
    lines.push("}");
    lines.push("");
  }

  if (refs.length > 0) {
    for (const ref of refs) {
      lines.push(`Ref: ${ref.fromTable}.${ref.fromCol} > ${ref.toTable}.${ref.toCol}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
