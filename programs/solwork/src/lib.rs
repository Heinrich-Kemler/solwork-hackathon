use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("3HP12EX32vPRnocDfy1SqRpFZSJUnyWkCDPGarhn9CGj");

pub const DEVNET_USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
pub const TREASURY_WALLET: Pubkey = pubkey!("Fg6PaFpoGXkYsidMpWxTWqkYMdL4C9dQW9i7RkQ4xkfj");

pub const MAX_TITLE_LEN: usize = 64;
pub const MAX_DESCRIPTION_LEN: usize = 256;
pub const MAX_WORK_DESCRIPTION_LEN: usize = 512;
pub const MAX_DISPUTE_REASON_LEN: usize = 256;

#[cfg(feature = "local-testing")]
pub const DEFAULT_EXPIRY_SECS: i64 = 1;
#[cfg(not(feature = "local-testing"))]
pub const DEFAULT_EXPIRY_SECS: i64 = 14 * 24 * 60 * 60;

#[cfg(feature = "local-testing")]
pub const DEFAULT_GRACE_PERIOD_SECS: i64 = 1;
#[cfg(not(feature = "local-testing"))]
pub const DEFAULT_GRACE_PERIOD_SECS: i64 = 14 * 24 * 60 * 60;

pub const TREASURY_FEE_BPS: u64 = 100; // 1%
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const SECONDS_PER_DAY: i64 = 86_400;
pub const MAX_EXTENSION_DAYS: u64 = 30;

#[program]
pub mod solwork {
    use super::*;

    pub fn init_profile(ctx: Context<InitProfile>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let profile = &mut ctx.accounts.profile;
        profile.owner = ctx.accounts.signer.key();
        profile.jobs_completed = 0;
        profile.jobs_posted = 0;
        profile.disputes_raised = 0;
        profile.total_earned = 0;
        profile.total_spent = 0;
        profile.member_since = now;
        emit!(ProfileInitialized {
            owner: ctx.accounts.signer.key(),
        });
        Ok(())
    }

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

        let now = Clock::get()?.unix_timestamp;
        let expiry_time = now
            .checked_add(DEFAULT_EXPIRY_SECS)
            .ok_or(EscrowError::MathOverflow)?;

        let job = &mut ctx.accounts.job;
        job.title = title;
        job.description = description;
        job.amount = amount;
        job.client = ctx.accounts.client.key();
        job.freelancer = Pubkey::default();
        job.status = JobStatus::Open;
        job.milestone_approved = false;
        job.created_at = now;
        job.expiry_time = expiry_time;
        job.grace_period = DEFAULT_GRACE_PERIOD_SECS;
        job.submitted_at = 0;
        job.work_description = String::new();
        job.dispute_reason = String::new();
        job.job_id = job_id;
        job.job_bump = ctx.bumps.job;
        job.vault_bump = ctx.bumps.escrow_vault;

