"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { USDC_DEVNET_MINT } from "./anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export function useUsdcBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    setLoading(true);
    try {
      const accounts = await connection.getTokenAccountsByOwner(publicKey, {
        mint: USDC_DEVNET_MINT,
        programId: TOKEN_PROGRAM_ID,
      });

      if (accounts.value.length > 0) {
        // Parse token account data — amount is at offset 64, 8 bytes LE
        const data = accounts.value[0].account.data;
        const amount = Number(data.readBigUInt64LE(64));
        setBalance(amount / 1_000_000);
      } else {
        setBalance(0);
      }
    } catch (err) {
      console.error("Failed to fetch USDC balance:", err);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}
