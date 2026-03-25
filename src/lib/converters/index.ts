export { toTypeORM } from "./typeorm";
export { toPrisma } from "./prisma";
export { toSQL } from "./sql";
export { sqlToDbml } from "./sqlToDbml";
export { toDrizzle } from "./drizzle";
export { toSequelize } from "./sequelize";
export { toGORM } from "./gorm";
export { toLaravel } from "./laravel";
export { toJPA } from "./jpa";

import type { ParsedSchema, ConversionTarget } from "@/types";
import { toTypeORM } from "./typeorm";
import { toPrisma } from "./prisma";
import { toSQL } from "./sql";
import { toDrizzle } from "./drizzle";
import { toSequelize } from "./sequelize";
import { toGORM } from "./gorm";
import { toLaravel } from "./laravel";
import { toJPA } from "./jpa";

export function convert(schema: ParsedSchema, target: ConversionTarget): string {
  if (!schema || schema.tables.length === 0) return "// Paste valid DBML and click Parse to generate code.";
  switch (target) {
    case "typeorm":    return toTypeORM(schema);
    case "prisma":    return toPrisma(schema);
    case "postgresql": return toSQL(schema, "postgresql");
    case "sqlserver":  return toSQL(schema, "sqlserver");
    case "mongodb":    return toSQL(schema, "mongodb");
    case "drizzle":    return toDrizzle(schema);
    case "sequelize":  return toSequelize(schema);
    case "gorm":       return toGORM(schema);
    case "laravel":    return toLaravel(schema);
    case "jpa":        return toJPA(schema);
    default: return "";
  }
}
