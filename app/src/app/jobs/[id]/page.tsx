"use client";

import { use, useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useSingleEscrow } from "@/lib/useEscrows";
import {
  getProvider,
  getProgram,
  lamportsToSol,
  explorerAccountUrl,
  txAcceptJob,
  txApproveAndRelease,
  txRaiseDispute,
  txCancelEscrow,
  type EscrowStatus,
} from "@/lib/anchor";
import { useToast } from "@/components/TxToast";

const statusColors: Record<EscrowStatus, string> = {
  Open: "bg-green-500/20 text-green-400 border-green-500/30",
  InProgress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Completed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Disputed: "bg-red-500/20 text-red-400 border-red-500/30",
  Cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function CopyableAddress({ address, label }: { address: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-gray-500 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <a
          href={explorerAccountUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm text-purple-400 hover:text-purple-300"
        >
          {address.slice(0, 8)}...{address.slice(-6)}
        </a>
        <button
          onClick={copy}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { showToast } = useToast();
  const { escrow, loading, error, refresh } = useSingleEscrow(id);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isClient = wallet && escrow?.client && wallet.publicKey.equals(escrow.client);
  const isFreelancer =
    wallet && escrow?.freelancer && wallet.publicKey.equals(escrow.freelancer);

  const handleAction = async (action: string) => {
    if (!wallet || !escrow) return;
    setActionLoading(action);

    try {
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      let tx: string;

      switch (action) {
        case "accept":
          tx = await txAcceptJob(program, wallet.publicKey, escrow.publicKey);
          showToast("Job accepted!", "success", tx);
          break;
        case "approve":
          tx = await txApproveAndRelease(
            program,
            wallet.publicKey,
            escrow.publicKey,
            escrow.freelancer,
            escrow.jobTitle,
          );
          showToast(`${lamportsToSol(escrow.amount)} SOL released!`, "success", tx);
          break;
        case "dispute":
          tx = await txRaiseDispute(program, wallet.publicKey, escrow.publicKey);
          showToast("Dispute raised", "info", tx);
          break;
        case "cancel":
          tx = await txCancelEscrow(
            program,
            wallet.publicKey,
            escrow.publicKey,
            escrow.jobTitle,
          );
          showToast("Escrow cancelled, SOL returned", "success", tx);
          break;
      }

      refresh();
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      showToast(msg, "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/2 bg-gray-700 rounded" />
          <div className="h-4 w-full bg-gray-700/50 rounded" />
          <div className="h-4 w-3/4 bg-gray-700/30 rounded" />
          <div className="h-32 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !escrow) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-red-400 text-lg mb-2">
          {error || "Escrow not found"}
        </p>
        <p className="text-gray-500 text-sm mb-4">
          Connect your wallet and make sure the escrow address is correct.
        </p>
        <Link
          href="/jobs"
          className="text-purple-400 hover:text-purple-300 underline"
        >
          &larr; Back to Jobs
        </Link>
      </div>
    );
  }

  const solAmount = lamportsToSol(escrow.amount);
  const createdDate = new Date(
    escrow.createdAt.toNumber() * 1000
  ).toLocaleDateString();

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <Link
        href="/jobs"
        className="text-sm text-gray-500 hover:text-white transition-colors"
      >
        &larr; Back to Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">{escrow.jobTitle}</h1>
        <span
          className={`text-sm px-3 py-1 rounded-full border whitespace-nowrap ${statusColors[escrow.status]}`}
        >
          {escrow.status === "InProgress" ? "In Progress" : escrow.status}
        </span>
      </div>

      {/* Amount */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <div className="text-4xl font-bold text-purple-400">
          {solAmount} SOL
        </div>
        <p className="text-gray-500 text-sm mt-1">Locked in Escrow</p>
      </div>

      {/* Description */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">
          Job Description
        </h3>
        <p className="text-white leading-relaxed">{escrow.jobDescription}</p>
      </div>

      {/* Details */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 divide-y divide-gray-800">
        <CopyableAddress
          label="Client"
          address={escrow.client.toBase58()}
        />
        {escrow.freelancer &&
          !escrow.freelancer.equals(PublicKey.default) && (
            <CopyableAddress
              label="Freelancer"
              address={escrow.freelancer.toBase58()}
            />
          )}
        <CopyableAddress
          label="Escrow Account"
          address={escrow.publicKey.toBase58()}
        />
        <div className="flex items-center justify-between py-2">
          <span className="text-gray-500 text-sm">Created</span>
          <span className="text-sm text-gray-300">{createdDate}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {escrow.status === "Open" && !isClient && wallet && (
          <button
            onClick={() => handleAction("accept")}
            disabled={actionLoading === "accept"}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-white font-semibold transition-colors"
          >
            {actionLoading === "accept" ? "Accepting..." : "Accept Job"}
          </button>
        )}

        {escrow.status === "InProgress" && isClient && (
          <>
            <button
              onClick={() => handleAction("approve")}
              disabled={actionLoading === "approve"}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white font-semibold transition-colors"
            >
              {actionLoading === "approve"
                ? "Releasing SOL..."
                : "Approve & Release SOL"}
            </button>
            <button
              onClick={() => handleAction("dispute")}
              disabled={actionLoading === "dispute"}
              className="px-6 py-3 bg-red-600/80 hover:bg-red-700 disabled:opacity-50 rounded-lg text-white font-semibold transition-colors"
            >
              {actionLoading === "dispute" ? "Disputing..." : "Raise Dispute"}
            </button>
          </>
        )}

        {escrow.status === "Open" && isClient && (
          <button
            onClick={() => handleAction("cancel")}
            disabled={actionLoading === "cancel"}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-white font-semibold transition-colors"
          >
            {actionLoading === "cancel" ? "Cancelling..." : "Cancel Escrow"}
          </button>
        )}
      </div>

      {!wallet && (
        <p className="text-yellow-400 text-sm">
          Connect your wallet to take actions on this escrow.
        </p>
      )}
    </div>
  );
}
