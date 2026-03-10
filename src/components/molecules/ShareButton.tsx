"use client";
import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Share2, Link, Check, Copy, X, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/atoms";
import { useAppStore } from "@/store/useAppStore";
import { encodeDBMLToUrl } from "@/lib/utils/shareUrl";

const URL_WARN_LENGTH = 3000;
const URL_DANGER_LENGTH = 8000;

export function ShareButton() {
  const { dbml } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    const url = encodeDBMLToUrl(dbml);
    setShareUrl(url);
    setShowModal(true);
    setCopied(false);
  }, [dbml]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleExportFile = useCallback(() => {
    const blob = new Blob([dbml], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema-${Date.now()}.dbml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [dbml]);

  const urlLength = shareUrl.length;
  const isWarn = urlLength > URL_WARN_LENGTH;
  const isDanger = urlLength > URL_DANGER_LENGTH;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleShare} title="Share diagram">
        <Share2 size={12} />
        <span className="hidden sm:inline">Share</span>
      </Button>

      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Link size={16} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Compartir diagrama</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-zinc-400">
                El contenido DBML está comprimido en la URL. Cualquiera con este enlace puede ver tu diagrama.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 font-mono truncate focus:outline-none focus:border-amber-500/50"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button variant="primary" size="sm" onClick={handleCopy}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "¡Copiado!" : "Copiar"}
                </Button>
              </div>

              {/* URL length indicator */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-zinc-600">
                  No se almacena nada en ningún servidor. Todo el contenido viaja en la URL.
                </p>
                <span className={`text-[10px] font-mono flex-shrink-0 ml-2 ${isDanger ? "text-red-400" : isWarn ? "text-amber-400" : "text-zinc-600"}`}>
                  {urlLength.toLocaleString()} chars
                </span>
              </div>

              {/* Warning for long URLs */}
              {isWarn && (
                <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${isDanger ? "bg-red-950/30 border-red-900/40 text-red-400" : "bg-amber-950/30 border-amber-900/40 text-amber-400"}`}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {isDanger ? "URL demasiado larga" : "URL larga"}
                    </p>
                    <p className={`mt-1 ${isDanger ? "text-red-400/70" : "text-amber-400/70"}`}>
                      {isDanger
                        ? "La URL podría no funcionar en algunos navegadores o servicios de mensajería. Se recomienda compartir el archivo .dbml directamente."
                        : "Algunos servicios de mensajería (WhatsApp, Slack, etc.) podrían truncar esta URL. Considera compartir el archivo .dbml si no funciona."}
                    </p>
                    <button
                      onClick={handleExportFile}
                      className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium hover:underline ${isDanger ? "text-red-300" : "text-amber-300"}`}
                    >
                      <Download size={12} />
                      Descargar archivo .dbml
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
