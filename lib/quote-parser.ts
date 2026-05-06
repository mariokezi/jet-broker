import type { ParsedQuote, RawEmail } from "./types";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#?\w+;/g, "");
}

function extractPrice(text: string): { price: number | null; formatted: string | null } {
  // $16,175 or USD 16,175 or $16,175.00
  const dollarMatch = text.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  if (dollarMatch) {
    const num = parseFloat(dollarMatch[1].replace(/,/g, ""));
    return { price: num, formatted: `$${num.toLocaleString()}` };
  }

  const usdMatch = text.match(/USD\s?([\d,]+(?:\.\d{2})?)/i);
  if (usdMatch) {
    const num = parseFloat(usdMatch[1].replace(/,/g, ""));
    return { price: num, formatted: `$${num.toLocaleString()}` };
  }

  // $16k
  const kMatch = text.match(/\$([\d.]+)k\b/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1]) * 1000;
    return { price: num, formatted: `$${num.toLocaleString()}` };
  }

  return { price: null, formatted: null };
}

function extractAircraft(text: string): string | null {
  const patterns = [
    /\b(Citation\s+(?:X|M2|VII|CJ[1-4]|Sovereign|Excel|Latitude|Longitude|Ultra|Encore|Bravo))\b/i,
    /\b(Hawker\s+\d{3,4}(?:XP)?)\b/i,
    /\b(Learjet\s+\d{2,3}(?:XR)?)\b/i,
    /\b(Pilatus\s+PC-12(?:\/\d+E?)?)\b/i,
    /\b(Phenom\s+\d{3}(?:E)?)\b/i,
    /\b(Challenger\s+\d{3})\b/i,
    /\b(Gulfstream\s+G\d{3,4})\b/i,
    /\b(Global\s+\d{4,5})\b/i,
    /\b(King\s+Air\s+\d{3,4})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractTailNumber(text: string): string | null {
  const match = text.match(/\bN\d{1,5}[A-Z]{0,2}\b/);
  return match ? match[0] : null;
}

function extractYOM(text: string): number | null {
  // Look for "YOM: XXXX" or "Year: XXXX" or "Year of Manufacture: XXXX"
  const yomMatch = text.match(/(?:YOM|Year(?:\s+of\s+(?:manufacture|mfg))?)[:\s]+(\d{4})/i);
  if (yomMatch) return parseInt(yomMatch[1]);

  // Look for 4-digit year near aircraft mention (between 1960-2026)
  const yearMatch = text.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  if (yearMatch) return parseInt(yearMatch[1]);

  return null;
}

function extractMaxPax(text: string): number | null {
  const match = text.match(/(?:max\s+)?(?:passengers?|pax|seats?)[:\s]+(\d{1,2})/i);
  if (match) return parseInt(match[1]);

  const match2 = text.match(/(\d{1,2})\s+(?:passengers?|pax|seats?)/i);
  if (match2) return parseInt(match2[1]);

  return null;
}

function extractRefurb(text: string): { interior: string | null; exterior: string | null } {
  // "Interior/Exterior refurb: 2022/2022" or "Refurb: 2022/2024" or "I/E: 2022/2022"
  const match = text.match(/(?:interior\s*\/\s*exterior|refurb(?:ished)?|I\s*\/\s*E)[:\s]+([\d-]+)\s*\/\s*([\d-]+)/i);
  if (match) {
    return {
      interior: match[1] === "-" ? null : match[1],
      exterior: match[2] === "-" ? null : match[2],
    };
  }
  return { interior: null, exterior: null };
}

function extractTotalHours(text: string): number | null {
  const match = text.match(/(?:total\s+(?:time|hours?|hrs)|flight\s+hours?|TTAF)[:\s]+([\d,]+)/i);
  if (match) return parseInt(match[1].replace(/,/g, ""));

  const match2 = text.match(/([\d,]+)\s*(?:hrs|hours|flight\s*hours)/i);
  if (match2) return parseInt(match2[1].replace(/,/g, ""));

  return null;
}

function extractOperator(text: string, fromName: string): string | null {
  // Try from email signature lines
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    const line = lines[i].trim();
    // Look for company-like names at end of email
    if (
      line.length > 3 &&
      line.length < 60 &&
      !line.includes("@") &&
      !line.match(/^\d/) &&
      !line.match(/^(Best|Thanks|Regards|Sincerely|Cheers|Hi|Hello)/i) &&
      (line.match(/\b(Aviation|Jet|Air|Flight|Charter|Flying|Aero|Premier|Royal|Century|Trinity)\b/i) ||
        line.match(/\b(Services|Club|Inc|LLC|Corp)\b/i))
    ) {
      return line;
    }
  }
  return fromName || null;
}

function extractExternalLink(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"]+(?:quote|portal|booking)[^\s<>"]*/i);
  return match ? match[0] : null;
}

export function parseQuoteFromText(email: RawEmail): ParsedQuote {
  const rawText = email.bodyType === "html" ? stripHtml(email.body) : email.body;
  const externalLink = extractExternalLink(rawText);
  const isExternalOnly =
    externalLink !== null &&
    !extractPrice(rawText).price &&
    !extractAircraft(rawText);

  const { price, formatted } = extractPrice(rawText);
  const aircraft = extractAircraft(rawText);
  const tailNumber = extractTailNumber(rawText);
  const yom = extractYOM(rawText);
  const maxPax = extractMaxPax(rawText);
  const refurb = extractRefurb(rawText);
  const totalHours = extractTotalHours(rawText);
  const operator = extractOperator(rawText, email.fromName);

  if (isExternalOnly) {
    return {
      emailId: email.id,
      price: null,
      priceFormatted: null,
      aircraft: null,
      yom: null,
      maxPax: null,
      tailNumber: null,
      refurbInterior: null,
      refurbExterior: null,
      totalHours: null,
      operator: operator,
      quoteSource: "external",
      externalLink: externalLink,
      status: "Unanswered",
      receivedAt: email.receivedAt,
      subject: email.subject,
      from: email.from,
      fromName: email.fromName,
      bodyType: email.bodyType,
      body: email.body,
      attachments: email.attachments,
    };
  }

  // Log unparsed fields
  const missing: string[] = [];
  if (!price) missing.push("price");
  if (!aircraft) missing.push("aircraft");
  if (!tailNumber) missing.push("tailNumber");
  if (!yom) missing.push("yom");
  if (!maxPax) missing.push("maxPax");
  if (!totalHours) missing.push("totalHours");
  if (missing.length > 0) {
    console.log(`[QuoteParser] Email ${email.id} missing fields: ${missing.join(", ")}`);
  }

  return {
    emailId: email.id,
    price,
    priceFormatted: formatted,
    aircraft,
    yom,
    maxPax,
    tailNumber,
    refurbInterior: refurb.interior,
    refurbExterior: refurb.exterior,
    totalHours,
    operator,
    quoteSource: "inline",
    externalLink,
    status: Math.random() > 0.6 ? "Accepted" : "Unanswered",
    receivedAt: email.receivedAt,
    subject: email.subject,
    from: email.from,
    fromName: email.fromName,
    bodyType: email.bodyType,
    body: email.body,
    attachments: email.attachments,
  };
}

export function parseQuoteFromPDF(email: RawEmail, pdfText: string): ParsedQuote {
  const fakeTextEmail: RawEmail = {
    ...email,
    body: pdfText,
    bodyType: "text",
  };
  const parsed = parseQuoteFromText(fakeTextEmail);
  parsed.quoteSource = "pdf";
  parsed.body = email.body;
  parsed.bodyType = email.bodyType;
  return parsed;
}
