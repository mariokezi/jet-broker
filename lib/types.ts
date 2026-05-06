export interface RawEmail {
  id: string;
  subject: string;
  from: string;
  fromName: string;
  receivedAt: string; // ISO datetime
  bodyType: "text" | "html";
  body: string;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  url: string; // path to file in /public or external
}

export interface ParsedQuote {
  emailId: string;
  price: number | null;
  priceFormatted: string | null;
  aircraft: string | null;
  yom: number | null;
  maxPax: number | null;
  tailNumber: string | null;
  refurbInterior: string | null;
  refurbExterior: string | null;
  totalHours: number | null;
  operator: string | null;
  quoteSource: "inline" | "pdf" | "external";
  externalLink: string | null;
  status: "Accepted" | "Unanswered";
  receivedAt: string;
  subject: string;
  from: string;
  fromName: string;
  bodyType: "text" | "html";
  body: string;
  attachments: EmailAttachment[];
}

export interface TripKey {
  origin: string; // ICAO
  destination: string; // ICAO
  date: string; // YYYY-MM-DD
}

export interface Trip {
  tripId: string;
  origin: string; // ICAO
  originName: string;
  destination: string; // ICAO
  destinationName: string;
  date: string; // YYYY-MM-DD
  quotes: ParsedQuote[];
  status: "Open" | "Closed";
  lastUpdated: string; // ISO datetime
}

export interface UnmatchedEmail {
  email: RawEmail;
  reason: string;
}
