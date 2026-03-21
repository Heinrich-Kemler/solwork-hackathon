"use client";

import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, type Connection } from "@solana/web3.js";

// Cache to avoid repeated lookups
const snsCache = new Map<string, string | null>();

/**
 * Resolve a wallet address to a .sol domain name.
 * Returns "name.sol" if found, null otherwise.
 */
export async function resolveSNS(
  connection: Connection,
  walletAddress: string
): Promise<string | null> {
  if (snsCache.has(walletAddress)) {
    return snsCache.get(walletAddress) ?? null;
  }

  try {
    const { performReverseLookup } = await import("@bonfida/spl-name-service");
    const pubkey = new PublicKey(walletAddress);
    const name = await performReverseLookup(connection, pubkey);
    const result = name ? `${name}.sol` : null;
    snsCache.set(walletAddress, result);
    return result;
  } catch {
    snsCache.set(walletAddress, null);
    return null;
  }
}

/**
 * Hook to resolve a wallet address to .sol name.
 */
export function useSNS(walletAddress: string | null) {
  const { connection } = useConnection();
  const [solName, setSolName] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setSolName(null);
      return;
    }

    resolveSNS(connection, walletAddress).then(setSolName);
  }, [connection, walletAddress]);

  return solName;
}
