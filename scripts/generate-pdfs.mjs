/**
 * Simple script to generate minimal text-based PDF files for demo purposes.
 * These are valid PDFs with embedded text content.
 * Run: node scripts/generate-pdfs.mjs
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createTextPDF(text) {
  const lines = text.split("\n");
  const textObjects = lines
    .map((line, i) => {
      const escaped = line
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
      return `BT /F1 10 Tf 50 ${700 - i * 14} Td (${escaped}) Tj ET`;
    })
    .join("\n");

  const stream = `${textObjects}`;
  const streamLength = Buffer.byteLength(stream, "ascii");

  const objects = [];
  const offsets = [];
  let pos = 0;

  // Header
  const header = "%PDF-1.4\n";
  pos += Buffer.byteLength(header, "ascii");

  // Object 1: Catalog
  offsets.push(pos);
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  pos += Buffer.byteLength(objects[objects.length - 1], "ascii");

  // Object 2: Pages
  offsets.push(pos);
  objects.push(
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
  );
  pos += Buffer.byteLength(objects[objects.length - 1], "ascii");

  // Object 3: Page
  offsets.push(pos);
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`
  );
  pos += Buffer.byteLength(objects[objects.length - 1], "ascii");

  // Object 4: Content stream
  offsets.push(pos);
  objects.push(
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj\n`
  );
  pos += Buffer.byteLength(objects[objects.length - 1], "ascii");

  // Object 5: Font
  offsets.push(pos);
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  );
  pos += Buffer.byteLength(objects[objects.length - 1], "ascii");

  // XRef
  const xrefPos = pos;
  let xref = "xref\n0 6\n";
  xref += "0000000000 65535 f \n";
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return header + objects.join("") + xref;
}

const quoteA = `AEM AVIATION
Charter Quote

Route: KTEB to KPBI
Date: May 15, 2026

Aircraft: Citation M2
Tail: N210AE
YOM: 2017
Max passengers: 6
Total time: 890 hrs
Interior/Exterior refurb: 2024/2023

Price: $21,750

All prices include fuel, crew, and FET.
Contact: info@aemaviation.example`;

const quoteB = `AEM AVIATION
Charter Quote

Route: KVNY to KASE
Date: May 18, 2026

Aircraft: Hawker 800XP
Tail: N808AE
YOM: 2003
Max passengers: 8
Total time: 3,450 hrs
Interior/Exterior refurb: 2021/2020

Price: $31,600

All prices include fuel, crew, and FET.
Contact: info@aemaviation.example`;

const outDir = join(__dirname, "..", "public", "sample-quotes");
writeFileSync(join(outDir, "quote-a.pdf"), createTextPDF(quoteA), "ascii");
writeFileSync(join(outDir, "quote-b.pdf"), createTextPDF(quoteB), "ascii");

console.log("Generated quote-a.pdf and quote-b.pdf in public/sample-quotes/");
