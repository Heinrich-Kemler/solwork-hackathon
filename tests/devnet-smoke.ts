import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Solwork } from "../target/types/solwork";

const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

async function run(): Promise<void> {
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

  const program = new Program<Solwork>(
    anchor.workspace.solwork.idl as Solwork,
    new PublicKey(programIdRaw),
    provider
  );

  const freelancer = Keypair.generate();
  const jobId = new anchor.BN(Date.now());
  const amount = new anchor.BN(1_000); // 0.001 USDC

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

  const freelancerUsdcAta = (
    await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      DEVNET_USDC_MINT,
      freelancer.publicKey
    )
  ).address;

  const airdropSig = await connection.requestAirdrop(
    freelancer.publicKey,
    anchor.web3.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSig, "confirmed");

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

  const createSig = await program.methods
    .createJob(jobId, "Devnet smoke", "Smoke test escrow flow", amount)
    .accounts({
      client: wallet.publicKey,
      job: jobPda,
      usdcMint: DEVNET_USDC_MINT,
      clientUsdcAta,
      escrowVault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  const acceptSig = await program.methods
    .acceptJob(jobId)
    .accounts({
      freelancer: freelancer.publicKey,
      client: wallet.publicKey,
      job: jobPda,
    })
    .signers([freelancer])
    .rpc();

  const approveSig = await program.methods
    .approveJob(jobId)
    .accounts({
      client: wallet.publicKey,
      job: jobPda,
      usdcMint: DEVNET_USDC_MINT,
      escrowVault: vaultPda,
      freelancer: freelancer.publicKey,
      freelancerUsdcAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

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
  console.log(`Approve tx: ${approveSig}`);
}

run().catch((error) => {
  console.error("Devnet smoke test failed:", error);
  process.exit(1);
});
