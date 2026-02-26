import logger from "../utils/logger";

// Brevo (Sendinblue) mailer service.
// - dynamically imports `sib-api-v3-sdk` inside the send function
// - parses `BREVO_FROM` or `BREVO_FROM_EMAIL`/`BREVO_FROM_NAME`
// - exposes `sendMail` and `sendPasswordReset`

function parseSender(): { email: string; name?: string } {
  const emailEnv = process.env.BREVO_FROM_EMAIL;
  const nameEnv = process.env.BREVO_FROM_NAME;
  if (emailEnv) return { email: emailEnv.trim(), name: (nameEnv || "").trim() };
  const raw = process.env.BREVO_FROM || "";
  const lt = raw.indexOf("<");
  const gt = raw.indexOf(">", lt + 1);
  if (lt !== -1 && gt !== -1) {
    const name = raw.substring(0, lt).trim();
    const email = raw.substring(lt + 1, gt).trim();
    return { email, name };
  }
  return { email: raw.trim() };
}

async function sendViaBrevo(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("Brevo not configured: set BREVO_API_KEY");
  }

  const sender = parseSender();
  if (!sender.email)
    throw new Error(
      "Brevo sender not configured: set BREVO_FROM or BREVO_FROM_EMAIL"
    );

  const sibModule = await import("sib-api-v3-sdk").catch((err) => {
    logger.error("Failed to import sib-api-v3-sdk", err);
    return null;
  });
  if (!sibModule)
    throw new Error("Brevo SDK not available; install sib-api-v3-sdk");
  type SibApiClient = {
    authentications: Record<string, { apiKey?: string }>;
  };
  type SibModuleShape = {
    ApiClient: { instance: SibApiClient };
    TransactionalEmailsApi: new () => {
      sendTransacEmail: (payload: unknown) => Promise<unknown>;
    };
    SendSmtpEmail: new (opts: unknown) => unknown;
  };

  const SibApiV3Sdk = sibModule as SibModuleShape;
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
    sender: { email: sender.email, name: sender.name || undefined },
    to: [{ email: to }],
    subject,
    htmlContent: html || undefined,
    textContent: text,
  });

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    logger.info({ to, subject }, "Email sent via Brevo");
    return true;
  } catch (err) {
    logger.error("Brevo send failed", err);
    throw err;
  }
}

export async function sendPasswordReset(email: string, resetLink: string) {
  const subject = "Password reset request";
  const text = `Reset your password using this link: ${resetLink}`;
  return sendViaBrevo(email, subject, text);
}

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> {
  return sendViaBrevo(to, subject, text, html);
}

export default { sendPasswordReset, sendMail };
