"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  getProvider,
  getProgram,
  parseJobStatus,
  type JobAccount,
} from "./anchor";

/**
 * Safely parse a decoded account into a JobAccount.
 * Defaults missing fields (from older program versions) to safe values.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParseJob(pubkey: PublicKey, acc: any): JobAccount | null {
  try {
    return {
      publicKey: pubkey,
      title: acc.title ?? "",
      description: acc.description ?? "",
      amount: acc.amount ?? new BN(0),
      client: acc.client ?? PublicKey.default,
      freelancer: acc.freelancer ?? PublicKey.default,
      status: parseJobStatus(acc.status ?? {}),
      milestoneApproved: acc.milestoneApproved ?? false,
      createdAt: acc.createdAt ?? new BN(0),
      expiryTime: acc.expiryTime ?? new BN(0),
      gracePeriod: acc.gracePeriod ?? new BN(0),
      submittedAt: acc.submittedAt ?? new BN(0),
      workDescription: acc.workDescription ?? "",
      disputeReason: acc.disputeReason ?? "",
      jobId: acc.jobId ?? new BN(0),
      jobBump: acc.jobBump ?? 0,
      vaultBump: acc.vaultBump ?? 0,
    };
  } catch {
    return null;
  }
}

export function useJobs() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [jobs, setJobs] = useState<JobAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!wallet?.publicKey) {
        setJobs([]);
        setLoading(false);
        return;
      }

      let provider, program;
      try {
        provider = getProvider(connection, wallet);
        program = getProgram(provider);
      } catch {
        setJobs([]);
        setLoading(false);
        return;
      }

      // Use getProgramAccounts + manual decode instead of .all()
      // so we can skip stale accounts that throw RangeError
      // (created by older program versions with smaller structs).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coder = (program as any).coder.accounts;
      const discriminator = coder.memcmp("job").bytes;

      const rawAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { memcmp: { offset: 0, bytes: discriminator } },
        ],
      });

      const parsed: JobAccount[] = [];
      for (const raw of rawAccounts) {
        try {
          const decoded = coder.decode("job", raw.account.data);
          const job = safeParseJob(raw.pubkey, decoded);
          if (job) parsed.push(job);
        } catch {
          // Stale account — skip silently
          console.warn(
            `Skipping stale job account ${raw.pubkey.toBase58()}`
          );
        }
      }

      parsed.sort((a, b) => b.createdAt.toNumber() - a.createdAt.toNumber());
      setJobs(parsed);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return { jobs, loading, error, refresh: fetchJobs };
}

export function useSingleJob(jobPubkey: string) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [job, setJob] = useState<JobAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!wallet?.publicKey || !jobPubkey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let provider, program;
      try {
        provider = getProvider(connection, wallet);
        program = getProgram(provider);
      } catch {
        setError("Wallet not ready");
        setLoading(false);
        return;
      }
      const pubkey = new PublicKey(jobPubkey);

      // Manual fetch + decode to handle stale accounts gracefully
      const accountInfo = await connection.getAccountInfo(pubkey);
      if (!accountInfo) {
        setError("Job account not found on-chain");
        setLoading(false);
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coder = (program as any).coder.accounts;
        const decoded = coder.decode("job", accountInfo.data);
        const parsed = safeParseJob(pubkey, decoded);
        if (parsed) {
          setJob(parsed);
        } else {
          setError("This job was created with an older program version.");
        }
      } catch (decodeErr) {
        console.error("Decode error:", decodeErr);
        setError(
          "This job was created with an older program version and cannot be displayed."
        );
      }
    } catch (err) {
      console.error("Failed to fetch job:", err);
      setError(err instanceof Error ? err.message : "Job not found");
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, jobPubkey]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  return { job, loading, error, refresh: fetchJob };
}
