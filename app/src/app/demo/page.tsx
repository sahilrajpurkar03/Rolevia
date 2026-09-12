import { Workspace } from "@/components/workspace";
import {
  demoApplications,
  demoChecks,
  demoMatches,
  demoProfile,
} from "@/lib/demo";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const blank = (await searchParams).start === "blank";
  return (
    <Workspace
      key={blank ? "blank" : "sample"}
      demo
      profile={blank ? null : demoProfile}
      matches={blank ? [] : demoMatches}
      applications={blank ? [] : demoApplications}
      checks={blank ? [] : demoChecks}
    />
  );
}
