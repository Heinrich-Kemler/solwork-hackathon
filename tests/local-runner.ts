import assert from "assert";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
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

const statusKey = (status: object): string => Object.keys(status)[0];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function waitForRpc(
  connection: anchor.web3.Connection,
  maxAttempts = 30
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await connection.getLatestBlockhash("confirmed");
      return;
    } catch {
      await sleep(1_000);
    }
  }
  throw new Error("RPC did not become ready in time.");
}

async function run(): Promise<void> {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const wallet = provider.wallet as anchor.Wallet & { payer: Keypair };
  const connection = provider.connection;
  const program = anchor.workspace.solwork as Program<Solwork>;

  await waitForRpc(connection);

  const usdcMint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    6,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );

  const clientUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      usdcMint,
      wallet.publicKey
    )
  ).address;

  const freelancer = Keypair.generate();
  const disputeFreelancer = Keypair.generate();

  await provider.sendAndConfirm(
    new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: freelancer.publicKey,
        lamports: 1_000_000_000,
      }),
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: disputeFreelancer.publicKey,
        lamports: 1_000_000_000,
      })
    ),
    []
  );

  const freelancerUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      usdcMint,
      freelancer.publicKey
    )
  ).address;

  await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    usdcMint,
    disputeFreelancer.publicKey
  );

  await mintTo(
    connection,
    wallet.payer,
    usdcMint,
    clientUsdcAta,
    wallet.payer,
    10_000_000
  );

  const happyJobId = new anchor.BN(1_001);
  const amount = new anchor.BN(2_500_000);
  const [happyJobPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("job"),
      wallet.publicKey.toBuffer(),
      happyJobId.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );
  const [happyVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), happyJobPda.toBuffer()],
    program.programId
  );

  const freelancerBefore = (await getAccount(connection, freelancerUsdcAta)).amount;
  await program.methods
    .createJob(happyJobId, "Landing page build", "Single milestone MVP", amount)
    .accounts({
      client: wallet.publicKey,
      job: happyJobPda,
      usdcMint,
      clientUsdcAta,
      escrowVault: happyVaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();

  let job = await program.account.job.fetch(happyJobPda);
  assert.equal(statusKey(job.status), "open");
  assert.equal(job.milestoneApproved, false);

  await program.methods
    .acceptJob(happyJobId)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: happyJobPda,
    } as any)
    .signers([freelancer])
    .rpc();

  job = await program.account.job.fetch(happyJobPda);
  assert.equal(statusKey(job.status), "active");

  await program.methods
    .approveJob(happyJobId)
    .accounts({
      client: wallet.publicKey,
      job: happyJobPda,
      usdcMint,
      escrowVault: happyVaultPda,
      freelancer: freelancer.publicKey,
      freelancerUsdcAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();

  job = await program.account.job.fetch(happyJobPda);
  const freelancerAfter = (await getAccount(connection, freelancerUsdcAta)).amount;
  const happyVaultAfter = (await getAccount(connection, happyVaultPda)).amount;
  assert.equal(statusKey(job.status), "complete");
  assert.equal(job.milestoneApproved, true);
  assert.equal(happyVaultAfter, BigInt(0));
  assert.equal(
    freelancerAfter - freelancerBefore,
    BigInt(amount.toString()),
    "freelancer did not receive expected USDC amount"
  );

  const disputeJobId = new anchor.BN(2_002);
  const [disputeJobPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("job"),
      wallet.publicKey.toBuffer(),
      disputeJobId.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );
  const [disputeVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), disputeJobPda.toBuffer()],
    program.programId
  );

  await program.methods
    .createJob(
      disputeJobId,
      "Backend integration",
      "Deliver escrow program integration",
      amount
    )
    .accounts({
      client: wallet.publicKey,
      job: disputeJobPda,
      usdcMint,
      clientUsdcAta,
      escrowVault: disputeVaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();

  await program.methods
    .acceptJob(disputeJobId)
    .accounts({
      freelancer: disputeFreelancer.publicKey,
      client: wallet.publicKey,
      job: disputeJobPda,
    } as any)
    .signers([disputeFreelancer])
    .rpc();

  const disputeVaultBefore = (await getAccount(connection, disputeVaultPda)).amount;
  await program.methods
    .disputeJob(disputeJobId)
    .accounts({
      actor: disputeFreelancer.publicKey,
      client: wallet.publicKey,
      job: disputeJobPda,
    } as any)
    .signers([disputeFreelancer])
    .rpc();

  const disputeJob = await program.account.job.fetch(disputeJobPda);
  const disputeVaultAfter = (await getAccount(connection, disputeVaultPda)).amount;
  assert.equal(statusKey(disputeJob.status), "disputed");
  assert.equal(disputeVaultAfter, disputeVaultBefore);

  console.log("Local integration runner passed: happy path + dispute path.");
}

run().catch((err) => {
  console.error("Local integration runner failed:", err);
  process.exit(1);
});
