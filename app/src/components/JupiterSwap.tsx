"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUsdcBalance } from "@/lib/useUsdcBalance";

// SOL native mint
const SOL_MINT = "So11111111111111111111111111111111111111112";
// USDC on mainnet (Jupiter uses mainnet mints)
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Jupiter?: any;
  }
}

interface JupiterSwapProps {
  /** DOM id for the integrated container */
  containerId?: string;
}

export default function JupiterSwap({
  containerId = "jupiter-swap",
}: JupiterSwapProps) {
  const { wallet, publicKey } = useWallet();
  const { refresh: refreshBalance } = useUsdcBalance();
  const initialized = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!window.Jupiter || initialized.current) return;

    // Small delay to ensure the script is fully loaded
    const timer = setTimeout(() => {
      if (!window.Jupiter) return;

      try {
        window.Jupiter.init({
          displayMode: "integrated",
          integratedTargetId: containerId,
          endpoint: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://lb.drpc.live/solana/AhgFfreYh0lckRG33JFX9MDfeHqiJSAR8YB8urWHF38a",
          formProps: {
            initialInputMint: SOL_MINT,
            initialOutputMint: USDC_MINT,
            fixedOutputMint: true,
          },
          passThroughWallet: wallet?.adapter ?? undefined,
          containerStyles: {
            maxHeight: "500px",
          },
          onSuccess: () => {
            // Refresh USDC balance after swap completes
            setTimeout(() => refreshBalance(), 3000);
          },
        });
        initialized.current = true;
      } catch (err) {
        console.error("Jupiter init error:", err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [wallet, containerId, refreshBalance, publicKey]);

  // Re-init when wallet changes
  useEffect(() => {
    initialized.current = false;
  }, [publicKey]);

  // Fallback if Jupiter doesn't load within 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialized.current) setShowFallback(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="rounded-xl overflow-hidden bg-[#111]">
      <div id={containerId} style={{ minHeight: showFallback && !initialized.current ? 0 : 300 }} />
      {showFallback && !initialized.current && (
        <div className="text-center p-8" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">Swap powered by Jupiter</p>
          <p className="text-xs mt-1">Connect your wallet to load the swap widget</p>
        </div>
      )}
    </div>
  );
}