        msg!(
            "job_created job={} job_id={} amount={} expiry_time={}",
            job.key(),
            job_id,
            amount,
            expiry_time
        );
        emit!(JobCreated {
            job_id,
            client: job.client,
            amount,
            expiry: expiry_time,
        });
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
        emit!(JobAccepted {
            job_id,
            freelancer: job.freelancer,
        });
        Ok(())
    }

    pub fn submit_work(
        ctx: Context<SubmitWork>,
        job_id: u64,
        work_description: String,
    ) -> Result<()> {
        require!(
            work_description.len() <= MAX_WORK_DESCRIPTION_LEN,
            EscrowError::WorkDescriptionTooLong
        );

        let job = &mut ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Active,
            EscrowError::InvalidStatusTransition
        );
        require_keys_eq!(
            job.freelancer,
            ctx.accounts.freelancer.key(),
            EscrowError::Unauthorized
        );

        job.submitted_at = Clock::get()?.unix_timestamp;
        job.work_description = work_description;
        job.status = JobStatus::PendingReview;

        msg!(
            "work_submitted job={} job_id={} submitted_at={}",
            job.key(),
            job_id,
            job.submitted_at
        );
        emit!(WorkSubmitted {
            job_id,
            freelancer: job.freelancer,
        });
        Ok(())
    }

    pub fn extend_deadline(
        ctx: Context<ExtendDeadline>,
        job_id: u64,
        extra_days: u64,
    ) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Active,
            EscrowError::InvalidStatusTransition
        );
        require!(
            extra_days > 0 && extra_days <= MAX_EXTENSION_DAYS,
            EscrowError::InvalidDeadlineExtension
        );

        let extension_seconds = i64::try_from(extra_days)
            .map_err(|_| EscrowError::MathOverflow)?
            .checked_mul(SECONDS_PER_DAY)
            .ok_or(EscrowError::MathOverflow)?;
        let new_expiry = job
            .expiry_time
            .checked_add(extension_seconds)
            .ok_or(EscrowError::MathOverflow)?;
        job.expiry_time = new_expiry;

        msg!(
            "deadline_extended job={} job_id={} new_expiry={}",
            job.key(),
            job_id,
            new_expiry
        );
        emit!(DeadlineExtended { job_id, new_expiry });
        Ok(())
    }

    pub fn partial_release(
        ctx: Context<PartialReleaseJob>,
        job_id: u64,
        amount: u64,
    ) -> Result<()> {
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;
        require!(amount > 0, EscrowError::InvalidAmount);

        let vault_balance = ctx.accounts.escrow_vault.amount;
        require!(
            amount <= vault_balance,
            EscrowError::ReleaseAmountExceedsVaultBalance
        );

        let job = &ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Active || job.status == JobStatus::PendingReview,
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
            amount,
        )?;

        let remaining = vault_balance
            .checked_sub(amount)
            .ok_or(EscrowError::MathOverflow)?;

        let freelancer_profile = &mut ctx.accounts.freelancer_profile;
        freelancer_profile.total_earned = freelancer_profile
            .total_earned
            .checked_add(amount)
            .ok_or(EscrowError::MathOverflow)?;

        let job = &mut ctx.accounts.job;
        if remaining == 0 {
            job.status = JobStatus::Complete;
            job.milestone_approved = true;
        } else {
            job.status = JobStatus::Active;
        }

        emit!(PartialRelease {
            job_id,
            amount,
            remaining,
        });
        Ok(())
    }

    pub fn approve_job(ctx: Context<ApproveJob>, job_id: u64) -> Result<()> {
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;

        let job = &ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Active || job.status == JobStatus::PendingReview,
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

        let vault_balance = ctx.accounts.escrow_vault.amount;
        require!(vault_balance > 0, EscrowError::EmptyEscrowVault);

        let fee_amount = vault_balance
            .checked_mul(TREASURY_FEE_BPS)
            .ok_or(EscrowError::MathOverflow)?
            / BPS_DENOMINATOR;
        let freelancer_amount = vault_balance
            .checked_sub(fee_amount)
            .ok_or(EscrowError::MathOverflow)?;

        let signer_client = job.client;
        let signer_job_id = job.job_id.to_le_bytes();
        let signer_bump = [job.job_bump];
        let signer_seeds: &[&[u8]] = &[
            b"job",
            signer_client.as_ref(),
            signer_job_id.as_ref(),
            signer_bump.as_ref(),
        ];

        if fee_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_vault.to_account_info(),
                        to: ctx.accounts.treasury_usdc_ata.to_account_info(),
                        authority: ctx.accounts.job.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                fee_amount,
            )?;
        }

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
            freelancer_amount,
        )?;

        let job = &mut ctx.accounts.job;
        job.milestone_approved = true;
        job.status = JobStatus::Complete;

        let client_profile = &mut ctx.accounts.client_profile;
        client_profile.jobs_posted = client_profile
            .jobs_posted
            .checked_add(1)
            .ok_or(EscrowError::MathOverflow)?;
        client_profile.total_spent = client_profile
            .total_spent
            .checked_add(job.amount)
            .ok_or(EscrowError::MathOverflow)?;

        let freelancer_profile = &mut ctx.accounts.freelancer_profile;
        freelancer_profile.jobs_completed = freelancer_profile
            .jobs_completed
            .checked_add(1)
            .ok_or(EscrowError::MathOverflow)?;
        freelancer_profile.total_earned = freelancer_profile
            .total_earned
            .checked_add(freelancer_amount)
            .ok_or(EscrowError::MathOverflow)?;

        emit!(JobApproved {
            job_id,
            amount_released: freelancer_amount,
        });

        msg!(
            "job_completed job={} job_id={} freelancer_amount={} treasury_fee={}",
            job.key(),
            job_id,
            freelancer_amount,
            fee_amount
        );
        Ok(())
    }

    pub fn claim_after_grace(ctx: Context<ClaimAfterGrace>, job_id: u64) -> Result<()> {
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;

        let now = Clock::get()?.unix_timestamp;
        let job = &ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::PendingReview,
            EscrowError::InvalidStatusTransition
        );
        require_keys_eq!(
            job.freelancer,
            ctx.accounts.freelancer.key(),
            EscrowError::Unauthorized
        );
        require!(job.submitted_at > 0, EscrowError::WorkNotSubmitted);

        let grace_deadline = job
            .submitted_at
            .checked_add(job.grace_period)
            .ok_or(EscrowError::MathOverflow)?;
        require!(now > grace_deadline, EscrowError::GracePeriodNotElapsed);
        let remaining = ctx.accounts.escrow_vault.amount;
        require!(remaining > 0, EscrowError::EmptyEscrowVault);

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
            remaining,
        )?;

        let job = &mut ctx.accounts.job;
        job.status = JobStatus::Complete;

        msg!("Auto-released after grace period");
        emit!(GraceClaimed {
            job_id,
            amount_released: remaining,
        });
        Ok(())
    }

    pub fn dispute_job(
        ctx: Context<DisputeJob>,
        job_id: u64,
        dispute_reason: String,
    ) -> Result<()> {
        require!(
            dispute_reason.len() <= MAX_DISPUTE_REASON_LEN,
            EscrowError::DisputeReasonTooLong
        );

        let actor = ctx.accounts.actor.key();
        let job = &mut ctx.accounts.job;

        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Active || job.status == JobStatus::PendingReview,
            EscrowError::InvalidStatusTransition
        );

        let authorized_actor = actor == job.client || actor == job.freelancer;
        require!(authorized_actor, EscrowError::Unauthorized);

        job.dispute_reason = dispute_reason;
        job.status = JobStatus::Disputed;

        let actor_profile = &mut ctx.accounts.actor_profile;
        actor_profile.disputes_raised = actor_profile
            .disputes_raised
            .checked_add(1)
            .ok_or(EscrowError::MathOverflow)?;

        msg!(
            "job_disputed job={} job_id={} actor={} status=Disputed",
            job.key(),
            job_id,
            actor
        );
        emit!(DisputeRaised {
            job_id,
            raised_by: actor,
        });
        Ok(())
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        job_id: u64,
        client_amount: u64,
        freelancer_amount: u64,
    ) -> Result<()> {
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;

        validate_resolver(ctx.accounts.admin.key())?;

        let job = &ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Disputed,
            EscrowError::InvalidStatusTransition
        );
        require_keys_eq!(
            job.freelancer,
            ctx.accounts.freelancer.key(),
            EscrowError::InvalidFreelancer
        );
        let vault_balance = ctx.accounts.escrow_vault.amount;
        require!(vault_balance > 0, EscrowError::EmptyEscrowVault);

        let split_total = client_amount
            .checked_add(freelancer_amount)
            .ok_or(EscrowError::MathOverflow)?;
        require!(
            split_total == vault_balance,
            EscrowError::InvalidDisputeSplit
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

        if client_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_vault.to_account_info(),
                        to: ctx.accounts.client_usdc_ata.to_account_info(),
                        authority: ctx.accounts.job.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                client_amount,
            )?;
        }

        if freelancer_amount > 0 {
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
                freelancer_amount,
            )?;
        }

        let job = &mut ctx.accounts.job;
        job.status = JobStatus::Complete;

        emit!(DisputeResolved {
            job_id,
            client_amount,
            freelancer_amount,
        });
        Ok(())
    }

    pub fn cancel_job(ctx: Context<CancelJob>, job_id: u64) -> Result<()> {
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;

        let job = &ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Open,
            EscrowError::InvalidStatusTransition
        );
        require_keys_eq!(
            job.client,
            ctx.accounts.client.key(),
            EscrowError::Unauthorized
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
                    to: ctx.accounts.client_usdc_ata.to_account_info(),
                    authority: ctx.accounts.job.to_account_info(),
                },
                &[signer_seeds],
            ),
            job.amount,
        )?;

        let job = &mut ctx.accounts.job;
        job.status = JobStatus::Cancelled;

        msg!(
            "job_cancelled job={} job_id={} refunded_to_client={}",
            job.key(),
            job_id,
            job.client
        );
        emit!(JobCancelled {
            job_id,
            refund_amount: job.amount,
        });
        Ok(())
    }

    pub fn expire_job(ctx: Context<ExpireJob>, job_id: u64) -> Result<()> {
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;

        let now = Clock::get()?.unix_timestamp;
        let job = &ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(now > job.expiry_time, EscrowError::JobNotExpiredYet);
        require!(
            job.status == JobStatus::Open || job.status == JobStatus::Active,
            EscrowError::InvalidStatusForExpiry
        );
        let remaining = ctx.accounts.escrow_vault.amount;
        require!(remaining > 0, EscrowError::EmptyEscrowVault);

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
                    to: ctx.accounts.client_usdc_ata.to_account_info(),
                    authority: ctx.accounts.job.to_account_info(),
                },
                &[signer_seeds],
            ),
            remaining,
        )?;

        let job = &mut ctx.accounts.job;
        job.status = JobStatus::Expired;

        msg!(
            "job_expired job={} job_id={} refunded_to_client={}",
            job.key(),
            job_id,
            job.client
        );
        emit!(JobExpired {
            job_id,
            refund_amount: remaining,
        });
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

