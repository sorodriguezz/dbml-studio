import type { ParsedSchema, DBMLTable, DBMLField, DBMLRef } from "@/types";

function pascal(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/^\w/, c => c.toUpperCase());
}

function camel(s: string): string {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function base(type: string): string {
  return type.replace(/\(.*\)/, "").toLowerCase().trim();
}

function javaType(type: string, notNull: boolean, pk: boolean): string {
  const b = base(type);
  switch (b) {
    case "int": case "integer": case "smallint":
      return pk || notNull ? "int" : "Integer";
    case "bigint": case "serial": case "bigserial":
      return pk || notNull ? "long" : "Long";
    case "float": case "real":
      return notNull ? "float" : "Float";
    case "double": case "decimal": case "numeric":
      return "BigDecimal";
    case "boolean": case "bool":
      return notNull ? "boolean" : "Boolean";
    case "date":
      return "LocalDate";
    case "datetime": case "timestamp":
      return "LocalDateTime";
    case "uuid":
      return "UUID";
    case "text": case "varchar": case "char": case "string":
    default:
      return "String";
  }
}

function needsImport(type: string): string[] {
  const b = base(type);
  switch (b) {
    case "decimal": case "numeric": case "double":
      return ["java.math.BigDecimal"];
    case "date":
      return ["java.time.LocalDate"];
    case "datetime": case "timestamp":
      return ["java.time.LocalDateTime"];
    case "uuid":
      return ["java.util.UUID"];
    default:
      return [];
  }
}

function colAnnotation(field: DBMLField): string {
  const parts: string[] = [`name = "${field.name}"`];
  if (field.isNotNull && !field.isPk) parts.push("nullable = false");
  if (field.isUnique && !field.isPk) parts.push("unique = true");

  const b = base(field.type);
  if (["varchar", "char"].includes(b)) {
    const m = field.type.match(/\((\d+)\)/);
    if (m) parts.push(`length = ${m[1]}`);
  }
  if (["text"].includes(b)) parts.push("columnDefinition = \"TEXT\"");

  return `    @Column(${parts.join(", ")})`;
}

export function toJPA(schema: ParsedSchema): string {
  if (!schema || schema.tables.length === 0)
    return "// Paste valid DBML and click Parse to generate code.";

  // Build a map: tableName → its refs as FK source
  const refsByTable = new Map<string, DBMLRef[]>();
  for (const ref of schema.refs) {
    // ref.from is "table.field", type ">" means from→to is ManyToOne
    const fromTable = ref.from.split(".")[0];
    const toTable   = ref.to.split(".")[0];
    if (!refsByTable.has(fromTable)) refsByTable.set(fromTable, []);
    if (!refsByTable.has(toTable))   refsByTable.set(toTable, []);
    refsByTable.get(fromTable)!.push(ref);
  }

  const classes: string[] = [];

  for (const table of schema.tables) {
    const className = pascal(table.name);
    const imports = new Set<string>([
      "jakarta.persistence.*",
      "java.io.Serializable",
    ]);

    // Collect field lines and extra imports
    const fieldLines: string[] = [];
    const tableRefs = refsByTable.get(table.name) ?? [];

    // FK field names from this table (used to skip raw FK integer fields)
    const fkFieldNames = new Set(
      tableRefs
        .filter(r => r.from.startsWith(table.name + ".") && (r.type === ">" || r.type === "-"))
        .map(r => r.from.split(".")[1])
    );

    for (const field of table.fields) {
      const jt = javaType(field.type, field.isNotNull, field.isPk);
      for (const imp of needsImport(field.type)) imports.add(imp);
      if (["BigDecimal"].includes(jt)) imports.add("java.math.BigDecimal");

      if (field.isPk) {
        fieldLines.push("    @Id");
        if (field.isIncrement) {
          fieldLines.push("    @GeneratedValue(strategy = GenerationType.IDENTITY)");
        }
        fieldLines.push(`    private ${jt} ${camel(field.name)};`);
        fieldLines.push("");
        continue;
      }

      // Skip raw FK integer if a proper @ManyToOne/@OneToOne will be emitted
      if (fkFieldNames.has(field.name)) continue;

      fieldLines.push(colAnnotation(field));
      if (field.default !== null && field.default !== undefined) {
        const defVal = String(field.default).replace(/^'(.*)'$/, "$1").replace(/^`(.*)`$/, "$1");
        if (!["now()", "current_timestamp", "true", "false"].includes(defVal.toLowerCase())) {
          fieldLines.push(`    // default: ${defVal}`);
        }
      }
      fieldLines.push(`    private ${jt} ${camel(field.name)};`);
      fieldLines.push("");
    }

    // Relationship fields
    for (const ref of tableRefs) {
      const fromTable = ref.from.split(".")[0];
      const toTable   = ref.to.split(".")[0];
      const fromField = ref.from.split(".")[1];
      const toField   = ref.to.split(".")[1];

      if (fromTable === table.name) {
        if (ref.type === ">" || ref.type === "-") {
          // ManyToOne / OneToOne
          const relClass = pascal(toTable);
          const fieldName = camel(toTable);
          const ann = ref.type === "-" ? "@OneToOne" : "@ManyToOne";
          fieldLines.push(`    ${ann}(fetch = FetchType.LAZY)`);
          fieldLines.push(`    @JoinColumn(name = "${fromField}", referencedColumnName = "${toField}")`);
          fieldLines.push(`    private ${relClass} ${fieldName};`);
          fieldLines.push("");
        } else if (ref.type === "<>") {
          // ManyToMany owner side
          const relClass = pascal(toTable);
          const fieldName = camel(toTable) + "List";
          imports.add("java.util.List");
          fieldLines.push(`    @ManyToMany`);
          fieldLines.push(`    @JoinTable(`);
          fieldLines.push(`        name = "${table.name}_${toTable}",`);
          fieldLines.push(`        joinColumns = @JoinColumn(name = "${fromField}"),`);
          fieldLines.push(`        inverseJoinColumns = @JoinColumn(name = "${toField}")`);
          fieldLines.push(`    )`);
          fieldLines.push(`    private List<${relClass}> ${fieldName};`);
          fieldLines.push("");
        }
      } else if (toTable === table.name && ref.type === "<") {
        // OneToMany inverse side
        const relClass = pascal(fromTable);
        const fieldName = camel(fromTable) + "List";
        imports.add("java.util.List");
        fieldLines.push(`    @OneToMany(mappedBy = "${camel(toTable)}", cascade = CascadeType.ALL, orphanRemoval = true)`);
        fieldLines.push(`    private List<${relClass}> ${fieldName};`);
        fieldLines.push("");
      }
    }

    // Remove trailing blank line inside class
    while (fieldLines.length > 0 && fieldLines[fieldLines.length - 1] === "") {
      fieldLines.pop();
    }

    const sortedImports = Array.from(imports).sort();
    const lines: string[] = [
      `// ${className}.java — generated by DBML Studio`,
      `package com.example.model;`,
      "",
      ...sortedImports.map(i => `import ${i};`),
      "",
      `@Entity`,
      `@Table(name = "${table.name}")`,
      `public class ${className} implements Serializable {`,
      "",
      ...fieldLines,
      "",
      `    // Getters and setters omitted — use Lombok @Data or generate with your IDE`,
      `}`,
    ];

    classes.push(lines.join("\n"));
  }

  return classes.join("\n\n// " + "─".repeat(60) + "\n\n");
}
