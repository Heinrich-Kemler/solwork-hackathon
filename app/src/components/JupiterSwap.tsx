"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!window.Jupiter || initialized.current) return;

    // Small delay to ensure the script is fully loaded
    const timer = setTimeout(() => {
      if (!window.Jupiter) return;

      try {
        window.Jupiter.init({
          displayMode: "integrated",
          integratedTargetId: containerId,
          endpoint: "https://api.mainnet-beta.solana.com",
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

  return (
    <div className="rounded-xl overflow-hidden bg-[#111]">
      <div id={containerId} style={{ minHeight: 300 }} />
    </div>
  );
}
