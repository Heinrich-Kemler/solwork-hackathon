use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer as SystemTransfer};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("3HP12EX32vPRnocDfy1SqRpFZSJUnyWkCDPGarhn9CGj");

pub const DEVNET_USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
pub const TREASURY_WALLET: Pubkey = pubkey!("GyyjsG67zY21B2BYfLsNUbN9hZLfog9DZYRjnZuHWzfQ");

pub const MAX_TITLE_LEN: usize = 64;
pub const MAX_DESCRIPTION_LEN: usize = 256;
pub const MAX_WORK_DESCRIPTION_LEN: usize = 512;
pub const MAX_DISPUTE_REASON_LEN: usize = 256;
pub const MAX_AVATAR_URI_LEN: usize = 128;

#[cfg(feature = "local-testing")]
pub const DEFAULT_EXPIRY_SECS: i64 = 1;
#[cfg(not(feature = "local-testing"))]
pub const DEFAULT_EXPIRY_SECS: i64 = 14 * 24 * 60 * 60;

#[cfg(feature = "local-testing")]
pub const DEFAULT_GRACE_PERIOD_SECS: i64 = 1;
#[cfg(not(feature = "local-testing"))]
pub const DEFAULT_GRACE_PERIOD_SECS: i64 = 14 * 24 * 60 * 60;

pub const TREASURY_FEE_BPS: u64 = 100; // 1%
pub const REFERRAL_FEE_BPS: u64 = 50; // 0.5%
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const SECONDS_PER_DAY: i64 = 86_400;
pub const MAX_EXTENSION_DAYS: u64 = 30;
#[cfg(feature = "local-testing")]
pub const MIN_JUROR_JOBS_COMPLETED: u32 = 0;
#[cfg(not(feature = "local-testing"))]
pub const MIN_JUROR_JOBS_COMPLETED: u32 = 3;

