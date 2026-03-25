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

  // Refs indexed separately by FK-owning table (from) and PK-holding table (to)
  const refsByFromTable = new Map<string, DBMLRef[]>();
  const refsByToTable   = new Map<string, DBMLRef[]>();
  for (const ref of schema.refs) {
    const ft = ref.from.split(".")[0];
    const tt = ref.to.split(".")[0];
    if (!refsByFromTable.has(ft)) refsByFromTable.set(ft, []);
    if (!refsByToTable.has(tt))   refsByToTable.set(tt, []);
    refsByFromTable.get(ft)!.push(ref);
    refsByToTable.get(tt)!.push(ref);
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
    const fromRefs = refsByFromTable.get(table.name) ?? [];
    const toRefs   = refsByToTable.get(table.name) ?? [];

    // Skip raw FK integer fields where @ManyToOne / @OneToOne will be emitted
    const fkFieldNames = new Set([
      ...fromRefs.filter(r => r.type === ">" || r.type === "-").map(r => r.from.split(".")[1]),
      ...toRefs.filter(r => r.type === "<").map(r => r.to.split(".")[1]),
    ]);

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

    // Relationship fields — this table owns the FK
    for (const ref of fromRefs) {
      const toTable   = ref.to.split(".")[0];
      const fromField = ref.from.split(".")[1];
      const toField   = ref.to.split(".")[1];

      if (ref.type === ">" || ref.type === "-") {
        const ann = ref.type === "-" ? "@OneToOne" : "@ManyToOne";
        fieldLines.push(`    ${ann}(fetch = FetchType.LAZY)`);
        fieldLines.push(`    @JoinColumn(name = "${fromField}", referencedColumnName = "${toField}")`);
        fieldLines.push(`    private ${pascal(toTable)} ${camel(toTable)};`);
        fieldLines.push("");
      } else if (ref.type === "<") {
        // This table is the PK/one side; toTable has the FK → @OneToMany
        imports.add("java.util.List");
        fieldLines.push(`    @OneToMany(mappedBy = "${camel(table.name)}", cascade = CascadeType.ALL, orphanRemoval = true)`);
        fieldLines.push(`    private List<${pascal(toTable)}> ${camel(toTable)}List;`);
        fieldLines.push("");
      } else if (ref.type === "<>") {
        imports.add("java.util.List");
        fieldLines.push(`    @ManyToMany`);
        fieldLines.push(`    @JoinTable(`);
        fieldLines.push(`        name = "${table.name}_${toTable}",`);
        fieldLines.push(`        joinColumns = @JoinColumn(name = "${fromField}"),`);
        fieldLines.push(`        inverseJoinColumns = @JoinColumn(name = "${toField}")`);
        fieldLines.push(`    )`);
        fieldLines.push(`    private List<${pascal(toTable)}> ${camel(toTable)}List;`);
        fieldLines.push("");
      }
    }

    // Relationship fields — this table is the PK holder (other table has FK pointing here)
    for (const ref of toRefs) {
      const fromTable = ref.from.split(".")[0];
      const fromField = ref.from.split(".")[1];
      const toField   = ref.to.split(".")[1];

      if (ref.type === ">") {
        // fromTable has FK; this table is PK/one side → @OneToMany
        imports.add("java.util.List");
        fieldLines.push(`    @OneToMany(mappedBy = "${camel(table.name)}", cascade = CascadeType.ALL, orphanRemoval = true)`);
        fieldLines.push(`    private List<${pascal(fromTable)}> ${camel(fromTable)}List;`);
        fieldLines.push("");
      } else if (ref.type === "-") {
        // @OneToOne inverse side
        fieldLines.push(`    @OneToOne(mappedBy = "${camel(table.name)}", cascade = CascadeType.ALL, orphanRemoval = true)`);
        fieldLines.push(`    private ${pascal(fromTable)} ${camel(fromTable)};`);
        fieldLines.push("");
      } else if (ref.type === "<") {
        // fromTable is PK; this table has FK → @ManyToOne
        fieldLines.push(`    @ManyToOne(fetch = FetchType.LAZY)`);
        fieldLines.push(`    @JoinColumn(name = "${toField}", referencedColumnName = "${fromField}")`);
        fieldLines.push(`    private ${pascal(fromTable)} ${camel(fromTable)};`);
        fieldLines.push("");
      } else if (ref.type === "<>") {
        // @ManyToMany non-owner
        imports.add("java.util.List");
        fieldLines.push(`    @ManyToMany(mappedBy = "${camel(table.name)}List")`);
        fieldLines.push(`    private List<${pascal(fromTable)}> ${camel(fromTable)}List;`);
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
