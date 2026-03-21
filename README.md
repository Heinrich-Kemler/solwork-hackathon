# SolWork — Anchor Backend (Round 4)

SolWork is a Solana devnet freelance escrow program using Anchor + SPL Token USDC escrow.

## Program

- Program ID: `3HP12EX32vPRnocDfy1SqRpFZSJUnyWkCDPGarhn9CGj`
- Cluster: `devnet`
- Devnet USDC mint (enforced outside local-testing): `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- Treasury wallet constant: `Fg6PaFpoGXkYsidMpWxTWqkYMdL4C9dQW9i7RkQ4xkfj`

## PDA Design

- `job`: seeds `[b"job", client, job_id_le]`
- `escrow_vault`: seeds `[b"vault", job]` (token authority = `job` PDA)

This supports multiple concurrent jobs per client as long as `job_id` differs.

## Instructions (IDL Surface)

- `init_profile()`
- `create_job(job_id: u64, title: string, description: string, amount: u64)`
- `accept_job(job_id: u64)`
- `submit_work(job_id: u64, work_description: string)`
- `extend_deadline(job_id: u64, extra_days: u64)` (max 30 days per call, Active only, client only)
- `partial_release(job_id: u64, amount: u64)` (client-only tranche release; Active/PendingReview)
- `approve_job(job_id: u64)` (release remaining vault balance, 99% freelancer / 1% treasury)
- `claim_after_grace(job_id: u64)` (auto-release if client ghosts during review window)
- `dispute_job(job_id: u64, dispute_reason: string)`
- `resolve_dispute(job_id: u64, client_amount: u64, freelancer_amount: u64)` (treasury/admin resolver)
- `cancel_job(job_id: u64)` (Open only, client refund)
- `expire_job(job_id: u64)` (permissionless, refunds client on expired Open/Active jobs)

## Job Status

`Open | Active | PendingReview | Complete | Disputed | Expired | Cancelled`

## Core Account Fields

`Job` includes:

- escrow/job metadata: `job_id`, `amount`, `client`, `freelancer`, `status`
- milestone/lifecycle: `milestone_approved`, `created_at`, `expiry_time`, `submitted_at`
- workflow text fields: `title`, `description`, `work_description` (max 512), `dispute_reason` (max 256)
- config: `grace_period`, `job_bump`, `vault_bump`

`UserProfile` includes:

- `owner`
- `jobs_completed`
- `jobs_posted`
- `disputes_raised`
- `total_earned`
- `total_spent`
- `member_since`

## Events (for Frontend Indexing)

- `ProfileInitialized`
- `JobCreated`
- `JobAccepted`
- `WorkSubmitted`
- `PartialRelease`
- `JobApproved`
- `DisputeRaised`
- `JobCancelled`
- `JobExpired`
- `DeadlineExtended`
- `GraceClaimed`
- `DisputeResolved`

## Local Verification

```bash
anchor build
anchor test -- --features local-testing
```

Local suite coverage includes:

- concurrent 3-job PDA uniqueness for one client
- submit -> approve happy path
- partial release from Active with remaining release via approve shortcut
- partial release from PendingReview and final tranche completion
- grace-period auto-release
- expiry refund for Open and Active
- treasury 1% fee split
- profile/reputation increments
- deadline extension limits
- partial dispute split resolution

## Devnet Verification

```bash
anchor deploy --provider.cluster devnet
```

Optional smoke flow:

```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
ANCHOR_WALLET=test-ledger/test-wallet.json \
SOLWORK_PROGRAM_ID=3HP12EX32vPRnocDfy1SqRpFZSJUnyWkCDPGarhn9CGj \
yarn run ts-node tests/devnet-smoke.ts
```

## Artifacts

- IDL: `target/idl/solwork.json`
- Program source: `programs/solwork/src/lib.rs`
- Local integration runner: `tests/local-runner.ts`
- Devnet smoke script: `tests/devnet-smoke.ts`
