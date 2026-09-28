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

async function deliver(
  env: EmailEnvironment,
  options: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
    failureMessage: string;
  },
): Promise<string | null> {
  const provider = emailProvider(env);
  if (!provider) return "Email delivery is not configured.";
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
          to: [{ address: options.to, name: "" }],
          subject: options.subject,
          text: options.text,
        });
        return result.accepted.length === 1 && result.rejected.length === 0
          ? null
          : options.failureMessage;
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
        "Idempotency-Key": options.idempotencyKey,
      },
      body: JSON.stringify({
        from: env.DIGEST_FROM,
        to: [options.to],
        subject: options.subject,
        text: options.text,
      }),
    });
    return response.ok ? null : options.failureMessage;
  } catch {
    return options.failureMessage;
  }
}

export async function sendDigest(
  email: string,
  count: number,
  userId: string,
  date: string,
  env: EmailEnvironment = process.env,
  testEmail = false,
) {
  const subject = testEmail ? "Rolevia email delivery test" : `${count} new matches on Rolevia`;
  const text = `${testEmail ? "This is the email delivery test you requested. No new job matches are implied." : `${count} new jobs match your preferences.`}\n\nReview: ${env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")}/workspace\n\nTurn off daily emails in your Rolevia profile at any time.`;
  return deliver(env, {
    to: email,
    subject,
    text,
    idempotencyKey: `digest-${userId}-${date}`,
    failureMessage: "Email delivery failed; matches remain available in your inbox.",
  });
}

export async function sendInterviewReminder(
  email: string,
  job: { title: string; company: string },
  round: string,
  date: string,
  userId: string,
  entryId: string,
  env: EmailEnvironment = process.env,
) {
  const subject = `Interview today: ${job.title} / ${job.company}${round ? ` (${round})` : ""}`;
  const text = `You have an interview today (${date})${round ? ` (${round})` : ""} for ${job.title} at ${job.company}.\n\nReview: ${env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")}/workspace\n\nThis reminder is sent regardless of your daily search and email digest settings.`;
  return deliver(env, {
    to: email,
    subject,
    text,
    idempotencyKey: `interview-${userId}-${date}-${entryId}`,
    failureMessage: "Email delivery failed; check your workspace for interview details.",
  });
}