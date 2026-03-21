# SolWork Anchor Backend — Round 5 TODO

- [x] Read `tasks/lessons.md` at session start.
- [x] Add dispute DAO accounts/instructions:
  - [x] Add `DisputeVote` account (PDA seeds `[b"dispute_vote", job]`)
  - [x] Add `initiate_dispute_vote(job_id)` with deterministic 3-juror selection
  - [x] Auto-create dispute vote in `dispute_job`
  - [x] Add `cast_vote(job_id, vote)` juror-only with vote recording
  - [x] Add majority/early-resolution logic
  - [x] Replace dispute resolver with vote-based `resolve_dispute(job_id)`
  - [x] Transfer full vault to majority winner
  - [x] Update reputation score (+5 winner, -2 loser)
  - [x] Emit `DisputeVoteInitiated` + updated `DisputeResolved`
- [x] Add referral system:
  - [x] Extend `UserProfile` with `referred_by`, `referral_earnings`, `reputation_score`
  - [x] Add `set_referral(referrer)` one-time, before first completion
  - [x] Update `approve_job` payout split for referred freelancers (98.5/1/0.5)
  - [x] Update `claim_after_grace` payout split for referred freelancers
  - [x] Emit `ReferralEarned`
- [x] Add juror helper:
  - [x] Add `get_eligible_jurors()` no-state-change instruction
  - [x] Return eligible pubkeys via return data from candidate `remaining_accounts`
- [x] Update tests:
  - [x] Dispute flow with vote initiation, cast votes, automatic resolution
  - [ ] Manual `resolve_dispute(job_id)` after majority
  - [x] Referral payout path on `approve_job`
  - [x] Eligibility helper path
- [x] Verification:
  - [x] `anchor build`
  - [x] `anchor test -- --features local-testing`
  - [x] `anchor deploy --provider.cluster devnet`
  - [x] If IDL size upgrade fails, run `anchor idl close` + `anchor idl init`
  - [x] Confirm `target/idl/solwork.json` updated
  - [x] Report Program ID + deploy signatures

Notes:
- Solana programs cannot enumerate all on-chain accounts internally, so juror selection and eligibility helper operate on candidate `UserProfile` accounts supplied in `remaining_accounts`.
- Devnet smoke on the long-lived deploy wallet now hits `AccountDidNotDeserialize` for legacy `profile` PDA data created before `UserProfile` field expansion; fresh wallets/profiles work.
