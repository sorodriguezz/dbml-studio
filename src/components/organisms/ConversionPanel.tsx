"use client";
import { useMemo } from "react";
import { ConversionTargetTab } from "@/components/molecules";
import { CopyButton } from "@/components/atoms";
import { useAppStore } from "@/store/useAppStore";
import { convert } from "@/lib/converters";

export function ConversionPanel() {
  const { parsed, conversionTarget, setConversionTarget } = useAppStore();
  const code = useMemo(() => parsed ? convert(parsed, conversionTarget) : "// Parse DBML first.", [parsed, conversionTarget]);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <ConversionTargetTab active={conversionTarget} onChange={setConversionTarget} />
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute top-3 right-3 z-10">
          <CopyButton text={code} />
        </div>
        <pre className="h-full overflow-auto p-5 text-xs font-mono leading-relaxed bg-transparent">
          <code className="text-zinc-300">{code}</code>
        </pre>
      </div>
    </div>
  );
}
