import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Extract text from a PDF using Claude's document reading capability.
 * Falls back to returning null if API key is missing.
 */
export async function extractTextFromPdf(base64Data: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[pdf-extract] No ANTHROPIC_API_KEY — cannot extract PDF text");
    return null;
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "Extract ALL text from this PDF document. Return the raw text content exactly as it appears, preserving the layout as much as possible. Do not add any commentary or explanation — return ONLY the document text.",
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    if (text.trim().length > 5) {
      console.log(`[pdf-extract] Claude extracted ${text.length} chars from PDF`);
      return text;
    }
    return null;
  } catch (err) {
    console.error("[pdf-extract] Claude PDF extraction failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
