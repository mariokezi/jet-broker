import { NextRequest } from "next/server";
import { aiExtractInquiry } from "@/lib/ai-broker";
import { heuristicExtract, mergeFields, qualify } from "@/lib/qualify";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const { text } = (await request.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) {
    return Response.json({ error: "Missing request text" }, { status: 400 });
  }

  const started = Date.now();
  const heuristic = heuristicExtract(text);
  const ai = await aiExtractInquiry(text);
  const fields = ai ? mergeFields(ai, heuristic) : heuristic;
  const { qualification, estimate } = qualify(fields);

  return Response.json({
    fields,
    qualification,
    estimate,
    aiUsed: ai !== null,
    elapsedMs: Date.now() - started,
  });
}
