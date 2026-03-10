"use client";
import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check } from "lucide-react";

interface DBMLCommand {
  title: string;
  description: string;
  template: string;
}

const DBML_COMMANDS: DBMLCommand[] = [
  {
    title: "Table",
    description: "Crea una tabla con sus campos",
    template: `Table table_name {
  id integer [pk, increment]
  name varchar(255) [not null]
  created_at timestamp [default: \`now()\`]
}`,
  },
  {
    title: "Enum",
    description: "Define un tipo enumerado",
    template: `Enum enum_name {
  value1
  value2
  value3
}`,
  },
  {
    title: "Ref (inline)",
    description: "Referencia inline dentro de un campo",
    template: `Table orders {
  id integer [pk]
  user_id integer [ref: > users.id]
}`,
  },
  {
    title: "Ref (top-level)",
    description: "Referencia definida fuera de la tabla",
    template: `Ref: orders.user_id > users.id`,
  },
  {
    title: "Ref: Uno a muchos (>)",
    description: "Muchos registros de la tabla actual apuntan a uno",
    template: `Ref: posts.author_id > users.id`,
  },
  {
    title: "Ref: Muchos a uno (<)",
    description: "Un registro de la tabla actual tiene muchos relacionados",
    template: `Ref: users.id < posts.author_id`,
  },
  {
    title: "Ref: Uno a uno (-)",
    description: "Relación directa uno a uno",
    template: `Ref: users.id - profiles.user_id`,
  },
  {
    title: "Ref: Muchos a muchos (<>)",
    description: "Relación muchos a muchos",
    template: `Ref: students.id <> courses.id`,
  },
  {
    title: "Campo con constraints",
    description: "Campo con múltiples restricciones",
    template: `Table example {
  id integer [pk, increment]
  email varchar(255) [not null, unique]
  role varchar(20) [default: 'user']
  bio text [note: 'User biography']
}`,
  },
  {
    title: "Primary Key (pk)",
    description: "Marca un campo como clave primaria",
    template: `id integer [pk, increment]`,
  },
  {
    title: "Not Null",
    description: "El campo no acepta valores nulos",
    template: `name varchar(100) [not null]`,
  },
  {
    title: "Unique",
    description: "El campo debe tener valores únicos",
    template: `email varchar(255) [unique]`,
  },
  {
    title: "Default",
    description: "Valor por defecto del campo",
    template: `created_at timestamp [default: \`now()\`]
status varchar(20) [default: 'active']
count integer [default: 0]`,
  },
  {
    title: "Increment",
    description: "Auto-incremento para campos numéricos",
    template: `id integer [pk, increment]`,
  },
  {
    title: "Note (campo)",
    description: "Agrega una nota descriptiva a un campo",
    template: `email varchar(255) [note: 'Email del usuario']`,
  },
  {
    title: "Note (tabla)",
    description: "Agrega una nota descriptiva a una tabla",
    template: `Table users {
  Note: 'Tabla de usuarios del sistema'
  id integer [pk]
  name varchar(100)
}`,
  },
  {
    title: "Alias de tabla",
    description: "Define un alias corto para la tabla",
    template: `Table very_long_table_name as T {
  id integer [pk]
}`,
  },
  {
    title: "Tipos comunes",
    description: "Tipos de datos frecuentes en DBML",
    template: `Table types_example {
  id integer [pk]
  name varchar(255)
  description text
  price decimal
  is_active boolean
  data json
  created_at timestamp
  birth_date date
}`,
  },
];

interface DBMLReferenceModalProps {
  open: boolean;
  onClose: () => void;
}

export function DBMLReferenceModal({ open, onClose }: DBMLReferenceModalProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleCopy = useCallback(async (template: string, title: string, idx: number) => {
    await navigator.clipboard.writeText(template);
    setCopiedIdx(idx);
    setToast(`"${title}" copiado al portapapeles`);
    setTimeout(() => {
      setCopiedIdx(null);
      setToast(null);
    }, 2000);
  }, []);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Referencia DBML</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">Haz clic en cualquier comando para copiar su estructura</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Commands list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {DBML_COMMANDS.map((cmd, idx) => (
            <button
              key={idx}
              onClick={() => handleCopy(cmd.template, cmd.title, idx)}
              className="w-full text-left group rounded-lg border border-zinc-800 hover:border-amber-500/30 bg-zinc-800/40 hover:bg-zinc-800/80 transition-all p-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-400 font-mono">{cmd.title}</span>
                  <span className="text-[10px] text-zinc-500">—</span>
                  <span className="text-[10px] text-zinc-400">{cmd.description}</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-zinc-600 group-hover:text-amber-400 transition-colors">
                  {copiedIdx === idx ? (
                    <><Check size={10} className="text-emerald-400" /> ¡Copiado!</>
                  ) : (
                    <><Copy size={10} /> Copiar</>
                  )}
                </span>
              </div>
              <pre className="text-[11px] text-zinc-500 group-hover:text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap transition-colors">
                {cmd.template}
              </pre>
            </button>
          ))}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[100] fade-in">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-emerald-500/30 rounded-lg shadow-xl text-xs text-emerald-400">
              <Check size={12} />
              {toast}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
