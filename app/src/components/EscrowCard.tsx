"use client";

import { useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import {
  getProvider,
  getProgram,
  lamportsToSol,
  txAcceptJob,
  txApproveAndRelease,
  txRaiseDispute,
  txCancelEscrow,
  type EscrowAccount,
  type EscrowStatus,
} from "@/lib/anchor";
import { useToast } from "./TxToast";

const statusColors: Record<EscrowStatus, string> = {
  Open: "bg-green-500/20 text-green-400 border-green-500/30",
  InProgress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Completed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Disputed: "bg-red-500/20 text-red-400 border-red-500/30",
  Cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function EscrowCard({
  escrow,
  onAction,
}: {
  escrow: EscrowAccount;
  onAction?: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const isClient = wallet?.publicKey.equals(escrow.client);
  const isFreelancer = wallet?.publicKey.equals(escrow.freelancer);
  const solAmount = lamportsToSol(escrow.amount);

  const handleAction = async (action: string) => {
    if (!wallet) return;
    setLoading(action);

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
          showToast(`${solAmount} SOL released to freelancer!`, "success", tx);
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
          showToast(`Escrow cancelled, ${solAmount} SOL returned`, "success", tx);
          break;
      }

      onAction?.();
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      showToast(msg, "error");
    } finally {
      setLoading(null);
    }
  };

  const addr = (pk: PublicKey) => {
    const s = pk.toBase58();
    return `${s.slice(0, 4)}...${s.slice(-4)}`;
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-3 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between">
        <Link
          href={`/jobs/${escrow.publicKey.toBase58()}`}
          className="text-lg font-semibold text-white hover:text-purple-400 transition-colors"
        >
          {escrow.jobTitle}
        </Link>
        <span
          className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${statusColors[escrow.status]}`}
        >
          {escrow.status === "InProgress" ? "In Progress" : escrow.status}
        </span>
      </div>

      <p className="text-sm text-gray-400 line-clamp-2">
        {escrow.jobDescription}
      </p>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Escrow:{" "}
          <span className="text-white font-mono font-semibold">
            {solAmount} SOL
          </span>
        </span>
        <span className="text-gray-500 text-xs font-mono">
          by {addr(escrow.client)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        {escrow.status === "Open" && !isClient && wallet && (
          <button
            onClick={() => handleAction("accept")}
            disabled={loading === "accept"}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
          >
            {loading === "accept" ? "Accepting..." : "Accept Job"}
          </button>
        )}

        {escrow.status === "InProgress" && isClient && (
          <>
            <button
              onClick={() => handleAction("approve")}
              disabled={loading === "approve"}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
            >
              {loading === "approve" ? "Releasing..." : "Approve & Release"}
            </button>
            <button
              onClick={() => handleAction("dispute")}
              disabled={loading === "dispute"}
              className="px-4 py-2 bg-red-600/80 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
            >
              {loading === "dispute" ? "Disputing..." : "Dispute"}
            </button>
          </>
        )}

        {escrow.status === "Open" && isClient && (
          <button
            onClick={() => handleAction("cancel")}
            disabled={loading === "cancel"}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
          >
            {loading === "cancel" ? "Cancelling..." : "Cancel"}
          </button>
        )}

        <Link
          href={`/jobs/${escrow.publicKey.toBase58()}`}
          className="px-4 py-2 border border-gray-600 hover:border-gray-500 rounded-lg text-sm text-gray-300 font-medium transition-colors ml-auto"
        >
          Details &rarr;
        </Link>
      </div>
    </div>
  );
}
