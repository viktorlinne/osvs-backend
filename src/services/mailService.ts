import nodemailer, { type Transporter } from "nodemailer";
import { getBrowserOriginConfig, getMailConfig } from "../config/env";
import type { PasswordActionPurpose } from "../types";
import logger from "../utils/logger";

type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Optional Reply-To (group mailings reply to the sender, not noreply). */
  replyTo?: string;
};

type PasswordActionMailInput = {
  purpose: PasswordActionPurpose;
  toEmail: string;
  toName?: string | null;
  token: string;
  expiresAt: Date;
};

let transporterPromise: Promise<Transporter> | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = Promise.resolve().then(() => {
    const config = getMailConfig();
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user
        ? {
            user: config.user,
            pass: config.password ?? "",
          }
        : undefined,
    });
  });

  return transporterPromise;
}

function formatRecipientName(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function buildPasswordActionLink(token: string): string {
  const frontendOrigin = getBrowserOriginConfig().frontendOrigin;
  const link = new globalThis.URL("/set-password", frontendOrigin);
  link.hash = new globalThis.URLSearchParams({ token }).toString();
  return link.toString();
}

function buildEmailShell(cardHtml: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#faf8f4;font-family:Georgia,'EB Garamond',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf8f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-family:Georgia,'EB Garamond',serif;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#208f44;">Ordensamfundet VS</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e3dcd2;border-radius:8px;padding:36px 40px;">

${cardHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-family:Georgia,'EB Garamond',serif;font-size:11px;color:#5c5248;letter-spacing:0.05em;">Ordensamfundet VS &middot; grundat 1924</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmailHtml(opts: {
  greeting: string;
  body: string;
  buttonHref: string;
  buttonLabel: string;
  expiresAt: string;
  footnote: string;
}): string {
  return buildEmailShell(`              <p style="margin:0 0 20px;font-family:Georgia,'EB Garamond',serif;font-size:15px;color:#1c1610;line-height:1.65;">${opts.greeting}</p>
              <p style="margin:0 0 28px;font-family:Georgia,'EB Garamond',serif;font-size:15px;color:#1c1610;line-height:1.65;">${opts.body}</p>

              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#208f44;border-radius:6px;">
                    <a href="${opts.buttonHref}" style="display:inline-block;padding:10px 20px;font-family:Georgia,'EB Garamond',serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${opts.buttonLabel}</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-family:Georgia,'EB Garamond',serif;font-size:13px;color:#5c5248;line-height:1.65;">Länken gäller till ${opts.expiresAt}.</p>
              <p style="margin:0;font-family:Georgia,'EB Garamond',serif;font-size:13px;color:#5c5248;line-height:1.65;">${opts.footnote}</p>
`);
}

/** HTML-escapes user-provided text for use inside the mail template. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildMailingFooter(groupName: string): string {
  return `Detta utskick skickades till gruppen ${groupName} via OSVS.`;
}

/**
 * Group mailing (OSVS-24): plain-text body as written by the sender plus a
 * footer, and the branded HTML version with the body escaped and line breaks
 * preserved.
 */
export function buildGroupMailingMessage(input: {
  groupName: string;
  subject: string;
  body: string;
}): Omit<MailMessage, "to" | "replyTo"> {
  const footer = buildMailingFooter(input.groupName);
  const body = input.body.replace(/\r\n?/g, "\n");
  const bodyHtml = escapeHtml(body).replace(/\n/g, "<br>\n");
  return {
    subject: input.subject,
    text: `${body}\n\n--\n${footer}\n`,
    html: buildEmailShell(`              <p style="margin:0 0 28px;font-family:Georgia,'EB Garamond',serif;font-size:15px;color:#1c1610;line-height:1.65;">${bodyHtml}</p>
              <p style="margin:0;font-family:Georgia,'EB Garamond',serif;font-size:13px;color:#5c5248;line-height:1.65;">${escapeHtml(footer)}</p>`),
  };
}

function buildPasswordActionCopy(
  input: PasswordActionMailInput,
): Omit<MailMessage, "to"> {
  const link = buildPasswordActionLink(input.token);
  const expiresAt = input.expiresAt.toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const name = formatRecipientName(input.toName);
  const greeting = name ? `Hej ${name},` : "Hej,";
  // The name is member-editable profile data: escape it for the HTML part.
  const greetingHtml = escapeHtml(greeting);

  if (input.purpose === "SET_PASSWORD") {
    return {
      subject: "Välj ditt lösenord för OSVS",
      text: `${greeting}

Din medlemssida i OSVS är nu skapad. Välj ditt lösenord här:
${link}

Länken gäller till ${expiresAt}.

Om du inte väntade dig det här mejlet kan du ignorera det.
`,
      html: buildEmailHtml({
        greeting: greetingHtml,
        body: "Din medlemssida i OSVS är nu skapad. Välj ditt lösenord nedan för att aktivera ditt konto.",
        buttonHref: link,
        buttonLabel: "Välj lösenord",
        expiresAt,
        footnote: "Om du inte väntade dig det här mejlet kan du ignorera det.",
      }),
    };
  }

  return {
    subject: "Återställ ditt lösenord för OSVS",
    text: `${greeting}

Vi har fått en begäran om att återställa ditt lösenord till OSVS. Fortsätt här:
${link}

Länken gäller till ${expiresAt}.

Om du inte begärde detta kan du ignorera mejlet.
`,
    html: buildEmailHtml({
      greeting: greetingHtml,
      body: "Vi har fått en begäran om att återställa ditt lösenord till OSVS. Klicka nedan för att fortsätta.",
      buttonHref: link,
      buttonLabel: "Återställ lösenord",
      expiresAt,
      footnote: "Om du inte begärde detta kan du ignorera mejlet.",
    }),
  };
}

export async function sendMail(message: MailMessage): Promise<void> {
  const transporter = await getTransporter();
  const config = getMailConfig();

  await transporter.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  });
}

export async function sendPasswordActionMail(
  input: PasswordActionMailInput,
): Promise<void> {
  const message = buildPasswordActionCopy(input);
  await sendMail({
    to: input.toEmail,
    ...message,
  });

  logger.info(
    {
      purpose: input.purpose,
      toEmail: input.toEmail,
      expiresAt: input.expiresAt.toISOString(),
    },
    "Password action email sent",
  );
}

export default {
  sendMail,
  sendPasswordActionMail,
};
