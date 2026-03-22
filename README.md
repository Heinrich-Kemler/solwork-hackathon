# Accord — Trustless Freelance. On-Chain.

> **"The code is the middleman."**

Accord is a decentralised freelance escrow platform built on Solana. Clients lock USDC in a trustless smart contract before work begins. Freelancers deliver. Payment releases in 400ms on approval — no platform taking 20%, no account bans, no waiting 5-14 days for your money.

Built at the **Superteam Solana Hackathon 2026**.

---

## The Problem

The global freelance platform market is worth **$5.15 billion today**, growing to $22.5B by 2035. 76.4 million Americans freelanced in 2024, contributing **$1.27 trillion** to the US economy.

Yet every major platform:
- Takes **20% of every transaction** (Upwork, Fiverr)
- Holds payments for **5–14 days**
- Can **ban your account** and withhold your earnings without warning
- Offers **zero transparency** on where your money actually is

Freelancers have no ownership. Clients have no accountability. Platforms have all the power.

---

## The Solution

Accord replaces the platform with a smart contract.

- Client posts a job → **USDC locks in escrow** before work starts
- Freelancer delivers → client reviews
- Client approves → **400ms payment release** directly to freelancer
- Client ghosts? → **Auto-release** after grace period, no human needed
- Dispute raised? → **Independent on-chain arbitration**

No middleman. No 20% cut. No one can ban you. The code enforces every agreement.

**We charge 1% on completion — 20x cheaper than every competitor.**

---

## Key Features

| Feature | Description |
|---|---|
| ⚡ **400ms payments** | Solana finality — fastest in the industry |
| 🔒 **Non-custodial escrow** | Funds always in the smart contract, never with us |
| 🛡️ **Confirmation guardrails** | Checkbox confirmation before irreversible payment release |
| ⏱️ **Grace period auto-release** | Freelancer gets paid automatically if client goes silent |
| ⚖️ **Independent arbitration** | On-chain dispute resolution without a company deciding |
| 🌐 **Cross-chain deposits** | Bridge from Ethereum, Base, Arbitrum via LI.FI |
| 🔄 **In-app swap** | SOL → USDC via Jupiter, never leave the app |
| 🐦 **Solana Blinks** | Post or accept jobs from any URL, tweet, or social post |
| 🏅 **On-chain reputation** | Verifiable work history — can't be deleted or faked |
| 🔑 **Activation fee** | 0.01 SOL one-time fee on first job post (spam prevention) |
| 👤 **Profile system** | Skills, avatar, completeness score, .sol name resolution |
| 🏆 **Leaderboard** | Top freelancers ranked by on-chain reputation |

---

## Built on the Best of Solana

> "We didn't reinvent the wheel. We assembled the best wheels on Solana into one platform."

| Integration | Purpose |
|---|---|
| **Anchor** | Battle-tested Solana smart contract framework |
| **Jupiter** | In-app SOL → USDC swap with deepest liquidity |
| **LI.FI / Jumper** | Cross-chain bridge from any network to Solana USDC |
| **Solana Blinks/Actions** | Hire or apply from any URL or social post |
| **Civic** | Optional on-chain identity verification for high-value jobs |
| **Bonfida SNS** | Human-readable .sol profile names |
| **Dialect** | On-chain messaging between client and freelancer |
| **Resend** | Real-time email notifications for on-chain events |
| **dRPC** | Private, stable RPC — no public endpoint throttling |

---

## Smart Contract

