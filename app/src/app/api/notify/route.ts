import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Email notifications not configured (RESEND_API_KEY missing)" },
      { status: 501 }
    );
  }

  try {
    const { to, subject, body, actionUrl, actionLabel } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, body" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const fullActionUrl = actionUrl ? `${appUrl}${actionUrl}` : appUrl;

    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: "Accord <notifications@accord.work>",
      to: [to],
      subject,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background: #080B14; color: #F1F5F9; padding: 32px; border-radius: 12px;">
          <h2 style="color: #7C3AED; margin: 0 0 8px;">Accord</h2>
          <hr style="border: 1px solid #1E2736; margin: 16px 0;" />
          <h3 style="margin: 0 0 12px;">${subject}</h3>
          <p style="color: #94A3B8; line-height: 1.6; margin: 0 0 24px;">${body}</p>
          ${
            actionUrl
              ? `<a href="${fullActionUrl}" style="display: inline-block; background: #7C3AED; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">${actionLabel || "View"}</a>`
              : ""
          }
          <hr style="border: 1px solid #1E2736; margin: 24px 0 16px;" />
          <p style="color: #6B7280; font-size: 12px; margin: 0;">Powered by Accord &mdash; Trustless Freelance on Solana</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to send email:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
