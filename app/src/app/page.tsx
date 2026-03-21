"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 md:py-32">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-tight">
          Trustless Freelance Escrow
          <br />
          <span className="text-purple-400">on Solana</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl leading-relaxed">
          Upwork takes 20% and holds your money for days.
          <br className="hidden md:block" />{" "}
          We take <span className="text-white font-semibold">0%</span> and
          release it in{" "}
          <span className="text-purple-400 font-semibold">
            400 milliseconds
          </span>
          .
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center">
          <WalletMultiButton />
          <Link
            href="/jobs"
            className="px-6 py-3 border border-gray-700 hover:border-gray-500 rounded-lg font-semibold text-gray-300 hover:text-white transition-colors"
          >
            Browse Jobs &rarr;
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-800 bg-gray-900/30">
        <div className="max-w-4xl mx-auto grid grid-cols-3 divide-x divide-gray-800 py-8">
          {[
            { value: "0%", label: "Platform Fees" },
            { value: "400ms", label: "Settlement Time" },
            { value: "100%", label: "On-Chain" },
          ].map((stat) => (
            <div key={stat.label} className="text-center px-4">
              <div className="text-2xl md:text-3xl font-bold text-purple-400">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-8 text-center">
          {[
            {
              step: "1",
              title: "Post Job",
              desc: "Client posts a job and locks SOL in a trustless escrow",
            },
            {
              step: "2",
              title: "Accept",
              desc: "Freelancer reviews the listing and accepts the gig",
            },
            {
              step: "3",
              title: "Deliver",
              desc: "Freelancer completes the work and submits",
            },
            {
              step: "4",
              title: "Release",
              desc: "Client approves and SOL releases instantly on-chain",
            },
          ].map((item) => (
            <div key={item.step} className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-lg">
                {item.step}
              </div>
              <h3 className="font-semibold text-white text-lg">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/post"
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-lg transition-colors inline-block"
          >
            Post Your First Job
          </Link>
        </div>
      </section>

      {/* Cross-chain */}
      <section className="border-t border-gray-800 bg-gray-900/20">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Pay From Any Chain</h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Fund your escrow from Ethereum, Arbitrum, Base, or any supported
            chain. We bridge it automatically via LI.FI. Your funds arrive on
            Solana in under 2 minutes.
          </p>
        </div>
      </section>
    </div>
  );
}
