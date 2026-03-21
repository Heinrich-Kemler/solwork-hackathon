"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import {
  getProvider,
  getProgram,
  parseEscrowStatus,
  lamportsToSol,
  type EscrowAccount,
} from "./anchor";

export function useEscrows() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [escrows, setEscrows] = useState<EscrowAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEscrows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!wallet) {
        // Fetch without wallet (read-only) - use a dummy provider
        setEscrows([]);
        setLoading(false);
        return;
      }

      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts = await (program.account as any).escrow.all();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: EscrowAccount[] = accounts.map((acc: any) => ({
        publicKey: acc.publicKey,
        client: acc.account.client,
        freelancer: acc.account.freelancer,
        amount: acc.account.amount,
        jobTitle: acc.account.jobTitle,
        jobDescription: acc.account.jobDescription,
        status: parseEscrowStatus(acc.account.status),
        bump: acc.account.bump,
        vaultBump: acc.account.vaultBump,
        createdAt: acc.account.createdAt,
      }));

      // Sort by creation time, newest first
      parsed.sort((a, b) => b.createdAt.toNumber() - a.createdAt.toNumber());

      setEscrows(parsed);
    } catch (err) {
      console.error("Failed to fetch escrows:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch escrows");
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

  return { escrows, loading, error, refresh: fetchEscrows };
}

export function useSingleEscrow(escrowPubkey: string) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [escrow, setEscrow] = useState<EscrowAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEscrow = useCallback(async () => {
    if (!wallet || !escrowPubkey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { PublicKey } = await import("@solana/web3.js");
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);

      const pubkey = new PublicKey(escrowPubkey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acc = await (program.account as any).escrow.fetch(pubkey);

      setEscrow({
        publicKey: pubkey,
        client: acc.client,
        freelancer: acc.freelancer,
        amount: acc.amount,
        jobTitle: acc.jobTitle,
        jobDescription: acc.jobDescription,
        status: parseEscrowStatus(acc.status),
        bump: acc.bump,
        vaultBump: acc.vaultBump,
        createdAt: acc.createdAt,
      });
    } catch (err) {
      console.error("Failed to fetch escrow:", err);
      setError(err instanceof Error ? err.message : "Escrow not found");
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, escrowPubkey]);

  useEffect(() => {
    fetchEscrow();
  }, [fetchEscrow]);

  return { escrow, loading, error, refresh: fetchEscrow };
}
