export interface DBMLField {
  name: string;
  type: string;
  isPk: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  isIncrement: boolean;
  default: string | null;
  note: string | null;
  refs: InlineRef[];
}

export interface InlineRef {
  type: RefType;
  toTable: string;
  toField: string;
}

export interface DBMLTable {
  name: string;
  alias: string | null;
  fields: DBMLField[];
  note: string | null;
  x: number;
  y: number;
}

export interface DBMLRef {
  from: string;
  to: string;
  type: RefType;
}

export interface DBMLEnum {
  name: string;
  values: string[];
  x: number;
  y: number;
}

export interface ParsedSchema {
  tables: DBMLTable[];
  refs: DBMLRef[];
  enums: DBMLEnum[];
  errors: string[];
}

export type RefType = "<" | ">" | "-" | "<>";
export type ConversionTarget = "typeorm" | "prisma" | "postgresql" | "sqlserver" | "mongodb" | "drizzle" | "sequelize" | "gorm" | "laravel" | "jpa";
export type SQLDialect = "postgresql" | "sqlserver" | "mongodb";
export type ActiveTab = "diagram" | "convert" | "import" | "diff";

export interface DiagramViewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}
