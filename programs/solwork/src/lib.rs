use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("3HP12EX32vPRnocDfy1SqRpFZSJUnyWkCDPGarhn9CGj");

pub const DEVNET_USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
pub const MAX_TITLE_LEN: usize = 64;
pub const MAX_DESCRIPTION_LEN: usize = 256;

#[program]
pub mod solwork {
    use super::*;

    pub fn create_job(
        ctx: Context<CreateJob>,
        job_id: u64,
        title: String,
        description: String,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(title.len() <= MAX_TITLE_LEN, EscrowError::TitleTooLong);
        require!(
            description.len() <= MAX_DESCRIPTION_LEN,
            EscrowError::DescriptionTooLong
        );
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.client_usdc_ata.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                    authority: ctx.accounts.client.to_account_info(),
                },
            ),
            amount,
        )?;

        let job = &mut ctx.accounts.job;
        job.title = title;
        job.description = description;
        job.amount = amount;
        job.client = ctx.accounts.client.key();
        job.freelancer = Pubkey::default();
        job.status = JobStatus::Open;
        job.milestone_approved = false;
        job.created_at = Clock::get()?.unix_timestamp;
        job.job_id = job_id;
        job.job_bump = ctx.bumps.job;
        job.vault_bump = ctx.bumps.escrow_vault;

        msg!(
            "job_created job={} job_id={} amount={} status=Open",
            job.key(),
            job_id,
            amount
        );
        Ok(())
    }

    pub fn accept_job(ctx: Context<AcceptJob>, job_id: u64) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(job.status == JobStatus::Open, EscrowError::InvalidStatusTransition);
        require!(
            job.freelancer == Pubkey::default(),
            EscrowError::JobAlreadyAccepted
        );

        job.freelancer = ctx.accounts.freelancer.key();
        job.status = JobStatus::Active;

        msg!(
            "job_accepted job={} job_id={} freelancer={}",
            job.key(),
            job_id,
            job.freelancer
        );
        Ok(())
    }

    pub fn approve_job(ctx: Context<ApproveJob>, job_id: u64) -> Result<()> {
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;

        let job = &ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Active,
            EscrowError::InvalidStatusTransition
        );
        require_keys_eq!(
            job.client,
            ctx.accounts.client.key(),
            EscrowError::Unauthorized
        );
        require_keys_eq!(
            job.freelancer,
            ctx.accounts.freelancer.key(),
            EscrowError::InvalidFreelancer
        );

        let signer_client = job.client;
        let signer_job_id = job.job_id.to_le_bytes();
        let signer_bump = [job.job_bump];
        let signer_seeds: &[&[u8]] = &[
            b"job",
            signer_client.as_ref(),
            signer_job_id.as_ref(),
            signer_bump.as_ref(),
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.freelancer_usdc_ata.to_account_info(),
                    authority: ctx.accounts.job.to_account_info(),
                },
                &[signer_seeds],
            ),
            job.amount,
        )?;

        let job = &mut ctx.accounts.job;
        job.milestone_approved = true;
        job.status = JobStatus::Complete;

        emit!(JobCompleted {
            job: job.key(),
            job_id,
            client: job.client,
            freelancer: job.freelancer,
            amount: job.amount,
            completed_at: Clock::get()?.unix_timestamp,
        });

        msg!(
            "job_completed job={} job_id={} amount={} status=Complete",
            job.key(),
            job_id,
            job.amount
        );
        Ok(())
    }

    pub fn dispute_job(ctx: Context<DisputeJob>, job_id: u64) -> Result<()> {
        let actor = ctx.accounts.actor.key();
        let job = &mut ctx.accounts.job;

        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Active,
            EscrowError::InvalidStatusTransition
        );

        let authorized_actor = actor == job.client || actor == job.freelancer;
        require!(authorized_actor, EscrowError::Unauthorized);

        job.status = JobStatus::Disputed;

        msg!(
            "job_disputed job={} job_id={} actor={} status=Disputed",
            job.key(),
            job_id,
            actor
        );
        Ok(())
    }
}

