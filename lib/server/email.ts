/**
 * Email Service
 *
 * Handles sending emails via Resend API
 */

import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

type FeedbackType = "bug" | "feature" | "general";

interface SendFeedbackEmailParams {
  email: string;
  type: FeedbackType;
  message: string;
  userId: string;
}

const feedbackTypeLabels: Record<FeedbackType, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  general: "General Feedback",
};

/**
 * Sends a feedback email to the configured feedback email address
 *
 * Requires EMAIL_FROM env var to be set to a verified domain email
 * (e.g., "Dyno Apps <hello@yourdomain.com>")
 */
export async function sendFeedbackEmail({
  email,
  type,
  message,
  userId,
}: SendFeedbackEmailParams): Promise<{ success: boolean; error?: string }> {
  const feedbackEmail = process.env.FEEDBACK_EMAIL;
  const fromEmail = process.env.EMAIL_FROM;

  if (!feedbackEmail) {
    console.error("[email] FEEDBACK_EMAIL environment variable not set");
    return { success: false, error: "Feedback email not configured" };
  }

  if (!fromEmail) {
    console.error("[email] EMAIL_FROM environment variable not set");
    return {
      success: false,
      error:
        "Email sender not configured. Set EMAIL_FROM to a verified domain email.",
    };
  }

  const typeLabel = feedbackTypeLabels[type];

  try {
    const { error } = await getResendClient().emails.send({
      from: fromEmail,
      to: feedbackEmail,
      replyTo: email,
      subject: `[${typeLabel}] New feedback from Dyno Apps`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); padding: 20px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">New ${typeLabel}</h1>
            </div>

            <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
                <p style="margin: 0; font-size: 16px;"><a href="mailto:${email}" style="color: #7c3aed; text-decoration: none;">${email}</a></p>
              </div>

              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">User ID</p>
                <p style="margin: 0; font-size: 14px; font-family: monospace; color: #6b7280;">${userId}</p>
              </div>

              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Type</p>
                <span style="display: inline-block; padding: 4px 12px; background: ${type === "bug" ? "#fef2f2" : type === "feature" ? "#f0fdf4" : "#eff6ff"}; color: ${type === "bug" ? "#dc2626" : type === "feature" ? "#16a34a" : "#2563eb"}; border-radius: 9999px; font-size: 14px; font-weight: 500;">${typeLabel}</span>
              </div>

              <div>
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Message</p>
                <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                  <p style="margin: 0; white-space: pre-wrap;">${message}</p>
                </div>
              </div>
            </div>

            <p style="margin-top: 16px; font-size: 12px; color: #9ca3af; text-align: center;">
              Sent from Dyno Apps Feedback System
            </p>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("[email] Failed to send feedback email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("[email] Exception sending feedback email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
