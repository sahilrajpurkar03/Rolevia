import nodemailer from "nodemailer";

type EmailEnvironment = Record<string, string | undefined>;

function emailProvider(env: EmailEnvironment) {
  if (!env.NEXT_PUBLIC_SITE_URL) return null;
  if (env.SMTP_USER || env.SMTP_PASSWORD)
    return env.SMTP_USER && env.SMTP_PASSWORD ? "gmail" : null;
  return env.RESEND_API_KEY && env.DIGEST_FROM ? "resend" : null;
}

export function digestEmailReady(env: EmailEnvironment = process.env) {
  return emailProvider(env) !== null;
}

export async function sendDigest(
  email: string,
  count: number,
  userId: string,
  date: string,
  env: EmailEnvironment = process.env,
) {
  const provider = emailProvider(env);
  if (!provider) return "Email delivery is not configured.";
  const failure = "Email delivery failed; matches remain available in your inbox.";
  const subject = `${count} new matches on Rolevia`;
  const text = `${count} new jobs match your preferences.\n\nReview: ${env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, "")}/workspace\n\nTurn off daily emails in your Rolevia profile at any time.`;
  try {
    if (provider === "gmail") {
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      try {
        const result = await transport.sendMail({
          from: { name: "Rolevia", address: env.SMTP_USER! },
          to: [{ address: email, name: "" }],
          subject,
          text,
        });
        return result.accepted.length === 1 && result.rejected.length === 0
          ? null
          : failure;
      } finally {
        transport.close();
      }
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `digest-${userId}-${date}`,
      },
      body: JSON.stringify({ from: env.DIGEST_FROM, to: [email], subject, text }),
    });
    return response.ok ? null : failure;
  } catch {
    return failure;
  }
}