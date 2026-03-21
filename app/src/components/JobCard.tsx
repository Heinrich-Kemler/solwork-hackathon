"use client";

import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import {
  smallestToUsdc,
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  type JobAccount,
} from "@/lib/anchor";
import { decodeJobMeta } from "@/lib/categories";
import WalletName from "./WalletName";

export default function JobCard({
  job,
  highlighted,
}: {
  job: JobAccount;
  onAction?: () => void;
  highlighted?: boolean;
}) {
  const usdcAmount = smallestToUsdc(job.amount);
  const { cleanDescription, meta } = decodeJobMeta(job.description);

  return (
    <Link
      href={`/jobs/${job.publicKey.toBase58()}`}
      className="card block p-5 space-y-3"
      style={highlighted ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : {}}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {job.title}
          </span>
          {meta.category && (
            <span className="badge badge-active text-[10px] shrink-0">{meta.category}</span>
          )}
        </div>
        <span className={`${STATUS_BADGE_CLASS[job.status]} shrink-0`}>
          {STATUS_LABELS[job.status]}
        </span>
      </div>

      <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
        {cleanDescription}
      </p>

      {/* Skill tags */}
      {meta.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {meta.skills.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              {s}
            </span>
          ))}
        </div>
      )}

      {highlighted && (
        <span className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>
          Matches your skills
        </span>
      )}

      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text-muted)' }}>
          Escrow:{" "}
          <span className="font-mono font-semibold" style={{ color: 'var(--success)' }}>
            {usdcAmount} USDC
          </span>
        </span>
        <WalletName
          address={job.client.toBase58()}
          className="text-xs font-mono"
          style={{ color: 'var(--text-muted)' }}
        />
      </div>
    </Link>
  );
}
