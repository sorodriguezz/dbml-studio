"use client";
import { useState, useCallback } from "react";
import { ArrowDownToLine, RefreshCw } from "lucide-react";
import { Button, CopyButton } from "@/components/atoms";
import { useAppStore } from "@/store/useAppStore";
import { sqlToDbml } from "@/lib/converters/sqlToDbml";

const PLACEHOLDER = `-- Paste SQL DDL here (PostgreSQL, MySQL, SQL Server)

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);`;

export function SQLImportPanel() {
  const { setDBML, parse, setActiveTab } = useAppStore();
  const [sqlInput, setSqlInput] = useState("");
  const [dbmlOutput, setDbmlOutput] = useState("");

  const handleConvert = useCallback(() => {
    if (!sqlInput.trim()) return;
    setDbmlOutput(sqlToDbml(sqlInput));
  }, [sqlInput]);

  const handleUseAsDBML = useCallback(() => {
    if (!dbmlOutput) return;
    setDBML(dbmlOutput);
    parse();
    setActiveTab("diagram");
  }, [dbmlOutput, setDBML, parse, setActiveTab]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">SQL → DBML</span>
          <span className="hidden sm:inline text-[10px] text-zinc-700 font-mono">Paste SQL DDL to convert into DBML</span>
        </div>
        <div className="flex gap-2">
          {dbmlOutput && (
            <Button variant="primary" size="sm" onClick={handleUseAsDBML}>
              <ArrowDownToLine size={12} />
              Use as DBML
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleConvert} disabled={!sqlInput.trim()}>
            <RefreshCw size={12} />
            Convert
          </Button>
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: SQL input */}
        <div className="flex-1 flex flex-col border-r border-zinc-800">
          <div className="px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/30 flex-shrink-0">
            <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">SQL Input</span>
          </div>
          <textarea
            className="flex-1 p-4 font-mono text-xs text-zinc-300 bg-transparent resize-none outline-none leading-relaxed"
            value={sqlInput}
            onChange={(e) => setSqlInput(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        {/* Right: DBML output */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/30 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">DBML Output</span>
            {dbmlOutput && <CopyButton text={dbmlOutput} />}
          </div>
          {dbmlOutput ? (
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-zinc-300 leading-relaxed bg-transparent">
              <code>{dbmlOutput}</code>
            </pre>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <div className="text-4xl mb-3 opacity-10 select-none">⇄</div>
                <p className="text-[11px] text-zinc-600 font-mono">Paste SQL on the left and click Convert</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
