import "server-only";

import nodemailer from "nodemailer";
import { env } from "@/lib/env";

/**
 * Email service type definitions
 */
export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: string | string[] | EmailRecipient | EmailRecipient[];
  cc?: string | string[] | EmailRecipient | EmailRecipient[];
  bcc?: string | string[] | EmailRecipient | EmailRecipient[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface EmailServiceResponse {
  success: boolean;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  response?: string;
  error?: string;
}

/**
 * Nodemailer transporter singleton
 */
let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize Nodemailer transporter
 */
function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  // Gmail configuration
  if (env.EMAIL_SERVICE === "gmail") {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD, // Use Gmail App Password, not regular password
      },
    });
  }
  // Custom SMTP configuration
  else {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465, // true for 465, false for other ports
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD,
      },
    });
  }

  return transporter;
}

/**
 * Format email recipients into Nodemailer format
 */
function formatRecipients(
  recipients: string | string[] | EmailRecipient | EmailRecipient[] | undefined
): string | { name: string; address: string } | { name: string; address: string }[] | undefined {
  if (!recipients) return undefined;

  // Handle single string email
  if (typeof recipients === "string") {
    return recipients;
  }

  // Handle array of strings
  if (Array.isArray(recipients) && recipients.length > 0) {
    if (typeof recipients[0] === "string") {
      return recipients.join(",");
    }

    // Handle array of EmailRecipient objects
    return (recipients as EmailRecipient[]).map((recipient) => ({
      name: recipient.name || "",
      address: recipient.email,
    }));
  }

  // Handle single EmailRecipient object
  if (typeof recipients === "object" && "email" in recipients) {
    return {
      name: (recipients as EmailRecipient).name || "",
      address: (recipients as EmailRecipient).email,
    };
  }

  return undefined;
}

/**
 * Send email using Nodemailer
 * Reusable function that accepts single or multiple recipients
 *
 * @example
 * // Send to single recipient
 * await sendEmail({
 *   to: "user@example.com",
 *   subject: "Welcome",
 *   html: "<h1>Hello</h1>",
 * });
 *
 * @example
 * // Send to multiple recipients
 * await sendEmail({
 *   to: ["user1@example.com", "user2@example.com"],
 *   subject: "Notification",
 *   html: "<p>Important update</p>",
 * });
 *
 * @example
 * // Send with recipient names
 * await sendEmail({
 *   to: [
 *     { email: "john@example.com", name: "John Doe" },
 *     { email: "jane@example.com", name: "Jane Smith" },
 *   ],
 *   subject: "Hello",
 *   html: "<p>Message</p>",
 * });
 *
 * @example
 * // Send with CC and BCC
 * await sendEmail({
 *   to: "recipient@example.com",
 *   cc: ["cc@example.com"],
 *   bcc: ["bcc@example.com"],
 *   subject: "Update",
 *   html: "<p>Content</p>",
 * });
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<EmailServiceResponse> {
  try {
    // Validate required environment variables
    if (!env.EMAIL_USER || !env.EMAIL_PASSWORD) {
      console.error(
        "Missing EMAIL_USER or EMAIL_PASSWORD environment variables"
      );
      return {
        success: false,
        error: "Email service not configured. Missing credentials.",
      };
    }

    if (!env.EMAIL_FROM_EMAIL) {
      console.error("Missing EMAIL_FROM_EMAIL environment variable");
      return {
        success: false,
        error: "Email service not configured. Missing from address.",
      };
    }

    const transporter = getTransporter();

    const mailOptions = {
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_EMAIL}>`,
      to: formatRecipients(options.to),
      cc: formatRecipients(options.cc),
      bcc: formatRecipients(options.bcc),
      subject: options.subject,
      html: options.html || "",
      text: options.text || "",
      replyTo: options.replyTo || env.EMAIL_FROM_EMAIL,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      to: options.to,
      subject: options.subject,
    });

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted as string[],
      rejected: info.rejected as string[],
      response: info.response,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    console.error("Failed to send email:", {
      error: errorMessage,
      to: options.to,
      subject: options.subject,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send email to multiple recipients with same content
 * Useful for sending bulk emails to a list
 *
 * @example
 * await sendBulkEmail(
 *   ["user1@example.com", "user2@example.com"],
 *   "Welcome!",
 *   "<h1>Welcome to our platform</h1>"
 * );
 */
export async function sendBulkEmail(
  recipients: string[] | EmailRecipient[],
  subject: string,
  html: string,
  text?: string
): Promise<EmailServiceResponse> {
  return sendEmail({
    to: recipients,
    subject,
    html,
    text,
  });
}

/**
 * Verify email configuration by attempting to connect
 * Use this during app initialization to check email setup
 */
export async function verifyEmailConfig(): Promise<{
  isValid: boolean;
  message: string;
}> {
  try {
    const transporter = getTransporter();
    await transporter.verify();

    return {
      isValid: true,
      message: "Email configuration is valid and ready to use",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      isValid: false,
      message: `Email configuration verification failed: ${errorMessage}`,
    };
  }
}
