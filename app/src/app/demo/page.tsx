import { Workspace } from "@/components/workspace";
import {
  demoApplications,
  demoChecks,
  demoMatches,
  demoProfile,
} from "@/lib/demo";
export default function Page() {
  return (
    <Workspace
      demo
      profile={demoProfile}
      matches={demoMatches}
      applications={demoApplications}
      checks={demoChecks}
    />
  );
}
