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
import type { ApplicationRecord } from "./automation";
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
    const profile = profileSchema.parse({
      ...data?.data,
      ...preferences,
      fields: data?.data.fields,
    });
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
          listSize: preferences.listSize,
          resultsPerRequest: preferences.resultsPerRequest,
          country: preferences.country,
        }),
      )
      .digest("hex")
      .slice(0, 24);
    const result = await runCheck(
      client,
      user.id,
      profile,
      `search:${Math.floor(Date.now() / 900000)}:${fingerprint}`,
      undefined,
      {
        listSize: preferences.listSize,
        resultsPerRequest: preferences.resultsPerRequest,
        country: preferences.country,
      },
    );
    revalidatePath("/workspace");
    return {
      success: result.skipped
        ? "Showing results for these selections. This search already ran in the last 15 minutes."
        : `Search complete. ${result.message}`,
    };
  } catch (error) {
    revalidatePath("/workspace");
    return failure(error);
  }
}
async function matchApplication(id: string) {
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
    const { data: application, error } = await client
      .from("applications")
      .select("id,job,status,saved,notes,letter,follow_up,interview_date,interview_round,interview_notes,interview_completed,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("source_id", match.source_id)
      .maybeSingle();
    if (error) return { error: "Could not load this application." };
    return { client, user, match, application: application as ApplicationRecord | null };
  } catch (error) {
    return { ...failure(error), application: null };
  }
}
export async function toggleMatchSaved(id: string) {
  const result = await matchApplication(id);
  if (result.error || !result.client || !result.user || !result.match)
    return { error: result.error ?? "Could not load this match." };
  if (result.application) {
    const saved = result.application.saved !== false;
    if (saved && result.application.status === "saved") {
      const { error } = await result.client
        .from("applications")
        .delete()
        .eq("id", result.application.id)
        .eq("user_id", result.user.id);
      if (error) return { error: "Could not unsave this job." };
      revalidatePath("/workspace");
      return { success: "", application: null };
    }
    const { data, error } = await result.client
      .from("applications")
      .update({ saved: !saved, updated_at: new Date().toISOString() })
      .eq("id", result.application.id)
      .eq("user_id", result.user.id)
      .select("id,job,status,saved,notes,letter,follow_up,interview_date,interview_round,interview_notes,interview_completed,created_at,updated_at")
      .single();
    if (error || !data) return { error: "Could not update the saved job." };
    revalidatePath("/workspace");
    return { success: !saved ? "Job saved." : "Job unsaved.", application: data as ApplicationRecord };
  }
  const { data, error } = await result.client
    .from("applications")
    .insert({ user_id: result.user.id, source_id: result.match.source_id, job: result.match.job, saved: true, status: "saved" })
    .select("id,job,status,saved,notes,letter,follow_up,created_at,updated_at")
    .single();
  if (error || !data) return { error: "Could not save this job." };
  revalidatePath("/workspace");
  return { success: "Job saved.", application: data as ApplicationRecord };
}
export async function toggleMatchLog(id: string) {
  const result = await matchApplication(id);
  if (result.error || !result.client || !result.user || !result.match)
    return { error: result.error ?? "Could not load this match." };
  if (result.application?.status === "applied") {
    if (result.application.saved !== false) {
      const { data, error } = await result.client
        .from("applications")
        .update({ status: "saved", updated_at: new Date().toISOString() })
        .eq("id", result.application.id)
        .eq("user_id", result.user.id)
        .select("id,job,status,saved,notes,letter,follow_up,created_at,updated_at")
        .single();
      if (error || !data) return { error: "Could not undo the application log." };
      revalidatePath("/workspace");
      return { success: "Application log undone.", application: data as ApplicationRecord };
    }
    const { error } = await result.client
      .from("applications")
      .delete()
      .eq("id", result.application.id)
      .eq("user_id", result.user.id);
    if (error) return { error: "Could not undo the application log." };
    revalidatePath("/workspace");
    return { success: "Application log undone.", application: null };
  }
  const response = result.application
    ? await result.client
        .from("applications")
        .update({ status: "applied" })
        .eq("id", result.application.id)
        .eq("user_id", result.user.id)
        .select("id,job,status,saved,notes,letter,follow_up,created_at,updated_at")
        .single()
    : await result.client
        .from("applications")
        .insert({
          user_id: result.user.id,
          source_id: result.match.source_id,
          job: result.match.job,
          saved: false,
          status: "applied",
        })
        .select("id,job,status,saved,notes,letter,follow_up,created_at,updated_at")
        .single();
  const { data, error } = response;
  if (error || !data) return { error: "Could not log this application." };
  revalidatePath("/workspace");
  return { success: "Application logged.", application: data as ApplicationRecord };
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
export async function dismissMatchesForDay(day: string): Promise<ActionResult> {
  try {
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(day);
    const { client, user } = await requireUser();
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const { error } = await client
      .from("matches")
      .update({ dismissed: true })
      .eq("user_id", user.id)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (error) return { error: "Could not dismiss these matches." };
    revalidatePath("/workspace");
    return { success: "All matches for this day were dismissed." };
  } catch (error) {
    return failure(error);
  }
}
export async function dismissAllMatches(): Promise<ActionResult> {
  try {
    const { client, user } = await requireUser();
    const { error } = await client
      .from("matches")
      .update({ dismissed: true })
      .eq("user_id", user.id)
      .eq("dismissed", false);
    if (error) return { error: "Could not dismiss all matches." };
    revalidatePath("/workspace");
    return { success: "All matches were dismissed." };
  } catch (error) {
    return failure(error);
  }
}
export async function updateApplication(input: unknown): Promise<ActionResult> {
  try {
    const legacyInput =
      input && typeof input === "object" ? input as Record<string, unknown> : {};
    const values = applicationSchema.parse({
      ...legacyInput,
      notes: legacyInput.notes ?? "",
      letter: legacyInput.letter ?? "",
      followUp: legacyInput.followUp ?? "",
      interviewDate: legacyInput.interviewDate ?? "",
      interviewRound: legacyInput.interviewRound ?? "",
      interviewNotes: legacyInput.interviewNotes ?? "",
      interviewHistory: legacyInput.interviewHistory ?? [],
      jobTitle: legacyInput.jobTitle || "Untitled application",
      jobCompany: legacyInput.jobCompany || "Company not recorded",
      jobLocation: legacyInput.jobLocation ?? "",
      jobUrl: legacyInput.jobUrl ?? "",
      jobDescription: legacyInput.jobDescription ?? "",
    });
    const { client, user } = await requireUser();
    const current = await client
      .from("applications")
      .select("job")
      .eq("id", values.id)
      .eq("user_id", user.id)
      .single();
    if (current.error || !current.data)
      return { error: "Application could not be loaded." };
    const job = {
      ...(current.data.job as Job),
      title: values.jobTitle,
      company: values.jobCompany,
      location: values.jobLocation,
      url: values.jobUrl,
      description: values.jobDescription,
    };
    const baseUpdate = {
      status: values.status,
      notes: values.notes,
      letter: values.letter,
      follow_up: values.followUp || null,
      job,
      updated_at: new Date().toISOString(),
    };
    let response = await client
      .from("applications")
      .update({
        ...baseUpdate,
        interview_date: values.interviewDate || null,
        interview_round: values.interviewRound,
        interview_notes: values.interviewNotes,
        interview_completed: values.interviewCompleted,
        interview_history: values.interviewHistory,
      })
      .eq("id", values.id)
      .eq("user_id", user.id)
      .select("id")
      .single();
    const missingInterviewColumns =
      response.error?.code === "42703" ||
      response.error?.code === "PGRST204" ||
      /interview_(date|round|notes|completed|history).*column|column .*interview_/i.test(
        response.error?.message ?? "",
      );
    if (missingInterviewColumns) {
      response = await client
        .from("applications")
        .update(baseUpdate)
        .eq("id", values.id)
        .eq("user_id", user.id)
        .select("id")
        .single();
    }
    const { error, data } = response;
    if (error || !data) {
      if (error?.code === "PGRST116")
        return { error: "This application no longer exists." };
      return {
        error:
          error?.code === "42501"
            ? "You do not have permission to update this application."
            : "Application could not be updated. Please apply the latest Supabase migrations.",
      };
    }
    revalidatePath("/workspace");
    return { success: "Application updated." };
  } catch (error) {
    return failure(error);
  }
}
export async function deleteApplication(id: string): Promise<ActionResult> {
  try {
    const { client, user } = await requireUser();
    const { error } = await client
      .from("applications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: "Application could not be deleted." };
    revalidatePath("/workspace");
    return { success: "Application deleted." };
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
