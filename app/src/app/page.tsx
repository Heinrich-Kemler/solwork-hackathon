"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useLiveStats } from "@/lib/useLiveStats";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function Home() {
  const { stats, loading: statsLoading } = useLiveStats();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="hero-bg flex flex-col items-center justify-center text-center px-6 py-28 md:py-40">
        <p className="text-sm uppercase tracking-widest font-semibold mb-5" style={{ color: 'var(--accent)' }}>
          Built on Solana
        </p>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-tight">
          <span className="text-gradient">The Future of Freelance Work</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl max-w-2xl leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Trustless. Instant. Global.
          <br className="hidden md:block" />
          No middlemen, no fees, no waiting.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center">
          <WalletMultiButton />
          <Link href="/jobs" className="btn-ghost px-6 py-3">
            Browse Jobs
          </Link>
        </div>
      </section>

      {/* Live On-Chain Stats */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-3 py-8" style={{ borderColor: 'var(--border)' }}>
          {[
            { value: statsLoading ? "\u2014" : stats.totalJobs.toString(), label: "Jobs Posted" },
            { value: statsLoading ? "\u2014" : `$${stats.totalUsdcLocked.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, label: "USDC Secured" },
            { value: statsLoading ? "\u2014" : stats.totalCompleted.toString(), label: "Jobs Completed" },
          ].map((stat, i) => (
            <div key={stat.label} className="text-center px-4" style={i > 0 ? { borderLeft: '1px solid var(--border)' } : {}}>
              <div className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--accent)' }}>{stat.value}</div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The Problem */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-3" style={{ color: 'var(--text-primary)' }}>The Problem</h2>
        <p className="text-center mb-12 max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
          Freelance platforms are broken. Here&apos;s what you&apos;re dealing with today.
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            { title: "20% Platform Fees", desc: "Upwork takes a fifth of every dollar you earn. That\u2019s thousands lost per year." },
            { title: "5\u201310 Day Payment Holds", desc: "You deliver the work, then wait over a week to get paid. Every. Single. Time." },
            { title: "Clients Can Ghost", desc: "No protection if a client disappears after work is done. Your hours, wasted." },
            { title: "Centralized Control", desc: "Platforms can ban you, freeze funds, or change the rules overnight. You own nothing." },
          ].map((item) => (
            <div key={item.title} className="card-static p-6 space-y-2">
              <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Our Solution */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center mb-3" style={{ color: 'var(--text-primary)' }}>Our Solution</h2>
          <p className="text-center mb-12 max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            SolWork replaces middlemen with smart contracts. Every guarantee is enforced by code.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "On-Chain Escrow", desc: "Funds locked in a smart contract. Released instantly on approval. No intermediary." },
              { title: "400ms Payments", desc: "Solana settles in under a second. Client approves, freelancer gets paid. Done." },
              { title: "Auto-Release", desc: "If the client goes silent, funds auto-release to the freelancer after the grace period." },
              { title: "On-Chain Reputation", desc: "Your track record lives on the blockchain. No platform can delete or manipulate it." },
              { title: "Cross-Chain Deposits", desc: "Pay from Ethereum, Arbitrum, Base, or any chain. Bridged to Solana USDC automatically." },
              { title: "Dispute Resolution", desc: "Both parties can raise disputes. Funds stay locked until resolved fairly on-chain." },
            ].map((item) => (
              <div key={item.title} className="space-y-2 text-center p-4">
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12" style={{ color: 'var(--text-primary)' }}>How It Works</h2>
        <div className="grid md:grid-cols-3 gap-10 text-center">
          {[
            { step: "1", title: "Post & Lock", desc: "Client posts a job and locks USDC in a trustless on-chain escrow. Funds are secured immediately." },
            { step: "2", title: "Accept & Deliver", desc: "Freelancer accepts the job, completes the work, and submits deliverables for review." },
            { step: "3", title: "Approve & Release", desc: "Client approves the work. USDC releases to the freelancer in 400 milliseconds." },
          ].map((item) => (
            <div key={item.step} className="space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center font-bold text-xl" style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(124,58,237,0.2)', color: 'var(--accent)' }}>
                {item.step}
              </div>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-14">
          <Link href="/post" className="btn-primary px-8 py-4 text-lg inline-block">
            Post Your First Job
          </Link>
        </div>
      </section>
    </div>
  );
}
