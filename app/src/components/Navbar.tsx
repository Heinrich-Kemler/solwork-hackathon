"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

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
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#0f0f0f]/90 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">&#9881;</span>
          <h1 className="text-xl font-bold text-white tracking-tight">
            sol<span className="text-purple-400">work</span>
          </h1>
        </Link>

        <span className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">
          devnet
        </span>

        <div className="hidden sm:flex items-center gap-1 ml-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-purple-600/20 text-purple-400"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <WalletMultiButton />
    </nav>
  );
}
