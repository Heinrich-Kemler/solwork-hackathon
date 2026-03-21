import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Solwork } from "../target/types/solwork";

const toStatus = (status: object): string => Object.keys(status)[0];

describe("solwork", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const wallet = provider.wallet as anchor.Wallet & { payer: Keypair };
  const connection = provider.connection;
  const program = anchor.workspace.solwork as Program<Solwork>;

  const jobIdHappy = new anchor.BN(101);
  const jobIdDispute = new anchor.BN(202);
  const usdcAmount = new anchor.BN(2_500_000); // 2.5 USDC with 6 decimals

  let usdcMint: PublicKey;
  let clientUsdcAta: PublicKey;
  let freelancer: Keypair;
  let freelancerUsdcAta: PublicKey;
  let disputeFreelancer: Keypair;
  let disputeFreelancerUsdcAta: PublicKey;

  before(async () => {
    usdcMint = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    clientUsdcAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        usdcMint,
        wallet.publicKey
      )
    ).address;

    freelancer = Keypair.generate();
    disputeFreelancer = Keypair.generate();

    await connection.confirmTransaction(
      await connection.requestAirdrop(freelancer.publicKey, LAMPORTS_PER_SOL),
      "confirmed"
    );
    await connection.confirmTransaction(
      await connection.requestAirdrop(disputeFreelancer.publicKey, LAMPORTS_PER_SOL),
      "confirmed"
    );

    freelancerUsdcAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        usdcMint,
        freelancer.publicKey
      )
    ).address;

    disputeFreelancerUsdcAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        usdcMint,
        disputeFreelancer.publicKey
      )
    ).address;

    await mintTo(
      connection,
      wallet.payer,
      usdcMint,
      clientUsdcAta,
      wallet.payer,
      10_000_000
    );
  });

  it("happy path: create -> accept -> approve -> USDC released", async () => {
    const [jobPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("job"),
        wallet.publicKey.toBuffer(),
        jobIdHappy.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), jobPda.toBuffer()],
      program.programId
    );

    const freelancerBefore = (await getAccount(connection, freelancerUsdcAta)).amount;

    await program.methods
      .createJob(jobIdHappy, "Landing page build", "Single milestone MVP", usdcAmount)
      .accounts({
        client: wallet.publicKey,
        job: jobPda,
        usdcMint,
        clientUsdcAta,
        escrowVault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    let job = await program.account.job.fetch(jobPda);
    expect(toStatus(job.status)).to.equal("open");
    expect(job.milestoneApproved).to.equal(false);
    expect(job.amount.toString()).to.equal(usdcAmount.toString());

    await program.methods
      .acceptJob(jobIdHappy)
      .accounts({
        freelancer: freelancer.publicKey,
        client: wallet.publicKey,
        job: jobPda,
      } as any)
      .signers([freelancer])
      .rpc();

    job = await program.account.job.fetch(jobPda);
    expect(toStatus(job.status)).to.equal("active");
    expect(job.freelancer.toBase58()).to.equal(freelancer.publicKey.toBase58());

    await program.methods
      .approveJob(jobIdHappy)
      .accounts({
        client: wallet.publicKey,
        job: jobPda,
        usdcMint,
        escrowVault: vaultPda,
        freelancer: freelancer.publicKey,
        freelancerUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();

    job = await program.account.job.fetch(jobPda);
    expect(toStatus(job.status)).to.equal("complete");
    expect(job.milestoneApproved).to.equal(true);

    const freelancerAfter = (await getAccount(connection, freelancerUsdcAta)).amount;
    const vaultAfter = (await getAccount(connection, vaultPda)).amount;
    expect(vaultAfter).to.equal(BigInt(0));
    expect(freelancerAfter - freelancerBefore).to.equal(BigInt(usdcAmount.toString()));
  });

  it("dispute path: create -> accept -> dispute -> vault stays frozen", async () => {
    const [jobPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("job"),
        wallet.publicKey.toBuffer(),
        jobIdDispute.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), jobPda.toBuffer()],
      program.programId
    );

    await program.methods
      .createJob(
        jobIdDispute,
        "Backend integration",
        "Deliver escrow program integration",
        usdcAmount
      )
      .accounts({
        client: wallet.publicKey,
        job: jobPda,
        usdcMint,
        clientUsdcAta,
        escrowVault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    await program.methods
      .acceptJob(jobIdDispute)
      .accounts({
        freelancer: disputeFreelancer.publicKey,
        client: wallet.publicKey,
        job: jobPda,
      } as any)
      .signers([disputeFreelancer])
      .rpc();

    const vaultBefore = (await getAccount(connection, vaultPda)).amount;

    await program.methods
      .disputeJob(jobIdDispute)
      .accounts({
        actor: disputeFreelancer.publicKey,
        client: wallet.publicKey,
        job: jobPda,
      } as any)
      .signers([disputeFreelancer])
      .rpc();

    const job = await program.account.job.fetch(jobPda);
    const vaultAfter = (await getAccount(connection, vaultPda)).amount;

    expect(toStatus(job.status)).to.equal("disputed");
    expect(vaultAfter).to.equal(vaultBefore);
  });
});
