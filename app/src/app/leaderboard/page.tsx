"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { Trophy } from "lucide-react";
import {
  PROGRAM_ID,
  getProvider,
  getProgram,
  calcReputation,
  getReputationTier,
  explorerAccountUrl,
} from "@/lib/anchor";
import { getLocalProfileForWallet } from "@/lib/useLocalProfile";

interface LeaderboardEntry {
  wallet: string;
  jobsCompleted: number;
  totalEarned: number;
  disputesRaised: number;
  reputation: number;
  displayName: string;
}

export default function LeaderboardPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (!wallet) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts = await (program.account as any).userProfile.all();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: LeaderboardEntry[] = accounts.map((acc: any) => {
        const walletAddr = acc.account.owner.toBase58();
        const earned = (acc.account.totalEarned as BN).toNumber() / 1_000_000;
        const completed = acc.account.jobsCompleted as number;
        const disputes = acc.account.disputesRaised as number;
        const lp = getLocalProfileForWallet(walletAddr);
        return {
          wallet: walletAddr,
          jobsCompleted: completed,
          totalEarned: earned,
          disputesRaised: disputes,
          reputation: calcReputation(completed, earned, disputes),
          displayName: lp.username || walletAddr.slice(0, 8),
        };
      });

      parsed.sort((a, b) => b.reputation - a.reputation);
      setEntries(parsed.slice(0, 50));
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const rankStyle = (i: number) => {
    if (i === 0) return { color: '#FFD700' };
    if (i === 1) return { color: '#C0C0C0' };
    if (i === 2) return { color: '#CD7F32' };
    return { color: 'var(--text-muted)' };
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Trophy size={24} style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Leaderboard</h1>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Top freelancers and clients ranked by on-chain reputation. Updated every 60 seconds.
      </p>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="card-static p-4 animate-pulse">
              <div className="h-6 rounded" style={{ background: 'var(--bg-elevated)', width: '60%' }} />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <p style={{ color: 'var(--text-muted)' }}>No profiles found. Connect your wallet to see the leaderboard.</p>
        </div>
      ) : (
        <div className="card-static overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            <div className="col-span-1">#</div>
            <div className="col-span-4">User</div>
            <div className="col-span-2 text-right">Score</div>
            <div className="col-span-1 text-right hidden sm:block">Tier</div>
            <div className="col-span-2 text-right hidden sm:block">Completed</div>
            <div className="col-span-2 text-right">Earned</div>
          </div>

          {entries.map((entry, i) => {
            const tier = getReputationTier(entry.reputation);
            return (
              <a
                key={entry.wallet}
                href={explorerAccountUrl(entry.wallet)}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="col-span-1 font-bold text-sm" style={rankStyle(i)}>
                  {i + 1}
                </div>
                <div className="col-span-4 flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                    {entry.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{entry.displayName}</div>
                    <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{entry.wallet.slice(0, 4)}...{entry.wallet.slice(-4)}</div>
                  </div>
                </div>
                <div className="col-span-2 text-right font-bold text-sm" style={{ color: 'var(--accent)' }}>
                  {entry.reputation}
                </div>
                <div className="col-span-1 text-right hidden sm:block">
                  <span className={`badge ${tier.class}`}>{tier.label}</span>
                </div>
                <div className="col-span-2 text-right text-sm hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                  {entry.jobsCompleted}
                </div>
                <div className="col-span-2 text-right text-sm font-mono" style={{ color: 'var(--success)' }}>
                  ${entry.totalEarned.toFixed(0)}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
