"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProfile } from "@/lib/useProfile";

/**
 * Wraps pages that require an on-chain profile.
 * Redirects to /onboarding if wallet connected but no profile exists.
 * Renders children normally if not connected (pages handle that themselves).
 */
export default function ProfileGate({ children }: { children: ReactNode }) {
  const { connected } = useWallet();
  const { exists, loading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (!loading && connected && !exists) {
      router.replace("/onboarding");
    }
  }, [loading, connected, exists, router]);

  // Show nothing while checking profile
  if (connected && loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Redirect is happening
  if (connected && !loading && !exists) {
    return null;
  }

  return <>{children}</>;
}