- **Program ID:** `3HP12EX32vPRnocDfy1SqRpFZSJUnyWkCDPGarhn9CGj`
- **Network:** Solana Devnet
- **Framework:** Anchor (Rust)
- **USDC Mint (devnet):** `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- **Treasury:** `GyyjsG67zY21B2BYfLsNUbN9hZLfog9DZYRjnZuHWzfQ`

### On-Chain Instructions

| Instruction | Description |
|---|---|
| `init_profile` | Create on-chain user profile with reputation tracking |
| `create_job` | Client locks USDC in escrow (0.01 SOL activation fee on first post) |
| `accept_job` | Freelancer accepts open job (Open → Active) |
| `submit_work` | Freelancer submits deliverables (Active → PendingReview) |
| `approve_job` | Client releases USDC to freelancer (400ms) |
| `partial_release` | Client releases a payment tranche before full completion |
| `cancel_job` | Client cancels and receives full refund (Open jobs only) |
| `dispute_job` | Either party raises a dispute |
| `cast_vote` | Eligible juror votes on dispute outcome |
| `resolve_dispute` | Finalise dispute — funds go to winner |
| `claim_after_grace` | Freelancer claims payment after grace period if client is unresponsive |
| `expire_job` | Refund client on expired jobs |
| `set_referral` | Set referrer for on-chain earnings share |
| `update_avatar` | Store avatar URI on-chain (IPFS/Arweave foundation) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Anchor (Rust) · Solana Devnet |
| Frontend | Next.js 16 · TypeScript · Tailwind CSS |
| Wallet | Solana Wallet Adapter (Phantom, Solflare) |
| Payments | USDC (SPL Token) |
| Swap | Jupiter Terminal |
| Bridge | LI.FI / Jumper Exchange |
| Identity | Bonfida SNS · Civic |
| Messaging | Dialect |
| Notifications | Resend |
| RPC | dRPC (devnet + mainnet) |

---

## Running Locally

### Prerequisites
- Node.js 20+ / pnpm
- Rust + Cargo
- Solana CLI
- Anchor CLI

### Smart Contract
```bash
anchor build
anchor test -- --features local-testing
anchor deploy --provider.cluster devnet
```

### Frontend
```bash
cd app
pnpm install
cp .env.example .env.local   # fill in your values
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables
```bash
# Required
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com

# Optional — for stable RPC (recommended)
NEXT_PUBLIC_MAINNET_RPC_URL=your_mainnet_rpc

# Optional — for email notifications
RESEND_API_KEY=re_your_key

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Demo Flow

1. Connect Phantom wallet on Solana devnet
2. Complete onboarding — name, bio, skills, avatar
3. **Client:** Post a job → USDC locks in escrow
4. **Freelancer:** Switch wallet → accept job → submit work
5. **Client:** Review → confirm satisfaction → release payment
6. Watch the **400ms tx** confirm on Solana Explorer
7. Open Top-Up modal → swap SOL→USDC via Jupiter → bridge from any chain via LI.FI
8. Check the leaderboard — on-chain reputation updates live

Load demo data: open `/?seed=true` to pre-populate the leaderboard.

---

## Project Structure

```
accord/
├── programs/solwork/src/
│   └── lib.rs                  # Full Anchor program (2000+ lines)
├── target/idl/solwork.json     # Generated IDL
├── tests/                      # Integration + devnet smoke tests
├── app/
│   ├── src/app/                # Next.js pages
│   │   ├── page.tsx            # Landing page
│   │   ├── jobs/               # Job board + job detail
│   │   ├── post/               # Create job
│   │   ├── profile/            # User profile + reputation
│   │   ├── leaderboard/        # Top freelancers
│   │   ├── onboarding/         # Profile setup
│   │   └── api/                # Blinks/Actions + notifications
│   ├── src/components/         # UI components
│   │   ├── ConfirmReleaseModal # Payment guardrail
│   │   ├── DisputeVoting       # Jury voting UI
│   │   ├── TopUpModal          # Jupiter + LI.FI bridge
│   │   ├── AvatarUpload        # Profile picture upload
│   │   └── ...
│   └── src/lib/                # Anchor helpers, hooks, IDL
│       ├── anchor.ts           # All on-chain instruction helpers
│       ├── idl.json            # Program IDL
│       └── ...
└── Anchor.toml
```

---

## Roadmap

**Phase 2 — Enterprise:**
- Multi-sig approvals for teams and agencies
- Retainer contracts (recurring automated payments)
- SLA enforcement (auto-refund on missed deadlines)
- White-label escrow API

**Phase 3 — Scale:**
- Mainnet launch with full security audit
- On-chain work receipt NFTs (verifiable CV)
- Streaming payments
- Mobile app

**Phase 4 — Network Effects:**
- Reputation as credit score (high rep → lower fees)
- AI-assisted dispute analysis
- Membership tiers for premium project access
- Global freelancer network

---

## Competitor Comparison

| | Accord | Upwork | Fiverr | Braintrust |
|---|---|---|---|---|
| Fees | **1%** | 20% | 20% | ~8% |
| Payment speed | **400ms** | 5 days | 14 days | Days |
| Censorship risk | **None** | High | High | Medium |
| Cross-chain | **✅** | ❌ | ❌ | ❌ |
| On-chain reputation | **✅** | ❌ | ❌ | ❌ |
| Non-custodial | **✅** | ❌ | ❌ | ❌ |
| Blinks support | **✅** | ❌ | ❌ | ❌ |

---

## Solana Blinks / Actions

Test the Blinks API via [dial.to](https://dial.to):
```
https://dial.to/?action=solana-action:https://your-domain/api/actions/post-job
```

API routes:
- `POST /api/actions/post-job` — post a job as a Blink
- `GET/POST /api/actions/accept-job/[id]` — accept a job from any URL

---

*Built at Superteam Solana Hackathon 2026.*

*"Every freelancer deserves to get paid. Every client deserves what they paid for. No platform should be able to take that away."*
