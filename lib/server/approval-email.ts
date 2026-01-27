/**
 * Approval Email Template
 *
 * Sends beta access approval notification emails via Resend
 */

import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

interface SendApprovalEmailParams {
  email: string;
  name?: string | null;
  signupUrl: string;
}

/**
 * Sends a beta access approval notification email
 *
 * Requires EMAIL_FROM env var to be set to a verified domain email
 * (e.g., "Dyno Apps <hello@yourdomain.com>")
 *
 * The testing domain (onboarding@resend.dev) only allows sending to your own email.
 * To send to other recipients, verify a domain at https://resend.com/domains
 */
export async function sendApprovalEmail({
  email,
  name,
  signupUrl,
}: SendApprovalEmailParams): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.EMAIL_FROM;

  if (!fromEmail) {
    console.error("[approval-email] EMAIL_FROM environment variable not set");
    return {
      success: false,
      error:
        "Email sender not configured. Set EMAIL_FROM to a verified domain email.",
    };
  }

  const displayName = name || "there";

  try {
    const { error } = await getResendClient().emails.send({
      from: fromEmail,
      to: email,
      subject: "You've been approved for Dyno Apps Beta!",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
                Welcome to Dyno Apps!
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
                Your beta access has been approved
              </p>
            </div>

            <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
              <p style="margin: 0 0 16px 0; font-size: 16px;">
                Hey ${displayName},
              </p>

              <p style="margin: 0 0 24px 0; font-size: 16px; color: #4b5563;">
                Great news! You've been approved for beta access to Dyno Apps.
                Click the button below to create your account and start building.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${signupUrl}"
                   style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Create Your Account
                </a>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af; word-break: break-all;">
                ${signupUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                <strong>What you can do with Dyno Apps:</strong>
              </p>
              <ul style="margin: 12px 0 0 0; padding-left: 20px; font-size: 14px; color: #6b7280;">
                <li style="margin-bottom: 8px;">Build mobile apps using natural language</li>
                <li style="margin-bottom: 8px;">Preview instantly on your phone</li>
                <li style="margin-bottom: 8px;">Export full source code</li>
              </ul>
            </div>

            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">
              You received this email because you requested beta access to Dyno Apps.
              <br>
              &copy; ${new Date().getFullYear()} Dyno Apps. All rights reserved.
            </p>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("[approval-email] Failed to send approval email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("[approval-email] Exception sending approval email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
