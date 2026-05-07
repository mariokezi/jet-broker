import "server-only";

/**
 * Extract text from a PDF buffer.
 * Uses pdf-parse (PDFParse class) with fallback to raw pdfjs-dist.
 */
export async function extractTextFromPdf(base64Data: string): Promise<string | null> {
  const buffer = Buffer.from(base64Data, "base64");

  // Approach 1: pdf-parse PDFParse class
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    if (result.text && result.text.trim().length > 5) {
      console.log(`[pdf-extract] pdf-parse succeeded: ${result.text.length} chars`);
      return result.text;
    }
  } catch (err) {
    console.warn(`[pdf-extract] pdf-parse failed, trying pdfjs-dist fallback:`, err instanceof Error ? err.message : err);
  }

  // Approach 2: pdfjs-dist directly
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // On Vercel serverless, we need to set the worker to the bundled file
    // or disable it. Try setting to the mjs worker path.
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        const path = await import("path");
        const workerPath = path.join(
          process.cwd(),
          "node_modules",
          "pdfjs-dist",
          "legacy",
          "build",
          "pdf.worker.mjs"
        );
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
      } catch {
        // If path resolution fails, pdfjs might still work without it in some environments
      }
    }

    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    }).promise;

    let fullText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str: string }>;
      const pageText = items.map((item) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    doc.destroy();

    if (fullText.trim().length > 5) {
      console.log(`[pdf-extract] pdfjs-dist fallback succeeded: ${fullText.length} chars`);
      return fullText;
    }
  } catch (err) {
    console.error(`[pdf-extract] pdfjs-dist also failed:`, err instanceof Error ? err.message : err);
  }

  return null;
}
