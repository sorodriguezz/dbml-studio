export { toTypeORM } from "./typeorm";
export { toPrisma } from "./prisma";
export { toSQL } from "./sql";
export { sqlToDbml } from "./sqlToDbml";

import type { ParsedSchema, ConversionTarget } from "@/types";
import { toTypeORM } from "./typeorm";
import { toPrisma } from "./prisma";
import { toSQL } from "./sql";

export function convert(schema: ParsedSchema, target: ConversionTarget): string {
  if (!schema || schema.tables.length === 0) return "// Paste valid DBML and click Parse to generate code.";
  switch (target) {
    case "typeorm": return toTypeORM(schema);
    case "prisma": return toPrisma(schema);
    case "postgresql": return toSQL(schema, "postgresql");
    case "sqlserver": return toSQL(schema, "sqlserver");
    case "mongodb": return toSQL(schema, "mongodb");
    default: return "";
  }
}
