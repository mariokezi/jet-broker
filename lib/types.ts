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

// ============================================================
// Broker workflow: inquiries, proposals, bookings
// ============================================================

export type AircraftCategory =
  | "Turboprop"
  | "Light Jet"
  | "Midsize Jet"
  | "Super Midsize Jet"
  | "Heavy Jet"
  | "Ultra Long Range";

export type LeadTier = "Hot" | "Warm" | "Cold";

export interface Qualification {
  score: number; // 0-100
  tier: LeadTier;
  reasons: { label: string; impact: number }[];
  missing: string[];
  summary: string;
}

export interface CategoryEstimate {
  category: AircraftCategory;
  flightHours: number;
  low: number;
  high: number;
  fits: boolean; // pax + range fit
}

export interface TripEstimate {
  distanceNm: number | null;
  recommended: AircraftCategory | null;
  options: CategoryEstimate[];
}

export interface InquiryFields {
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  company: string | null;
  origin: string | null; // ICAO
  destination: string | null; // ICAO
  date: string | null; // YYYY-MM-DD
  departureTime: string | null; // "HH:MM" local, free text allowed
  returnDate: string | null;
  pax: number | null;
  category: AircraftCategory | null;
  budget: number | null;
  pets: boolean;
  notes: string | null;
}

export type InquiryStatus =
  | "New"
  | "Qualified"
  | "Sourcing"
  | "Quoted"
  | "Proposal Sent"
  | "Booked"
  | "Lost";

export type InquirySource = "Email" | "Web Form" | "Phone" | "Referral";

export interface Inquiry extends InquiryFields {
  id: string;
  createdAt: string;
  source: InquirySource;
  rawText: string;
  status: InquiryStatus;
  qualification: Qualification;
  estimate: TripEstimate;
  aiUsed: boolean;
  rfqSentAt: string | null;
  operatorsContacted: number;
}

export type QuoteDecision = "Shortlisted" | "Declined" | "Accepted";

export interface ProposalOption {
  quoteId: string;
  operator: string | null;
  aircraft: string | null;
  tailNumber: string | null;
  yom: number | null;
  maxPax: number | null;
  refurbInterior: string | null;
  operatorPrice: number;
  clientPrice: number;
}

export interface Proposal {
  tripId: string;
  createdAt: string;
  clientName: string;
  clientEmail: string | null;
  origin: string;
  destination: string;
  date: string;
  pax: number | null;
  markupPct: number;
  options: ProposalOption[];
  message: string;
  status: "Draft" | "Sent" | "Accepted";
  acceptedQuoteId: string | null;
}

export type BookingStage = "Contracted" | "Paid" | "Confirmed" | "Flown";

export interface BookingChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export interface Booking {
  id: string;
  tripId: string;
  inquiryId: string | null;
  createdAt: string;
  clientName: string;
  origin: string;
  destination: string;
  date: string;
  departureTime: string;
  pax: number | null;
  operator: string;
  aircraft: string;
  tailNumber: string | null;
  operatorPrice: number;
  clientPrice: number;
  checklist: BookingChecklistItem[];
}

export interface ActivityItem {
  id: string;
  at: string;
  kind: "inquiry" | "qualified" | "rfq" | "quote" | "proposal" | "booking" | "ops" | "ai";
  text: string;
  href?: string;
}

export interface BrokerSettings {
  companyName: string;
  brokerName: string;
  brokerEmail: string;
  brokerPhone: string;
  defaultMarkupPct: number;
}
