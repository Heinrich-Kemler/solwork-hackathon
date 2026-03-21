"use client";

import { useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import {
  getProvider,
  getProgram,
  solToLamports,
  txCreateEscrow,
} from "@/lib/anchor";
import { useToast } from "./TxToast";

export default function CreateEscrow({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    setLoading(true);
    try {
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      const amountLamports = solToLamports(parseFloat(amount));

      const tx = await txCreateEscrow(
        program,
        wallet.publicKey,
        title,
        description,
        amountLamports,
      );

      showToast(`Job posted! ${amount} SOL locked in escrow`, "success", tx);
      setTitle("");
      setDescription("");
      setAmount("");
      onCreated?.();
    } catch (err) {
      console.error("Failed to create escrow:", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <h2 className="text-xl font-bold text-white">Post a Job</h2>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Job Title</label>
        <input
          type="text"
          maxLength={64}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Build a landing page"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Description</label>
        <textarea
          maxLength={256}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the deliverables..."
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Escrow Amount (SOL)
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1.5"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !wallet}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Confirming...
          </span>
        ) : (
          "Lock SOL & Post Job"
        )}
      </button>

      {!wallet && (
        <p className="text-sm text-yellow-400">
          Connect your wallet to post a job
        </p>
      )}
    </form>
  );
}
