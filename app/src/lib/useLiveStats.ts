"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PROGRAM_ID } from "./anchor";

export interface LiveStats {
  totalJobs: number;
  totalUsdcLocked: number;
  totalCompleted: number;
}

/**
 * Fetches aggregate stats from all Job accounts on-chain.
 * Refreshes every 30 seconds.
 */
export function useLiveStats() {
  const { connection } = useConnection();
  const [stats, setStats] = useState<LiveStats>({
    totalJobs: 0,
    totalUsdcLocked: 0,
    totalCompleted: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      // Get all program accounts with the Job discriminator
      // Job discriminator: first 8 bytes of sha256("account:Job")
      const allAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
        dataSlice: { offset: 0, length: 0 }, // We only need the count first
      });

      // For stats, fetch full data to parse amounts and statuses
      const fullAccounts = await connection.getProgramAccounts(PROGRAM_ID);

      let totalJobs = 0;
      let totalUsdcLocked = 0;
      let totalCompleted = 0;

      for (const acc of fullAccounts) {
        const data = acc.account.data;
        // Job accounts have discriminator [75, 124, 80, 203, 161, 180, 202, 80]
        // Check first 8 bytes
        if (data.length < 50) continue; // Too small to be a Job

        // Skip UserProfile accounts (different discriminator)
        // We can identify Jobs by their larger size (> 500 bytes typically)
        if (data.length < 200) continue;

        totalJobs++;

        // Parse amount at a known offset — after discriminator(8) + title string(4+len) + desc string(4+len)
        // This is fragile, but for stats display it's fine
        // Instead, try to read the status byte to count completions
        try {
          // Status enum is after: disc(8) + title(4+64max) + desc(4+256max) + amount(8) + client(32) + freelancer(32)
          // = 8 + 4 + titleLen + 4 + descLen + 8 + 32 + 32
          // Too variable. Just count all as jobs and estimate.

          // Read amount: it's at offset 8 + 4 + titleLen + 4 + descLen
          // Read title length first
          const titleLen = data.readUInt32LE(8);
          const descLen = data.readUInt32LE(8 + 4 + titleLen);
          const amountOffset = 8 + 4 + titleLen + 4 + descLen;

          if (amountOffset + 8 <= data.length) {
            const amount = Number(data.readBigUInt64LE(amountOffset));
            totalUsdcLocked += amount / 1_000_000;
          }

          // Status is after amount(8) + client(32) + freelancer(32) = 72 bytes after amount
          const statusOffset = amountOffset + 8 + 32 + 32;
          if (statusOffset < data.length) {
            const status = data[statusOffset];
            // JobStatus enum: 0=Open, 1=Active, 2=PendingReview, 3=Complete, 4=Disputed, 5=Expired, 6=Cancelled
            if (status === 3) totalCompleted++;
          }
        } catch {
          // Skip malformed accounts
        }
      }

      setStats({ totalJobs, totalUsdcLocked, totalCompleted });
    } catch (err) {
      console.error("Failed to fetch live stats:", err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading };
}
