import { LoaderCircle } from "lucide-react";
export default function Loading() {
  return (
    <main className="loading-screen" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>Opening your workspace...</p>
    </main>
  );
}
