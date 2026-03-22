"use client";

import { useEffect, useState } from "react";
import JupiterSwap from "./JupiterSwap";

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortfall: number;
}

type Tab = "swap" | "bridge";

const JUMPER_EMBED_URL =
  "https://jumper.exchange/?toChain=sol&toToken=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&theme=dark";

export default function TopUpModal({
  isOpen,
  onClose,
  shortfall,
}: TopUpModalProps) {
  const [tab, setTab] = useState<Tab>("swap");
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setIframeLoaded(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#1a1a1a] border border-gray-700 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Top Up USDC</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
          <p className="text-red-300 text-sm">
            You need <strong>{shortfall.toFixed(2)} more USDC</strong> to fund
            this job.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setTab("swap")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "swap"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Swap SOL &rarr; USDC
          </button>
          <button
            onClick={() => setTab("bridge")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "bridge"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Bridge (Any Chain)
          </button>
        </div>

        {/* Swap tab — Jupiter */}
        {tab === "swap" && (
          <>
            <p className="text-gray-400 text-sm">
              Swap SOL to USDC instantly via Jupiter.
            </p>
            <JupiterSwap containerId="topup-jupiter" />
          </>
        )}

        {/* Bridge tab — LI.FI / Jumper */}
        {tab === "bridge" && (
          <>
            <p className="text-gray-400 text-sm">
              Bridge tokens from any chain to Solana USDC via LI.FI.
            </p>
            <div
              className="rounded-xl overflow-hidden bg-[#111] relative"
              style={{ height: 440 }}
            >
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full" />
                </div>
              )}
              <iframe
                src={JUMPER_EMBED_URL}
                width="100%"
                height="440"
                style={{ border: "none", borderRadius: "12px" }}
                allow="clipboard-write"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                onLoad={() => setIframeLoaded(true)}
              />
            </div>
          </>
        )}

        <p className="text-xs text-gray-500 text-center">
          {tab === "swap"
            ? "Powered by Jupiter"
            : "Powered by LI.FI \u00b7 Bridge from any chain"}
        </p>
      </div>
    </div>
  );
}