#[cfg(feature = "local-testing")]
fn validate_resolver(_resolver: Pubkey) -> Result<()> {
    Ok(())
}

#[cfg(not(feature = "local-testing"))]
fn validate_resolver(resolver: Pubkey) -> Result<()> {
    require_keys_eq!(resolver, TREASURY_WALLET, EscrowError::UnauthorizedResolver);
    Ok(())
}

#[derive(Accounts)]
pub struct InitProfile<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = UserProfile::space(),
        seeds = [b"profile", signer.key().as_ref()],
        bump,
    )]
    pub profile: Account<'info, UserProfile>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct CreateJob<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        init,
        payer = client,
        space = Job::space(),
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
pub struct SubmitWork<'info> {
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
pub struct ExtendDeadline<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        mut,
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump = job.job_bump,
        constraint = job.client == client.key() @ EscrowError::Unauthorized,
    )]
    pub job: Account<'info, Job>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct PartialReleaseJob<'info> {
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

    #[account(
        mut,
        seeds = [b"profile", freelancer.key().as_ref()],
        bump,
        constraint = freelancer_profile.owner == freelancer.key() @ EscrowError::Unauthorized,
    )]
    pub freelancer_profile: Account<'info, UserProfile>,

    pub token_program: Program<'info, Token>,
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

    #[account(
        mut,
        constraint = treasury_usdc_ata.owner == TREASURY_WALLET @ EscrowError::InvalidTreasuryAccount,
        constraint = treasury_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub treasury_usdc_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"profile", client.key().as_ref()],
        bump,
        constraint = client_profile.owner == client.key() @ EscrowError::Unauthorized,
    )]
    pub client_profile: Account<'info, UserProfile>,

    #[account(
        mut,
        seeds = [b"profile", freelancer.key().as_ref()],
        bump,
        constraint = freelancer_profile.owner == freelancer.key() @ EscrowError::Unauthorized,
    )]
    pub freelancer_profile: Account<'info, UserProfile>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct ClaimAfterGrace<'info> {
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

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"vault", job.key().as_ref()],
        bump = job.vault_bump,
        token::mint = usdc_mint,
        token::authority = job,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

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
    #[account(mut)]
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

    #[account(
        mut,
        seeds = [b"profile", actor.key().as_ref()],
        bump,
        constraint = actor_profile.owner == actor.key() @ EscrowError::Unauthorized,
    )]
    pub actor_profile: Account<'info, UserProfile>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct ResolveDispute<'info> {
    pub admin: Signer<'info>,

    /// CHECK: Used only for PDA derivation and must match `job.client`.
    pub client: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump = job.job_bump,
        constraint = job.client == client.key() @ EscrowError::ClientMismatch,
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

    #[account(
        mut,
        constraint = client_usdc_ata.owner == client.key() @ EscrowError::InvalidTokenOwner,
        constraint = client_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub client_usdc_ata: Account<'info, TokenAccount>,

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
pub struct CancelJob<'info> {
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

    #[account(
        mut,
        constraint = client_usdc_ata.owner == client.key() @ EscrowError::InvalidTokenOwner,
        constraint = client_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub client_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct ExpireJob<'info> {
    pub caller: Signer<'info>,

    /// CHECK: Used only for PDA derivation and must match `job.client`.
    pub client: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump = job.job_bump,
        constraint = job.client == client.key() @ EscrowError::ClientMismatch,
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

    #[account(
        mut,
        constraint = client_usdc_ata.owner == client.key() @ EscrowError::InvalidTokenOwner,
        constraint = client_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub client_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
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
    pub expiry_time: i64,
    pub grace_period: i64,
    pub submitted_at: i64,
    pub work_description: String,
    pub dispute_reason: String,
    pub job_id: u64,
    pub job_bump: u8,
    pub vault_bump: u8,
}

