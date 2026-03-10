# DBML Studio

Visualize and convert DBML schemas — built with Next.js 14, Tailwind CSS, Zustand, and @dbml/core.

## Features

- **Interactive Diagram** — drag tables, pan, zoom (scroll wheel), auto-layout
- **Live Editor** — debounced auto-parse as you type
- **Converters** — TypeORM, Prisma, PostgreSQL, SQL Server, MongoDB
- **Export PNG** — capture the full diagram
- **Table Inspector** — field details and relationship view

## Setup

```bash
npm install
npm run dev
```

## Architecture

Follows **Atomic Design**:
- `atoms/` — Badge, Button, CopyButton, Tooltip
- `molecules/` — FieldRow, ConversionTargetTab, TableStats
- `organisms/` — DiagramCanvas, DBMLEditor, ConversionPanel, TableCard, TableInspector
- `templates/` — AppTemplate (layout composition)
- `lib/` — parser, converters, hooks, utils (pure business logic)
- `store/` — Zustand store (single source of truth)
- `types/` — shared TypeScript interfaces

## Parser Strategy

1. Tries `@dbml/core` Parser first (full spec: enums, complex types, all ref syntax)
2. Falls back to a battle-tested regex parser for edge cases

## Notes

- No localStorage/session; all state is in-memory and resets on refresh
- Drag interaction tracked via `useRef` to avoid stale closures on `mousemove`
- `useMemo` on ref line calculations — stable for 50+ table schemas
