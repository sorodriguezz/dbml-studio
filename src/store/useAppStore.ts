"use client";
import { create } from "zustand";
import { parseDBML } from "@/lib/parser/dbmlParser";
import { formatDBML as fmt } from "@/lib/utils/formatDBML";
import type { ParsedSchema, ActiveTab, ConversionTarget, DBMLTable, DBMLEnum } from "@/types";

const HISTORY_KEY = "dbml-studio-history";
const HISTORY_MAX = 20;

export interface HistoryItem {
  dbml: string;
  ts: number;
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(HISTORY_KEY) : null;
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch { /* ignore */ }
}

interface AppState {
  // DBML source
  dbml: string;
  parsed: ParsedSchema | null;
  isParsingError: boolean;

  // History
  history: HistoryItem[];

  // UI state
  activeTab: ActiveTab;
  conversionTarget: ConversionTarget;
  selectedTable: string | null;
  hoveredRef: { from: string; to: string } | null;

  // Diagram viewport
  offsetX: number;
  offsetY: number;
  zoom: number;

  // Actions
  setDBML: (v: string) => void;
  parse: () => void;
  formatDBML: () => void;
  setActiveTab: (t: ActiveTab) => void;
  setConversionTarget: (t: ConversionTarget) => void;
  selectTable: (name: string | null) => void;
  setHoveredRef: (ref: { from: string; to: string } | null) => void;
  setViewport: (offsetX: number, offsetY: number, zoom?: number) => void;
  setZoom: (z: number) => void;
  moveTable: (name: string, x: number, y: number) => void;
  moveEnum: (name: string, x: number, y: number) => void;
  resetViewport: () => void;
  reLayout: () => void;
  centerViewport: (containerWidth: number, containerHeight: number) => void;
  addToHistory: (dbml: string) => void;
  restoreFromHistory: (index: number) => void;
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
  history: loadHistory(),
  activeTab: "diagram",
  conversionTarget: "typeorm",
  selectedTable: null,
  hoveredRef: null,
  offsetX: 0,
  offsetY: 0,
  zoom: 1,

  setDBML: (v) => set({ dbml: v }),

  parse: () => {
    try {
      const result = parseDBML(get().dbml);
      set({ parsed: result, isParsingError: result.errors.length > 0 });
      get().addToHistory(get().dbml);
    } catch {
      set({ isParsingError: true });
    }
  },

  formatDBML: () => {
    set({ dbml: fmt(get().dbml) });
  },

  addToHistory: (dbml: string) => {
    const current = get().history;
    if (current.length > 0 && current[0].dbml === dbml) return;
    const next = [{ dbml, ts: Date.now() }, ...current].slice(0, HISTORY_MAX);
    saveHistory(next);
    set({ history: next });
  },

  restoreFromHistory: (index: number) => {
    const item = get().history[index];
    if (!item) return;
    set({ dbml: item.dbml });
    try {
      const result = parseDBML(item.dbml);
      set({ parsed: result, isParsingError: result.errors.length > 0 });
    } catch {
      set({ isParsingError: true });
    }
  },

  setActiveTab: (t) => set({ activeTab: t }),
  setConversionTarget: (t) => set({ conversionTarget: t }),
  setHoveredRef: (ref) => set({ hoveredRef: ref }),
  selectTable: (name) => set({ selectedTable: name }),

  setViewport: (offsetX, offsetY, zoom) =>
    set((s) => ({ offsetX, offsetY, zoom: zoom !== undefined ? zoom : s.zoom })),

  setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(2.5, z)) }),

  moveTable: (name, x, y) =>
    set((s) => {
      if (!s.parsed) return s;
      const tables = s.parsed.tables.map((t: DBMLTable) =>
        t.name === name ? { ...t, x, y } : t
      );
      return { parsed: { ...s.parsed, tables } };
    }),

  moveEnum: (name, x, y) =>
    set((s) => {
      if (!s.parsed) return s;
      const enums = s.parsed.enums.map((en: DBMLEnum) =>
        en.name === name ? { ...en, x, y } : en
      );
      return { parsed: { ...s.parsed, enums } };
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

      const heights = s.parsed.tables.map(
        (t: DBMLTable) => HEADER_H + t.fields.length * FIELD_H
      );

      const rowHeights: number[] = [];
      for (let i = 0; i < s.parsed.tables.length; i++) {
        const row = Math.floor(i / COLS);
        rowHeights[row] = Math.max(rowHeights[row] ?? 0, heights[i]);
      }

      const rowY: number[] = [GAP_Y];
      for (let r = 1; r < rowHeights.length; r++) {
        rowY[r] = rowY[r - 1] + rowHeights[r - 1] + GAP_Y;
      }

      const tables = s.parsed.tables.map((t: DBMLTable, i: number) => ({
        ...t,
        x: (i % COLS) * (TABLE_W + GAP_X) + GAP_Y,
        y: rowY[Math.floor(i / COLS)],
      }));

      // Place enums to the right of all tables
      const ENUM_W = 200;
      const ENUM_HEADER_H = 32;
      const ENUM_VALUE_H = 24;
      let maxTableX = 0;
      tables.forEach(t => { maxTableX = Math.max(maxTableX, t.x + TABLE_W); });
      const enumX = maxTableX + GAP_X;
      let enumY = GAP_Y;
      const enums = s.parsed.enums.map((en: DBMLEnum) => {
        const enumH = ENUM_HEADER_H + en.values.length * ENUM_VALUE_H;
        const placed = { ...en, x: enumX, y: enumY };
        enumY += enumH + GAP_Y;
        return placed;
      });
      void ENUM_W;

      return { parsed: { ...s.parsed, tables, enums }, offsetX: 0, offsetY: 0 };
    }),

  centerViewport: (containerWidth, containerHeight) =>
    set((s) => {
      if (!s.parsed || s.parsed.tables.length === 0) return s;
      const TABLE_W = 260;
      const HEADER_H = 40;
      const FIELD_H = 32;
      const tables = s.parsed.tables;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const t of tables) {
        minX = Math.min(minX, t.x);
        minY = Math.min(minY, t.y);
        maxX = Math.max(maxX, t.x + TABLE_W);
        maxY = Math.max(maxY, t.y + HEADER_H + t.fields.length * FIELD_H);
      }
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const offsetX = (containerWidth - contentW * s.zoom) / 2 - minX * s.zoom;
      const offsetY = (containerHeight - contentH * s.zoom) / 2 - minY * s.zoom;
      return { offsetX, offsetY };
    }),
}));
