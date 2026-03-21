"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { getProvider, getProgram, getProfilePDA } from "./anchor";

export interface UserProfile {
  owner: string;
  jobsCompleted: number;
  jobsPosted: number;
  disputesRaised: number;
  totalEarned: number; // USDC (human-readable)
  totalSpent: number;
  memberSince: number; // unix timestamp
}

export function useProfile() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!wallet) {
      setProfile(null);
      setLoading(false);
      setExists(false);
      return;
    }

    try {
      setLoading(true);
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      const [profilePDA] = getProfilePDA(wallet.publicKey);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acc = await (program.account as any).userProfile.fetch(profilePDA);

      setProfile({
        owner: acc.owner.toBase58(),
        jobsCompleted: acc.jobsCompleted,
        jobsPosted: acc.jobsPosted,
        disputesRaised: acc.disputesRaised,
        totalEarned: (acc.totalEarned as BN).toNumber() / 1_000_000,
        totalSpent: (acc.totalSpent as BN).toNumber() / 1_000_000,
        memberSince: (acc.memberSince as BN).toNumber(),
      });
      setExists(true);
    } catch {
      // Profile doesn't exist yet
      setProfile(null);
      setExists(false);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, exists, refresh: fetchProfile };
}
