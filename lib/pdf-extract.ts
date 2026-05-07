import "server-only";

/**
 * Extract text from a PDF using unpdf (local, zero AI tokens).
 * The extracted text then gets sent to Claude for intelligent
 * quote analysis via ai-parser.ts — keeping token usage minimal.
 */
export async function extractTextFromPdf(base64Data: string): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buffer = Buffer.from(base64Data, "base64");
    const uint8 = new Uint8Array(buffer);
    const doc = await getDocumentProxy(uint8);
    const result = await extractText(doc, { mergePages: true });

    const text = result.text?.trim();
    if (text && text.length > 5) {
      console.log(`[pdf-extract] Extracted ${text.length} chars from PDF (local, no AI tokens used)`);
      return text;
    }

    console.warn("[pdf-extract] PDF parsed but no meaningful text found");
    return null;
  } catch (err) {
    console.error("[pdf-extract] unpdf extraction failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
