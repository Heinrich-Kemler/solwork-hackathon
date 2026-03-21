# SolWork Anchor Backend — Round 4 Next Tasks

- [x] Read `tasks/lessons.md` at session start.
- [x] Verify `UserProfile` devnet queryability:
  - [x] Run `program.account.userProfile.all()` against devnet
  - [x] Confirm profile field structure for frontend (`owner`, counters, totals, `member_since`)
- [x] Re-validate Round 4 instruction coverage in program code:
  - [x] `partial_release(job_id, amount)` constraints and state transitions
  - [x] `extend_deadline(job_id, extra_days)` constraints and event
- [x] Run verification sequence requested:
  - [x] `anchor build`
  - [x] `anchor test`
  - [x] `anchor deploy --provider.cluster devnet`
- [x] Confirm deploy outputs:
  - [x] Program ID (and whether it changed)
  - [x] IDL updated at `target/idl/solwork.json`
  - [x] Surface results for frontend integration

Notes:
- `anchor test` (without feature flag) fails in this repo with `InvalidUsdcMint` because local tests mint a mock token while non-feature build enforces devnet USDC.
- Deterministic local suite passes with `anchor test -- --features local-testing`.
