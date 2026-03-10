import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Dark theme for DBML with amber/zinc colors matching the app
export const dbmlTheme = EditorView.theme({
  "&": {
    color: "#d4d4d8", // zinc-300
    backgroundColor: "transparent",
    fontSize: "12px",
    fontFamily: "ui-monospace, monospace",
  },
  ".cm-content": {
    caretColor: "#fbbf24", // amber-400
    padding: "16px",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#fbbf24", // amber-400
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "#f59e0b40", // amber-500 with opacity
  },
  ".cm-selectionBackground": {
    backgroundColor: "#f59e0b30",
  },
  ".cm-activeLine": {
    backgroundColor: "#27272a30", // zinc-800 with opacity
  },
  ".cm-gutters": {
    backgroundColor: "#18181b", // zinc-900
    color: "#52525b", // zinc-600
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#27272a", // zinc-800
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px",
    minWidth: "40px",
  }
}, { dark: true });

// Syntax highlighting styles
export const dbmlHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#c084fc", fontWeight: "bold" }, // purple-400 - Table, Ref, Enum
  { tag: t.typeName, color: "#60a5fa" }, // blue-400 - integer, varchar, etc
  { tag: t.attributeName, color: "#fb923c" }, // orange-400 - pk, not null, etc
  { tag: t.string, color: "#86efac" }, // green-300
  { tag: t.comment, color: "#71717a", fontStyle: "italic" }, // zinc-500
  { tag: t.number, color: "#fbbf24" }, // amber-400
  { tag: t.operator, color: "#f59e0b" }, // amber-500 - <, >, -
  { tag: t.punctuation, color: "#a1a1aa" }, // zinc-400
  { tag: t.bracket, color: "#d4d4d8" }, // zinc-300
  { tag: t.variableName, color: "#e4e4e7" }, // zinc-200
]);

export const dbmlExtensions: Extension[] = [
  dbmlTheme,
  syntaxHighlighting(dbmlHighlightStyle),
];
