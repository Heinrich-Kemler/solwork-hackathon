"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { explorerUrl } from "./anchor";

export interface TxRecord {
  signature: string;
  blockTime: number | null;
  explorerUrl: string;
  status: "success" | "error";
}

export function useTxHistory(limit = 10) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [transactions, setTransactions] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!publicKey) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const sigs = await connection.getSignaturesForAddress(publicKey, {
        limit,
      });

      const records: TxRecord[] = sigs.map((sig) => ({
        signature: sig.signature,
        blockTime: sig.blockTime ?? null,
        explorerUrl: explorerUrl(sig.signature),
        status: sig.err ? "error" : "success",
      }));

      setTransactions(records);
    } catch (err) {
      console.error("Failed to fetch tx history:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { transactions, loading, refresh: fetchHistory };
}
