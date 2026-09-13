"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "./supabase/server";
import {
  applicationSchema,
  manualJobSchema,
  profileSchema,
  searchPreferencesSchema,
  type ActionResult,
} from "./schema";
import { draftLetter, type Job } from "./matching";
import { runCheck } from "./automation";
import { writeProfileChange } from "./profile-storage";

function failure(error: unknown): ActionResult {
  return {
    error:
      error instanceof z.ZodError
        ? error.issues[0].message
        : error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
  };
}
export async function saveProfile(input: unknown): Promise<ActionResult> {
  try {
    const profile = profileSchema.parse(input);
    const { client, user } = await requireUser();
    const result = await writeProfileChange(client, user.id, { profile });
    if (!result.error) revalidatePath("/workspace");
    return result;
  } catch (error) {
    return failure(error);
  }
}
export async function checkNow(): Promise<ActionResult> {
  try {
    const { client, user } = await requireUser();
    const { data } = await client
      .from("profiles")
      .select("data")
      .eq("id", user.id)
      .single();
    const profile = profileSchema.parse(data?.data);
    const result = await runCheck(
      client,
      user.id,
      profile,
      `manual:${Math.floor(Date.now() / 900000)}`,
    );
    revalidatePath("/workspace");
    return {
      success: result.skipped
        ? "A check has already run in this 15-minute window."
        : `${result.count} new matches. ${result.message}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function searchJobs(input: unknown): Promise<ActionResult> {
  try {
    const preferences = searchPreferencesSchema.parse(input);
    const { client, user } = await requireUser();
    const { data, error } = await client
      .from("profiles")
      .select("data")
      .eq("id", user.id)
      .single();
    if (error) return { error: "Could not load your profile. Please retry." };
    const profile = profileSchema.parse({ ...data?.data, ...preferences });
    const saved = await writeProfileChange(client, user.id, { profile });
    if (saved.error) return saved;
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          fields: preferences.fields.map((value) => value.toLowerCase()).sort(),
          regions: preferences.regions
            .map((value) => value.toLowerCase())
            .sort(),
          jobTypes: [...preferences.jobTypes].sort(),
          remote: preferences.remote,
        }),
      )
      .digest("hex")
      .slice(0, 24);
    const result = await runCheck(
      client,
      user.id,
      profile,
      `search:${Math.floor(Date.now() / 900000)}:${fingerprint}`,
    );
    revalidatePath("/workspace");
    return {
      success: result.skipped
        ? "Showing results for these selections. This search already ran in the last 15 minutes."
        : `Search complete. ${result.count} new matches added. ${result.message}`,
    };
  } catch (error) {
    revalidatePath("/workspace");
    return failure(error);
  }
}
export async function saveMatch(id: string): Promise<ActionResult> {
  try {
    z.uuid().parse(id);
    const { client, user } = await requireUser();
    const { data: match } = await client
      .from("matches")
      .select("job,source_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!match) return { error: "This match is no longer available." };
    const { error } = await client
      .from("applications")
      .upsert(
        { user_id: user.id, source_id: match.source_id, job: match.job },
        { onConflict: "user_id,source_id", ignoreDuplicates: true },
      );
    if (error) return { error: "Could not save this job." };
    revalidatePath("/workspace");
    return { success: "Saved to your applications." };
  } catch (error) {
    return failure(error);
  }
}
export async function dismissMatch(id: string): Promise<ActionResult> {
  try {
    z.uuid().parse(id);
    const { client, user } = await requireUser();
    const { error } = await client
      .from("matches")
      .update({ dismissed: true })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: "Could not dismiss this match." };
    revalidatePath("/workspace");
    return { success: "Match dismissed." };
  } catch (error) {
    return failure(error);
  }
}
export async function updateApplication(input: unknown): Promise<ActionResult> {
  try {
    const values = applicationSchema.parse(input);
    const { client, user } = await requireUser();
    const { error, data } = await client
      .from("applications")
      .update({
        status: values.status,
        notes: values.notes,
        letter: values.letter,
        follow_up: values.followUp || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", values.id)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error || !data) return { error: "Application could not be updated." };
    revalidatePath("/workspace");
    return { success: "Application updated." };
  } catch (error) {
    return failure(error);
  }
}
export async function addApplication(input: unknown): Promise<ActionResult> {
  try {
    const values = manualJobSchema.parse(input);
    const { client, user } = await requireUser();
    const job: Job = {
      ...values,
      sourceId: `manual:${values.url}`,
      source: "Added by you",
      type: "unknown",
      remote: false,
      publishedAt: null,
    };
    const { error } = await client
      .from("applications")
      .upsert(
        { user_id: user.id, source_id: job.sourceId, job },
        { onConflict: "user_id,source_id", ignoreDuplicates: true },
      );
    if (error) return { error: "Could not add this application." };
    revalidatePath("/workspace");
    return { success: "Application added." };
  } catch (error) {
    return failure(error);
  }
}
export async function generateLetter(
  id: string,
): Promise<ActionResult & { letter?: string }> {
  try {
    z.uuid().parse(id);
    const { client, user } = await requireUser();
    const [{ data: profile }, { data: application }] = await Promise.all([
      client.from("profiles").select("data").eq("id", user.id).single(),
      client
        .from("applications")
        .select("job")
        .eq("id", id)
        .eq("user_id", user.id)
        .single(),
    ]);
    if (!application) return { error: "Application not found." };
    return {
      letter: draftLetter(profileSchema.parse(profile?.data), application.job),
      success: "Draft ready for your review. Save it when finished.",
    };
  } catch (error) {
    return failure(error);
  }
}
