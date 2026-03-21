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

const TREASURY_WALLET = new PublicKey(
  "Fg6PaFpoGXkYsidMpWxTWqkYMdL4C9dQW9i7RkQ4xkfj"
);
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
const statusKey = (status: object): string => Object.keys(status)[0];

function findJobPda(programId: PublicKey, client: PublicKey, jobId: anchor.BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("job"), client.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
    programId
  )[0];
}

function findVaultPda(programId: PublicKey, job: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), job.toBuffer()],
    programId
  )[0];
}

function findProfilePda(programId: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), owner.toBuffer()],
    programId
  )[0];
}

function findDisputeVotePda(programId: PublicKey, job: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dispute_vote"), job.toBuffer()],
    programId
  )[0];
}

async function expectFailure(label: string, fn: () => Promise<unknown>): Promise<void> {
  let failed = false;
  try {
    await fn();
  } catch {
    failed = true;
  }
  assert.equal(failed, true, label);
}

async function run(): Promise<void> {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const wallet = provider.wallet as anchor.Wallet & { payer: Keypair };
  const connection = provider.connection;
  const program = anchor.workspace.solwork as Program<Solwork>;

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

  const treasuryUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      usdcMint,
      TREASURY_WALLET,
      true
    )
  ).address;

  const freelancer = Keypair.generate();
  const altCaller = Keypair.generate();
  const referrer = Keypair.generate();

  await provider.sendAndConfirm(
    new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: freelancer.publicKey,
        lamports: 1_000_000_000,
      }),
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: altCaller.publicKey,
        lamports: 1_000_000_000,
      }),
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: referrer.publicKey,
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

  const referrerUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      usdcMint,
      referrer.publicKey
    )
  ).address;

  await mintTo(
    connection,
    wallet.payer,
    usdcMint,
    clientUsdcAta,
    wallet.payer,
    100_000_000
  );

  const clientProfile = findProfilePda(program.programId, wallet.publicKey);
  const freelancerProfile = findProfilePda(program.programId, freelancer.publicKey);
  const referrerProfile = findProfilePda(program.programId, referrer.publicKey);
  await program.methods
    .initProfile()
    .accounts({
      signer: wallet.publicKey,
      profile: clientProfile,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();
  await program.methods
    .initProfile()
    .accounts({
      signer: freelancer.publicKey,
      profile: freelancerProfile,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([freelancer])
    .rpc();
  await program.methods
    .initProfile()
    .accounts({
      signer: referrer.publicKey,
      profile: referrerProfile,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([referrer])
    .rpc();
  await program.methods
    .setReferral(referrer.publicKey)
    .accounts({
      signer: freelancer.publicKey,
      profile: freelancerProfile,
      referrerProfile,
    } as any)
    .signers([freelancer])
    .rpc();

  // 0) Multiple concurrent jobs for one client should have unique PDAs.
  const concurrentJobIds = [
    new anchor.BN(9_001),
    new anchor.BN(9_002),
    new anchor.BN(9_003),
  ];
  const concurrentJobs = concurrentJobIds.map((jobId) =>
    findJobPda(program.programId, wallet.publicKey, jobId)
  );
  assert.equal(
    new Set(concurrentJobs.map((k) => k.toBase58())).size,
    3,
    "job PDAs collided for same client with different job_ids"
  );

  const concurrentAmount = new anchor.BN(50_000);
  for (let i = 0; i < concurrentJobIds.length; i += 1) {
    const jobId = concurrentJobIds[i];
    const jobPda = concurrentJobs[i];
    const vault = findVaultPda(program.programId, jobPda);
    await program.methods
      .createJob(jobId, `Concurrent ${i}`, "PDA uniqueness", concurrentAmount)
      .accounts({
        client: wallet.publicKey,
        job: jobPda,
        usdcMint,
        clientUsdcAta,
        escrowVault: vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();
  }

  for (let i = 0; i < concurrentJobIds.length; i += 1) {
    const jobPda = concurrentJobs[i];
    const job = await program.account.job.fetch(jobPda);
    assert.equal(statusKey(job.status), "open");
    assert.equal(job.jobId.toString(), concurrentJobIds[i].toString());
  }

  // 1) Happy path: submit_work -> approve (includes treasury fee + reputation checks)
  const jobIdHappy = new anchor.BN(10_001);
  const amountHappy = new anchor.BN(2_500_000);
  const [happyJob, happyVault] = [
    findJobPda(program.programId, wallet.publicKey, jobIdHappy),
    findVaultPda(program.programId, findJobPda(program.programId, wallet.publicKey, jobIdHappy)),
  ];

  const freelancerBeforeHappy = (await getAccount(connection, freelancerUsdcAta)).amount;
  const treasuryBeforeHappy = (await getAccount(connection, treasuryUsdcAta)).amount;
  const referrerBeforeHappy = (await getAccount(connection, referrerUsdcAta)).amount;

  await program.methods
    .createJob(jobIdHappy, "Round2 Happy", "submit then approve", amountHappy)
    .accounts({
      client: wallet.publicKey,
      job: happyJob,
      usdcMint,
      clientUsdcAta,
      escrowVault: happyVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();
  await program.methods
    .acceptJob(jobIdHappy)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: happyJob,
    } as any)
    .signers([freelancer])
    .rpc();
  await program.methods
    .submitWork(jobIdHappy, "Milestone complete, please review.")
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: happyJob,
    } as any)
    .signers([freelancer])
    .rpc();
  await program.methods
    .approveJob(jobIdHappy)
    .accounts({
      client: wallet.publicKey,
      job: happyJob,
      usdcMint,
      escrowVault: happyVault,
      freelancer: freelancer.publicKey,
      freelancerUsdcAta,
      treasuryUsdcAta,
      clientProfile,
      freelancerProfile,
      referrerProfile,
      referrerUsdcAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();

  const happyJobData = await program.account.job.fetch(happyJob);
  const freelancerAfterHappy = (await getAccount(connection, freelancerUsdcAta)).amount;
  const treasuryAfterHappy = (await getAccount(connection, treasuryUsdcAta)).amount;
  const referrerAfterHappy = (await getAccount(connection, referrerUsdcAta)).amount;
  const happyVaultAfter = (await getAccount(connection, happyVault)).amount;
  const feeHappy = BigInt(amountHappy.toString()) / BigInt(100);
  const referralHappy = BigInt(amountHappy.toString()) / BigInt(200);
  const freelancerExpectedHappy = BigInt(amountHappy.toString()) - feeHappy - referralHappy;
  assert.equal(statusKey(happyJobData.status), "complete");
  assert.equal(statusKey(happyJobData.status), "complete");
  assert.equal(happyJobData.milestoneApproved, true);
  assert.equal(happyVaultAfter, BigInt(0));
  assert.equal(freelancerAfterHappy - freelancerBeforeHappy, freelancerExpectedHappy);
  assert.equal(treasuryAfterHappy - treasuryBeforeHappy, feeHappy);
  assert.equal(referrerAfterHappy - referrerBeforeHappy, referralHappy);

  const clientProfileAfterHappy = await program.account.userProfile.fetch(clientProfile);
  const freelancerProfileAfterHappy = await program.account.userProfile.fetch(freelancerProfile);
  const referrerProfileAfterHappy = await program.account.userProfile.fetch(referrerProfile);
  assert.equal(clientProfileAfterHappy.jobsPosted, 1);
  assert.equal(
    clientProfileAfterHappy.totalSpent.toString(),
    amountHappy.toString(),
    "client total_spent mismatch"
  );
  assert.equal(freelancerProfileAfterHappy.jobsCompleted, 1);
  assert.equal(
    freelancerProfileAfterHappy.totalEarned.toString(),
    freelancerExpectedHappy.toString(),
    "freelancer total_earned mismatch"
  );
  assert.equal(
    referrerProfileAfterHappy.referralEarnings.toString(),
    referralHappy.toString(),
    "referrer referral_earnings mismatch"
  );

  // 1.1) Tranche release from Active, then approve shortcut releases all remaining.
  const jobIdTrancheActive = new anchor.BN(10_007);
  const amountTrancheActive = new anchor.BN(1_200_000);
  const [trancheActiveJob, trancheActiveVault] = [
    findJobPda(program.programId, wallet.publicKey, jobIdTrancheActive),
    findVaultPda(
      program.programId,
      findJobPda(program.programId, wallet.publicKey, jobIdTrancheActive)
    ),
  ];
  const activeTrancheOne = new anchor.BN(300_000);
  const freelancerBeforeTrancheActive = (await getAccount(connection, freelancerUsdcAta)).amount;
  const treasuryBeforeTrancheActive = (await getAccount(connection, treasuryUsdcAta)).amount;
  const referrerBeforeTrancheActive = (await getAccount(connection, referrerUsdcAta)).amount;

  await program.methods
    .createJob(
      jobIdTrancheActive,
      "Tranche active",
      "partial from active then approve remainder",
      amountTrancheActive
    )
    .accounts({
      client: wallet.publicKey,
      job: trancheActiveJob,
      usdcMint,
      clientUsdcAta,
      escrowVault: trancheActiveVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();
  await program.methods
    .acceptJob(jobIdTrancheActive)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: trancheActiveJob,
    } as any)
    .signers([freelancer])
    .rpc();
  await program.methods
    .partialRelease(jobIdTrancheActive, activeTrancheOne)
    .accounts({
      client: wallet.publicKey,
      job: trancheActiveJob,
      usdcMint,
      escrowVault: trancheActiveVault,
      freelancer: freelancer.publicKey,
      freelancerUsdcAta,
      freelancerProfile,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();

  const trancheActiveAfterFirst = await program.account.job.fetch(trancheActiveJob);
  const trancheActiveVaultAfterFirst = (await getAccount(connection, trancheActiveVault)).amount;
  assert.equal(statusKey(trancheActiveAfterFirst.status), "active");
  assert.equal(trancheActiveAfterFirst.milestoneApproved, false);
  assert.equal(
    trancheActiveVaultAfterFirst,
    BigInt(amountTrancheActive.toString()) - BigInt(activeTrancheOne.toString())
  );

  await program.methods
    .approveJob(jobIdTrancheActive)
    .accounts({
      client: wallet.publicKey,
      job: trancheActiveJob,
      usdcMint,
      escrowVault: trancheActiveVault,
      freelancer: freelancer.publicKey,
      freelancerUsdcAta,
      treasuryUsdcAta,
      clientProfile,
      freelancerProfile,
      referrerProfile,
      referrerUsdcAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();

  const trancheActiveAfterApprove = await program.account.job.fetch(trancheActiveJob);
  const trancheActiveVaultAfterApprove = (await getAccount(connection, trancheActiveVault)).amount;
  const freelancerAfterTrancheActive = (await getAccount(connection, freelancerUsdcAta)).amount;
  const treasuryAfterTrancheActive = (await getAccount(connection, treasuryUsdcAta)).amount;
  const referrerAfterTrancheActive = (await getAccount(connection, referrerUsdcAta)).amount;
  const remainingBeforeApprove =
    BigInt(amountTrancheActive.toString()) - BigInt(activeTrancheOne.toString());
  const approveFee = remainingBeforeApprove / BigInt(100);
  const approveReferral = remainingBeforeApprove / BigInt(200);
  const approveFreelancerShare = remainingBeforeApprove - approveFee - approveReferral;
  assert.equal(statusKey(trancheActiveAfterApprove.status), "complete");
  assert.equal(trancheActiveAfterApprove.milestoneApproved, true);
  assert.equal(trancheActiveVaultAfterApprove, BigInt(0));
  assert.equal(
    freelancerAfterTrancheActive - freelancerBeforeTrancheActive,
    BigInt(activeTrancheOne.toString()) + approveFreelancerShare
  );
  assert.equal(treasuryAfterTrancheActive - treasuryBeforeTrancheActive, approveFee);
  assert.equal(referrerAfterTrancheActive - referrerBeforeTrancheActive, approveReferral);

  // 1.2) Partial release from PendingReview, then final tranche completes when vault hits zero.
  const jobIdTranchePending = new anchor.BN(10_008);
  const amountTranchePending = new anchor.BN(700_000);
  const [tranchePendingJob, tranchePendingVault] = [
    findJobPda(program.programId, wallet.publicKey, jobIdTranchePending),
    findVaultPda(
      program.programId,
      findJobPda(program.programId, wallet.publicKey, jobIdTranchePending)
    ),
  ];
  const pendingTrancheOne = new anchor.BN(200_000);
  const freelancerBeforeTranchePending = (await getAccount(connection, freelancerUsdcAta)).amount;

  await program.methods
    .createJob(
      jobIdTranchePending,
      "Tranche pending",
      "partial from pending review then complete with final tranche",
      amountTranchePending
    )
    .accounts({
      client: wallet.publicKey,
      job: tranchePendingJob,
      usdcMint,
      clientUsdcAta,
      escrowVault: tranchePendingVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();
  await program.methods
    .acceptJob(jobIdTranchePending)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: tranchePendingJob,
    } as any)
    .signers([freelancer])
    .rpc();
  await program.methods
    .submitWork(jobIdTranchePending, "submitted for pending tranche test")
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: tranchePendingJob,
    } as any)
    .signers([freelancer])
    .rpc();
  await program.methods
    .partialRelease(jobIdTranchePending, pendingTrancheOne)
    .accounts({
      client: wallet.publicKey,
      job: tranchePendingJob,
      usdcMint,
      escrowVault: tranchePendingVault,
      freelancer: freelancer.publicKey,
      freelancerUsdcAta,
      freelancerProfile,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();

  const pendingAfterFirstTranche = await program.account.job.fetch(tranchePendingJob);
  const pendingVaultAfterFirstTranche = (await getAccount(connection, tranchePendingVault)).amount;
  const pendingRemaining =
    BigInt(amountTranchePending.toString()) - BigInt(pendingTrancheOne.toString());
  assert.equal(statusKey(pendingAfterFirstTranche.status), "active");
  assert.equal(pendingAfterFirstTranche.milestoneApproved, false);
  assert.equal(pendingVaultAfterFirstTranche, pendingRemaining);

  await program.methods
    .submitWork(jobIdTranchePending, "resubmitted after partial release")
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: tranchePendingJob,
    } as any)
    .signers([freelancer])
    .rpc();
  await program.methods
    .partialRelease(jobIdTranchePending, new anchor.BN(pendingRemaining.toString()))
    .accounts({
      client: wallet.publicKey,
      job: tranchePendingJob,
      usdcMint,
      escrowVault: tranchePendingVault,
      freelancer: freelancer.publicKey,
      freelancerUsdcAta,
      freelancerProfile,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();

  const pendingAfterFinalTranche = await program.account.job.fetch(tranchePendingJob);
  const pendingVaultAfterFinalTranche = (await getAccount(connection, tranchePendingVault)).amount;
  const freelancerAfterTranchePending = (await getAccount(connection, freelancerUsdcAta)).amount;
  assert.equal(statusKey(pendingAfterFinalTranche.status), "complete");
  assert.equal(pendingAfterFinalTranche.milestoneApproved, true);
  assert.equal(pendingVaultAfterFinalTranche, BigInt(0));
  assert.equal(
    freelancerAfterTranchePending - freelancerBeforeTranchePending,
    BigInt(amountTranchePending.toString())
  );

  // 1.3) Deadline extension by extra days, max 30 per call
  const jobIdExtend = new anchor.BN(10_006);
  const amountExtend = new anchor.BN(300_000);
  const [extendJob, extendVault] = [
    findJobPda(program.programId, wallet.publicKey, jobIdExtend),
    findVaultPda(program.programId, findJobPda(program.programId, wallet.publicKey, jobIdExtend)),
  ];
  await program.methods
    .createJob(jobIdExtend, "Deadline extension", "active job extension", amountExtend)
    .accounts({
      client: wallet.publicKey,
      job: extendJob,
      usdcMint,
      clientUsdcAta,
      escrowVault: extendVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();
  await program.methods
    .acceptJob(jobIdExtend)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: extendJob,
    } as any)
    .signers([freelancer])
    .rpc();

  const extendBefore = await program.account.job.fetch(extendJob);
  await program.methods
    .extendDeadline(jobIdExtend, new anchor.BN(3))
    .accounts({
      client: wallet.publicKey,
      job: extendJob,
    } as any)
    .rpc();
  const extendAfter = await program.account.job.fetch(extendJob);
  assert.equal(
    extendAfter.expiryTime.toString(),
    extendBefore.expiryTime.add(new anchor.BN(3 * 86_400)).toString(),
    "deadline extension did not add expected seconds"
  );

  await expectFailure("extension above 30 days should fail", async () => {
    await program.methods
      .extendDeadline(jobIdExtend, new anchor.BN(31))
      .accounts({
        client: wallet.publicKey,
        job: extendJob,
      } as any)
      .rpc();
  });

  // 2) Grace period auto-release after submit_work
  const jobIdGrace = new anchor.BN(10_002);
  const amountGrace = new anchor.BN(1_000_000);
  const [graceJob, graceVault] = [
    findJobPda(program.programId, wallet.publicKey, jobIdGrace),
    findVaultPda(program.programId, findJobPda(program.programId, wallet.publicKey, jobIdGrace)),
  ];
  const freelancerBeforeGrace = (await getAccount(connection, freelancerUsdcAta)).amount;

  await program.methods
    .createJob(jobIdGrace, "Grace path", "auto release after grace", amountGrace)
    .accounts({
      client: wallet.publicKey,
      job: graceJob,
      usdcMint,
      clientUsdcAta,
      escrowVault: graceVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();
  await program.methods
    .acceptJob(jobIdGrace)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: graceJob,
    } as any)
    .signers([freelancer])
    .rpc();
  await program.methods
    .submitWork(jobIdGrace, "Submitted for grace test")
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: graceJob,
    } as any)
    .signers([freelancer])
    .rpc();
  await sleep(2_500);
  await program.methods
    .claimAfterGrace(jobIdGrace)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: graceJob,
      usdcMint,
      escrowVault: graceVault,
      freelancerUsdcAta,
      treasuryUsdcAta,
      freelancerProfile,
      referrerProfile,
      referrerUsdcAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .signers([freelancer])
    .rpc();

  const graceJobData = await program.account.job.fetch(graceJob);
  const freelancerAfterGrace = (await getAccount(connection, freelancerUsdcAta)).amount;
  assert.equal(statusKey(graceJobData.status), "complete");
  const graceFee = BigInt(amountGrace.toString()) / BigInt(100);
  const graceReferral = BigInt(amountGrace.toString()) / BigInt(200);
  const graceFreelancerExpected =
    BigInt(amountGrace.toString()) - graceFee - graceReferral;
  assert.equal(
    freelancerAfterGrace - freelancerBeforeGrace,
    graceFreelancerExpected,
    "grace release payout mismatch"
  );

  // 3) Expiry refund on Open job
  const jobIdOpenExpiry = new anchor.BN(10_003);
  const amountOpenExpiry = new anchor.BN(500_000);
  const [openExpiryJob, openExpiryVault] = [
    findJobPda(program.programId, wallet.publicKey, jobIdOpenExpiry),
    findVaultPda(
      program.programId,
      findJobPda(program.programId, wallet.publicKey, jobIdOpenExpiry)
    ),
  ];
  const clientBeforeOpenExpiry = (await getAccount(connection, clientUsdcAta)).amount;

  await program.methods
    .createJob(jobIdOpenExpiry, "Open expiry", "refund open after expiry", amountOpenExpiry)
    .accounts({
      client: wallet.publicKey,
      job: openExpiryJob,
      usdcMint,
      clientUsdcAta,
      escrowVault: openExpiryVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();
  await sleep(2_500);
  await program.methods
    .expireJob(jobIdOpenExpiry)
    .accounts({
      caller: altCaller.publicKey,
      client: wallet.publicKey,
      job: openExpiryJob,
      usdcMint,
      escrowVault: openExpiryVault,
      clientUsdcAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .signers([altCaller])
    .rpc();

  const openExpiryJobData = await program.account.job.fetch(openExpiryJob);
  const clientAfterOpenExpiry = (await getAccount(connection, clientUsdcAta)).amount;
  assert.equal(statusKey(openExpiryJobData.status), "expired");
  assert.equal(
    clientAfterOpenExpiry,
    clientBeforeOpenExpiry,
    "open expiry should leave client net balance unchanged"
  );

  // 4) Expiry refund on Active job
  const jobIdActiveExpiry = new anchor.BN(10_004);
  const amountActiveExpiry = new anchor.BN(600_000);
  const [activeExpiryJob, activeExpiryVault] = [
    findJobPda(program.programId, wallet.publicKey, jobIdActiveExpiry),
    findVaultPda(
      program.programId,
      findJobPda(program.programId, wallet.publicKey, jobIdActiveExpiry)
    ),
  ];
  const clientBeforeActiveExpiry = (await getAccount(connection, clientUsdcAta)).amount;

  await program.methods
    .createJob(
      jobIdActiveExpiry,
      "Active expiry",
      "refund active after expiry",
      amountActiveExpiry
    )
    .accounts({
      client: wallet.publicKey,
      job: activeExpiryJob,
      usdcMint,
      clientUsdcAta,
      escrowVault: activeExpiryVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();
  await program.methods
    .acceptJob(jobIdActiveExpiry)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: activeExpiryJob,
    } as any)
    .signers([freelancer])
    .rpc();
  await sleep(2_500);
  await program.methods
    .expireJob(jobIdActiveExpiry)
    .accounts({
      caller: altCaller.publicKey,
      client: wallet.publicKey,
      job: activeExpiryJob,
      usdcMint,
      escrowVault: activeExpiryVault,
      clientUsdcAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .signers([altCaller])
    .rpc();

  const activeExpiryJobData = await program.account.job.fetch(activeExpiryJob);
  const clientAfterActiveExpiry = (await getAccount(connection, clientUsdcAta)).amount;
  assert.equal(statusKey(activeExpiryJobData.status), "expired");
  assert.equal(
    clientAfterActiveExpiry,
    clientBeforeActiveExpiry,
    "active expiry should leave client net balance unchanged"
  );

  // 5) Dispute DAO voting: dispute auto-inits jurors, jurors vote, and funds resolve by majority.
  const jobIdDispute = new anchor.BN(10_005);
  const amountDispute = new anchor.BN(400_000);
  const [disputeJob, disputeVault] = [
    findJobPda(program.programId, wallet.publicKey, jobIdDispute),
    findVaultPda(program.programId, findJobPda(program.programId, wallet.publicKey, jobIdDispute)),
  ];
  const disputeVote = findDisputeVotePda(program.programId, disputeJob);
  const jurorCandidates = [clientProfile, freelancerProfile, referrerProfile].map((pubkey) => ({
    pubkey,
    isSigner: false,
    isWritable: false,
  }));

  await program.methods
    .createJob(jobIdDispute, "Dispute", "record dispute profile stat", amountDispute)
    .accounts({
      client: wallet.publicKey,
      job: disputeJob,
      usdcMint,
      clientUsdcAta,
      escrowVault: disputeVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .rpc();
  await program.methods
    .acceptJob(jobIdDispute)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: disputeJob,
    } as any)
    .signers([freelancer])
    .rpc();
  const clientBeforeResolve = (await getAccount(connection, clientUsdcAta)).amount;
  const freelancerBeforeResolve = (await getAccount(connection, freelancerUsdcAta)).amount;
  const freelancerProfileBeforeDispute = await program.account.userProfile.fetch(freelancerProfile);
  const clientProfileBeforeDispute = await program.account.userProfile.fetch(clientProfile);

  // View helper path: call juror eligibility instruction (frontend can parse return data).
  await program.methods
    .getEligibleJurors()
    .accounts({} as any)
    .remainingAccounts(jurorCandidates)
    .rpc();

  await program.methods
    .disputeJob(jobIdDispute, "Missing deliverable")
    .accounts({
      actor: freelancer.publicKey,
      client: wallet.publicKey,
      job: disputeJob,
      actorProfile: freelancerProfile,
      disputeVote,
      systemProgram: SystemProgram.programId,
    } as any)
    .remainingAccounts(jurorCandidates)
    .signers([freelancer])
    .rpc();

  const disputeJobData = await program.account.job.fetch(disputeJob);
  const disputeVoteData = await program.account.disputeVote.fetch(disputeVote);
  const freelancerProfileAfterDispute = await program.account.userProfile.fetch(freelancerProfile);
  assert.equal(statusKey(disputeJobData.status), "disputed");
  assert.equal(
    freelancerProfileAfterDispute.disputesRaised,
    freelancerProfileBeforeDispute.disputesRaised + 1
  );

  const signerMap = new Map<string, Keypair | null>([
    [wallet.publicKey.toBase58(), null],
    [freelancer.publicKey.toBase58(), freelancer],
    [referrer.publicKey.toBase58(), referrer],
  ]);
  const firstTwoJurors = [disputeVoteData.juror1, disputeVoteData.juror2];
  for (const juror of firstTwoJurors) {
    const signer = signerMap.get(juror.toBase58());
    assert.notEqual(signer, undefined, `missing signer for juror ${juror.toBase58()}`);
    const voteCall = program.methods
      .castVote(jobIdDispute, true)
      .accounts({
        voter: juror,
        client: wallet.publicKey,
        job: disputeJob,
        disputeVote,
        usdcMint,
        escrowVault: disputeVault,
        clientUsdcAta,
        freelancer: freelancer.publicKey,
        freelancerUsdcAta,
        clientProfile,
        freelancerProfile,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any);
    if (signer) {
      await voteCall.signers([signer]).rpc();
    } else {
      await voteCall.rpc();
    }
  }

  const disputeAfterResolve = await program.account.job.fetch(disputeJob);
  const disputeVaultAfter = (await getAccount(connection, disputeVault)).amount;
  const clientAfterResolve = (await getAccount(connection, clientUsdcAta)).amount;
  const freelancerAfterResolve = (await getAccount(connection, freelancerUsdcAta)).amount;
  const clientProfileAfterResolve = await program.account.userProfile.fetch(clientProfile);
  const freelancerProfileAfterResolve = await program.account.userProfile.fetch(freelancerProfile);
  assert.equal(statusKey(disputeAfterResolve.status), "complete");
  assert.equal(disputeVaultAfter, BigInt(0));
  assert.equal(
    clientAfterResolve - clientBeforeResolve,
    BigInt(0),
    "client should not receive funds when freelancer wins vote"
  );
  assert.equal(
    freelancerAfterResolve - freelancerBeforeResolve,
    BigInt(amountDispute.toString()),
    "freelancer should receive full disputed vault amount"
  );
  assert.equal(
    clientProfileAfterResolve.reputationScore.toNumber(),
    clientProfileBeforeDispute.reputationScore.toNumber() - 2
  );
  assert.equal(
    freelancerProfileAfterResolve.reputationScore.toNumber(),
    freelancerProfileBeforeDispute.reputationScore.toNumber() + 5
  );

  console.log(
    "Local integration runner passed: concurrent PDA uniqueness, tranche release flow, deadline extension limits, dispute DAO vote resolution, referral payouts, and prior regressions."
  );
}

run().catch((error) => {
  console.error("Local integration runner failed:", error);
  process.exit(1);
});
