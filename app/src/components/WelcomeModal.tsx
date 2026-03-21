"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useLocalProfile } from "@/lib/useLocalProfile";
import { useProfile } from "@/lib/useProfile";

const DISMISSED_KEY = "solwork-welcome-dismissed";

/**
 * Shows a welcome modal when a wallet connects for the first time
 * and has no profile data in localStorage and no on-chain profile.
 */
export default function WelcomeModal() {
  const { publicKey, connected } = useWallet();
  const { exists, loading } = useProfile();
  const { profile, loaded } = useLocalProfile(publicKey?.toBase58() ?? null);
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!connected || !loaded || loading) return;
    if (exists) return; // Already has on-chain profile
    if (profile.username) return; // Already filled local profile

    // Check if already dismissed this session
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    setShow(true);
  }, [connected, loaded, loading, exists, profile.username]);

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative max-w-sm w-full mx-4 p-6 rounded-2xl animate-slide-up space-y-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
          Welcome to SolWork
        </h2>
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          Set up your profile to get started — it takes 30 seconds.
        </p>
        <button
          onClick={() => { dismiss(); router.push("/onboarding"); }}
          className="btn-primary w-full py-3"
        >
          Set Up Profile
        </button>
        <button
          onClick={dismiss}
          className="block w-full text-center text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
