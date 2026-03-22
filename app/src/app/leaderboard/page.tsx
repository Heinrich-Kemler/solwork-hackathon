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
      // Fetch raw accounts and decode manually to skip stale profiles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coder = (program as any).coder.accounts;
      const discriminator = coder.memcmp("userProfile").bytes;
      const rawAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ memcmp: { offset: 0, bytes: discriminator } }],
      });

      const parsed: LeaderboardEntry[] = [];
      for (const raw of rawAccounts) {
        try {
          const acc = coder.decode("userProfile", raw.account.data);
          const walletAddr = acc.owner.toBase58();
          const earned = (acc.totalEarned as BN).toNumber() / 1_000_000;
          const completed = acc.jobsCompleted as number;
          const disputes = acc.disputesRaised as number;
          const repScore = (acc.reputationScore as BN)?.toNumber?.() ?? acc.reputationScore ?? 0;
          const lp = getLocalProfileForWallet(walletAddr);
          parsed.push({
            wallet: walletAddr,
            jobsCompleted: completed,
            totalEarned: earned,
            disputesRaised: disputes,
            reputation: repScore || calcReputation(completed, earned, disputes),
            displayName: lp.username || walletAddr.slice(0, 8),
          });
        } catch {
          // Stale profile — skip
          console.warn(`Skipping stale profile ${raw.pubkey.toBase58()}`);
        }
      }

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
        <div className="card-static overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-2 w-10">#</th>
                <th className="text-left px-2 py-2">User</th>
                <th className="text-right px-2 py-2">Score</th>
                <th className="text-right px-2 py-2">Tier</th>
                <th className="text-right px-2 py-2">Jobs</th>
                <th className="text-right px-4 py-2">Earned</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const tier = getReputationTier(entry.reputation);
                return (
                  <tr
                    key={entry.wallet}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td className="px-4 py-3 font-bold text-sm" style={rankStyle(i)}>
                      {i + 1}
                    </td>
                    <td className="px-2 py-3">
                      <a href={explorerAccountUrl(entry.wallet)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                          {entry.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{entry.displayName}</div>
                          <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{entry.wallet.slice(0, 4)}...{entry.wallet.slice(-4)}</div>
                        </div>
                      </a>
                    </td>
                    <td className="px-2 py-3 text-right font-bold text-sm" style={{ color: 'var(--accent)' }}>
                      {entry.reputation}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span className={`badge ${tier.class}`}>{tier.label}</span>
                    </td>
                    <td className="px-2 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {entry.jobsCompleted}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono" style={{ color: 'var(--success)' }}>
                      ${entry.totalEarned.toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