#[cfg(feature = "local-testing")]
pub const MAX_JUROR_DISPUTES_RAISED: u32 = u32::MAX;
#[cfg(not(feature = "local-testing"))]
pub const MAX_JUROR_DISPUTES_RAISED: u32 = 1;
pub const JUROR_COUNT: usize = 3;
pub const ACTIVATION_FEE_LAMPORTS: u64 = 10_000_000; // 0.01 SOL

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
        profile.referred_by = None;
        profile.referral_earnings = 0;
        profile.reputation_score = 0;
        profile.avatar_uri = String::new();
        profile.member_since = now;
        emit!(ProfileInitialized {
            owner: ctx.accounts.signer.key(),
        });
        Ok(())
    }

    pub fn set_referral(ctx: Context<SetReferral>, referrer: Pubkey) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        let referrer_profile = &ctx.accounts.referrer_profile;

        require!(profile.referred_by.is_none(), EscrowError::ReferralAlreadySet);
        require!(
            profile.jobs_completed == 0,
            EscrowError::ReferralMustBeSetBeforeCompletion
        );
        require!(
            referrer != profile.owner,
            EscrowError::InvalidReferrer
        );
        require_keys_eq!(
            referrer_profile.owner,
            referrer,
            EscrowError::InvalidReferrer
        );

        profile.referred_by = Some(referrer);
        emit!(ReferralSet {
            user: profile.owner,
            referrer,
        });
        Ok(())
    }

    pub fn update_avatar(ctx: Context<UpdateAvatar>, avatar_uri: String) -> Result<()> {
        require!(
            avatar_uri.len() <= MAX_AVATAR_URI_LEN,
            EscrowError::AvatarUriTooLong
        );

        let profile = &mut ctx.accounts.profile;
        require_keys_eq!(
            profile.owner,
            ctx.accounts.signer.key(),
            EscrowError::Unauthorized
        );
        profile.avatar_uri = avatar_uri;
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

        let client_profile = &mut ctx.accounts.client_profile;
        if client_profile.jobs_posted == 0 {
            // Activation fee: 0.01 SOL on first job post
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    SystemTransfer {
                        from: ctx.accounts.client.to_account_info(),
                        to: ctx.accounts.treasury_wallet.to_account_info(),
                    },
                ),
                ACTIVATION_FEE_LAMPORTS,
            )?;
        }
        client_profile.jobs_posted = client_profile
            .jobs_posted
            .checked_add(1)
            .ok_or(EscrowError::MathOverflow)?;

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
        let job_key = job.key();

        let vault_balance = ctx.accounts.escrow_vault.amount;
        require!(vault_balance > 0, EscrowError::EmptyEscrowVault);

        let maybe_referrer = ctx.accounts.freelancer_profile.referred_by;
        let fee_amount = vault_balance
            .checked_mul(TREASURY_FEE_BPS)
            .ok_or(EscrowError::MathOverflow)?
            / BPS_DENOMINATOR;
        let referral_amount = if maybe_referrer.is_some() {
            vault_balance
                .checked_mul(REFERRAL_FEE_BPS)
                .ok_or(EscrowError::MathOverflow)?
                / BPS_DENOMINATOR
        } else {
            0
        };
        let freelancer_amount = vault_balance
            .checked_sub(fee_amount)
            .ok_or(EscrowError::MathOverflow)?
            .checked_sub(referral_amount)
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

        if let Some(referrer) = maybe_referrer {
            let referrer_profile = ctx
                .accounts
                .referrer_profile
                .as_mut()
                .ok_or(EscrowError::MissingReferralAccounts)?;
            require_keys_eq!(
                referrer_profile.owner,
                referrer,
                EscrowError::InvalidReferrer
            );
            let referrer_usdc_ata = ctx
                .accounts
                .referrer_usdc_ata
                .as_ref()
                .ok_or(EscrowError::MissingReferralAccounts)?;
            require_keys_eq!(
                referrer_usdc_ata.owner,
                referrer,
                EscrowError::InvalidReferrer
            );
            require_keys_eq!(
                referrer_usdc_ata.mint,
                ctx.accounts.usdc_mint.key(),
                EscrowError::InvalidTokenMint
            );

            if referral_amount > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.escrow_vault.to_account_info(),
                            to: referrer_usdc_ata.to_account_info(),
                            authority: ctx.accounts.job.to_account_info(),
                        },
                        &[signer_seeds],
                    ),
                    referral_amount,
                )?;

                referrer_profile.referral_earnings = referrer_profile
                    .referral_earnings
                    .checked_add(referral_amount)
                    .ok_or(EscrowError::MathOverflow)?;
                emit!(ReferralEarned {
                    referrer,
                    amount: referral_amount,
                });
            }
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
        emit!(JobCompletedEvent {
            job: job_key,
            client: job.client,
            freelancer: job.freelancer,
            amount: vault_balance,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "job_completed job={} job_id={} freelancer_amount={} treasury_fee={} referral_fee={}",
            job.key(),
            job_id,
            freelancer_amount,
            fee_amount,
            referral_amount
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
        let maybe_referrer = ctx.accounts.freelancer_profile.referred_by;

        let signer_client = job.client;
        let signer_job_id = job.job_id.to_le_bytes();
        let signer_bump = [job.job_bump];
        let signer_seeds: &[&[u8]] = &[
            b"job",
            signer_client.as_ref(),
            signer_job_id.as_ref(),
            signer_bump.as_ref(),
        ];

        let fee_amount = remaining
            .checked_mul(TREASURY_FEE_BPS)
            .ok_or(EscrowError::MathOverflow)?
            / BPS_DENOMINATOR;
        let referral_amount = if maybe_referrer.is_some() {
            remaining
                .checked_mul(REFERRAL_FEE_BPS)
                .ok_or(EscrowError::MathOverflow)?
                / BPS_DENOMINATOR
        } else {
            0
        };
        let freelancer_amount = remaining
            .checked_sub(fee_amount)
            .ok_or(EscrowError::MathOverflow)?
            .checked_sub(referral_amount)
            .ok_or(EscrowError::MathOverflow)?;

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

        if let Some(referrer) = maybe_referrer {
            let referrer_profile = ctx
                .accounts
                .referrer_profile
                .as_mut()
                .ok_or(EscrowError::MissingReferralAccounts)?;
            require_keys_eq!(
                referrer_profile.owner,
                referrer,
                EscrowError::InvalidReferrer
            );
            let referrer_usdc_ata = ctx
                .accounts
                .referrer_usdc_ata
                .as_ref()
                .ok_or(EscrowError::MissingReferralAccounts)?;
            require_keys_eq!(
                referrer_usdc_ata.owner,
                referrer,
                EscrowError::InvalidReferrer
            );
            require_keys_eq!(
                referrer_usdc_ata.mint,
                ctx.accounts.usdc_mint.key(),
                EscrowError::InvalidTokenMint
            );

            if referral_amount > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.escrow_vault.to_account_info(),
                            to: referrer_usdc_ata.to_account_info(),
                            authority: ctx.accounts.job.to_account_info(),
                        },
                        &[signer_seeds],
                    ),
                    referral_amount,
                )?;

                referrer_profile.referral_earnings = referrer_profile
                    .referral_earnings
                    .checked_add(referral_amount)
                    .ok_or(EscrowError::MathOverflow)?;
                emit!(ReferralEarned {
                    referrer,
                    amount: referral_amount,
                });
            }
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
        job.status = JobStatus::Complete;

        let freelancer_profile = &mut ctx.accounts.freelancer_profile;
        freelancer_profile.total_earned = freelancer_profile
            .total_earned
            .checked_add(freelancer_amount)
            .ok_or(EscrowError::MathOverflow)?;

        msg!("Auto-released after grace period");
        emit!(GraceClaimed {
            job_id,
            amount_released: freelancer_amount,
        });
        Ok(())
    }

    pub fn initiate_dispute_vote(ctx: Context<InitiateDisputeVote>, job_id: u64) -> Result<()> {
        let job = &ctx.accounts.job;
        require!(job.job_id == job_id, EscrowError::JobIdMismatch);
        require!(
            job.status == JobStatus::Disputed,
            EscrowError::InvalidStatusTransition
        );

        let now = Clock::get()?.unix_timestamp;
        let slot = Clock::get()?.slot;
        let jurors = select_jurors(job.key(), slot, ctx.remaining_accounts.to_vec())?;
        let dispute_vote = &mut ctx.accounts.dispute_vote;
        dispute_vote.dispute_key = job.key();
        dispute_vote.juror_1 = jurors[0];
        dispute_vote.juror_2 = jurors[1];
        dispute_vote.juror_3 = jurors[2];
        dispute_vote.vote_1 = None;
        dispute_vote.vote_2 = None;
        dispute_vote.vote_3 = None;
        dispute_vote.created_at = now;
        dispute_vote.resolved = false;
        dispute_vote.bump = ctx.bumps.dispute_vote;

        emit!(DisputeVoteInitiated {
            job_id,
            juror_1: jurors[0],
            juror_2: jurors[1],
            juror_3: jurors[2],
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
        let job_key = job.key();

        let actor_profile = &mut ctx.accounts.actor_profile;
        actor_profile.disputes_raised = actor_profile
            .disputes_raised
            .checked_add(1)
            .ok_or(EscrowError::MathOverflow)?;

        let now = Clock::get()?.unix_timestamp;
        let slot = Clock::get()?.slot;
        let jurors = select_jurors(job_key, slot, ctx.remaining_accounts.to_vec())?;
        let dispute_vote = &mut ctx.accounts.dispute_vote;
        dispute_vote.dispute_key = job_key;
        dispute_vote.juror_1 = jurors[0];
        dispute_vote.juror_2 = jurors[1];
        dispute_vote.juror_3 = jurors[2];
        dispute_vote.vote_1 = None;
        dispute_vote.vote_2 = None;
        dispute_vote.vote_3 = None;
        dispute_vote.created_at = now;
        dispute_vote.resolved = false;
        dispute_vote.bump = ctx.bumps.dispute_vote;

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
        emit!(DisputeVoteInitiated {
            job_id,
            juror_1: jurors[0],
            juror_2: jurors[1],
            juror_3: jurors[2],
        });
        Ok(())
    }

    pub fn cast_vote(ctx: Context<CastVote>, job_id: u64, vote: bool) -> Result<()> {
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;

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

        let voter = ctx.accounts.voter.key();
        let dispute_vote = &mut ctx.accounts.dispute_vote;
        require_keys_eq!(
            dispute_vote.dispute_key,
            job.key(),
            EscrowError::InvalidDisputeVote
        );
        require!(!dispute_vote.resolved, EscrowError::DisputeAlreadyResolved);

        match juror_index(dispute_vote, voter) {
            Some(1) => {
                require!(dispute_vote.vote_1.is_none(), EscrowError::VoteAlreadyCast);
                dispute_vote.vote_1 = Some(vote);
            }
            Some(2) => {
                require!(dispute_vote.vote_2.is_none(), EscrowError::VoteAlreadyCast);
                dispute_vote.vote_2 = Some(vote);
            }
            Some(3) => {
                require!(dispute_vote.vote_3.is_none(), EscrowError::VoteAlreadyCast);
                dispute_vote.vote_3 = Some(vote);
            }
            _ => return err!(EscrowError::UnauthorizedJuror),
        }

        emit!(DisputeVoteCast {
            job_id,
            juror: voter,
            vote,
        });

        let majority = majority_vote(dispute_vote.vote_1, dispute_vote.vote_2, dispute_vote.vote_3);
        if let Some(freelancer_wins) = majority {
            let amount = settle_dispute_with_vote(
                &mut ctx.accounts.job,
                &mut ctx.accounts.dispute_vote,
                freelancer_wins,
                &ctx.accounts.escrow_vault,
                &ctx.accounts.client_usdc_ata,
                &ctx.accounts.freelancer_usdc_ata,
                &mut ctx.accounts.client_profile,
                &mut ctx.accounts.freelancer_profile,
                &ctx.accounts.token_program,
            )?;
            let winner = if freelancer_wins {
                ctx.accounts.freelancer.key()
            } else {
                ctx.accounts.client.key()
            };
            emit!(DisputeResolved {
                job_id,
                winner,
                amount,
            });
        }

        Ok(())
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        job_id: u64,
    ) -> Result<()> {
        validate_usdc_mint(ctx.accounts.usdc_mint.key())?;

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
        let dispute_vote = &ctx.accounts.dispute_vote;
        require_keys_eq!(
            dispute_vote.dispute_key,
            job.key(),
            EscrowError::InvalidDisputeVote
        );
        require!(!dispute_vote.resolved, EscrowError::DisputeAlreadyResolved);

        let freelancer_wins = majority_vote(dispute_vote.vote_1, dispute_vote.vote_2, dispute_vote.vote_3)
            .ok_or(EscrowError::InsufficientVotes)?;
        let amount = settle_dispute_with_vote(
            &mut ctx.accounts.job,
            &mut ctx.accounts.dispute_vote,
            freelancer_wins,
            &ctx.accounts.escrow_vault,
            &ctx.accounts.client_usdc_ata,
            &ctx.accounts.freelancer_usdc_ata,
            &mut ctx.accounts.client_profile,
            &mut ctx.accounts.freelancer_profile,
            &ctx.accounts.token_program,
        )?;
        let winner = if freelancer_wins {
            ctx.accounts.freelancer.key()
        } else {
            ctx.accounts.client.key()
        };
        emit!(DisputeResolved {
            job_id,
            winner,
            amount,
        });
        Ok(())
    }

    pub fn get_eligible_jurors(ctx: Context<GetEligibleJurors>) -> Result<()> {
        let mut eligible = collect_eligible_jurors(ctx.remaining_accounts.to_vec())?;
        eligible.sort();
        anchor_lang::solana_program::program::set_return_data(&eligible.try_to_vec()?);
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

fn is_juror_eligible(profile: &UserProfile) -> bool {
    profile.jobs_completed >= MIN_JUROR_JOBS_COMPLETED
        && profile.disputes_raised <= MAX_JUROR_DISPUTES_RAISED
}

fn collect_eligible_jurors<'info>(
    remaining_accounts: Vec<AccountInfo<'info>>,
) -> Result<Vec<Pubkey>> {
    let mut eligible = Vec::new();
    for account_info in remaining_accounts.iter() {
        if account_info.owner != &crate::id() {
            continue;
        }
        let data_ref = account_info.try_borrow_data()?;
        let mut data_slice: &[u8] = &data_ref;
        if let Ok(profile) = UserProfile::try_deserialize(&mut data_slice) {
            if is_juror_eligible(&profile) && !eligible.contains(&profile.owner) {
                eligible.push(profile.owner);
            }
        }
    }
    Ok(eligible)
}

fn select_jurors<'info>(
    job_key: Pubkey,
    slot: u64,
    remaining_accounts: Vec<AccountInfo<'info>>,
) -> Result<[Pubkey; JUROR_COUNT]> {
    let mut eligible = collect_eligible_jurors(remaining_accounts)?;
    require!(
        eligible.len() >= JUROR_COUNT,
        EscrowError::NotEnoughEligibleJurors
    );

    let mut selected = [Pubkey::default(); JUROR_COUNT];
    let mut seed_bytes = [0u8; 8];
    seed_bytes.copy_from_slice(&job_key.to_bytes()[..8]);
    let mut state = u64::from_le_bytes(seed_bytes) ^ slot;
    for (i, slot_ref) in selected.iter_mut().enumerate() {
        state = state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1)
            .wrapping_add(i as u64);
        let index = (state as usize) % eligible.len();
        *slot_ref = eligible.remove(index);
    }
    Ok(selected)
}

