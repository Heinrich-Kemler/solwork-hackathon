"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  getProvider,
  getProgram,
  getJobPDA,
  getDisputeVotePDA,
  txCastVote,
  txInitiateDisputeVote,
} from "@/lib/anchor";
import { useToast } from "./TxToast";
import WalletName from "./WalletName";

interface DisputeVotingProps {
  client: PublicKey;
  freelancer: PublicKey;
  jobId: BN;
}

interface VoteState {
  jurors: string[];
  votes: (boolean | null)[];
  resolved: boolean;
  votesCount: number;
}

export default function DisputeVoting({
  client,
  freelancer,
  jobId,
}: DisputeVotingProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { showToast } = useToast();
  const [voteState, setVoteState] = useState<VoteState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchVoteState = useCallback(async () => {
    if (!wallet) return;
    try {
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      const [jobPDA] = getJobPDA(client, jobId);
      const [disputePDA] = getDisputeVotePDA(jobPDA);

      const accountInfo = await connection.getAccountInfo(disputePDA);
      if (!accountInfo) {
        setVoteState(null);
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coder = (program as any).coder.accounts;
      const acc = coder.decode("disputeVote", accountInfo.data);

      const jurors = [
        acc.juror1?.toBase58() || "",
        acc.juror2?.toBase58() || "",
        acc.juror3?.toBase58() || "",
      ].filter(Boolean);

      const votes: (boolean | null)[] = [
        acc.vote1 === 0 ? null : acc.vote1 === 1,
        acc.vote2 === 0 ? null : acc.vote2 === 1,
        acc.vote3 === 0 ? null : acc.vote3 === 1,
      ];

      setVoteState({
        jurors,
        votes,
        resolved: acc.resolved || false,
        votesCount: votes.filter((v) => v !== null).length,
      });
    } catch {
      setVoteState(null);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, client, jobId]);

  useEffect(() => {
    fetchVoteState();
  }, [fetchVoteState]);

  const isJuror =
    wallet &&
    voteState?.jurors.includes(wallet.publicKey.toBase58());

  const myJurorIndex = wallet
    ? voteState?.jurors.indexOf(wallet.publicKey.toBase58()) ?? -1
    : -1;

  const hasVoted = myJurorIndex >= 0 && voteState?.votes[myJurorIndex] !== null;

  const handleInitiateVote = async () => {
    if (!wallet) return;
    setActionLoading("initiate");
    try {
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      const tx = await txInitiateDisputeVote(
        program,
        wallet.publicKey,
        client,
        jobId
      );
      showToast("Dispute vote initiated!", "success", tx);
      fetchVoteState();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleVote = async (vote: boolean) => {
    if (!wallet) return;
    setActionLoading(vote ? "freelancer" : "client");
    try {
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      const tx = await txCastVote(
        program,
        wallet.publicKey,
        client,
        freelancer,
        jobId,
        vote
      );
      showToast(
        `Vote cast: ${vote ? "Freelancer wins" : "Client wins"}`,
        "success",
        tx
      );
      fetchVoteState();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="card-static p-4 animate-pulse">
        <div className="h-6 rounded" style={{ background: "var(--bg-elevated)", width: "50%" }} />
      </div>
    );
  }

  return (
    <div className="card-static p-5 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--warning)" }}>
        Dispute Resolution
      </h3>

      {!voteState ? (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No jury vote has been initiated for this dispute yet.
          </p>
          {wallet && (
            <button
              onClick={handleInitiateVote}
              disabled={actionLoading === "initiate"}
              className="btn-primary px-4 py-2 text-sm"
            >
              {actionLoading === "initiate" ? "Initiating..." : "Initiate Jury Vote"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Jury members */}
          <div>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Jury Members
            </p>
            <div className="flex flex-wrap gap-2">
              {voteState.jurors.map((j, i) => (
                <span
                  key={j}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color:
                      wallet?.publicKey.toBase58() === j
                        ? "var(--accent)"
                        : "var(--text-muted)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background:
                        voteState.votes[i] !== null
                          ? "var(--success)"
                          : "var(--border)",
                    }}
                  />
                  <WalletName address={j} />
                </span>
              ))}
            </div>
          </div>

          {/* Vote count */}
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {voteState.votesCount} of 3 votes cast
            {voteState.resolved && (
              <span className="ml-2 badge badge-complete">Resolved</span>
            )}
          </p>

          {/* Vote buttons */}
          {isJuror && !hasVoted && !voteState.resolved && (
            <div className="flex gap-3">
              <button
                onClick={() => handleVote(true)}
                disabled={actionLoading === "freelancer"}
                className="btn-primary px-4 py-2 text-sm"
              >
                {actionLoading === "freelancer"
                  ? "Voting..."
                  : "Freelancer Wins"}
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={actionLoading === "client"}
                className="btn-ghost px-4 py-2 text-sm"
              >
                {actionLoading === "client" ? "Voting..." : "Client Wins"}
              </button>
            </div>
          )}

          {isJuror && hasVoted && (
            <p className="text-xs" style={{ color: "var(--success)" }}>
              You have voted.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