impl Job {
    pub fn space() -> usize {
        8 + // discriminator
        4 + MAX_TITLE_LEN + // title
        4 + MAX_DESCRIPTION_LEN + // description
        8 + // amount
        32 + // client
        32 + // freelancer
        1 + // status
        1 + // milestone_approved
        8 + // created_at
        8 + // expiry_time
        8 + // grace_period
        8 + // submitted_at
        4 + MAX_WORK_DESCRIPTION_LEN + // work_description
        4 + MAX_DISPUTE_REASON_LEN + // dispute_reason
        8 + // job_id
        1 + // job_bump
        1 // vault_bump
    }
}

#[account]
pub struct UserProfile {
    pub owner: Pubkey,
    pub jobs_completed: u32,
    pub jobs_posted: u32,
    pub disputes_raised: u32,
    pub total_earned: u64,
    pub total_spent: u64,
    pub member_since: i64,
}

impl UserProfile {
    pub fn space() -> usize {
        8 + // discriminator
        32 + // owner
        4 + // jobs_completed
        4 + // jobs_posted
        4 + // disputes_raised
        8 + // total_earned
        8 + // total_spent
        8 // member_since
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum JobStatus {
    Open,
    Active,
    PendingReview,
    Complete,
    Disputed,
    Expired,
    Cancelled,
}

#[event]
pub struct ProfileInitialized {
    pub owner: Pubkey,
}

#[event]
pub struct JobCreated {
    pub job_id: u64,
    pub client: Pubkey,
    pub amount: u64,
    pub expiry: i64,
}

#[event]
pub struct JobAccepted {
    pub job_id: u64,
    pub freelancer: Pubkey,
}

#[event]
pub struct WorkSubmitted {
    pub job_id: u64,
    pub freelancer: Pubkey,
}

#[event]
pub struct JobApproved {
    pub job_id: u64,
    pub amount_released: u64,
}

#[event]
pub struct PartialRelease {
    pub job_id: u64,
    pub amount: u64,
    pub remaining: u64,
}

#[event]
pub struct DisputeRaised {
    pub job_id: u64,
    pub raised_by: Pubkey,
}

#[event]
pub struct JobCancelled {
    pub job_id: u64,
    pub refund_amount: u64,
}

#[event]
pub struct JobExpired {
    pub job_id: u64,
    pub refund_amount: u64,
}

#[event]
pub struct DeadlineExtended {
    pub job_id: u64,
    pub new_expiry: i64,
}

#[event]
pub struct GraceClaimed {
    pub job_id: u64,
    pub amount_released: u64,
}

#[event]
pub struct DisputeResolved {
    pub job_id: u64,
    pub client_amount: u64,
    pub freelancer_amount: u64,
}

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Job title is too long.")]
    TitleTooLong,
    #[msg("Job description is too long.")]
    DescriptionTooLong,
    #[msg("Work description is too long.")]
    WorkDescriptionTooLong,
    #[msg("Dispute reason is too long.")]
    DisputeReasonTooLong,
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
    #[msg("Provided treasury token account is invalid.")]
    InvalidTreasuryAccount,
    #[msg("Provided job_id does not match the job account.")]
    JobIdMismatch,
    #[msg("New deadline must be greater than current expiry time.")]
    InvalidDeadlineExtension,
    #[msg("Job is not expired yet.")]
    JobNotExpiredYet,
    #[msg("Status does not allow expiry.")]
    InvalidStatusForExpiry,
    #[msg("Work has not been submitted yet.")]
    WorkNotSubmitted,
    #[msg("Grace period has not elapsed yet.")]
    GracePeriodNotElapsed,
    #[msg("Only treasury/admin resolver can resolve disputes.")]
    UnauthorizedResolver,
    #[msg("Client and freelancer split must equal escrow amount.")]
    InvalidDisputeSplit,
    #[msg("Partial release amount exceeds vault balance.")]
    ReleaseAmountExceedsVaultBalance,
    #[msg("Escrow vault is empty.")]
    EmptyEscrowVault,
    #[msg("Math overflow.")]
    MathOverflow,
}
