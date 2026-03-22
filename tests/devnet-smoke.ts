import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Solwork } from "../target/types/solwork";

const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
const TREASURY_WALLET = new PublicKey(
  "GyyjsG67zY21B2BYfLsNUbN9hZLfog9DZYRjnZuHWzfQ"
);

async function run(): Promise<void> {
  console.log("devnet-smoke: start");
  const baseProvider = anchor.AnchorProvider.env();
  const connection = new anchor.web3.Connection(clusterApiUrl("devnet"), "confirmed");
  const provider = new anchor.AnchorProvider(connection, baseProvider.wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const wallet = provider.wallet as anchor.Wallet & { payer: Keypair };
  const programIdRaw = process.env.SOLWORK_PROGRAM_ID;
  if (!programIdRaw) {
    throw new Error("Set SOLWORK_PROGRAM_ID to the deployed devnet program ID.");
  }

  const idlPath = path.resolve(__dirname, "../target/idl/solwork.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl & {
    address?: string;
  };
  idl.address = programIdRaw;
  const program = new Program(idl, provider) as Program<Solwork>;

  const freelancer = Keypair.generate();
  const jobId = new anchor.BN(Date.now());
  const amount = new anchor.BN(1_000); // 0.001 USDC

  console.log("devnet-smoke: resolving client ATA");
  const clientUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      DEVNET_USDC_MINT,
      wallet.publicKey
    )
  ).address;

  const clientUsdcBalance = (await getAccount(connection, clientUsdcAta)).amount;
  if (clientUsdcBalance < BigInt(amount.toString())) {
    throw new Error(
      `Insufficient devnet USDC. Need ${amount.toString()} base units in ${clientUsdcAta.toBase58()}.`
    );
  }

  console.log("devnet-smoke: resolving freelancer ATA");
  const freelancerUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      DEVNET_USDC_MINT,
      freelancer.publicKey
    )
  ).address;

  console.log("devnet-smoke: funding freelancer with SOL");
  await provider.sendAndConfirm(
    new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: freelancer.publicKey,
        lamports: 1_000_000_000,
      })
    ),
    []
  );

  console.log("devnet-smoke: resolving treasury ATA");
  const treasuryUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      DEVNET_USDC_MINT,
      TREASURY_WALLET,
      true
    )
  ).address;

  const [clientProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), wallet.publicKey.toBuffer()],
    program.programId
  );
  const [freelancerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), freelancer.publicKey.toBuffer()],
    program.programId
  );

  let initClientOk = true;
  if (!(await connection.getAccountInfo(clientProfile))) {
    try {
      await program.methods
        .initProfile()
        .accounts({
          signer: wallet.publicKey,
          profile: clientProfile,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .rpc();
      console.log("init_profile(client): PASS");
    } catch (error) {
      initClientOk = false;
      console.error("init_profile(client): FAIL", error);
    }
  } else {
    console.log("init_profile(client): PASS (already initialized)");
  }

  let initFreelancerOk = true;
  try {
    await program.methods
      .initProfile()
      .accounts({
        signer: freelancer.publicKey,
        profile: freelancerProfile,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([freelancer])
      .rpc();
    console.log("init_profile(freelancer): PASS");
  } catch (error) {
    initFreelancerOk = false;
    console.error("init_profile(freelancer): FAIL", error);
  }

  const [jobPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("job"),
      wallet.publicKey.toBuffer(),
      jobId.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), jobPda.toBuffer()],
    program.programId
  );
  console.log("devnet-smoke: preflight setup complete");

  let createSig = "";
  let createOk = false;
  try {
    createSig = await program.methods
      .createJob(jobId, "Devnet smoke", "Smoke test escrow flow", amount)
      .accounts({
        client: wallet.publicKey,
        job: jobPda,
        clientProfile,
        usdcMint: DEVNET_USDC_MINT,
        clientUsdcAta,
        escrowVault: vaultPda,
        treasuryWallet: TREASURY_WALLET,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();
    createOk = true;
    console.log("create_job: PASS");
  } catch (error) {
    console.error("create_job: FAIL", error);
  }

  let acceptSig = "";
  let acceptOk = false;
  if (createOk) {
    try {
      acceptSig = await program.methods
        .acceptJob(jobId)
        .accounts({
          freelancer: freelancer.publicKey,
          client: wallet.publicKey,
          job: jobPda,
        } as any)
        .signers([freelancer])
        .rpc();
      acceptOk = true;
      console.log("accept_job: PASS");
    } catch (error) {
      console.error("accept_job: FAIL", error);
    }
  } else {
    console.log("accept_job: SKIPPED (create_job failed)");
  }

  let submitSig = "";
  let submitOk = false;
  if (acceptOk) {
    try {
      submitSig = await program.methods
        .submitWork(jobId, "Smoke-test deliverable submitted")
        .accounts({
          freelancer: freelancer.publicKey,
          client: wallet.publicKey,
          job: jobPda,
        } as any)
        .signers([freelancer])
        .rpc();
      submitOk = true;
      console.log("submit_work: PASS");
    } catch (error) {
      console.error("submit_work: FAIL", error);
    }
  } else {
    console.log("submit_work: SKIPPED (accept_job failed)");
  }

  let approveSig = "";
  let approveOk = false;
  if (submitOk) {
    try {
      approveSig = await program.methods
        .approveJob(jobId)
        .accounts({
          client: wallet.publicKey,
          job: jobPda,
          usdcMint: DEVNET_USDC_MINT,
          escrowVault: vaultPda,
          freelancer: freelancer.publicKey,
          freelancerUsdcAta,
          treasuryUsdcAta,
          clientProfile,
          freelancerProfile,
          // Placeholder optional accounts; no referral payout occurs unless freelancer profile has referred_by set.
          referrerProfile: freelancerProfile,
          referrerUsdcAta: freelancerUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .rpc();
      approveOk = true;
      console.log("approve_job: PASS");
    } catch (error) {
      console.error("approve_job: FAIL", error);
    }
  } else {
    console.log("approve_job: SKIPPED (submit_work failed)");
  }

  if (!initClientOk || !initFreelancerOk || !createOk || !acceptOk || !submitOk || !approveOk) {
    throw new Error("Devnet smoke had one or more failed steps.");
  }

  const job = await program.account.job.fetch(jobPda);
  const finalStatus = Object.keys(job.status)[0];
  if (finalStatus !== "complete") {
    throw new Error(`Unexpected final status: ${finalStatus}`);
  }

  console.log("Devnet smoke test passed.");
  console.log(`Program ID: ${program.programId.toBase58()}`);
  console.log(`Job PDA: ${jobPda.toBase58()}`);
  console.log(`Create tx: ${createSig}`);
  console.log(`Accept tx: ${acceptSig}`);
  console.log(`Submit tx: ${submitSig}`);
  console.log(`Approve tx: ${approveSig}`);
}

run().catch((error) => {
  console.error("Devnet smoke test failed:", error);
  process.exit(1);
});
