import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "./idl.json";

// ── Constants ──────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey(idl.address);
export const USDC_DEVNET_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
export const TREASURY_WALLET = new PublicKey(
  "GyyjsG67zY21B2BYfLsNUbN9hZLfog9DZYRjnZuHWzfQ"
);

// ── Types ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SolworkProgram = Program<any>;

export type JobStatus =
  | "Open"
  | "Active"
  | "PendingReview"
  | "Complete"
  | "Disputed"
  | "Expired"
  | "Cancelled";

export interface JobAccount {
  publicKey: PublicKey;
  title: string;
  description: string;
  amount: BN;
  client: PublicKey;
  freelancer: PublicKey;
  status: JobStatus;
  milestoneApproved: boolean;
  createdAt: BN;
  expiryTime: BN;
  gracePeriod: BN;
  submittedAt: BN;
  workDescription: string;
  disputeReason: string;
  jobId: BN;
  jobBump: number;
  vaultBump: number;
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  Open: "Open",
  Active: "Active",
  PendingReview: "Pending Review",
  Complete: "Complete",
  Disputed: "Disputed",
  Expired: "Expired",
  Cancelled: "Cancelled",
};

export function calcReputation(jobsCompleted: number, totalEarned: number, disputesRaised: number): number {
  return Math.max(0, (jobsCompleted * 10) + Math.floor(totalEarned) - (disputesRaised * 5));
}

export function getReputationTier(score: number): { label: string; class: string } {
  if (score >= 200) return { label: "Elite", class: "badge-active" };
  if (score >= 100) return { label: "Expert", class: "badge-open" };
  if (score >= 50) return { label: "Trusted", class: "badge-pending" };
  if (score >= 10) return { label: "Rising", class: "badge-complete" };
  return { label: "New", class: "badge-complete" };
}

export const STATUS_BADGE_CLASS: Record<JobStatus, string> = {
  Open: "badge badge-open",
  Active: "badge badge-active",
  PendingReview: "badge badge-pending",
  Complete: "badge badge-complete",
  Disputed: "badge badge-disputed",
  Expired: "badge badge-expired",
  Cancelled: "badge badge-cancelled",
};

// ── Provider / Program ─────────────────────────────────────────────────────

export function getProvider(
  connection: Connection,
  wallet: AnchorWallet
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
}

export function getProgram(provider: AnchorProvider): SolworkProgram {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, provider);
}

// ── PDA Derivation ─────────────────────────────────────────────────────────

export function getJobPDA(client: PublicKey, jobId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("job"), client.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

export function getVaultPDA(jobPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), jobPDA.toBuffer()],
    PROGRAM_ID
  );
}

export function getProfilePDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function getDisputeVotePDA(jobPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dispute_vote"), jobPDA.toBuffer()],
    PROGRAM_ID
  );
}

type RemainingAccount = {
  pubkey: PublicKey;
  isWritable: boolean;
  isSigner: boolean;
};

function toReadonlyRemainingAccounts(pubkeys: PublicKey[]): RemainingAccount[] {
  return pubkeys.map((pubkey) => ({
    pubkey,
    isWritable: false,
    isSigner: false,
  }));
}

// ── Status Parsing ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJobStatus(status: any): JobStatus {
  if (status.open) return "Open";
  if (status.active) return "Active";
  if (status.pendingReview) return "PendingReview";
  if (status.complete) return "Complete";
  if (status.disputed) return "Disputed";
  if (status.expired) return "Expired";
  if (status.cancelled) return "Cancelled";
  return "Open";
}

// ── USDC Helpers ───────────────────────────────────────────────────────────

export function usdcToSmallest(usdc: number): BN {
  return new BN(Math.round(usdc * 1_000_000));
}

export function smallestToUsdc(amount: BN | number): number {
  const val = typeof amount === "number" ? amount : amount.toNumber();
  return val / 1_000_000;
}

// ── Explorer URLs ──────────────────────────────────────────────────────────

export function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAccountUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

// ── Transaction Helpers ────────────────────────────────────────────────────

async function rpc(
  program: SolworkProgram,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  accounts: Record<string, PublicKey>,
  remainingAccounts: RemainingAccount[] = []
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = (program.methods as any)[method](...args).accounts(accounts);
  if (remainingAccounts.length > 0) {
    builder.remainingAccounts(remainingAccounts);
  }
  return builder.rpc() as Promise<string>;
}

export async function txInitProfile(
  program: SolworkProgram,
  signer: PublicKey
): Promise<string> {
  const [profilePDA] = getProfilePDA(signer);
  return rpc(program, "initProfile", [], {
    signer,
    profile: profilePDA,
    systemProgram: SystemProgram.programId,
  });
}

