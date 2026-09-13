import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { profileSchema, searchPreferencesSchema } from "@/lib/schema";
import { runCheck } from "@/lib/automation";
import { writeProfileChange } from "@/lib/profile-storage";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  let auth;
  try {
    auth = await requireUser();
  } catch {
    return Response.json({ error: "Sign in to search jobs." }, { status: 401 });
  }
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json({ error: "Choose search settings." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 10000) {
      await reader.cancel();
      return Response.json(
        { error: "Search settings are too large." },
        { status: 413 },
      );
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  let preferences;
  try {
    preferences = searchPreferencesSchema.parse(JSON.parse(raw));
  } catch {
    return Response.json(
      { error: "Check your country, employment type and search limits." },
      { status: 400 },
    );
  }
  const { client, user } = auth;
  const stored = await client
    .from("profiles")
    .select("data")
    .eq("id", user.id)
    .single();
  if (stored.error)
    return Response.json(
      { error: "Could not load your profile." },
      { status: 400 },
    );
  const parsed = profileSchema.safeParse({
    ...stored.data.data,
    ...preferences,
    fields: stored.data.data.fields,
  });
  if (!parsed.success)
    return Response.json(
      { error: "Complete your profile and role keywords before searching." },
      { status: 400 },
    );
  const profile = parsed.data;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ ...preferences, fields: profile.fields }))
    .digest("hex")
    .slice(0, 24);
  const encoder = new TextEncoder();
  let connected = true;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        if (connected)
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const saved = await writeProfileChange(client, user.id, { profile });
        if (saved.error) throw new Error(saved.error);
        const result = await runCheck(
          client,
          user.id,
          profile,
          `query:${Math.floor(Date.now() / 60000)}:${fingerprint}`,
          undefined,
          {
            listSize: preferences.listSize,
            country: preferences.country,
            resultsPerRequest: preferences.resultsPerRequest,
            progress: (event) => send({ type: "progress", ...event }),
          },
        );
        revalidatePath("/workspace");
        send(
          result.skipped
            ? {
                type: "error",
                error:
                  "This search was already started within the last minute. Wait for it to finish, then retry; existing results are unchanged.",
              }
            : {
                type: "result",
                matches: result.matches,
                message: result.message,
              },
        );
      } catch (error) {
        send({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Search failed. Please retry.",
        });
      } finally {
        if (connected) controller.close();
      }
    },
    cancel() {
      connected = false;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