fn juror_index(dispute_vote: &DisputeVote, juror: Pubkey) -> Option<u8> {
    if juror == dispute_vote.juror_1 {
        Some(1)
    } else if juror == dispute_vote.juror_2 {
        Some(2)
    } else if juror == dispute_vote.juror_3 {
        Some(3)
    } else {
        None
    }
}

fn majority_vote(v1: Option<bool>, v2: Option<bool>, v3: Option<bool>) -> Option<bool> {
    let votes = [v1, v2, v3];
    let trues = votes.iter().filter(|v| matches!(v, Some(true))).count();
    let falses = votes.iter().filter(|v| matches!(v, Some(false))).count();
    if trues >= 2 {
        Some(true)
    } else if falses >= 2 {
        Some(false)
    } else {
        None
    }
}

fn settle_dispute_with_vote<'info>(
    job: &mut Account<'info, Job>,
    dispute_vote: &mut Account<'info, DisputeVote>,
    freelancer_wins: bool,
    escrow_vault: &Account<'info, TokenAccount>,
    client_usdc_ata: &Account<'info, TokenAccount>,
    freelancer_usdc_ata: &Account<'info, TokenAccount>,
    client_profile: &mut Account<'info, UserProfile>,
    freelancer_profile: &mut Account<'info, UserProfile>,
    token_program: &Program<'info, Token>,
) -> Result<u64> {
    let amount = escrow_vault.amount;
    require!(amount > 0, EscrowError::EmptyEscrowVault);

    let signer_client = job.client;
    let signer_job_id = job.job_id.to_le_bytes();
    let signer_bump = [job.job_bump];
    let signer_seeds: &[&[u8]] = &[
        b"job",
        signer_client.as_ref(),
        signer_job_id.as_ref(),
        signer_bump.as_ref(),
    ];

    let to_account = if freelancer_wins {
        freelancer_usdc_ata.to_account_info()
    } else {
        client_usdc_ata.to_account_info()
    };

    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: escrow_vault.to_account_info(),
                to: to_account,
                authority: job.to_account_info(),
            },
            &[signer_seeds],
        ),
        amount,
    )?;

    if freelancer_wins {
        freelancer_profile.reputation_score = freelancer_profile
            .reputation_score
            .checked_add(5)
            .ok_or(EscrowError::MathOverflow)?;
        client_profile.reputation_score = client_profile
            .reputation_score
            .checked_sub(2)
            .ok_or(EscrowError::MathOverflow)?;
    } else {
        client_profile.reputation_score = client_profile
            .reputation_score
            .checked_add(5)
            .ok_or(EscrowError::MathOverflow)?;
        freelancer_profile.reputation_score = freelancer_profile
            .reputation_score
            .checked_sub(2)
            .ok_or(EscrowError::MathOverflow)?;
    }

    dispute_vote.resolved = true;
    job.status = JobStatus::Complete;
    job.milestone_approved = freelancer_wins;

    Ok(amount)
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
pub struct SetReferral<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"profile", signer.key().as_ref()],
        bump,
        constraint = profile.owner == signer.key() @ EscrowError::Unauthorized,
    )]
    pub profile: Account<'info, UserProfile>,

    #[account(
        seeds = [b"profile", referrer_profile.owner.as_ref()],
        bump,
    )]
    pub referrer_profile: Account<'info, UserProfile>,
}