export async function txUpdateAvatar(
  program: SolworkProgram,
  signer: PublicKey,
  avatarUri: string
): Promise<string> {
  const [profilePDA] = getProfilePDA(signer);
  return rpc(program, "updateAvatar", [avatarUri], {
    signer,
    profile: profilePDA,
  });
}

export async function txCreateJob(
  program: SolworkProgram,
  client: PublicKey,
  jobId: BN,
  title: string,
  description: string,
  amount: BN
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [clientProfilePDA] = getProfilePDA(client);
  const [vaultPDA] = getVaultPDA(jobPDA);
  const clientUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, client);

  return rpc(program, "createJob", [jobId, title, description, amount], {
    client,
    job: jobPDA,
    clientProfile: clientProfilePDA,
    usdcMint: USDC_DEVNET_MINT,
    clientUsdcAta,
    escrowVault: vaultPDA,
    treasuryWallet: TREASURY_WALLET,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  });
}

export async function txAcceptJob(
  program: SolworkProgram,
  freelancer: PublicKey,
  client: PublicKey,
  jobId: BN
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  return rpc(program, "acceptJob", [jobId], {
    freelancer,
    client,
    job: jobPDA,
  });
}

export async function txSubmitWork(
  program: SolworkProgram,
  freelancer: PublicKey,
  client: PublicKey,
  jobId: BN,
  workDescription: string
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  return rpc(program, "submitWork", [jobId, workDescription], {
    freelancer,
    client,
    job: jobPDA,
  });
}

export async function txExtendDeadline(
  program: SolworkProgram,
  client: PublicKey,
  jobId: BN,
  extraDays: BN
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  return rpc(program, "extendDeadline", [jobId, extraDays], {
    client,
    job: jobPDA,
  });
}

