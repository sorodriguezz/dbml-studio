"use client";
import { create } from "zustand";
import { parseDBML } from "@/lib/parser/dbmlParser";
import type { ParsedSchema } from "@/types";

const TABS_STORAGE_KEY = "dbml-studio-tabs";
const TABS_STORAGE_VERSION = 2; // bump to reset stale cached schemas
const MAX_TABS = 8;

export interface SchemaTab {
  id: string;
  name: string;
  dbml: string;
  parsed: ParsedSchema | null;
  isError: boolean;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_DBML = `Table users {
  id integer [pk, increment]
  username varchar(50) [not null, unique]
  email varchar(100) [not null, unique]
  password_hash varchar(255) [not null]
  role varchar(20) [default: 'user']
  avatar_url varchar(500)
  created_at timestamp [default: 'now()']
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
  created_at timestamp [default: 'now()']
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
}`;

const NEW_TAB_DBML = `Table example {
  id integer [pk, increment]
  name varchar(100) [not null]
  created_at timestamp [default: 'now()']
}`;

function makeTab(name: string, dbml = DEFAULT_DBML): SchemaTab {
  // Don't parse at module load time: avoids SSR/client hydration mismatch.
  // Parsing is triggered on the client after mount via MultiSchemaEditor.
  return { id: uid(), name, dbml, parsed: null, isError: false };
}

function saveTabs(tabs: SchemaTab[], activeId: string): void {
  try {
    const data = {
      version: TABS_STORAGE_VERSION,
      tabs: tabs.map(t => ({ id: t.id, name: t.name, dbml: t.dbml })),
      activeId,
    };
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function loadTabs(): { tabs: SchemaTab[]; activeId: string } {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(TABS_STORAGE_KEY) : null;
    if (raw) {
      const data = JSON.parse(raw) as { version?: number; tabs: Array<{ id: string; name: string; dbml: string }>; activeId: string };
      // If version mismatch, discard stale cache and use new default
      if ((data.version ?? 0) < TABS_STORAGE_VERSION) {
        localStorage.removeItem(TABS_STORAGE_KEY);
        const first = makeTab("Schema 1");
        return { tabs: [first], activeId: first.id };
      }
      if (data.tabs?.length) {
        const tabs = data.tabs.map(t => makeTab(t.name, t.dbml));
        // restore original ids
        data.tabs.forEach((t, i) => { tabs[i].id = t.id; });
        const activeId = tabs.find(t => t.id === data.activeId)?.id ?? tabs[0].id;
        return { tabs, activeId };
      }
    }
  } catch { /* ignore */ }
  const first = makeTab("Schema 1");
  return { tabs: [first], activeId: first.id };
}

interface TabsState {
  tabs: SchemaTab[];
  activeTabId: string;

  // Getters
  activeSchemaTab: () => SchemaTab | undefined;

  // Actions
  addTab: () => void;
  removeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  updateTabDBML: (id: string, dbml: string) => void;
  parseTab: (id: string) => void;
  duplicateTab: (id: string) => void;
  reorderTabs: (from: number, to: number) => void;
}

const initial = loadTabs();

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: initial.tabs,
  activeTabId: initial.activeId,

  activeSchemaTab: () => get().tabs.find(t => t.id === get().activeTabId),

  addTab: () => {
    const { tabs } = get();
    if (tabs.length >= MAX_TABS) return;
    const tab = makeTab(`Schema ${tabs.length + 1}`, NEW_TAB_DBML);
    const next = [...tabs, tab];
    saveTabs(next, tab.id);
    set({ tabs: next, activeTabId: tab.id });
  },

  removeTab: (id: string) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return; // always keep at least one
    const next = tabs.filter(t => t.id !== id);
    const nextActiveId = activeTabId === id
      ? (next[next.length - 1]?.id ?? next[0].id)
      : activeTabId;
    saveTabs(next, nextActiveId);
    set({ tabs: next, activeTabId: nextActiveId });
  },

  setActiveTabId: (id: string) => {
    saveTabs(get().tabs, id);
    set({ activeTabId: id });
  },

  renameTab: (id: string, name: string) => {
    const tabs = get().tabs.map(t => t.id === id ? { ...t, name: name.trim() || t.name } : t);
    saveTabs(tabs, get().activeTabId);
    set({ tabs });
  },

  updateTabDBML: (id: string, dbml: string) => {
    const tabs = get().tabs.map(t => t.id === id ? { ...t, dbml } : t);
    saveTabs(tabs, get().activeTabId);
    set({ tabs });
  },

  parseTab: (id: string) => {
    const tab = get().tabs.find(t => t.id === id);
    if (!tab) return;
    let parsed: ParsedSchema | null = null;
    let isError = false;
    try {
      parsed = parseDBML(tab.dbml);
      isError = parsed.errors.length > 0;
    } catch {
      isError = true;
    }
    const tabs = get().tabs.map(t => t.id === id ? { ...t, parsed, isError } : t);
    saveTabs(tabs, get().activeTabId);
    set({ tabs });
  },

  duplicateTab: (id: string) => {
    const { tabs } = get();
    if (tabs.length >= MAX_TABS) return;
    const src = tabs.find(t => t.id === id);
    if (!src) return;
    const newTab = makeTab(`${src.name} (copy)`, src.dbml);
    const idx = tabs.findIndex(t => t.id === id);
    const next = [...tabs.slice(0, idx + 1), newTab, ...tabs.slice(idx + 1)];
    saveTabs(next, newTab.id);
    set({ tabs: next, activeTabId: newTab.id });
  },

  reorderTabs: (from: number, to: number) => {
    const tabs = [...get().tabs];
    const [moved] = tabs.splice(from, 1);
    tabs.splice(to, 0, moved);
    saveTabs(tabs, get().activeTabId);
    set({ tabs });
  },
}));
