"use client";

import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from "react";
import { explorerUrl } from "@/lib/anchor";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  txSignature?: string;
}

interface ToastContextType {
  showToast: (message: string, type: Toast["type"], txSignature?: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: Toast["type"], txSignature?: string) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type, txSignature }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm animate-slide-up ${
              toast.type === "success"
                ? "bg-green-900/90 border-green-700 text-green-100"
                : toast.type === "error"
                ? "bg-red-900/90 border-red-700 text-red-100"
                : "bg-gray-800/90 border-gray-700 text-gray-100"
            }`}
          >
            <p className="text-sm font-medium">{toast.message}</p>
            {toast.txSignature && (
              <a
                href={explorerUrl(toast.txSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 underline mt-1 inline-block"
              >
                View on Explorer &rarr;
              </a>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
