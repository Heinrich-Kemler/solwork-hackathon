import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "./idl.json";

export const PROGRAM_ID = new PublicKey(idl.address);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SolworkProgram = Program<any>;

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

export function getEscrowPDA(
  clientPubkey: PublicKey,
  jobTitle: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), clientPubkey.toBuffer(), Buffer.from(jobTitle)],
    PROGRAM_ID
  );
}

export function getVaultPDA(
  clientPubkey: PublicKey,
  jobTitle: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), clientPubkey.toBuffer(), Buffer.from(jobTitle)],
    PROGRAM_ID
  );
}

export function solToLamports(sol: number): BN {
  return new BN(Math.round(sol * LAMPORTS_PER_SOL));
}

export function lamportsToSol(lamports: BN | number): number {
  const val = typeof lamports === "number" ? lamports : lamports.toNumber();
  return val / LAMPORTS_PER_SOL;
}

export type EscrowStatus =
  | "Open"
  | "InProgress"
  | "Completed"
  | "Disputed"
  | "Cancelled";

export interface EscrowAccount {
  publicKey: PublicKey;
  client: PublicKey;
  freelancer: PublicKey;
  amount: BN;
  jobTitle: string;
  jobDescription: string;
  status: EscrowStatus;
  bump: number;
  vaultBump: number;
  createdAt: BN;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEscrowStatus(status: any): EscrowStatus {
  if (status.open) return "Open";
  if (status.inProgress) return "InProgress";
  if (status.completed) return "Completed";
  if (status.disputed) return "Disputed";
  if (status.cancelled) return "Cancelled";
  return "Open";
}

export function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAccountUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

// ── Transaction helpers (avoid deep type inference issues) ──────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpc(program: SolworkProgram, method: string, args: any[], accounts: Record<string, PublicKey>): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = (program.methods as any)[method](...args);
  return builder.accounts(accounts).rpc() as Promise<string>;
}

export async function txCreateEscrow(
  program: SolworkProgram,
  client: PublicKey,
  title: string,
  description: string,
  amount: BN,
): Promise<string> {
  const [escrowPDA] = getEscrowPDA(client, title);
  const [vaultPDA] = getVaultPDA(client, title);
  return rpc(program, "createEscrow", [title, description, amount], {
    client,
    escrow: escrowPDA,
    escrowVault: vaultPDA,
    systemProgram: new PublicKey("11111111111111111111111111111111"),
  });
}

export async function txAcceptJob(
  program: SolworkProgram,
  freelancer: PublicKey,
  escrowPubkey: PublicKey,
): Promise<string> {
  return rpc(program, "acceptJob", [], { freelancer, escrow: escrowPubkey });
}

export async function txApproveAndRelease(
  program: SolworkProgram,
  client: PublicKey,
  escrowPubkey: PublicKey,
  freelancer: PublicKey,
  jobTitle: string,
): Promise<string> {
  const [vaultPDA] = getVaultPDA(client, jobTitle);
  return rpc(program, "approveAndRelease", [], {
    client,
    escrow: escrowPubkey,
    escrowVault: vaultPDA,
    freelancer,
  });
}

export async function txRaiseDispute(
  program: SolworkProgram,
  client: PublicKey,
  escrowPubkey: PublicKey,
): Promise<string> {
  return rpc(program, "raiseDispute", [], { client, escrow: escrowPubkey });
}

export async function txCancelEscrow(
  program: SolworkProgram,
  client: PublicKey,
  escrowPubkey: PublicKey,
  jobTitle: string,
): Promise<string> {
  const [vaultPDA] = getVaultPDA(client, jobTitle);
  return rpc(program, "cancelEscrow", [], {
    client,
    escrow: escrowPubkey,
    escrowVault: vaultPDA,
  });
}