export async function txApproveJob(
  program: SolworkProgram,
  client: PublicKey,
  freelancer: PublicKey,
  jobId: BN,
  referrer?: PublicKey
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [vaultPDA] = getVaultPDA(jobPDA);
  const freelancerUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, freelancer);
  const treasuryUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, TREASURY_WALLET);
  const [clientProfilePDA] = getProfilePDA(client);
  const [freelancerProfilePDA] = getProfilePDA(freelancer);

  // Referrer — use freelancer's referrer if set, otherwise use freelancer's own profile as placeholder
  const refKey = referrer && !referrer.equals(PublicKey.default) ? referrer : freelancer;
  const [referrerProfilePDA] = getProfilePDA(refKey);
  const referrerUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, refKey);

  return rpc(program, "approveJob", [jobId], {
    client,
    job: jobPDA,
    usdcMint: USDC_DEVNET_MINT,
    escrowVault: vaultPDA,
    freelancer,
    freelancerUsdcAta,
    treasuryUsdcAta,
    clientProfile: clientProfilePDA,
    freelancerProfile: freelancerProfilePDA,
    referrerProfile: referrerProfilePDA,
    referrerUsdcAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}

export async function txDisputeJob(
  program: SolworkProgram,
  actor: PublicKey,
  client: PublicKey,
  jobId: BN,
  disputeReason: string,
  candidateJurorProfiles: PublicKey[] = []
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [actorProfilePDA] = getProfilePDA(actor);
  const [disputeVotePDA] = getDisputeVotePDA(jobPDA);

  return rpc(program, "disputeJob", [jobId, disputeReason], {
    actor,
    client,
    job: jobPDA,
    actorProfile: actorProfilePDA,
    disputeVote: disputeVotePDA,
    systemProgram: SystemProgram.programId,
  }, toReadonlyRemainingAccounts(candidateJurorProfiles));
}

export async function txInitiateDisputeVote(
  program: SolworkProgram,
  caller: PublicKey,
  client: PublicKey,
  jobId: BN,
  candidateJurorProfiles: PublicKey[] = []
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [disputeVotePDA] = getDisputeVotePDA(jobPDA);

  return rpc(program, "initiateDisputeVote", [jobId], {
    caller,
    client,
    job: jobPDA,
    disputeVote: disputeVotePDA,
    systemProgram: SystemProgram.programId,
  }, toReadonlyRemainingAccounts(candidateJurorProfiles));
}

export async function txCastVote(
  program: SolworkProgram,
  voter: PublicKey,
  client: PublicKey,
  freelancer: PublicKey,
  jobId: BN,
  vote: boolean
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [disputeVotePDA] = getDisputeVotePDA(jobPDA);
  const [vaultPDA] = getVaultPDA(jobPDA);
  const clientUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, client);
  const freelancerUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, freelancer);
  const [clientProfilePDA] = getProfilePDA(client);
  const [freelancerProfilePDA] = getProfilePDA(freelancer);

  return rpc(program, "castVote", [jobId, vote], {
    voter,
    client,
    job: jobPDA,
    disputeVote: disputeVotePDA,
    usdcMint: USDC_DEVNET_MINT,
    escrowVault: vaultPDA,
    clientUsdcAta,
    freelancer,
    freelancerUsdcAta,
    clientProfile: clientProfilePDA,
    freelancerProfile: freelancerProfilePDA,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}

export async function txPartialRelease(
  program: SolworkProgram,
  client: PublicKey,
  freelancer: PublicKey,
  jobId: BN,
  amount: BN
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [vaultPDA] = getVaultPDA(jobPDA);
  const freelancerUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, freelancer);
  const [freelancerProfilePDA] = getProfilePDA(freelancer);

  return rpc(program, "partialRelease", [jobId, amount], {
    client,
    job: jobPDA,
    usdcMint: USDC_DEVNET_MINT,
    escrowVault: vaultPDA,
    freelancer,
    freelancerUsdcAta,
    freelancerProfile: freelancerProfilePDA,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}

export async function txClaimAfterGrace(
  program: SolworkProgram,
  freelancer: PublicKey,
  client: PublicKey,
  jobId: BN,
  referrer?: PublicKey
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [vaultPDA] = getVaultPDA(jobPDA);
  const freelancerUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, freelancer);
  const treasuryUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, TREASURY_WALLET);
  const [freelancerProfilePDA] = getProfilePDA(freelancer);

  const refKey = referrer && !referrer.equals(PublicKey.default) ? referrer : freelancer;
  const [referrerProfilePDA] = getProfilePDA(refKey);
  const referrerUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, refKey);

  return rpc(program, "claimAfterGrace", [jobId], {
    freelancer,
    client,
    job: jobPDA,
    usdcMint: USDC_DEVNET_MINT,
    escrowVault: vaultPDA,
    freelancerUsdcAta,
    treasuryUsdcAta,
    freelancerProfile: freelancerProfilePDA,
    referrerProfile: referrerProfilePDA,
    referrerUsdcAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}

export async function txResolveDispute(
  program: SolworkProgram,
  caller: PublicKey,
  client: PublicKey,
  freelancer: PublicKey,
  jobId: BN
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [disputeVotePDA] = getDisputeVotePDA(jobPDA);
  const [vaultPDA] = getVaultPDA(jobPDA);
  const clientUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, client);
  const freelancerUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, freelancer);
  const [clientProfilePDA] = getProfilePDA(client);
  const [freelancerProfilePDA] = getProfilePDA(freelancer);

  return rpc(program, "resolveDispute", [jobId], {
    caller,
    client,
    job: jobPDA,
    disputeVote: disputeVotePDA,
    usdcMint: USDC_DEVNET_MINT,
    escrowVault: vaultPDA,
    clientUsdcAta,
    freelancer,
    freelancerUsdcAta,
    clientProfile: clientProfilePDA,
    freelancerProfile: freelancerProfilePDA,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}

export async function txGetEligibleJurors(
  program: SolworkProgram,
  candidateJurorProfiles: PublicKey[] = []
): Promise<string> {
  return rpc(program, "getEligibleJurors", [], {}, toReadonlyRemainingAccounts(candidateJurorProfiles));
}

export async function txSetReferral(
  program: SolworkProgram,
  signer: PublicKey,
  referrer: PublicKey
): Promise<string> {
  const [signerProfilePDA] = getProfilePDA(signer);
  const [referrerProfilePDA] = getProfilePDA(referrer);

  return rpc(program, "setReferral", [referrer], {
    signer,
    profile: signerProfilePDA,
    referrerProfile: referrerProfilePDA,
  });
}

export async function txCancelJob(
  program: SolworkProgram,
  client: PublicKey,
  jobId: BN
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [vaultPDA] = getVaultPDA(jobPDA);
  const clientUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, client);

  return rpc(program, "cancelJob", [jobId], {
    client,
    job: jobPDA,
    usdcMint: USDC_DEVNET_MINT,
    escrowVault: vaultPDA,
    clientUsdcAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}

export async function txExpireJob(
  program: SolworkProgram,
  caller: PublicKey,
  client: PublicKey,
  jobId: BN
): Promise<string> {
  const [jobPDA] = getJobPDA(client, jobId);
  const [vaultPDA] = getVaultPDA(jobPDA);
  const clientUsdcAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, client);

  return rpc(program, "expireJob", [jobId], {
    caller,
    client,
    job: jobPDA,
    usdcMint: USDC_DEVNET_MINT,
    escrowVault: vaultPDA,
    clientUsdcAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}
