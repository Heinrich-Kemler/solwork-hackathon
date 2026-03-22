"use client";

import { use, useState } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useSingleJob } from "@/lib/useJobs";
import {
  getProvider,
  getProgram,
  smallestToUsdc,
  explorerAccountUrl,
  txAcceptJob,
  txApproveJob,
  txDisputeJob,
  txCancelJob,
  txSubmitWork,
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
} from "@/lib/anchor";
import { useToast } from "@/components/TxToast";
import { useProgramLogs } from "@/lib/useProgramLogs";
import JobComments from "@/components/JobComments";
import DisputeVoting from "@/components/DisputeVoting";
import ConfirmReleaseModal from "@/components/ConfirmReleaseModal";

function CopyableAddress({
  address,
  label,
}: {
  address: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <a
          href={explorerAccountUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm"
          style={{ color: 'var(--accent)' }}
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
  const { job, loading, error, refresh } = useSingleJob(id);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Auto-refresh on any program event
  useProgramLogs(() => {
    refresh();
    showToast("Job status updated", "info");
  });
  const [submitWorkText, setSubmitWorkText] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [releasePercent, setReleasePercent] = useState(100);
  const [showReleaseSlider, setShowReleaseSlider] = useState(false);
  const [showConfirmRelease, setShowConfirmRelease] = useState(false);

  const isClient =
    wallet && job?.client && wallet.publicKey.equals(job.client);
  const isFreelancer =
    wallet &&
    job?.freelancer &&
    !job.freelancer.equals(PublicKey.default) &&
    wallet.publicKey.equals(job.freelancer);

  const handleAction = async (action: string) => {
    if (!wallet || !job) return;
    setActionLoading(action);

    try {
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);

      switch (action) {
        case "accept": {
          const tx = await txAcceptJob(
            program,
            wallet.publicKey,
            job.client,
            job.jobId
          );
          showToast("Job accepted!", "success", tx);
          break;
        }
        case "approve": {
          const tx = await txApproveJob(
            program,
            wallet.publicKey,
            job.freelancer,
            job.jobId
          );
          showToast(
            `${smallestToUsdc(job.amount)} USDC released!`,
            "success",
            tx
          );
          break;
        }
        case "submit": {
          const tx = await txSubmitWork(
            program,
            wallet.publicKey,
            job.client,
            job.jobId,
            submitWorkText
          );
          showToast("Work submitted for review!", "success", tx);
          setSubmitWorkText("");
          setShowSubmitForm(false);
          break;
        }
        case "dispute": {
          const tx = await txDisputeJob(
            program,
            wallet.publicKey,
            job.client,
            job.jobId,
            disputeReason
          );
          showToast("Dispute raised", "info", tx);
          setDisputeReason("");
          setShowDisputeForm(false);
          break;
        }
        case "cancel": {
          const tx = await txCancelJob(
            program,
            wallet.publicKey,
            job.jobId
          );
          showToast(
            `Job cancelled, ${smallestToUsdc(job.amount)} USDC refunded`,
            "success",
            tx
          );
          break;
        }
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

  if (error || !job) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-red-400 text-lg mb-2">
          {error || "Job not found"}
        </p>
        <p className="text-gray-500 text-sm mb-4">
          Connect your wallet and make sure the job address is correct.
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

  const usdcAmount = smallestToUsdc(job.amount);
  const createdDate = new Date(
    job.createdAt.toNumber() * 1000
  ).toLocaleDateString();
  const isTerminal = ["Complete", "Disputed", "Expired", "Cancelled"].includes(
    job.status
  );

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
        <h1 className="text-3xl font-bold">{job.title}</h1>
        <span className={STATUS_BADGE_CLASS[job.status]}>
          {STATUS_LABELS[job.status]}
        </span>
      </div>

      {/* Amount */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <div className="text-4xl font-bold text-purple-400">
          {usdcAmount} USDC
        </div>
        <p className="text-gray-500 text-sm mt-1">
          {isTerminal ? "Escrow Closed" : "Locked in Escrow"}
        </p>
      </div>

      {/* Description */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">
          Job Description
        </h3>
        <p className="text-white leading-relaxed">{job.description}</p>
      </div>

      {/* Work Submission (if submitted) */}
      {job.workDescription && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">
            Submitted Work
          </h3>
          <p className="text-white leading-relaxed">{job.workDescription}</p>
        </div>
      )}

      {/* Dispute Reason (if disputed) */}
      {job.disputeReason && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-red-400 mb-2">
            Dispute Reason
          </h3>
          <p className="text-white leading-relaxed">{job.disputeReason}</p>
        </div>
      )}

      {/* Dispute Voting (if disputed) */}
      {job.status === "Disputed" && (
        <DisputeVoting
          client={job.client}
          freelancer={job.freelancer}
          jobId={job.jobId}
        />
      )}

      {/* Details */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 divide-y divide-gray-800">
        <CopyableAddress label="Client" address={job.client.toBase58()} />
        {job.freelancer && !job.freelancer.equals(PublicKey.default) && (
          <CopyableAddress
            label="Freelancer"
            address={job.freelancer.toBase58()}
          />
        )}
        <CopyableAddress
          label="Job Account"
          address={job.publicKey.toBase58()}
        />
        <div className="flex items-center justify-between py-2">
          <span className="text-gray-500 text-sm">Created</span>
          <span className="text-sm text-gray-300">{createdDate}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-gray-500 text-sm">Job ID</span>
          <span className="text-sm text-gray-300 font-mono">
            {job.jobId.toString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!isTerminal && wallet && (
        <div className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            {/* Open: Accept (non-client) */}
            {job.status === "Open" && !isClient && (
              <button
                onClick={() => handleAction("accept")}
                disabled={actionLoading === "accept"}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-white font-semibold transition-colors"
              >
                {actionLoading === "accept" ? "Accepting..." : "Accept Job"}
              </button>
            )}

            {/* Open: Cancel (client only) */}
            {job.status === "Open" && isClient && (
              <button
                onClick={() => handleAction("cancel")}
                disabled={actionLoading === "cancel"}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-white font-semibold transition-colors"
              >
                {actionLoading === "cancel"
                  ? "Cancelling..."
                  : "Cancel & Refund"}
              </button>
            )}

            {/* Active: Submit Work (freelancer) */}
            {job.status === "Active" && isFreelancer && (
              <button
                onClick={() => setShowSubmitForm(!showSubmitForm)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
              >
                Submit Work
              </button>
            )}

            {/* PendingReview: Approve with tranche slider (client) */}
            {job.status === "PendingReview" && isClient && (
              <button
                onClick={() => setShowReleaseSlider(!showReleaseSlider)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors"
              >
                Approve & Release USDC
              </button>
            )}

            {/* Active/PendingReview: Dispute (client or freelancer) */}
            {(job.status === "Active" || job.status === "PendingReview") &&
              (isClient || isFreelancer) && (
                <button
                  onClick={() => setShowDisputeForm(!showDisputeForm)}
                  className="px-6 py-3 bg-red-600/80 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors"
                >
                  Raise Dispute
                </button>
              )}
          </div>

          {/* Submit Work Form */}
          {showSubmitForm && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <textarea
                value={submitWorkText}
                onChange={(e) => setSubmitWorkText(e.target.value)}
                placeholder="Describe the completed work, link to deliverables..."
                maxLength={512}
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleAction("submit")}
                disabled={
                  actionLoading === "submit" || !submitWorkText.trim()
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
              >
                {actionLoading === "submit"
                  ? "Submitting..."
                  : "Submit for Review"}
              </button>
            </div>
          )}

          {/* Release Slider */}
          {showReleaseSlider && job && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Release amount</span>
                <span className="text-lg font-bold text-purple-400">
                  {((smallestToUsdc(job.amount) * releasePercent) / 100).toFixed(
                    2
                  )}{" "}
                  USDC
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={releasePercent}
                onChange={(e) => setReleasePercent(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>10%</span>
                <span className="font-semibold text-white">
                  {releasePercent}%
                </span>
                <span>100%</span>
              </div>
              <p className="text-xs text-gray-500">
                MVP: Full release only. Partial tranches coming in v2.
              </p>
              <button
                onClick={() => setShowConfirmRelease(true)}
                disabled={actionLoading === "approve"}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white font-semibold transition-colors"
              >
                {`Release ${((smallestToUsdc(job.amount) * releasePercent) / 100).toFixed(2)} USDC`}
              </button>
            </div>
          )}

          {/* Dispute Form */}
          {showDisputeForm && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe the reason for the dispute..."
                maxLength={256}
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={() => handleAction("dispute")}
                disabled={
                  actionLoading === "dispute" || !disputeReason.trim()
                }
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
              >
                {actionLoading === "dispute"
                  ? "Submitting..."
                  : "Confirm Dispute"}
              </button>
            </div>
          )}
        </div>
      )}

      {!wallet && (
        <p className="text-yellow-400 text-sm">
          Connect your wallet to take actions on this job.
        </p>
      )}

      {/* Q&A Comments */}
      <JobComments jobPubkey={id} />

      {/* Payment Confirmation Modal */}
      {job && (
        <ConfirmReleaseModal
          isOpen={showConfirmRelease}
          onClose={() => setShowConfirmRelease(false)}
          onConfirm={() => {
            setShowConfirmRelease(false);
            handleAction("approve");
          }}
          amount={((smallestToUsdc(job.amount) * releasePercent) / 100).toFixed(2)}
          loading={actionLoading === "approve"}
        />
      )}
    </div>
  );
}