#[derive(Accounts)]
pub struct UpdateAvatar<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"profile", signer.key().as_ref()],
        bump,
        constraint = profile.owner == signer.key() @ EscrowError::Unauthorized,
    )]
    pub profile: Account<'info, UserProfile>,
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

    #[account(
        mut,
        seeds = [b"profile", client.key().as_ref()],
        bump,
        constraint = client_profile.owner == client.key() @ EscrowError::Unauthorized,
    )]
    pub client_profile: Account<'info, UserProfile>,

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

    /// CHECK: Fixed treasury wallet enforced by address constraint.
    #[account(
        mut,
        address = TREASURY_WALLET @ EscrowError::InvalidTreasuryWallet,
    )]
    pub treasury_wallet: UncheckedAccount<'info>,

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
    pub job: Box<Account<'info, Job>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"vault", job.key().as_ref()],
        bump = job.vault_bump,
        token::mint = usdc_mint,
        token::authority = job,
    )]
    pub escrow_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: Verified against `job.freelancer`.
    pub freelancer: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = freelancer_usdc_ata.owner == freelancer.key() @ EscrowError::InvalidTokenOwner,
        constraint = freelancer_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub freelancer_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = treasury_usdc_ata.owner == TREASURY_WALLET @ EscrowError::InvalidTreasuryAccount,
        constraint = treasury_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub treasury_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"profile", client.key().as_ref()],
        bump,
        constraint = client_profile.owner == client.key() @ EscrowError::Unauthorized,
    )]
    pub client_profile: Box<Account<'info, UserProfile>>,

    #[account(
        mut,
        seeds = [b"profile", freelancer.key().as_ref()],
        bump,
        constraint = freelancer_profile.owner == freelancer.key() @ EscrowError::Unauthorized,
    )]
    pub freelancer_profile: Box<Account<'info, UserProfile>>,

    #[account(mut)]
    pub referrer_profile: Option<Box<Account<'info, UserProfile>>>,

    #[account(mut)]
    pub referrer_usdc_ata: Option<Box<Account<'info, TokenAccount>>>,

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
    pub job: Box<Account<'info, Job>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"vault", job.key().as_ref()],
        bump = job.vault_bump,
        token::mint = usdc_mint,
        token::authority = job,
    )]
    pub escrow_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = freelancer_usdc_ata.owner == freelancer.key() @ EscrowError::InvalidTokenOwner,
        constraint = freelancer_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub freelancer_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = treasury_usdc_ata.owner == TREASURY_WALLET @ EscrowError::InvalidTreasuryAccount,
        constraint = treasury_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub treasury_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"profile", freelancer.key().as_ref()],
        bump,
        constraint = freelancer_profile.owner == freelancer.key() @ EscrowError::Unauthorized,
    )]
    pub freelancer_profile: Box<Account<'info, UserProfile>>,

    #[account(mut)]
    pub referrer_profile: Option<Box<Account<'info, UserProfile>>>,

    #[account(mut)]
    pub referrer_usdc_ata: Option<Box<Account<'info, TokenAccount>>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct InitiateDisputeVote<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    /// CHECK: Used only for PDA derivation and must match `job.client`.
    pub client: UncheckedAccount<'info>,

    #[account(
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump = job.job_bump,
        constraint = job.client == client.key() @ EscrowError::ClientMismatch,
    )]
    pub job: Account<'info, Job>,

    #[account(
        init,
        payer = caller,
        space = DisputeVote::space(),
        seeds = [b"dispute_vote", job.key().as_ref()],
        bump,
    )]
    pub dispute_vote: Account<'info, DisputeVote>,

    pub system_program: Program<'info, System>,
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

    #[account(
        init,
        payer = actor,
        space = DisputeVote::space(),
        seeds = [b"dispute_vote", job.key().as_ref()],
        bump,
    )]
    pub dispute_vote: Account<'info, DisputeVote>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    /// CHECK: Used only for PDA derivation and must match `job.client`.
    pub client: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump = job.job_bump,
        constraint = job.client == client.key() @ EscrowError::ClientMismatch,
    )]
    pub job: Box<Account<'info, Job>>,

    #[account(
        mut,
        seeds = [b"dispute_vote", job.key().as_ref()],
        bump = dispute_vote.bump,
        constraint = dispute_vote.dispute_key == job.key() @ EscrowError::InvalidDisputeVote,
    )]
    pub dispute_vote: Box<Account<'info, DisputeVote>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"vault", job.key().as_ref()],
        bump = job.vault_bump,
        token::mint = usdc_mint,
        token::authority = job,
    )]
    pub escrow_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = client_usdc_ata.owner == client.key() @ EscrowError::InvalidTokenOwner,
        constraint = client_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub client_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: Verified against `job.freelancer`.
    pub freelancer: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = freelancer_usdc_ata.owner == freelancer.key() @ EscrowError::InvalidTokenOwner,
        constraint = freelancer_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub freelancer_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"profile", client.key().as_ref()],
        bump,
        constraint = client_profile.owner == client.key() @ EscrowError::Unauthorized,
    )]
    pub client_profile: Box<Account<'info, UserProfile>>,

    #[account(
        mut,
        seeds = [b"profile", freelancer.key().as_ref()],
        bump,
        constraint = freelancer_profile.owner == freelancer.key() @ EscrowError::Unauthorized,
    )]
    pub freelancer_profile: Box<Account<'info, UserProfile>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct ResolveDispute<'info> {
    pub caller: Signer<'info>,

    /// CHECK: Used only for PDA derivation and must match `job.client`.
    pub client: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump = job.job_bump,
        constraint = job.client == client.key() @ EscrowError::ClientMismatch,
    )]
    pub job: Box<Account<'info, Job>>,

    #[account(
        mut,
        seeds = [b"dispute_vote", job.key().as_ref()],
        bump = dispute_vote.bump,
        constraint = dispute_vote.dispute_key == job.key() @ EscrowError::InvalidDisputeVote,
    )]
    pub dispute_vote: Box<Account<'info, DisputeVote>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"vault", job.key().as_ref()],
        bump = job.vault_bump,
        token::mint = usdc_mint,
        token::authority = job,
    )]
    pub escrow_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = client_usdc_ata.owner == client.key() @ EscrowError::InvalidTokenOwner,
        constraint = client_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub client_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: Verified against `job.freelancer`.
    pub freelancer: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = freelancer_usdc_ata.owner == freelancer.key() @ EscrowError::InvalidTokenOwner,
        constraint = freelancer_usdc_ata.mint == usdc_mint.key() @ EscrowError::InvalidTokenMint,
    )]
    pub freelancer_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"profile", client.key().as_ref()],
        bump,
        constraint = client_profile.owner == client.key() @ EscrowError::Unauthorized,
    )]
    pub client_profile: Box<Account<'info, UserProfile>>,

    #[account(
        mut,
        seeds = [b"profile", freelancer.key().as_ref()],
        bump,
        constraint = freelancer_profile.owner == freelancer.key() @ EscrowError::Unauthorized,
    )]
    pub freelancer_profile: Box<Account<'info, UserProfile>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetEligibleJurors {}

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
    pub referred_by: Option<Pubkey>,
    pub referral_earnings: u64,
    pub reputation_score: i64,
    pub avatar_uri: String,
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
        1 + 32 + // referred_by option
        8 + // referral_earnings
        8 + // reputation_score
        4 + MAX_AVATAR_URI_LEN + // avatar_uri
        8 // member_since
    }
}

