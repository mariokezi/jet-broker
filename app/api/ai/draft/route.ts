import { NextRequest } from "next/server";
import { aiDraft, type DraftKind } from "@/lib/ai-broker";

export const maxDuration = 30;

const KINDS: DraftKind[] = ["followup", "proposal", "rfq", "confirmation"];

export async function POST(request: NextRequest) {
  const { kind, context } = (await request.json().catch(() => ({}))) as {
    kind?: DraftKind;
    context?: Record<string, unknown>;
  };
  if (!kind || !KINDS.includes(kind)) {
    return Response.json({ error: "Unknown draft kind" }, { status: 400 });
  }
  const draft = await aiDraft(kind, context ?? {});
  return Response.json({ draft, aiUsed: draft !== null });
}
