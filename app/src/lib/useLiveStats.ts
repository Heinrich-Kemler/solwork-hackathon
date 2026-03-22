"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PROGRAM_ID } from "./anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

export interface LiveStats {
  totalJobs: number;
  totalUsdcLocked: number;
  totalCompleted: number;
}

// Job discriminator: sha256("account:Job")[0..8] = [75, 124, 80, 203, 161, 180, 202, 80]
const JOB_DISCRIMINATOR = bs58.encode(
  Buffer.from([75, 124, 80, 203, 161, 180, 202, 80])
);

/**
 * Fetches aggregate stats from all Job accounts on-chain.
 * Single RPC call with discriminator filter. Refreshes every 60s.
 */
export function useLiveStats() {
  const { connection } = useConnection();
  const [stats, setStats] = useState<LiveStats>({
    totalJobs: 0,
    totalUsdcLocked: 0,
    totalCompleted: 0,
  });
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { memcmp: { offset: 0, bytes: JOB_DISCRIMINATOR } },
        ],
      });

      let totalJobs = 0;
      let totalUsdcLocked = 0;
      let totalCompleted = 0;

      for (const acc of accounts) {
        const data = acc.account.data;
        if (data.length < 50) continue;

        totalJobs++;

        try {
          // Borsh layout after 8-byte discriminator:
          // title: 4-byte length prefix + string bytes
          // description: 4-byte length prefix + string bytes
          // amount: u64 (8 bytes)
          // client: pubkey (32 bytes)
          // freelancer: pubkey (32 bytes)
          // status: 1 byte enum index
          const titleLen = data.readUInt32LE(8);
          const descLen = data.readUInt32LE(8 + 4 + titleLen);
          const amountOffset = 8 + 4 + titleLen + 4 + descLen;

          if (amountOffset + 8 <= data.length) {
            const amount = Number(data.readBigUInt64LE(amountOffset));
            totalUsdcLocked += amount / 1_000_000;
          }

          // Status byte: amount(8) + client(32) + freelancer(32) past amountOffset
          const statusOffset = amountOffset + 8 + 32 + 32;
          if (statusOffset < data.length) {
            const status = data[statusOffset];
            // 3 = Complete
            if (status === 3) totalCompleted++;
          }
        } catch {
          // Skip malformed accounts
        }
      }

      setStats({ totalJobs, totalUsdcLocked, totalCompleted });
    } catch (err) {
      console.error("Failed to fetch live stats:", err);
      // Keep previous stats on error instead of zeroing out
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [connection]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60_000); // 60s to avoid rate limiting
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading };
}
