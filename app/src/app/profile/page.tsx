"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Github, Twitter, Linkedin, Globe, Send, Copy, ExternalLink, Pencil } from "lucide-react";
import { useProfile } from "@/lib/useProfile";
import { useJobs } from "@/lib/useJobs";
import { useTxHistory, type TxRecord } from "@/lib/useTxHistory";
import { useUsdcBalance } from "@/lib/useUsdcBalance";
import { useLocalProfile, calcCompleteness } from "@/lib/useLocalProfile";
import EditProfileModal from "@/components/EditProfileModal";
import {
  getProvider,
  getProgram,
  txInitProfile,
  smallestToUsdc,
  explorerAccountUrl,
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  calcReputation,
  getReputationTier,
} from "@/lib/anchor";
import { useToast } from "@/components/TxToast";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

function TxRow({ tx }: { tx: TxRecord }) {
  const sig = tx.signature;
  const date = tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleDateString() : "";
  const time = tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${tx.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
        <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
          {sig.slice(0, 8)}...{sig.slice(-6)}
        </a>
      </div>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date} {time}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { showToast } = useToast();
  const { profile, loading: profileLoading, exists, needsRecreate, refresh: refreshProfile } = useProfile();
  const { jobs } = useJobs();
  const { balance } = useUsdcBalance();
  const { transactions, loading: txLoading } = useTxHistory(10);
  const { profile: localProfile, saveProfile } = useLocalProfile(publicKey?.toBase58() ?? null);
  const [initLoading, setInitLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"posted" | "completed">("posted");
  const [showEdit, setShowEdit] = useState(false);

  if (!connected || !publicKey) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Profile</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to view your profile</p>
        <WalletMultiButton />
      </div>
    );
  }

  const myPostedJobs = jobs.filter((j) => j.client.equals(publicKey));
  const myWorkedJobs = jobs.filter(
    (j) => j.freelancer && !j.freelancer.equals(PublicKey.default) && j.freelancer.equals(publicKey)
  );

  const handleInitProfile = async () => {
    if (!wallet) return;
    setInitLoading(true);
    try {
      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      const tx = await txInitProfile(program, wallet.publicKey);
      showToast("Profile created!", "success", tx);
      refreshProfile();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setInitLoading(false);
    }
  };

  const addr = publicKey.toBase58();
  const displayName = localProfile.username || addr.slice(0, 8);
  const repScore = profile ? calcReputation(profile.jobsCompleted, profile.totalEarned, profile.disputesRaised) : 0;
  const tier = getReputationTier(repScore);
  const { score: completeness, missing } = calcCompleteness(localProfile);

  const copyAddr = () => { navigator.clipboard.writeText(addr); showToast("Address copied", "info"); };

  const socialLinks = [
    { url: localProfile.github ? `https://github.com/${localProfile.github}` : "", icon: Github },
    { url: localProfile.twitter ? `https://x.com/${localProfile.twitter.replace('@','')}` : "", icon: Twitter },
    { url: localProfile.linkedin ? `https://linkedin.com/in/${localProfile.linkedin}` : "", icon: Linkedin },
    { url: localProfile.website || "", icon: Globe },
    { url: localProfile.telegram ? `https://t.me/${localProfile.telegram.replace('@','')}` : "", icon: Send },
  ].filter((l) => l.url);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      {/* Header card */}
      <div className="card-static p-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden" style={{ background: 'var(--accent-subtle)', border: '2px solid var(--border)', color: 'var(--accent)' }}>
            {localProfile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={localProfile.avatar} alt="" className="w-full h-full object-cover" />
            ) : addr.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</h1>
              {exists && <span className={`badge ${tier.class}`}>{tier.label}</span>}
              {localProfile.available && (
                <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--success)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Available
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{addr.slice(0, 8)}...{addr.slice(-6)}</span>
              <button onClick={copyAddr}><Copy size={12} style={{ color: 'var(--text-muted)' }} /></button>
              <a href={explorerAccountUrl(addr)} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} style={{ color: 'var(--text-muted)' }} /></a>
            </div>

            {localProfile.bio && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{localProfile.bio}</p>}

            {/* Skills */}
            {localProfile.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {localProfile.skills.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid rgba(124,58,237,0.15)' }}>{s}</span>
                ))}
              </div>
            )}

            {socialLinks.length > 0 && (
              <div className="flex gap-2 pt-1">
                {socialLinks.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}>
                    <l.icon size={14} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-right">
              <span className="font-mono text-lg font-semibold" style={{ color: 'var(--success)' }}>{balance.toFixed(2)}</span>
              <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>USDC</span>
            </div>
            <button onClick={() => setShowEdit(true)} className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
              <Pencil size={12} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Completeness bar */}
      {completeness < 100 && (
        <div className="card-static p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Profile Strength: {completeness}%</p>
            <button onClick={() => setShowEdit(true)} className="text-xs" style={{ color: 'var(--accent)' }}>Complete profile</button>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${completeness}%`, background: completeness >= 80 ? 'var(--success)' : 'var(--accent)' }} />
          </div>
          {missing.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {missing.map((m) => (
                <span key={m} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{m}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {profileLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1,2,3,4,5].map((i) => <div key={i} className="card-static p-4 animate-pulse"><div className="h-8 rounded" style={{ background: 'var(--bg-elevated)' }} /></div>)}
        </div>
      ) : exists && profile ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Reputation", value: repScore.toString() },
            { label: "Completed", value: profile.jobsCompleted.toString() },
            { label: "Posted", value: profile.jobsPosted.toString() },
            { label: "Earned", value: `$${profile.totalEarned.toFixed(0)}` },
            { label: "Spent", value: `$${profile.totalSpent.toFixed(0)}` },
          ].map((s) => (
            <div key={s.label} className="card-static p-4 text-center">
              <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{s.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-static p-6 text-center space-y-3">
          <p style={{ color: 'var(--text-secondary)' }}>{needsRecreate ? "Your profile needs to be updated. Please recreate it." : "No on-chain profile found."}</p>
          <button onClick={handleInitProfile} disabled={initLoading} className="btn-primary px-6 py-2.5">
            {initLoading ? "Creating..." : needsRecreate ? "Recreate Profile" : "Create Profile"}
          </button>
        </div>
      )}

      {/* Activity tabs */}
      <div>
        <div className="flex gap-1 mb-4 p-0.5 rounded-md inline-flex" style={{ background: 'var(--bg-elevated)' }}>
          <button onClick={() => setActiveTab("posted")} className="px-4 py-1.5 rounded text-sm font-medium" style={{ background: activeTab === "posted" ? 'var(--accent)' : 'transparent', color: activeTab === "posted" ? '#fff' : 'var(--text-muted)' }}>
            Posted ({myPostedJobs.length})
          </button>
          <button onClick={() => setActiveTab("completed")} className="px-4 py-1.5 rounded text-sm font-medium" style={{ background: activeTab === "completed" ? 'var(--accent)' : 'transparent', color: activeTab === "completed" ? '#fff' : 'var(--text-muted)' }}>
            Worked ({myWorkedJobs.length})
          </button>
        </div>
        {(activeTab === "posted" ? myPostedJobs : myWorkedJobs).length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
            {activeTab === "posted" ? "No jobs posted yet." : "No jobs worked yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {(activeTab === "posted" ? myPostedJobs : myWorkedJobs).slice(0, 10).map((job) => (
              <Link key={job.publicKey.toBase58()} href={`/jobs/${job.publicKey.toBase58()}`} className="card-static flex items-center justify-between p-3">
                <span className="text-sm font-medium truncate mr-3" style={{ color: 'var(--text-primary)' }}>{job.title}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono" style={{ color: 'var(--success)' }}>{smallestToUsdc(job.amount)} USDC</span>
                  <span className={STATUS_BADGE_CLASS[job.status]}>{STATUS_LABELS[job.status]}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Recent Transactions</h2>
        {txLoading ? (
          <div className="animate-pulse space-y-2">{[1,2,3].map((i) => <div key={i} className="h-8 rounded" style={{ background: 'var(--bg-elevated)' }} />)}</div>
        ) : transactions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No transactions found.</p>
        ) : (
          <div className="card-static p-4">{transactions.map((tx) => <TxRow key={tx.signature} tx={tx} />)}</div>
        )}
      </div>

      {/* Edit Modal */}
      <EditProfileModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        profile={localProfile}
        onSave={(data) => { saveProfile(data); showToast("Profile updated", "success"); }}
      />
    </div>
  );
}
