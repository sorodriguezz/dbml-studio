"use client";
import { useEffect } from "react";
import { Check, X } from "lucide-react";

interface ToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, visible, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [visible, onClose, duration]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] fade-in">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl text-sm text-zinc-200">
        <Check size={14} className="text-emerald-400 flex-shrink-0" />
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 text-zinc-500 hover:text-zinc-300 transition-colors">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
