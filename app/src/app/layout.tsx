import Script from "next/script";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import { ToastProvider } from "@/components/TxToast";
import Navbar from "@/components/Navbar";
import WelcomeModal from "@/components/WelcomeModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "solwork — Trustless Freelance Escrow on Solana",
  description:
    "Milestone-based freelance escrow dApp. Client locks SOL, freelancer delivers, funds release instantly on approval.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-noise" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <WalletProvider>
          <ToastProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <WelcomeModal />
          </ToastProvider>
        </WalletProvider>
        <Script
          src="https://terminal.jup.ag/main-v3.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
