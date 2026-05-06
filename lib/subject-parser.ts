import { resolveToICAO } from "./airport-lookup";

export interface ParsedSubject {
  origin: string | null;
  destination: string | null;
  date: string | null; // YYYY-MM-DD
}

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseDate(dateStr: string): string | null {
  const currentYear = new Date().getFullYear();
  let match: RegExpMatchArray | null;

  // ISO: 2026-05-18
  match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  // US format: MM/DD/YYYY or MM/DD/YY
  match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (match) {
    let year = parseInt(match[3]);
    if (year < 100) year += 2000;
    return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }

  // US format without year: MM/DD
  match = dateStr.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (match && !dateStr.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
    const month = parseInt(match[1]);
    const day = parseInt(match[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const candidateDate = new Date(currentYear, month - 1, day);
      const year = candidateDate < new Date() ? currentYear + 1 : currentYear;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Month name DD, YYYY or Month DD YYYY or Month DD
  const monthNamePattern = new RegExp(
    `(${Object.keys(MONTH_NAMES).join("|")})\\s+(\\d{1,2})(?:[,\\s]+(\\d{4}))?`,
    "i"
  );
  match = dateStr.match(monthNamePattern);
  if (match) {
    const month = MONTH_NAMES[match[1].toLowerCase()];
    const day = parseInt(match[2]);
    let year = match[3] ? parseInt(match[3]) : currentYear;
    if (!match[3]) {
      const candidateDate = new Date(currentYear, month - 1, day);
      year = candidateDate < new Date() ? currentYear + 1 : currentYear;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function extractAirports(subject: string): { origin: string | null; destination: string | null } {
  // Pattern 1: ICAO-ICAO or ICAO/ICAO or ICAO > ICAO
  const icaoPattern = /\b([A-Z]{3,4})\s*[-/>]\s*([A-Z]{3,4})\b/;
  let match = subject.match(icaoPattern);
  if (match) {
    const origin = resolveToICAO(match[1]);
    const dest = resolveToICAO(match[2]);
    if (origin && dest) return { origin, destination: dest };
  }

  // Pattern 2: "City to City" or "City - City"
  const cityPattern = /([A-Za-z\s'-]+?)\s+to\s+([A-Za-z\s'-]+?)(?:\s+(?:on|trip|\d|$))/i;
  match = subject.match(cityPattern);
  if (match) {
    const origin = resolveToICAO(match[1].trim());
    const dest = resolveToICAO(match[2].trim());
    if (origin && dest) return { origin, destination: dest };
  }

  return { origin: null, destination: null };
}

export function parseSubject(subject: string): ParsedSubject {
  const { origin, destination } = extractAirports(subject);
  const date = parseDate(subject);

  return { origin, destination, date };
}

export function buildTripKey(parsed: ParsedSubject): string | null {
  if (!parsed.origin || !parsed.destination || !parsed.date) return null;
  return `${parsed.origin}-${parsed.destination}-${parsed.date}`;
}
