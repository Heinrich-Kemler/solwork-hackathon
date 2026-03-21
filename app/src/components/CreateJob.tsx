"use client";

import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { X } from "lucide-react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import {
  getProvider,
  getProgram,
  usdcToSmallest,
  txCreateJob,
} from "@/lib/anchor";
import { useToast } from "./TxToast";
import { useUsdcBalance } from "@/lib/useUsdcBalance";
import TopUpModal from "./TopUpModal";
import { JOB_CATEGORIES, encodeJobMeta, type JobCategory } from "@/lib/categories";

export default function CreateJob({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { showToast } = useToast();
  const { balance } = useUsdcBalance();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<JobCategory | "">("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const insufficientFunds = parsedAmount > 0 && parsedAmount > balance;
  const shortfall = parsedAmount - balance;

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s) && skills.length < 8) {
      setSkills([...skills, s]);
      setSkillInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    if (insufficientFunds) {
      setShowTopUp(true);
      return;
    }

    setLoading(true);
    try {
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      const amountSmallest = usdcToSmallest(parsedAmount);
      const jobId = new BN(Date.now());

      // Encode category + skills into description
      const fullDescription = encodeJobMeta(description, {
        category: category || "",
        skills,
      });

      const tx = await txCreateJob(
        program,
        wallet.publicKey,
        jobId,
        title,
        fullDescription,
        amountSmallest
      );

      showToast(`Job posted! ${amount} USDC locked in escrow`, "success", tx);
      setTitle("");
      setDescription("");
      setAmount("");
      setCategory("");
      setSkills([]);
      onCreated?.();
    } catch (err) {
      console.error("Failed to create job:", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Post a Job</h2>

        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Job Title</label>
          <input type="text" maxLength={64} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Build a landing page" className="input w-full px-3 py-2" />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as JobCategory)} className="input w-full px-3 py-2">
            <option value="">Select category...</option>
            {JOB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
          <textarea maxLength={200} required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the deliverables..." rows={3} className="input w-full px-3 py-2" />
        </div>

        {/* Required Skills */}
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Required Skills</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              placeholder="e.g. React, Solidity..."
              className="input flex-1 px-3 py-1.5 text-sm"
            />
            <button type="button" onClick={addSkill} className="btn-ghost px-3 py-1.5 text-sm">Add</button>
          </div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  {s}
                  <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Amount (USDC)</label>
          <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100.00" className="input w-full px-3 py-2" />
          {wallet && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Balance: {balance.toFixed(2)} USDC</p>}
        </div>

        {insufficientFunds && (
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              Insufficient USDC. You need <strong>{shortfall.toFixed(2)} more</strong>.
            </p>
            <button type="button" onClick={() => setShowTopUp(true)} className="btn-danger px-3 py-1 text-xs">Top Up</button>
          </div>
        )}

        <button type="submit" disabled={loading || !wallet} className="btn-primary w-full py-3">
          {loading ? "Confirming..." : "Lock USDC & Post Job"}
        </button>

        {!wallet && <p className="text-sm" style={{ color: 'var(--warning)' }}>Connect your wallet to post a job</p>}
      </form>

      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} shortfall={shortfall} />
    </>
  );
}
