import { unstable_cache } from "next/cache";
import { discoverJobs } from "@/lib/jobs";
import { buildRoleMarket } from "@/lib/role-suggestions";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const marketSnapshot = unstable_cache(
  async () => {
    const { jobs, warnings } = await discoverJobs();
    if (warnings.length === 2) throw new Error("Job feeds unavailable");
    return buildRoleMarket(jobs, warnings);
  },
  ["role-market-v1"],
  { revalidate: 900 },
);

export async function GET() {
  try {
    return Response.json(await marketSnapshot(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        error:
          "Current feed evidence is unavailable. Role keywords are still available.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
