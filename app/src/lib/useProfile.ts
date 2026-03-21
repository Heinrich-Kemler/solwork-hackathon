"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, getProvider, getProgram, getProfilePDA } from "./anchor";

export interface UserProfile {
  owner: string;
  jobsCompleted: number;
  jobsPosted: number;
  disputesRaised: number;
  totalEarned: number;
  totalSpent: number;
  referredBy: string;
  referralEarnings: number;
  reputationScore: number;
  memberSince: number;
}

export function useProfile() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [needsRecreate, setNeedsRecreate] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!wallet) {
      setProfile(null);
      setLoading(false);
      setExists(false);
      setNeedsRecreate(false);
      return;
    }

    try {
      setLoading(true);
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      const [profilePDA] = getProfilePDA(wallet.publicKey);

      // Manual fetch + decode to handle old schema gracefully
      const accountInfo = await connection.getAccountInfo(profilePDA);
      if (!accountInfo) {
        setProfile(null);
        setExists(false);
        setNeedsRecreate(false);
        setLoading(false);
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coder = (program as any).coder.accounts;
        const acc = coder.decode("userProfile", accountInfo.data);

        setProfile({
          owner: acc.owner.toBase58(),
          jobsCompleted: acc.jobsCompleted ?? 0,
          jobsPosted: acc.jobsPosted ?? 0,
          disputesRaised: acc.disputesRaised ?? 0,
          totalEarned: ((acc.totalEarned as BN)?.toNumber() ?? 0) / 1_000_000,
          totalSpent: ((acc.totalSpent as BN)?.toNumber() ?? 0) / 1_000_000,
          referredBy: acc.referredBy ? acc.referredBy.toBase58() : PublicKey.default.toBase58(),
          referralEarnings: ((acc.referralEarnings as BN)?.toNumber() ?? 0) / 1_000_000,
          reputationScore: ((acc.reputationScore as BN)?.toNumber?.() ?? acc.reputationScore ?? 0),
          memberSince: ((acc.memberSince as BN)?.toNumber() ?? 0),
        });
        setExists(true);
        setNeedsRecreate(false);
      } catch {
        // Old schema — account exists but can't deserialize
        console.warn("Profile account exists but has old schema — needs recreation");
        setProfile(null);
        setExists(false);
        setNeedsRecreate(true);
      }
    } catch {
      setProfile(null);
      setExists(false);
      setNeedsRecreate(false);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, exists, needsRecreate, refresh: fetchProfile };
}
