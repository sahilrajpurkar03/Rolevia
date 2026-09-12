"use server";
import { revalidatePath } from "next/cache";
import { cvDraftsSchema } from "./cv-editor";
import { requireUser } from "./supabase/server";
import { writeProfileChange } from "./profile-storage";
import type { ActionResult } from "./schema";

export async function saveCvDrafts(
  input: unknown,
  expectedRevision: string | null,
): Promise<ActionResult & { revision?: string }> {
  try {
    const { client, user } = await requireUser();
    const parsed = cvDraftsSchema.safeParse(input);
    if (!parsed.success)
      return { error: "Check CV field lengths and photo size before saving." };
    const result = await writeProfileChange(client, user.id, {
      drafts: parsed.data,
      expectedRevision,
    });
    if (!result.error) revalidatePath("/workspace");
    return result;
  } catch {
    return {
      error:
        "Your CV could not be saved. Check your connection and sign-in, then retry.",
    };
  }
}
