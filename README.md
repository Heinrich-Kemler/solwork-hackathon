# Accord

**Trustless Freelance. On-Chain.**

Accord is a milestone-based freelance escrow protocol on Solana. Clients post jobs and lock USDC in a trustless PDA vault. Freelancers accept, deliver, and get paid instantly on approval.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Anchor (Rust) on Solana |
| Frontend | Next.js 16 + TypeScript + Tailwind CSS |
| Wallet | Solana Wallet Adapter (Phantom, Solflare) |
| Token | USDC (SPL Token) |
| Network | Solana Devnet |
| Names | SNS (.sol name resolution) |
| Notifications | Resend (email) |
| Cross-chain | LI.FI / Jumper Exchange (bridge) |
| Swap | Jupiter Terminal (SOL → USDC) |

## Program

- **Program ID:** `3HP12EX32vPRnocDfy1SqRpFZSJUnyWkCDPGarhn9CGj`
- **Network:** Solana Devnet
- **USDC Mint:** `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## On-Chain Instructions

| Instruction | Description |
|-------------|-------------|
| `init_profile` | Create on-chain user profile |
| `create_job` | Client locks USDC in escrow |
| `accept_job` | Freelancer accepts (Open → Active) |
| `submit_work` | Freelancer submits deliverables (Active → PendingReview) |
| `approve_job` | Client releases USDC (PendingReview → Complete) |
| `partial_release` | Client releases partial payment tranche |
| `cancel_job` | Client cancels and gets refund (Open only) |
| `dispute_job` | Either party raises dispute |
| `initiate_dispute_vote` | Start jury voting on dispute |
| `cast_vote` | Juror votes on dispute outcome |
| `resolve_dispute` | Finalize dispute resolution |
| `set_referral` | Set referrer for earnings share |
| `expire_job` | Refund expired jobs |
| `claim_after_grace` | Auto-release after grace period |

## Integrations

### SNS (.sol Names)
Wallet addresses resolve to `.sol` names where available via `@bonfida/spl-name-service`.

### Solana Blinks / Actions
API routes at `/api/actions/post-job` and `/api/actions/accept-job/[id]` implement the Solana Actions spec. Test via [dial.to](https://dial.to):
```
https://dial.to/?action=solana-action:https://your-domain/api/actions/post-job
```

### Email Notifications (Resend)
Set up in `.env.local`:
```
RESEND_API_KEY=re_your_api_key_here
```
Sends notifications for: job accepted, work submitted, payment released, dispute raised.

### Jupiter Terminal (SOL → USDC Swap)
Embedded inline on `/post` page and in the Top Up modal. Auto-refreshes USDC balance after swap.

### LI.FI Bridge
Jumper Exchange embedded in the Top Up modal for cross-chain bridging to Solana USDC.

## How to Run Locally

### Prerequisites
- Node.js 18+ / pnpm
- Rust + Cargo + Solana CLI + Anchor CLI

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
pnpm dev
```

### Environment Variables (`.env.local`)
```
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com    # optional, defaults to devnet
RESEND_API_KEY=re_...                                 # optional, for email notifications
NEXT_PUBLIC_APP_URL=http://localhost:3000              # optional, for email links
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Flow

1. Connect wallet (Phantom/Solflare on devnet)
2. Complete onboarding profile (name, bio, skills, avatar)
3. Post a job — set title, category, skills, USDC amount
4. Switch to "Working" mode — browse and accept open jobs
5. Submit work as freelancer
6. Approve and release payment as client
7. View profile stats, reputation score, leaderboard

## Project Structure

```
solwork/
├── programs/solwork/src/lib.rs    # Anchor program
├── target/idl/solwork.json        # Generated IDL
├── tests/                         # Integration + smoke tests
├── app/                           # Next.js frontend
│   ├── src/app/                   # Pages (9 routes)
│   │   ├── page.tsx               # Landing
│   │   ├── jobs/                  # Job board + detail
│   │   ├── post/                  # Create job
│   │   ├── profile/               # User profile
│   │   ├── leaderboard/           # Reputation rankings
│   │   ├── onboarding/            # Profile setup
│   │   └── api/                   # Blinks + notifications
│   ├── src/components/            # UI components
│   ├── src/lib/                   # Hooks, helpers, IDL
│   └── package.json
└── Anchor.toml
```

## Roadmap

- Multi-milestone escrow (partial releases per deliverable)
- Cross-chain deposits via embedded LI.FI widget
- On-chain reputation NFTs
- Mainnet launch with arbitration DAO
