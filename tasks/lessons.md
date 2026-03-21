# SolWork Lessons

## Session Start Checklist

- Read this file before coding.
- Keep fixes minimal and demo-focused.
- If any correction is needed, append:
  - Mistake pattern
  - Prevention rule

## Corrections Log

- 2026-03-21: Mistake pattern: held a mutable borrow of `job` while also needing an immutable borrow for CPI authority in `approve_job`.
  Prevention rule: in Anchor handlers, do validations/read-only seed prep with immutable borrows first, perform CPI, then take mutable borrow only for final state writes.
- 2026-03-21: Mistake pattern: added `anchor-spl` accounts but forgot to propagate `anchor-spl/idl-build` into the program's `idl-build` feature.
  Prevention rule: whenever adding Anchor SPL account types, update `idl-build` feature list for every dependency used in account derive macros.
- 2026-03-21: Mistake pattern: relied on default local validator RPC port and hit an environment collision (`8899` in use).
  Prevention rule: define explicit `[test.validator]` ports in `Anchor.toml` early to avoid local port conflicts during hackathon runs.
- 2026-03-21: Mistake pattern: test workflow assumed access to `~/.config/solana/id.json`, which is restricted in this environment.
  Prevention rule: always configure a workspace-local test wallet in `Anchor.toml` for local validator and integration tests.
- 2026-03-21: Mistake pattern: local validator startup failed on `UnspecifiedIpAddr(0.0.0.0)`.
  Prevention rule: set an explicit localhost bind address (`127.0.0.1`) under `[test.validator]` to avoid host auto-detection failures.
- 2026-03-21: Mistake pattern: `ts-mocha` broke under Node v25 due ESM/CJS loader incompatibility.
  Prevention rule: prefer `mocha -r ts-node/register` in Anchor test scripts for broader Node-version compatibility.
- 2026-03-21: Mistake pattern: even mocha CLI still failed under Node v25 due `yargs` ESM/CJS behavior.
  Prevention rule: keep a CLI-light fallback (`ts-node` integration runner) so tests can run independently of mocha/yargs stack during hackathons.
- 2026-03-21: Mistake pattern: Anchor TS v0.32 strict account typings auto-resolve PDAs and rejected explicit account maps in runner scripts.
  Prevention rule: use `.accounts(... as any)` or `.accountsPartial` in fast-moving tests when PDA auto-resolution typing blocks execution.
- 2026-03-21: Mistake pattern: used BigInt literal syntax (`0n`) while TS target is ES6.
  Prevention rule: use `BigInt(0)` (or raise TS target) for compatibility with current workspace compiler settings.
- 2026-03-21: Mistake pattern: local integration runner requested airdrops before validator RPC/faucet was reliably ready.
  Prevention rule: add explicit RPC readiness checks and retry wrappers for localnet airdrops in test scripts.
- 2026-03-21: Mistake pattern: local faucet requests still failed with RPC internal errors in this environment.
  Prevention rule: for deterministic local tests, fund test signers via `SystemProgram.transfer` from the provider wallet instead of relying on `requestAirdrop`.
- 2026-03-21: Mistake pattern: devnet smoke flow depended on `requestAirdrop`, which can stall or fail under faucet limits.
  Prevention rule: fund temporary smoke-test signers with direct SOL transfer from the funded deploy wallet.
- 2026-03-21: Mistake pattern: used outdated `new Program(idl, programId, provider)` construction under Anchor v0.32 TypeScript APIs.
  Prevention rule: load IDL from `target/idl`, set `idl.address`, and instantiate with `new Program(idl, provider)` for version-safe scripts.
- 2026-03-21: Mistake pattern: time-based local tests relied on long default windows and wall-clock sleeps without enough validator time drift.
  Prevention rule: keep `local-testing` time constants minimal (for example 1s) so expiry/grace assertions are deterministic in CI-like environments.
- 2026-03-21: Mistake pattern: expiry refund assertions compared final client balance to pre-create balance, ignoring the initial escrow debit.
  Prevention rule: for refund paths, assert net-zero loss against the pre-create baseline or compare refund delta from post-lock balance.
- 2026-03-21: Mistake pattern: interpreted Anchor's "configured rpc port is already in use" literally when sandbox actually blocked validator port binding.
  Prevention rule: if local validator fails with port errors in sandboxed runs, confirm with a direct validator launch and rerun `anchor test` with elevated permissions before changing test network config.
- 2026-03-21: Mistake pattern: assumed `anchor deploy` would always resize and upload a larger IDL account; deploy upgraded the program but IDL upload failed (`RequireGteViolated`) when new IDL exceeded previous account capacity.
  Prevention rule: after adding instructions/events that grow the IDL, be ready to `anchor idl close` + `anchor idl init --filepath target/idl/<program>.json <program_id>` on devnet when IDL set-buffer fails due size.
- 2026-03-21: Mistake pattern: used strict `Program<Idl>` typing in one-off TS scripts and hit missing typed account namespace (`program.account.userProfile`).
  Prevention rule: for ad-hoc verification scripts, either import generated `Program<Solwork>` types or cast `program as any` to avoid blocking runtime checks on type-only friction.
- 2026-03-21: Mistake pattern: treated `anchor test` (without features) as equivalent to local deterministic tests, but non-feature build enforces devnet USDC mint and fails against mock local mint.
  Prevention rule: for this repo, run deterministic local suite with `anchor test -- --features local-testing`; reserve plain `anchor test` for scenarios using real devnet USDC mint/account setup.
