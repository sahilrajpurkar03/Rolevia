"use server";
import { revalidatePath } from "next/cache";
import { letterDraftsSchema } from "./letter-editor";
import { requireUser } from "./supabase/server";
import { writeProfileChange } from "./profile-storage";
import type { ActionResult } from "./schema";

export async function saveLetterDrafts(
  input: unknown,
  expectedRevision: string | null,
): Promise<ActionResult & { revision?: string }> {
  try {
    const { client, user } = await requireUser();
    const parsed = letterDraftsSchema.safeParse(input);
    if (!parsed.success)
      return {
        error: "Check letter lengths and the 20-letter limit before saving.",
      };
    const result = await writeProfileChange(client, user.id, {
      letters: parsed.data,
      expectedRevision,
    });
    if (!result.error) revalidatePath("/workspace");
    return result;
  } catch {
    return {
      error:
        "Your letters could not be saved. Check your connection and sign-in, then retry.",
    };
  }
}
