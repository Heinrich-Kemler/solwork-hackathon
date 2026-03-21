use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("3HP12EX32vPRnocDfy1SqRpFZSJUnyWkCDPGarhn9CGj");

#[program]
pub mod solwork {
    use super::*;

    /// Client creates an escrow, locking SOL for a single-milestone job.
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        job_title: String,
        job_description: String,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(job_title.len() <= 64, EscrowError::TitleTooLong);
        require!(job_description.len() <= 256, EscrowError::DescriptionTooLong);

        // Transfer SOL from client to escrow vault (PDA)
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.client.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                },
            ),
            amount,
        )?;

        let escrow = &mut ctx.accounts.escrow;
        escrow.client = ctx.accounts.client.key();
        escrow.freelancer = Pubkey::default();
        escrow.amount = amount;
        escrow.job_title = job_title;
        escrow.job_description = job_description;
        escrow.status = EscrowStatus::Open;
        escrow.bump = ctx.bumps.escrow;
        escrow.vault_bump = ctx.bumps.escrow_vault;
        escrow.created_at = Clock::get()?.unix_timestamp;

        msg!("Escrow created: {} lamports locked", amount);
        Ok(())
    }

    /// Freelancer accepts an open job.
    pub fn accept_job(ctx: Context<AcceptJob>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.status == EscrowStatus::Open, EscrowError::NotOpen);

        escrow.freelancer = ctx.accounts.freelancer.key();
        escrow.status = EscrowStatus::InProgress;

        msg!("Job accepted by freelancer");
        Ok(())
    }

    /// Client approves the work — SOL releases to freelancer instantly.
    pub fn approve_and_release(ctx: Context<ApproveAndRelease>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(
            escrow.status == EscrowStatus::InProgress,
            EscrowError::NotInProgress
        );

        let amount = escrow.amount;
        let client_key = escrow.client;

        // Transfer SOL from vault PDA to freelancer
        let vault_seeds: &[&[u8]] = &[
            b"vault",
            client_key.as_ref(),
            escrow.job_title.as_bytes(),
            &[escrow.vault_bump],
        ];

        **ctx
            .accounts
            .escrow_vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .freelancer
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        let escrow = &mut ctx.accounts.escrow;
        escrow.status = EscrowStatus::Completed;

        msg!("Work approved! {} lamports released to freelancer", amount);
        Ok(())
    }

    /// Client raises a dispute (MVP: just flags it, no arbiter yet).
    pub fn raise_dispute(ctx: Context<RaiseDispute>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.status == EscrowStatus::InProgress,
            EscrowError::NotInProgress
        );

        escrow.status = EscrowStatus::Disputed;

        msg!("Dispute raised on escrow");
        Ok(())
    }

    /// Client cancels an open escrow (no freelancer yet) and reclaims SOL.
    pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(escrow.status == EscrowStatus::Open, EscrowError::NotOpen);

        let amount = escrow.amount;

        **ctx
            .accounts
            .escrow_vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .client
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        let escrow = &mut ctx.accounts.escrow;
        escrow.status = EscrowStatus::Cancelled;

        msg!("Escrow cancelled, {} lamports returned to client", amount);
        Ok(())
    }
}

// ── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(job_title: String, job_description: String, amount: u64)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        init,
        payer = client,
        space = Escrow::space(&job_title, &job_description),
        seeds = [b"escrow", client.key().as_ref(), job_title.as_bytes()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: PDA vault that holds the SOL
    #[account(
        mut,
        seeds = [b"vault", client.key().as_ref(), job_title.as_bytes()],
        bump,
    )]
    pub escrow_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptJob<'info> {
    #[account(mut)]
    pub freelancer: Signer<'info>,

    #[account(
        mut,
        constraint = escrow.status == EscrowStatus::Open @ EscrowError::NotOpen,
    )]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct ApproveAndRelease<'info> {
    #[account(
        mut,
        constraint = escrow.client == client.key() @ EscrowError::Unauthorized,
    )]
    pub client: Signer<'info>,

    #[account(
        mut,
        constraint = escrow.status == EscrowStatus::InProgress @ EscrowError::NotInProgress,
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: PDA vault holding the SOL
    #[account(
        mut,
        seeds = [b"vault", client.key().as_ref(), escrow.job_title.as_bytes()],
        bump = escrow.vault_bump,
    )]
    pub escrow_vault: SystemAccount<'info>,

    /// CHECK: Must match escrow.freelancer
    #[account(
        mut,
        constraint = escrow.freelancer == freelancer.key() @ EscrowError::Unauthorized,
    )]
    pub freelancer: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(
        mut,
        constraint = escrow.client == client.key() @ EscrowError::Unauthorized,
    )]
    pub client: Signer<'info>,

    #[account(
        mut,
        constraint = escrow.status == EscrowStatus::InProgress @ EscrowError::NotInProgress,
    )]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(
        mut,
        constraint = escrow.client == client.key() @ EscrowError::Unauthorized,
    )]
    pub client: Signer<'info>,

    #[account(
        mut,
        constraint = escrow.status == EscrowStatus::Open @ EscrowError::NotOpen,
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: PDA vault holding the SOL
    #[account(
        mut,
        seeds = [b"vault", client.key().as_ref(), escrow.job_title.as_bytes()],
        bump = escrow.vault_bump,
    )]
    pub escrow_vault: SystemAccount<'info>,
}

// ── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct Escrow {
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub amount: u64,
    pub job_title: String,
    pub job_description: String,
    pub status: EscrowStatus,
    pub bump: u8,
    pub vault_bump: u8,
    pub created_at: i64,
}

impl Escrow {
    pub fn space(title: &str, description: &str) -> usize {
        8 +                    // discriminator
        32 +                   // client
        32 +                   // freelancer
        8 +                    // amount
        4 + title.len() +      // job_title (string)
        4 + description.len() + // job_description (string)
        1 +                    // status (enum)
        1 +                    // bump
        1 +                    // vault_bump
        8                     // created_at
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Open,
    InProgress,
    Completed,
    Disputed,
    Cancelled,
}

// ── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Job title must be 64 characters or fewer")]
    TitleTooLong,
    #[msg("Job description must be 256 characters or fewer")]
    DescriptionTooLong,
    #[msg("Escrow is not open")]
    NotOpen,
    #[msg("Escrow is not in progress")]
    NotInProgress,
    #[msg("Unauthorized action")]
    Unauthorized,
}
