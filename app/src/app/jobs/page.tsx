"use client";

import { useState } from "react";
import Link from "next/link";
import { useEscrows } from "@/lib/useEscrows";
import EscrowCard from "@/components/EscrowCard";
import type { EscrowStatus } from "@/lib/anchor";

const FILTERS: { label: string; value: EscrowStatus | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Open", value: "Open" },
  { label: "In Progress", value: "InProgress" },
  { label: "Completed", value: "Completed" },
  { label: "Disputed", value: "Disputed" },
];

export default function JobsPage() {
  const { escrows, loading, error, refresh } = useEscrows();
  const [filter, setFilter] = useState<EscrowStatus | "All">("All");

  const filtered =
    filter === "All"
      ? escrows
      : escrows.filter((e) => e.status === filter);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Job Board</h1>
        <Link
          href="/post"
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-sm transition-colors"
        >
          + Post a Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const count =
            f.value === "All"
              ? escrows.length
              : escrows.filter((e) => e.status === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                  : "text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600"
              }`}
            >
              {f.label}
              <span className="ml-1.5 text-xs opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 animate-pulse"
            >
              <div className="h-5 w-1/3 bg-gray-700 rounded mb-3" />
              <div className="h-4 w-2/3 bg-gray-700/50 rounded mb-2" />
              <div className="h-4 w-1/4 bg-gray-700/30 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 mb-2">Failed to load escrows</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={refresh}
            className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">
            {escrows.length === 0
              ? "No escrows yet. Be the first to post a job!"
              : "No jobs match this filter."}
          </p>
          {escrows.length === 0 && (
            <Link
              href="/post"
              className="mt-4 inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
            >
              Post a Job
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((escrow) => (
            <EscrowCard
              key={escrow.publicKey.toBase58()}
              escrow={escrow}
              onAction={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
