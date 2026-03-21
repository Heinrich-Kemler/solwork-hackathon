"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import CreateEscrow from "@/components/CreateEscrow";
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

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Post a Job</h1>
        <p className="text-gray-400 mt-1">
          Lock SOL in escrow and find a freelancer to get it done.
        </p>
      </div>

      {/* Cross-chain funding info */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-2">
        <h3 className="font-semibold text-purple-400 text-sm uppercase tracking-wide">
          Pay from any chain
        </h3>
        <p className="text-sm text-gray-400">
          Need SOL? Bridge from any chain, any token via LI.FI. Your funds
          arrive on Solana in under 2 minutes.
        </p>
        <a
          href="https://jumper.exchange/?toChain=sol&toToken=So11111111111111111111111111111111111111112"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600/30 rounded-lg text-sm font-medium transition-colors"
        >
          Bridge to Solana via LI.FI &rarr;
        </a>
      </div>

      {/* Create form */}
      {connected ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <CreateEscrow
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
  );
}
