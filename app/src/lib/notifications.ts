/**
 * Email notification helpers for Accord.
 * Sends notifications via the /api/notify endpoint.
 */

interface NotifyPayload {
  to: string;
  subject: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}

async function sendNotification(payload: NotifyPayload) {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("Failed to send notification:", err);
  }
}

export function notifyJobAccepted(
  clientEmail: string,
  jobTitle: string,
  freelancerAddress: string
) {
  sendNotification({
    to: clientEmail,
    subject: `Job Accepted: ${jobTitle}`,
    body: `A freelancer (${freelancerAddress.slice(0, 8)}...) has accepted your job "${jobTitle}". They will begin working on your deliverables.`,
    actionUrl: `/jobs`,
    actionLabel: "View Job",
  });
}

export function notifyWorkSubmitted(clientEmail: string, jobTitle: string) {
  sendNotification({
    to: clientEmail,
    subject: `Work Submitted: ${jobTitle}`,
    body: `The freelancer has submitted their work for "${jobTitle}". Please review and approve to release the payment.`,
    actionUrl: `/jobs`,
    actionLabel: "Review Work",
  });
}

export function notifyPaymentReleased(
  freelancerEmail: string,
  amount: number,
  jobTitle: string
) {
  sendNotification({
    to: freelancerEmail,
    subject: `Payment Received: ${amount} USDC`,
    body: `You have been paid ${amount} USDC for "${jobTitle}". The funds have been transferred to your wallet.`,
    actionUrl: `/profile`,
    actionLabel: "View Profile",
  });
}

export function notifyDisputeRaised(
  recipientEmail: string,
  jobTitle: string
) {
  sendNotification({
    to: recipientEmail,
    subject: `Dispute Raised: ${jobTitle}`,
    body: `A dispute has been raised on "${jobTitle}". Funds are frozen until the dispute is resolved.`,
    actionUrl: `/jobs`,
    actionLabel: "View Dispute",
  });
}
