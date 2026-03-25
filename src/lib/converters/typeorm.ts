import type { ParsedSchema, DBMLTable, DBMLRef } from "@/types";

const TYPEORM_TYPE: Record<string, string> = {
  int:"int", integer:"int", bigint:"bigint", smallint:"smallint",
  varchar:"varchar", text:"text", char:"char",
  boolean:"boolean", bool:"boolean",
  float:"float", double:"double", decimal:"decimal", numeric:"decimal",
  date:"date", datetime:"datetime", timestamp:"timestamp", time:"time",
  json:"json", jsonb:"jsonb", uuid:"uuid",
};

const TS_TYPE: Record<string, string> = {
  int:"number", integer:"number", bigint:"bigint", smallint:"number",
  varchar:"string", text:"string", char:"string",
  boolean:"boolean", bool:"boolean",
  float:"number", double:"number", decimal:"number", numeric:"number",
  date:"Date", datetime:"Date", timestamp:"Date", time:"string",
  json:"Record<string,unknown>", jsonb:"Record<string,unknown>", uuid:"string",
};

function pascal(s: string) {
  return s.replace(/_([a-z])/g, (_,c: string) => c.toUpperCase()).replace(/^\w/, c => c.toUpperCase());
}
function base(type: string) {
  return type.replace(/\(.*\)/, "").replace(/\[\]/, "").toLowerCase();
}

function entity(table: DBMLTable, refs: DBMLRef[]): string {
  const cls = pascal(table.name);
  const lines: string[] = [];
  lines.push(`@Entity({ name: '${table.name}' })`);
  lines.push(`export class ${cls} {`);

  for (const f of table.fields) {
    const b = base(f.type);
    const ormType = TYPEORM_TYPE[b] ?? "varchar";
    const tsType = TS_TYPE[b] ?? "string";
    const opts: string[] = [];
    if (f.isUnique && !f.isPk) opts.push("unique: true");
    if (!f.isNotNull && !f.isPk) opts.push("nullable: true");
    if (f.default !== null) opts.push(`default: ${f.default}`);
    const lenM = f.type.match(/\((\d+)\)/);
    if (lenM) opts.push(`length: ${lenM[1]}`);
    if (f.note) opts.push(`comment: '${f.note}'`);
    const optsStr = opts.length ? `, { ${opts.join(", ")} }` : "";

    if (f.isPk && f.isIncrement) lines.push("  @PrimaryGeneratedColumn()");
    else if (f.isPk && b === "uuid") lines.push("  @PrimaryGeneratedColumn('uuid')");
    else if (f.isPk) lines.push("  @PrimaryColumn()");
    else lines.push(`  @Column('${ormType}'${optsStr})`);

    const nullable = !f.isNotNull && !f.isPk ? " | null" : "";
    lines.push(`  ${f.name}!: ${tsType}${nullable};\n`);
  }

  const outRefs = refs.filter(r => r.from.startsWith(table.name + ".") && (r.type === ">" || r.type === "-"));
  const inRefs  = refs.filter(r => r.to.startsWith(table.name + ".") && r.type === ">");  // type ">" = toTable is PK side

  for (const ref of outRefs) {
    const [,ff] = ref.from.split(".");
    const [tt] = ref.to.split(".");
    lines.push(`  @ManyToOne(() => ${pascal(tt)}, { nullable: true })`);
    lines.push(`  @JoinColumn({ name: '${ff}' })`);
    lines.push(`  ${tt}!: ${pascal(tt)};\n`);
  }
  for (const ref of inRefs) {
    const [ft] = ref.from.split(".");
    lines.push(`  @OneToMany(() => ${pascal(ft)}, (x) => x.${table.name})`);
    lines.push(`  ${ft}s!: ${pascal(ft)}[];\n`);
  }

  lines.push("}");
  return lines.join("\n");
}

export function toTypeORM(schema: ParsedSchema): string {
  const header = [
    "import {",
    "  Entity, PrimaryGeneratedColumn, PrimaryColumn,",
    "  Column, ManyToOne, OneToMany, JoinColumn",
    "} from 'typeorm';\n",
  ];
  return [...header, ...schema.tables.map(t => entity(t, schema.refs))].join("\n\n");
}
