"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useJobs } from "@/lib/useJobs";
import { useViewMode } from "@/lib/useViewMode";
import { useProgramLogs } from "@/lib/useProgramLogs";
import { useToast } from "@/components/TxToast";
import JobCard from "@/components/JobCard";
import { smallestToUsdc, type JobStatus } from "@/lib/anchor";
import ProfileGate from "@/components/ProfileGate";

const FILTERS: { label: string; value: JobStatus | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Open", value: "Open" },
  { label: "Active", value: "Active" },
  { label: "Pending Review", value: "PendingReview" },
  { label: "Complete", value: "Complete" },
  { label: "Disputed", value: "Disputed" },
  { label: "Cancelled", value: "Cancelled" },
];

type SortKey = "newest" | "highest" | "expiring";

export default function JobsPage() {
  const { jobs, loading, error, refresh } = useJobs();
  const { publicKey } = useWallet();
  const { mode } = useViewMode();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<JobStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // Real-time updates
  useProgramLogs(() => {
    refresh();
    showToast("Job board updated", "info");
  });

  // Pipeline: mode → search → status filter → amount filter → sort
  const result = useMemo(() => {
    let list = jobs;

    // Mode filter
    if (publicKey) {
      list =
        mode === "hiring"
          ? list.filter((j) => j.client.equals(publicKey))
          : list.filter(
              (j) => j.status === "Open" && !j.client.equals(publicKey)
            );
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filter !== "All") {
      list = list.filter((j) => j.status === filter);
    }

    // Amount range
    const min = parseFloat(minAmount);
    const max = parseFloat(maxAmount);
    if (!isNaN(min)) {
      list = list.filter((j) => smallestToUsdc(j.amount) >= min);
    }
    if (!isNaN(max)) {
      list = list.filter((j) => smallestToUsdc(j.amount) <= max);
    }

    // Sort
    list = [...list];
    switch (sortBy) {
      case "newest":
        list.sort((a, b) => b.createdAt.toNumber() - a.createdAt.toNumber());
        break;
      case "highest":
        list.sort((a, b) => b.amount.toNumber() - a.amount.toNumber());
        break;
      case "expiring":
        list.sort((a, b) => a.expiryTime.toNumber() - b.expiryTime.toNumber());
        break;
    }

    return list;
  }, [jobs, publicKey, mode, search, filter, minAmount, maxAmount, sortBy]);

  const modeLabel = mode === "hiring" ? "Your Posted Jobs" : "Available Jobs";

  // Count for filters (use mode-filtered base, not final result)
  const modeBase = useMemo(() => {
    if (!publicKey) return jobs;
    return mode === "hiring"
      ? jobs.filter((j) => j.client.equals(publicKey))
      : jobs.filter(
          (j) => j.status === "Open" && !j.client.equals(publicKey)
        );
  }, [jobs, publicKey, mode]);

  return (
    <ProfileGate>
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Board</h1>
          {publicKey && (
            <p className="text-sm text-gray-500 mt-0.5">{modeLabel}</p>
          )}
        </div>
        {mode === "hiring" && (
          <Link
            href="/post"
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-sm transition-colors"
          >
            + Post a Job
          </Link>
        )}
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs by title or description..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="newest">Newest First</option>
          <option value="highest">Highest Paying</option>
          <option value="expiring">Expiring Soon</option>
        </select>
      </div>

      {/* Amount range filter */}
      <div className="flex gap-3 items-center">
        <span className="text-xs text-gray-500">USDC range:</span>
        <input
          type="number"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          placeholder="Min"
          className="w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <span className="text-gray-600">—</span>
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="Max"
          className="w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {(minAmount || maxAmount) && (
          <button
            onClick={() => {
              setMinAmount("");
              setMaxAmount("");
            }}
            className="text-xs text-gray-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const count =
            f.value === "All"
              ? modeBase.length
              : modeBase.filter((j) => j.status === f.value).length;
          if (count === 0 && f.value !== "All") return null;
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

      {/* Results */}
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
          <p className="text-red-400 mb-2">Failed to load jobs</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={refresh}
            className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      ) : result.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">
            {search
              ? "No jobs match your search."
              : modeBase.length === 0
              ? mode === "hiring"
                ? "You haven't posted any jobs yet."
                : "No open jobs available right now."
              : "No jobs match these filters."}
          </p>
          {mode === "hiring" && modeBase.length === 0 && (
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
          {result.map((job) => (
            <JobCard
              key={job.publicKey.toBase58()}
              job={job}
              onAction={refresh}
            />
          ))}
        </div>
      )}
    </div>
    </ProfileGate>
  );
}
