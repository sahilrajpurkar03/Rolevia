import { readFile, writeFile } from "node:fs/promises";
import { resolve, join, isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { z } from "zod";
import {
  legacyApplications,
  prepareLegacyProfile,
} from "../src/lib/legacy-import.ts";

const project = "qnuytqvbtcaeibcxyloq";
const args = process.argv.slice(2);
const option = (name: string) => args[args.indexOf(name) + 1];

async function main() {
  if (!args.includes("--archive") || !args.includes("--email"))
    throw new Error(
      "Use --archive ABSOLUTE_PATH --email ACCOUNT_EMAIL, optionally --apply",
    );
  const archive = option("--archive");
  if (!isAbsolute(archive))
    throw new Error("Archive path must be absolute and outside the repository");
  if (
    resolve(archive)
      .toLowerCase()
      .startsWith(resolve(process.cwd()).toLowerCase())
  )
    throw new Error(
      "Keep personal migration files outside the working directory",
    );
  const email = z.email().parse(option("--email")).toLowerCase();
  const parser = spawnSync(
    process.env.PYTHON ?? "python",
    [
      "-c",
      "import ast,json,pathlib,sys; tree=ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig')); names={'PERSONAL','EXPERIENCES','PROJECTS','SKILL_PHRASES'}; data={node.targets[0].id:ast.literal_eval(node.value) for node in tree.body if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in names}; print(json.dumps(data))",
      join(archive, "cover_letter", "cv_data.py"),
    ],
    {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    },
  );
  if (parser.status !== 0)
    throw new Error(
      "Could not parse literal CV data with Python's standard-library AST parser",
    );
  const legacy: unknown = JSON.parse(parser.stdout);
  const tracker: unknown = JSON.parse(
    await readFile(join(archive, "log", "applications.json"), "utf8"),
  );
  const letter = await readFile(join(archive, "cl_sahil.txt"), "utf8");
  const photo = `data:image/jpeg;base64,${(await sharp(join(archive, "photo.png")).rotate().resize(320, 400, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer()).toString("base64")}`;
  const credentials = spawnSync(
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
    { encoding: "utf8", shell: true, maxBuffer: 1024 * 1024 },
  );
  if (credentials.status !== 0)
    throw new Error("Authenticated Supabase CLI access is required");
  const keys = z
    .array(z.object({ name: z.string(), api_key: z.string() }))
    .parse(JSON.parse(credentials.stdout));
  const serviceKey = keys.find((key) => key.name === "service_role")?.api_key;
  if (!serviceKey)
    throw new Error("The project service credential was not available");
  const client = createClient(`https://${project}.supabase.co`, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId = "";
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error("Could not locate the target account");
    const matches = data.users.filter(
      (user) => user.email?.toLowerCase() === email,
    );
    if (matches.length > 1) throw new Error("Ambiguous target account");
    if (matches.length === 1) {
      userId = matches[0].id;
      break;
    }
    if (data.users.length < 1000) break;
  }
  if (!userId) throw new Error("The exact target account does not exist");
  const { data: current, error: profileError } = await client
    .from("profiles")
    .select("data,updated_at")
    .eq("id", userId)
    .maybeSingle();
  const { data: existingApplications, error: applicationsError } = await client
    .from("applications")
    .select("*")
    .eq("user_id", userId);
  if (profileError || applicationsError)
    throw new Error("Could not read existing account data");
  const data = prepareLegacyProfile(
    current?.data ?? {},
    legacy,
    email,
    photo,
    letter,
  );
  const applications = legacyApplications(tracker, userId);
  const existingIds = new Set(
    (existingApplications ?? []).map((record) => record.source_id),
  );
  const incoming = applications.filter(
    (record) => !existingIds.has(record.source_id),
  );
  console.log(
    JSON.stringify({
      mode: args.includes("--apply") ? "apply" : "preview",
      targetMatched: true,
      archivedApplications: applications.length,
      newApplications: incoming.length,
      existingApplications: existingIds.size,
      createCvDrafts: !current?.data?.cvEditor,
      lettersAfter: (data.letterDrafts as unknown[] | undefined)?.length ?? 0,
      profilePreserved: ["fullName", "summary", "cvText"].every(
        (key) => !current?.data?.[key] || current.data[key] === data[key],
      ),
    }),
  );
  if (!args.includes("--apply")) return;
  const backup = join(archive, `rolevia-before-restore-${Date.now()}.json`);
  await writeFile(
    backup,
    JSON.stringify(
      { profile: current, applications: existingApplications },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
  const record = {
    id: userId,
    data,
    updated_at: new Date(
      Math.max(Date.now(), current ? Date.parse(current.updated_at) + 1 : 0),
    ).toISOString(),
  };
  const saved = current
    ? await client
        .from("profiles")
        .update(record)
        .eq("id", userId)
        .eq("updated_at", current.updated_at)
        .select("id")
        .maybeSingle()
    : await client.from("profiles").insert(record).select("id").single();
  if (saved.error || !saved.data)
    throw new Error(
      "Profile changed during restore; no application records were written. Retry after reviewing the private backup",
    );
  if (incoming.length) {
    const { error } = await client
      .from("applications")
      .upsert(incoming, {
        onConflict: "user_id,source_id",
        ignoreDuplicates: true,
      });
    if (error)
      throw new Error(
        "Profile restored but application import failed; the same command can be retried safely",
      );
  }
  const verified = await client
    .from("profiles")
    .select("data")
    .eq("id", userId)
    .single();
  const restored = await client
    .from("applications")
    .select("source_id,status")
    .eq("user_id", userId)
    .in(
      "source_id",
      applications.map((item) => item.source_id),
    );
  if (verified.error || restored.error)
    throw new Error("Restore writes completed but verification failed");
  if (!isDeepStrictEqual(verified.data.data, data))
    throw new Error("Profile restore verification mismatch");
  const statusById = new Map(
    (restored.data ?? []).map((item) => [item.source_id, item.status]),
  );
  if (incoming.some((item) => statusById.get(item.source_id) !== item.status))
    throw new Error("Application status verification mismatch");
  console.log(
    JSON.stringify({
      restoredApplications: restored.data.length,
      verifiedCvDrafts: Boolean(verified.data.data.cvEditor),
      verifiedLetters: verified.data.data.letterDrafts?.length ?? 0,
      backupCreatedOutsideRepository: true,
    }),
  );
}

main().catch((error: unknown) => {
  if (error instanceof z.ZodError)
    console.error(
      JSON.stringify({
        validation: error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      }),
    );
  console.error(
    error instanceof z.ZodError
      ? "Legacy data validation failed; no unvalidated records were written."
      : error instanceof Error
        ? error.message
        : "Legacy restore failed.",
  );
  process.exitCode = 1;
});
