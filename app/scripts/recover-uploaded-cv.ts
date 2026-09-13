import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { isAbsolute, resolve, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createImportedCvDrafts, cvPlainText } from "../src/lib/cv-editor.ts";
import { cleanCvText } from "../src/lib/cv-text.ts";

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : "";
  const email = z.email().parse(option("--email")).toLowerCase();
  const backupDirectory = option("--backup-directory");
  if (
    !isAbsolute(backupDirectory) ||
    resolve(backupDirectory)
      .toLowerCase()
      .startsWith(resolve(process.cwd()).toLowerCase())
  )
    throw new Error("Use an absolute backup directory outside the repository.");
  const project = "qnuytqvbtcaeibcxyloq";
  const result = spawnSync(
    "npx",
    [
      "supabase",
      "projects",
      "api-keys",
      "--project-ref",
      project,
      "--output",
      "json",
    ],
    { encoding: "utf8", shell: true },
  );
  if (result.status !== 0)
    throw new Error("Authenticated Supabase CLI access is required.");
  const keys = z
    .array(z.object({ name: z.string(), api_key: z.string() }))
    .parse(JSON.parse(result.stdout));
  const key = keys.find((item) => item.name === "service_role")?.api_key;
  if (!key) throw new Error("Service credential unavailable.");
  const client = createClient(`https://${project}.supabase.co`, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId = "";
  for (let page = 1; page <= 100; page++) {
    const users = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (users.error) throw new Error("Could not find the requested account.");
    const user = users.data.users.find(
      (item) => item.email?.toLowerCase() === email,
    );
    if (user) {
      userId = user.id;
      break;
    }
    if (users.data.users.length < 1000) break;
  }
  if (!userId) throw new Error("Exact target account not found.");
  const current = await client
    .from("profiles")
    .select("data,updated_at")
    .eq("id", userId)
    .single();
  if (current.error) throw new Error("Could not read the uploaded CV.");
  const text = z.string().min(40).max(60000).parse(current.data.data.cvText);
  const old = current.data.data.cvEditor;
  const drafts = createImportedCvDrafts(text, email);
  for (const version of ["one", "two"] as const) {
    drafts[version].photo = old?.[version]?.photo ?? "";
    const normalize = (value: string) =>
      value.replace(/:\s*/g, " ").replace(/\s+/g, " ").trim();
    const content = normalize(cvPlainText(drafts[version], version));
    const missing = cleanCvText(text)
      .split(/\r?\n/)
      .map(normalize)
      .filter((line) => line && !content.includes(line));
    if (missing.length)
      throw new Error(
        `Recovery would omit ${missing.length} extracted lines; manual review required.`,
      );
  }
  const summary = {
    uploadedTextCharacters: text.length,
    sections: drafts.one.sections.map((section) => section.title),
    allExtractedLinesRetained: true,
    profileAndLettersPreserved: true,
    mode: args.includes("--apply") ? "apply" : "preview",
  };
  console.log(JSON.stringify(summary));
  if (!args.includes("--apply")) return;
  if (
    !old?.one?.sections?.some((section: { id: string }) =>
      section.id.startsWith("legacy-"),
    )
  )
    throw new Error(
      "CV drafts are not the archive-restored versions; use the editor's explicit recovery control instead.",
    );
  await writeFile(
    join(backupDirectory, `rolevia-before-upload-recovery-${Date.now()}.json`),
    JSON.stringify(current.data, null, 2),
    { flag: "wx", mode: 0o600 },
  );
  const data = {
    ...current.data.data,
    cvEditor: drafts,
    cvEditorRevision: crypto.randomUUID(),
  };
  const update = await client
    .from("profiles")
    .update({
      data,
      updated_at: new Date(
        Math.max(Date.now(), Date.parse(current.data.updated_at) + 1),
      ).toISOString(),
    })
    .eq("id", userId)
    .eq("updated_at", current.data.updated_at)
    .select("id")
    .maybeSingle();
  if (update.error || !update.data)
    throw new Error(
      "Account changed during recovery; no replacement was applied.",
    );
  const verified = await client
    .from("profiles")
    .select("data")
    .eq("id", userId)
    .single();
  if (verified.error || !isDeepStrictEqual(verified.data.data, data))
    throw new Error("Recovery write completed but verification did not match.");
  console.log(
    "Verified: both editor drafts now use the uploaded text; old drafts backed up privately.",
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof z.ZodError
      ? "Recovery input validation failed."
      : error instanceof Error
        ? error.message
        : "Recovery failed.",
  );
  process.exitCode = 1;
});