#[account]
pub struct DisputeVote {
    pub dispute_key: Pubkey,
    pub juror_1: Pubkey,
    pub juror_2: Pubkey,
    pub juror_3: Pubkey,
    pub vote_1: Option<bool>,
    pub vote_2: Option<bool>,
    pub vote_3: Option<bool>,
    pub created_at: i64,
    pub resolved: bool,
    pub bump: u8,
}

impl DisputeVote {
    pub fn space() -> usize {
        8 + // discriminator
        32 + // dispute_key
        32 + // juror_1
        32 + // juror_2
        32 + // juror_3
        2 + // vote_1 option bool
        2 + // vote_2 option bool
        2 + // vote_3 option bool
        8 + // created_at
        1 + // resolved
        1 // bump
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
pub struct JobCompletedEvent {
    pub job: Pubkey,
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
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
pub struct DisputeVoteInitiated {
    pub job_id: u64,
    pub juror_1: Pubkey,
    pub juror_2: Pubkey,
    pub juror_3: Pubkey,
}

#[event]
pub struct DisputeVoteCast {
    pub job_id: u64,
    pub juror: Pubkey,
    pub vote: bool,
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
    pub winner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ReferralSet {
    pub user: Pubkey,
    pub referrer: Pubkey,
}

#[event]
pub struct ReferralEarned {
    pub referrer: Pubkey,
    pub amount: u64,
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
    #[msg("Avatar URI is too long.")]
    AvatarUriTooLong,
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
    #[msg("Provided treasury wallet is invalid.")]
    InvalidTreasuryWallet,
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
    #[msg("Dispute vote account does not match this job.")]
    InvalidDisputeVote,
    #[msg("Only assigned jurors can cast dispute votes.")]
    UnauthorizedJuror,
    #[msg("This juror has already voted.")]
    VoteAlreadyCast,
    #[msg("Dispute is already resolved.")]
    DisputeAlreadyResolved,
    #[msg("Not enough votes to resolve dispute.")]
    InsufficientVotes,
    #[msg("At least three eligible jurors are required.")]
    NotEnoughEligibleJurors,
    #[msg("Referral can only be set once.")]
    ReferralAlreadySet,
    #[msg("Referral must be set before first completion.")]
    ReferralMustBeSetBeforeCompletion,
    #[msg("Invalid referrer profile or token account.")]
    InvalidReferrer,
    #[msg("Missing referrer profile/token accounts in remaining accounts.")]
    MissingReferralAccounts,
    #[msg("Math overflow.")]
    MathOverflow,
}