#[cfg(feature = "local-testing")]
fn validate_usdc_mint(_mint: Pubkey) -> Result<()> {
    Ok(())
}

#[cfg(not(feature = "local-testing"))]
fn validate_usdc_mint(mint: Pubkey) -> Result<()> {
    require_keys_eq!(mint, DEVNET_USDC_MINT, EscrowError::InvalidUsdcMint);
    Ok(())
}

#[derive(Accounts)]
#[instruction(job_id: u64, title: String, description: String)]
pub struct CreateJob<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        init,
        payer = client,
        space = Job::space(&title, &description),
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump,
    )]
    pub job: Account<'info, Job>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = client_usdc_ata.owner == client.key() @ EscrowError::InvalidTokenOwner,
        constraint = client_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub client_usdc_ata: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = client,
        seeds = [b"vault", job.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = job,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct AcceptJob<'info> {
    #[account(mut)]
    pub freelancer: Signer<'info>,

    /// CHECK: Used only for PDA derivation and must match `job.client`.
    pub client: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump = job.job_bump,
        constraint = job.client == client.key() @ EscrowError::ClientMismatch,
    )]
    pub job: Account<'info, Job>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct ApproveJob<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        mut,
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump = job.job_bump,
        constraint = job.client == client.key() @ EscrowError::Unauthorized,
    )]
    pub job: Account<'info, Job>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"vault", job.key().as_ref()],
        bump = job.vault_bump,
        token::mint = usdc_mint,
        token::authority = job,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// CHECK: Verified against `job.freelancer`.
    pub freelancer: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = freelancer_usdc_ata.owner == freelancer.key() @ EscrowError::InvalidTokenOwner,
        constraint = freelancer_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub freelancer_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct DisputeJob<'info> {
    pub actor: Signer<'info>,

    /// CHECK: Used only for PDA derivation and must match `job.client`.
    pub client: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump = job.job_bump,
        constraint = job.client == client.key() @ EscrowError::ClientMismatch,
    )]
    pub job: Account<'info, Job>,
}

#[account]
pub struct Job {
    pub title: String,
    pub description: String,
    pub amount: u64,
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub status: JobStatus,
    pub milestone_approved: bool,
    pub created_at: i64,
    pub job_id: u64,
    pub job_bump: u8,
    pub vault_bump: u8,
}

impl Job {
    pub fn space(title: &str, description: &str) -> usize {
        8 + // discriminator
        4 + title.len() + // title
        4 + description.len() + // description
        8 + // amount
        32 + // client
        32 + // freelancer
        1 + // status
        1 + // milestone_approved
        8 + // created_at
        8 + // job_id
        1 + // job_bump
        1 // vault_bump
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum JobStatus {
    Open,
    Active,
    Complete,
    Disputed,
}

#[event]
pub struct JobCompleted {
    pub job: Pubkey,
    pub job_id: u64,
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub amount: u64,
    pub completed_at: i64,
}

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Job title is too long.")]
    TitleTooLong,
    #[msg("Job description is too long.")]
    DescriptionTooLong,
    #[msg("Invalid USDC mint for this environment.")]
    InvalidUsdcMint,
    #[msg("Signer is not authorized for this action.")]
    Unauthorized,
    #[msg("Invalid status transition for this action.")]
    InvalidStatusTransition,
    #[msg("Job was already accepted by a freelancer.")]
    JobAlreadyAccepted,
    #[msg("Provided freelancer does not match the job freelancer.")]
    InvalidFreelancer,
    #[msg("Client account does not match the job client.")]
    ClientMismatch,
    #[msg("Token account owner is invalid.")]
    InvalidTokenOwner,
    #[msg("Token account mint is invalid.")]
    InvalidTokenMint,
    #[msg("Provided job_id does not match the job account.")]
    JobIdMismatch,
}
