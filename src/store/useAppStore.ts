"use client";
import { create } from "zustand";
import { parseDBML } from "@/lib/parser/dbmlParser";
import type { ParsedSchema, ActiveTab, ConversionTarget, DBMLTable } from "@/types";

interface AppState {
  // DBML source
  dbml: string;
  parsed: ParsedSchema | null;
  isParsingError: boolean;

  // UI state
  activeTab: ActiveTab;
  conversionTarget: ConversionTarget;
  selectedTable: string | null;

  // Diagram viewport
  offsetX: number;
  offsetY: number;
  zoom: number;

  // Actions
  setDBML: (v: string) => void;
  parse: () => void;
  setActiveTab: (t: ActiveTab) => void;
  setConversionTarget: (t: ConversionTarget) => void;
  selectTable: (name: string | null) => void;
  setViewport: (offsetX: number, offsetY: number, zoom?: number) => void;
  setZoom: (z: number) => void;
  moveTable: (name: string, x: number, y: number) => void;
  resetViewport: () => void;
  reLayout: () => void;
}

const SAMPLE_DBML = `Table users {
  id integer [pk, increment]
  username varchar(50) [not null, unique]
  email varchar(100) [not null, unique]
  password_hash varchar(255) [not null]
  role varchar(20) [default: 'user']
  avatar_url varchar(500)
  created_at timestamp [default: \'now()\']
  updated_at timestamp
}

Table posts {
  id integer [pk, increment]
  title varchar(200) [not null]
  slug varchar(200) [not null, unique]
  body text
  author_id integer [ref: > users.id]
  published boolean [default: false]
  views integer [default: 0]
  created_at timestamp [default: \'now()\']
}

Table comments {
  id integer [pk, increment]
  post_id integer [ref: > posts.id]
  user_id integer [ref: > users.id]
  content text [not null]
  is_deleted boolean [default: false]
  created_at timestamp
}

Table tags {
  id integer [pk, increment]
  name varchar(50) [not null, unique]
  color varchar(7)
}

Table post_tags {
  post_id integer [ref: > posts.id]
  tag_id integer [ref: > tags.id]
}

Table categories {
  id integer [pk, increment]
  name varchar(100) [not null]
  parent_id integer [ref: > categories.id]
}

Table post_categories {
  post_id integer [ref: > posts.id]
  category_id integer [ref: > categories.id]
}`;

export const useAppStore = create<AppState>((set, get) => ({
  dbml: SAMPLE_DBML,
  parsed: null,
  isParsingError: false,
  activeTab: "diagram",
  conversionTarget: "typeorm",
  selectedTable: null,
  offsetX: 0,
  offsetY: 0,
  zoom: 1,

  setDBML: (v) => set({ dbml: v }),

  parse: () => {
    try {
      const result = parseDBML(get().dbml);
      set({ parsed: result, isParsingError: result.errors.length > 0 });
    } catch {
      set({ isParsingError: true });
    }
  },

  setActiveTab: (t) => set({ activeTab: t }),
  setConversionTarget: (t) => set({ conversionTarget: t }),
  selectTable: (name) => set({ selectedTable: name }),

  setViewport: (offsetX, offsetY, zoom) =>
    set((s) => ({ offsetX, offsetY, zoom: zoom !== undefined ? zoom : s.zoom })),

  setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(2.5, z)) }),

  moveTable: (name, x, y) =>
    set((s) => {
      if (!s.parsed) return s;
      const tables = s.parsed.tables.map((t: DBMLTable) =>
        t.name === name ? { ...t, x: Math.max(0, x), y: Math.max(0, y) } : t
      );
      return { parsed: { ...s.parsed, tables } };
    }),

  resetViewport: () => set({ offsetX: 0, offsetY: 0, zoom: 1 }),

  reLayout: () =>
    set((s) => {
      if (!s.parsed) return s;
      const HEADER_H = 40;
      const FIELD_H = 32;
      const TABLE_W = 260;
      const GAP_X = 100;
      const GAP_Y = 60;
      const COLS = Math.max(1, Math.ceil(Math.sqrt(s.parsed.tables.length)));

      // Calculate actual height per table
      const heights = s.parsed.tables.map(
        (t: DBMLTable) => HEADER_H + t.fields.length * FIELD_H
      );

      // For each row, find the tallest table to set proper row height
      const rowHeights: number[] = [];
      for (let i = 0; i < s.parsed.tables.length; i++) {
        const row = Math.floor(i / COLS);
        rowHeights[row] = Math.max(rowHeights[row] ?? 0, heights[i]);
      }

      // Cumulative Y offsets per row
      const rowY: number[] = [GAP_Y];
      for (let r = 1; r < rowHeights.length; r++) {
        rowY[r] = rowY[r - 1] + rowHeights[r - 1] + GAP_Y;
      }

      const tables = s.parsed.tables.map((t: DBMLTable, i: number) => ({
        ...t,
        x: (i % COLS) * (TABLE_W + GAP_X) + GAP_Y,
        y: rowY[Math.floor(i / COLS)],
      }));
      return { parsed: { ...s.parsed, tables }, offsetX: 0, offsetY: 0 };
    }),
}));
