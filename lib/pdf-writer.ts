/** Minimal single page text PDF (Helvetica), returned as base64. */
export function createTextPdfBase64(text: string): string {
  const textObjects = text
    .split("\n")
    .map((line, i) => {
      const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      return `BT /F1 10 Tf 50 ${700 - i * 14} Td (${escaped}) Tj ET`;
    })
    .join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(textObjects, "latin1")} >>\nstream\n${textObjects}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  const header = "%PDF-1.4\n";
  let pos = Buffer.byteLength(header, "latin1");
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pos);
    pos += Buffer.byteLength(obj, "latin1");
  }
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;

  return Buffer.from(header + objects.join("") + xref, "latin1").toString("base64");
}
