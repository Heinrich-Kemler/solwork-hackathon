"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { useUsdcBalance } from "@/lib/useUsdcBalance";
import { useViewMode } from "@/lib/useViewMode";
import { useTheme } from "@/lib/useTheme";
import { useLocalProfile } from "@/lib/useLocalProfile";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/post", label: "Post a Job" },
  { href: "/profile", label: "Profile" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { connected, publicKey } = useWallet();
  const { balance } = useUsdcBalance();
  const { mode, setMode, hydrated } = useViewMode();
  const { theme, toggle: toggleTheme, hydrated: themeHydrated } = useTheme();
  const { profile: localProfile } = useLocalProfile(publicKey?.toBase58() ?? null);

  return (
    <nav className="nav-bar sticky top-0 z-40 flex items-center justify-between px-6 py-3.5">
      <div className="flex items-center gap-5">
        <Link href="/" className="flex items-center gap-1.5">
          <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Sol<span style={{ color: 'var(--accent)' }}>Work</span>
          </span>
        </Link>

        <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          devnet
        </span>

        <div className="hidden sm:flex items-center gap-0.5 ml-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                color: pathname === link.href ? 'var(--accent)' : 'var(--text-muted)',
                background: pathname === link.href ? 'var(--accent-subtle)' : 'transparent',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Mode Toggle */}
        {connected && hydrated && (
          <div className="hidden sm:flex items-center rounded-md p-0.5" style={{ background: 'var(--bg-elevated)' }}>
            <button
              onClick={() => setMode("hiring")}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: mode === "hiring" ? 'var(--accent)' : 'transparent',
                color: mode === "hiring" ? '#fff' : 'var(--text-muted)',
              }}
            >
              Hiring
            </button>
            <button
              onClick={() => setMode("working")}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: mode === "working" ? 'var(--accent)' : 'transparent',
                color: mode === "working" ? '#fff' : 'var(--text-muted)',
              }}
            >
              Working
            </button>
          </div>
        )}

        {/* USDC Balance */}
        {connected && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <span className="font-mono font-semibold" style={{ color: 'var(--success)' }}>
              {balance.toFixed(2)}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>USDC</span>
          </span>
        )}

        {/* Profile Avatar */}
        {connected && publicKey && (
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}
          >
            {localProfile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={localProfile.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              publicKey.toBase58().slice(0, 2).toUpperCase()
            )}
          </Link>
        )}

        {/* Theme Toggle */}
        {themeHydrated && (
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        )}

        <WalletMultiButton />
      </div>
    </nav>
  );
}
