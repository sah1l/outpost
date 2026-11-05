"use client";

import { Check, CircleAlert } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Tone = "default" | "error";

type ShowToast = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: Tone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((message, tone = "default") => {
    if (timer.current) clearTimeout(timer.current);
    nextId.current += 1;
    setToast({ id: nextId.current, message, tone });
    // Errors stay up longer, since they usually ask you to do something.
    timer.current = setTimeout(() => setToast(null), tone === "error" ? 5000 : 2200);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className="toast flex max-w-md items-center gap-2 rounded-lg border border-line bg-raised px-3.5 py-2.5 text-[13px] font-medium text-ink shadow-overlay"
          >
            {toast.tone === "error" ? (
              <CircleAlert size={15} className="shrink-0 text-danger" aria-hidden="true" />
            ) : (
              <Check size={15} className="shrink-0 text-ok" aria-hidden="true" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
