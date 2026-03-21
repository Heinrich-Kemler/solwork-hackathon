"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { Github, Twitter, Linkedin, Globe, Send } from "lucide-react";
import {
  getProvider,
  getProgram,
  txInitProfile,
} from "@/lib/anchor";
import { useLocalProfile, type LocalProfile } from "@/lib/useLocalProfile";
import { useProfile } from "@/lib/useProfile";
import { useToast } from "@/components/TxToast";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function OnboardingPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { showToast } = useToast();
  const { exists, refresh: refreshProfile } = useProfile();
  const { saveProfile } = useLocalProfile(publicKey?.toBase58() ?? null);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [github, setGithub] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");
  const [telegram, setTelegram] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (skip = false) => {
    if (!wallet || !publicKey) return;
    setLoading(true);

    try {
      const localData: LocalProfile = {
        username: skip ? "" : username.trim() || publicKey.toBase58().slice(0, 8),
        bio: skip ? "" : bio.trim(),
        github: skip ? "" : github.trim(),
        twitter: skip ? "" : twitter.trim(),
        linkedin: skip ? "" : linkedin.trim(),
        website: skip ? "" : website.trim(),
        telegram: skip ? "" : telegram.trim(),
        avatar: skip ? "" : avatarUrl.trim(),
        skills: [],
        available: false,
      };
      saveProfile(localData);

      const provider = getProvider(connection, wallet);
      const program = getProgram(provider);
      const tx = await txInitProfile(program, wallet.publicKey);
      showToast("Profile created on-chain!", "success", tx);
      await refreshProfile();
      setTimeout(() => router.push("/jobs"), 1500);
    } catch (err) {
      console.error("Failed to create profile:", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center space-y-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Welcome to SolWork</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to get started.</p>
        <WalletMultiButton />
      </div>
    );
  }

  if (exists) {
    router.push("/jobs");
    return null;
  }

  return (
    <div className="max-w-[560px] mx-auto px-6 py-12 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Create Your Profile</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Your on-chain identity. Visible to clients and freelancers.
        </p>
      </div>

      <div className="card-static p-6 space-y-5">
        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden" style={{ background: 'var(--accent-subtle)', border: '2px solid var(--border)', color: 'var(--accent)' }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              publicKey!.toBase58().slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Profile picture URL (optional)</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="input w-full px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Display name <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="text"
            maxLength={50}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="satoshi"
            className="input w-full px-3 py-2"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Bio</label>
          <textarea
            maxLength={200}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Full-stack dev, Solana enthusiast..."
            rows={3}
            className="input w-full px-3 py-2"
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{bio.length}/200</p>
        </div>

        {/* Social links */}
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Social links (optional)</p>

          <div className="flex items-center gap-2">
            <Github size={16} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
            <input type="text" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="GitHub username" className="input flex-1 px-3 py-1.5 text-sm" />
          </div>

          <div className="flex items-center gap-2">
            <Twitter size={16} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
            <input type="text" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" className="input flex-1 px-3 py-1.5 text-sm" />
          </div>

          <div className="flex items-center gap-2">
            <Linkedin size={16} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
            <input type="text" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="LinkedIn username" className="input flex-1 px-3 py-1.5 text-sm" />
          </div>

          <div className="flex items-center gap-2">
            <Globe size={16} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" className="input flex-1 px-3 py-1.5 text-sm" />
          </div>

          <div className="flex items-center gap-2">
            <Send size={16} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
            <input type="text" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@telegram" className="input flex-1 px-3 py-1.5 text-sm" />
          </div>
        </div>
      </div>

      <button
        onClick={() => handleSubmit(false)}
        disabled={loading || !username.trim()}
        className="btn-primary w-full py-3 text-base"
      >
        {loading ? "Creating Profile..." : "Complete Profile"}
      </button>

      <button
        onClick={() => handleSubmit(true)}
        disabled={loading}
        className="block w-full text-center text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        Skip for now
      </button>
    </div>
  );
}
