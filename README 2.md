# solwork

**Trustless milestone-based freelance escrow on Solana.**

> Upwork takes 20% and holds your money for days. We take 0% and release it in 400 milliseconds.

Client posts a job and locks SOL in a PDA vault. Freelancer accepts. Client approves the deliverable and SOL releases instantly on-chain. No middlemen, no trust required.

## How It Works

1. **Post Job** — Client creates an escrow with a title, description, and SOL amount. Funds are locked in a program-derived vault.
2. **Accept** — A freelancer reviews the listing and accepts the job.
3. **Deliver** — Freelancer completes the work off-chain.
4. **Approve & Release** — Client approves and SOL transfers to the freelancer instantly. Or raises a dispute.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Rust + Anchor 0.32 |
| Blockchain | Solana (devnet) |
| Frontend | Next.js 16 + TypeScript |
| Styling | Tailwind CSS 4 |
| Wallet | Solana Wallet Adapter (Phantom, Solflare) |
| Cross-Chain | LI.FI bridge integration |
| Package Manager | pnpm |

## Project Structure

```
solwork/
  programs/solwork/src/
    lib.rs                    # Anchor escrow program (5 instructions)
  app/                        # Next.js frontend
    src/
      app/
        page.tsx              # Landing page
        jobs/page.tsx          # Job board with filters
        jobs/[id]/page.tsx     # Job detail + actions
        post/page.tsx          # Post a job form
        layout.tsx             # Root layout (wallet + toast providers)
        globals.css            # Dark theme styles
      components/
        WalletProvider.tsx     # Solana wallet context (devnet)
        Navbar.tsx             # Navigation + wallet connect
        CreateEscrow.tsx       # Job posting form (wired to on-chain)
        EscrowCard.tsx         # Escrow card with role-based actions
        TxToast.tsx            # Transaction notifications + explorer links
      lib/
        anchor.ts              # Anchor client, PDA helpers, tx wrappers
        useEscrows.ts          # React hooks for fetching escrows
        idl.json               # Generated program IDL
  tests/                       # Anchor integration tests
  target/idl/                  # Generated IDL from anchor build
  Anchor.toml                  # Anchor config (devnet)
```

## Program Instructions

| Instruction | Signer | Description |
|------------|--------|-------------|
| `create_escrow` | Client | Lock SOL and create a job listing |
| `accept_job` | Freelancer | Accept an open escrow |
| `approve_and_release` | Client | Approve work and release SOL to freelancer |
| `raise_dispute` | Client | Flag the escrow as disputed |
| `cancel_escrow` | Client | Cancel an open escrow and reclaim SOL |

## Demo Flow

1. Open the app and connect your Phantom/Solflare wallet (set to devnet)
2. Click **Post a Job** in the navbar
3. Fill in a job title, description, and SOL amount
4. Click **Lock SOL & Post Job** — approve the transaction in your wallet
5. Navigate to **Jobs** to see your posted escrow
6. From a different wallet, click **Accept Job** on an open listing
7. As the client, click **Approve & Release SOL** to pay the freelancer instantly
8. Click the explorer link in the toast notification to verify on-chain

## Prerequisites

- Rust (via rustup)
- Solana CLI
- Anchor CLI via AVM
- Node.js 18+
- pnpm

## Getting Started

```bash
# 1. Build the Anchor program
cd solwork
anchor build

# 2. Start the frontend
cd app
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Get devnet SOL

```bash
solana config set --url devnet
solana airdrop 2
```

Or use [faucet.solana.com](https://faucet.solana.com)

## Roadmap

- [x] Trustless escrow smart contract (Anchor)
- [x] Frontend with wallet connect and on-chain transactions
- [x] Job board with status filters
- [x] Role-based actions (client vs freelancer)
- [x] Transaction notifications with explorer links
- [ ] Cross-chain deposits via LI.FI widget (in progress)
- [ ] Multi-milestone escrow support
- [ ] On-chain dispute resolution with third-party arbiter
- [ ] Reputation system (on-chain reviews)
- [ ] USDC support via SPL token escrow
- [ ] Deploy to mainnet-beta

## License

MIT
