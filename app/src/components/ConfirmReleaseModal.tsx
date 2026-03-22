"use client";

import { useState, useEffect } from "react";

interface ConfirmReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: string;
  loading?: boolean;
}

export default function ConfirmReleaseModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  loading = false,
}: ConfirmReleaseModalProps) {
  const [checked, setChecked] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) setChecked(false);
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative max-w-md w-full mx-4 rounded-2xl p-6 space-y-5 animate-slide-up"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
        }}
      >
        <h3
          className="text-lg font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Confirm Payment Release
        </h3>

        <div
          className="rounded-xl p-4 text-center"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-3xl font-bold"
            style={{ color: "var(--accent)" }}
          >
            {amount} USDC
          </div>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            will be released to the freelancer
          </p>
        </div>

        <div
          className="rounded-lg p-3 flex items-start gap-2"
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
          }}
        >
          <span className="text-amber-400 text-sm shrink-0 mt-0.5">
            &#9888;
          </span>
          <p className="text-sm" style={{ color: "var(--warning, #F59E0B)" }}>
            Once released, payments cannot be reversed. This action is
            permanent and settled on-chain.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 accent-purple-600 w-4 h-4"
          />
          <span
            className="text-sm leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            I confirm I am satisfied with the work delivered and want to release
            the payment.
          </span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-ghost flex-1 py-2.5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!checked || loading}
            className="flex-1 py-2.5 rounded-lg font-semibold text-white transition-colors disabled:opacity-40"
            style={{
              background: checked ? "#EF4444" : "rgba(239,68,68,0.3)",
            }}
          >
            {loading ? "Releasing..." : "Release Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
