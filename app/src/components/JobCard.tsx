"use client";

import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import {
  smallestToUsdc,
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  type JobAccount,
} from "@/lib/anchor";

export default function JobCard({
  job,
}: {
  job: JobAccount;
  onAction?: () => void;
}) {
  const usdcAmount = smallestToUsdc(job.amount);

  const addr = (pk: PublicKey) => {
    const s = pk.toBase58();
    return `${s.slice(0, 4)}...${s.slice(-4)}`;
  };

  return (
    <Link
      href={`/jobs/${job.publicKey.toBase58()}`}
      className="card block p-5 space-y-3"
    >
      <div className="flex items-start justify-between">
        <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {job.title}
        </span>
        <span className={STATUS_BADGE_CLASS[job.status]}>
          {STATUS_LABELS[job.status]}
        </span>
      </div>

      <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
        {job.description}
      </p>

      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text-muted)' }}>
          Escrow:{" "}
          <span className="font-mono font-semibold" style={{ color: 'var(--success)' }}>
            {usdcAmount} USDC
          </span>
        </span>
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          by {addr(job.client)}
        </span>
      </div>
    </Link>
  );
}
