"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import CreateJob from "@/components/CreateJob";
import JupiterSwap from "@/components/JupiterSwap";
import ProfileGate from "@/components/ProfileGate";
import { useProfile } from "@/lib/useProfile";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function PostJobPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { profile } = useProfile();
  const [showSwap, setShowSwap] = useState(false);
  const isFirstPost = profile ? profile.jobsPosted === 0 : true;

  return (
    <ProfileGate>
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Post a Job</h1>
        <p className="text-gray-400 mt-1">
          Lock USDC in escrow and find a freelancer to get it done.
        </p>
      </div>

      {/* Funding options */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-purple-400 text-sm uppercase tracking-wide">
          Need USDC?
        </h3>
        <p className="text-sm text-gray-400">
          Swap SOL to USDC instantly, or bridge from any chain.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowSwap(!showSwap)}
            className="px-4 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600/30 rounded-lg text-sm font-medium transition-colors"
          >
            {showSwap ? "Hide Swap" : "Swap SOL \u2192 USDC"}
          </button>
          <a
            href="https://jumper.exchange/?toChain=sol&toToken=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Bridge from other chains &rarr;
          </a>
        </div>

        {/* Inline Jupiter Swap */}
        {showSwap && connected && (
          <div className="mt-3">
            <JupiterSwap containerId="post-page-jupiter" />
          </div>
        )}
      </div>

      {/* Activation fee notice */}
      {connected && isFirstPost && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
          <span className="text-lg shrink-0">&#9432;</span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              First-time job post
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              A one-time 0.01 SOL activation fee will be charged on your first job post. This goes to the Accord treasury.
            </p>
          </div>
        </div>
      )}

      {/* Create form */}
      {connected ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <CreateJob
            onCreated={() => {
              router.push("/jobs");
            }}
          />
        </div>
      ) : (
        <div className="text-center py-16 space-y-4">
          <p className="text-gray-400 text-lg">
            Connect your wallet to post a job
          </p>
          <WalletMultiButton />
        </div>
      )}
    </div>
    </ProfileGate>
  );
}
