import type { SupabaseClient } from "@supabase/supabase-js";
import type { CvDrafts } from "./cv-editor.ts";
import type { LetterDrafts } from "./letter-editor.ts";
import type { ActionResult, Profile } from "./schema.ts";

type Change =
  | { profile: Profile }
  | { drafts: CvDrafts; expectedRevision: string | null }
  | { letters: LetterDrafts; expectedRevision: string | null };

export async function writeProfileChange(
  client: SupabaseClient,
  userId: string,
  change: Change,
): Promise<ActionResult & { revision?: string }> {
  const { data: current, error: readError } = await client
    .from("profiles")
    .select("data,updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (readError)
    return { error: "Your account data could not be loaded. Please retry." };
  const isCv = "drafts" in change;
  const isLetter = "letters" in change;
  const revisionKey = isLetter ? "letterRevision" : "cvEditorRevision";
  if (
    (isCv || isLetter) &&
    (current?.data[revisionKey] ?? null) !== change.expectedRevision
  ) {
    return {
      error:
        "A newer document was saved in another tab. Export a backup of your edits, then reload before saving.",
    };
  }
  const revision = isCv || isLetter ? crypto.randomUUID() : undefined;
  const record = {
    id: userId,
    data: {
      ...current?.data,
      ...(isCv
        ? { cvEditor: change.drafts, cvEditorRevision: revision }
        : isLetter
          ? { letterDrafts: change.letters, letterRevision: revision }
          : change.profile),
    },
    updated_at: new Date(
      Math.max(Date.now(), current ? Date.parse(current.updated_at) + 1 : 0),
    ).toISOString(),
  };
  const { data: saved, error } = current
    ? await client
        .from("profiles")
        .update(record)
        .eq("id", userId)
        .eq("updated_at", current.updated_at)
        .select("id")
        .maybeSingle()
    : await client.from("profiles").insert(record).select("id").single();
  if (error || !saved)
    return {
      error:
        "Save failed. Another save may be in progress; please retry. Your edits are still in this tab.",
    };
  return isLetter
    ? { success: "Cover letters saved to your account.", revision }
    : isCv
      ? { success: "Both CV versions saved to your account.", revision }
      : {
          success: "Profile saved. Your next check will use these preferences.",
        };
}
