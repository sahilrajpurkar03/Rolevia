import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { extractCv } from "@/lib/cv";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json(
      { error: "Sign in to import your CV." },
      { status: 401 },
    );
  }
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Choose a file first.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 6 * 1024 * 1024) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Maximum CV size is 5 MB." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const form = await new Response(new Uint8Array(Buffer.concat(chunks)), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a PDF or DOCX file.");
    return NextResponse.json(
      await extractCv(Buffer.from(await file.arrayBuffer()), file.name),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not read this document.",
      },
      { status: 400 },
    );
  }
}
