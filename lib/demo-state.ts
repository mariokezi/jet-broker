import { heuristicExtract, qualify } from "./qualify";
import { demoTripDates, utcDatePlus } from "./demo-clock";
import { generateTripId } from "./trip-id";
import type {
  ActivityItem,
  Booking,
  BookingChecklistItem,
  BrokerSettings,
  Inquiry,
  InquiryFields,
  InquirySource,
  InquiryStatus,
  ParsedQuote,
  Proposal,
  QuoteDecision,
} from "./types";

export const STATE_VERSION = 3;

export interface AppState {
  version: number;
  anchorMs: number;
  settings: BrokerSettings;
  inquiries: Inquiry[];
  rfqQuotes: Record<string, ParsedQuote[]>; // tripId -> simulated/received RFQ responses
  quoteDecisions: Record<string, QuoteDecision>; // quote emailId -> decision
  proposals: Record<string, Proposal>; // tripId -> proposal
  bookings: Booking[];
  activity: ActivityItem[];
  // Rolling 30 day counters before today's session, used for automation metrics
  history: { quotesParsed: number; inquiriesQualified: number; rfqsSent: number; proposalsSent: number; bookings: number };
}

export const DEFAULT_SETTINGS: BrokerSettings = {
  companyName: "JetBroker",
  brokerName: "Mario Kezi",
  brokerEmail: "charter@jetbroker.example",
  brokerPhone: "(586) 707-3466",
  defaultMarkupPct: 12,
};

export function checklistTemplate(): BookingChecklistItem[] {
  return [
    { key: "contract", label: "Charter agreement signed", done: false },
    { key: "payment", label: "Client wire received", done: false },
    { key: "operator", label: "Operator confirmation and trip sheet", done: false },
    { key: "crew", label: "Crew names and tail confirmed", done: false },
    { key: "catering", label: "Catering ordered", done: false },
    { key: "ground", label: "Ground transportation arranged", done: false },
    { key: "itinerary", label: "Final itinerary sent to client", done: false },
  ];
}

export function inquiryTripId(inq: Pick<InquiryFields, "origin" | "destination" | "date">): string | null {
  return inq.origin && inq.destination && inq.date ? generateTripId(inq.origin, inq.destination, inq.date) : null;
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1000;
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}${counter}`;
}

function makeInquiry(
  id: string,
  anchorMs: number,
  hoursAgo: number,
  source: InquirySource,
  status: InquiryStatus,
  rawText: string,
  overrides: Partial<InquiryFields> = {}
): Inquiry {
  const now = new Date(anchorMs);
  const fields = { ...heuristicExtract(rawText, now), ...overrides };
  const { qualification, estimate } = qualify(fields, now);
  return {
    ...fields,
    id,
    createdAt: new Date(anchorMs - hoursAgo * 3_600_000).toISOString(),
    source,
    rawText,
    status,
    qualification,
    estimate,
    aiUsed: false,
    rfqSentAt: status === "New" || status === "Qualified" ? null : new Date(anchorMs - (hoursAgo - 0.2) * 3_600_000).toISOString(),
    operatorsContacted: status === "New" || status === "Qualified" ? 0 : 9,
  };
}

function booking(
  id: string,
  anchorMs: number,
  days: number,
  b: Omit<Booking, "id" | "tripId" | "date" | "createdAt" | "checklist">,
  doneKeys: string[]
): Booking {
  const date = utcDatePlus(anchorMs, days);
  return {
    ...b,
    id,
    date,
    tripId: generateTripId(b.origin, b.destination, date),
    createdAt: new Date(anchorMs - Math.max(2, 6 - days) * 86_400_000).toISOString(),
    checklist: checklistTemplate().map((c) => ({ ...c, done: doneKeys.includes(c.key) })),
  };
}

const ALL = ["contract", "payment", "operator", "crew", "catering", "ground", "itinerary"];

export function createSeedState(anchorMs: number): AppState {
  const { A, B, C } = demoTripDates(anchorMs);
  const d = (n: number) => utcDatePlus(anchorMs, n);
  const at = (hoursAgo: number) => new Date(anchorMs - hoursAgo * 3_600_000).toISOString();

  const inquiries: Inquiry[] = [
    makeInquiry(
      "INQ-2041", anchorMs, 0.4, "Email", "Qualified",
      `Hi,

Looking to take the family to Cabo. Austin to Los Cabos, departing ${d(8)} around 10am, returning ${d(13)}. 8 passengers plus our dog. We'd like a super midsize or bigger with wifi. Budget is around $95k round trip.

Thanks,
Jordan Ellis
Ellis Ventures
jordan@ellisventures.com
(512) 555-0182`
    ),
    makeInquiry(
      "INQ-2040", anchorMs, 2.5, "Web Form", "New",
      `how much for a private jet to vegas? maybe next month sometime

sent from my iphone
Tyler
tyler.b88@gmail.com`
    ),
    makeInquiry(
      "INQ-2039", anchorMs, 5, "Phone", "Qualified",
      `Call notes: Karen Walsh (Walsh & Partners LLP) needs Westchester to Nantucket on ${d(15)}, morning departure, 4 passengers, light jet is fine. Budget up to $14k one way. Email kwalsh@walshpartners.com, cell 917-555-0143.`
    ),
    makeInquiry(
      "INQ-2037", anchorMs, 30, "Email", "Quoted",
      `Hello,

I need a jet from Teterboro to Palm Beach on ${A.long}, 6 passengers, wheels up around 9am. Midsize or larger, all-in pricing please.

Best,
Richard Hale
Hale Capital Partners
rhale@halecapital.com
212-555-0107`
    ),
    makeInquiry(
      "INQ-2035", anchorMs, 22, "Referral", "Quoted",
      `Referral from the Aspen group. Van Nuys to Aspen ${B.iso}, 7 passengers with skis, prefer a newer midsize. Afternoon departure.

Priya Raman
Raman Media Group
priya@ramanmedia.com
310-555-0199`
    ),
    makeInquiry(
      "INQ-2033", anchorMs, 18, "Email", "Quoted",
      `Hi, one way Opa-Locka to Teterboro on ${C.md}, 5 passengers, early morning. Please send options.

Thanks,
Marcus Delgado
Delgado Holdings
marcus@delgadoholdings.com
305-555-0168`
    ),
    makeInquiry(
      "INQ-2030", anchorMs, 60, "Email", "Booked",
      `Dallas Love to Scottsdale on ${d(3)} at 8am, 6 passengers, Challenger 350 or similar. Returning later, will confirm separately.

Ben Carter
Carter Energy
bcarter@carterenergy.com
214-555-0130`
    ),
    makeInquiry(
      "INQ-2026", anchorMs, 140, "Web Form", "Lost",
      `Need a jet Chicago to Miami ${d(-2)}, 3 people, budget $6k.

Sam
sam.k@yahoo.com`
    ),
  ];

  const proposals: Record<string, Proposal> = {};

  const bookings: Booking[] = [
    booking("BK-1182", anchorMs, 1, {
      inquiryId: null, clientName: "Laura Chen", origin: "KPTK", destination: "KTEB", departureTime: "07:30",
      pax: 4, operator: "Great Lakes Executive", aircraft: "Phenom 300", tailNumber: "N318GL",
      operatorPrice: 13900, clientPrice: 16200,
    }, ["contract", "payment", "operator", "crew", "catering"]),
    booking("BK-1185", anchorMs, 3, {
      inquiryId: "INQ-2030", clientName: "Ben Carter", origin: "KDAL", destination: "KSDL", departureTime: "08:00",
      pax: 6, operator: "Lone Star Jets", aircraft: "Challenger 350", tailNumber: "N350LS",
      operatorPrice: 24800, clientPrice: 28500,
    }, ["contract", "payment", "operator"]),
    booking("BK-1187", anchorMs, 8, {
      inquiryId: null, clientName: "Grant Whitaker", origin: "KSNA", destination: "KJAC", departureTime: "11:00",
      pax: 10, operator: "Pacific Coast Jets", aircraft: "Gulfstream G450", tailNumber: "N450PC",
      operatorPrice: 58200, clientPrice: 66000,
    }, ["contract"]),
    booking("BK-1176", anchorMs, -4, {
      inquiryId: null, clientName: "Hannah Brooks", origin: "KBOS", destination: "KPBI", departureTime: "10:00",
      pax: 5, operator: "Flight Level Services", aircraft: "Citation XLS+", tailNumber: "N560FL",
      operatorPrice: 21000, clientPrice: 24300,
    }, ALL),
    booking("BK-1171", anchorMs, -11, {
      inquiryId: null, clientName: "Derek Owens", origin: "KAPA", destination: "KLAS", departureTime: "15:00",
      pax: 3, operator: "Summit Air Charter", aircraft: "Phenom 300", tailNumber: "N300SA",
      operatorPrice: 11500, clientPrice: 13400,
    }, ALL),
    booking("BK-1166", anchorMs, -18, {
      inquiryId: null, clientName: "Richard Hale", origin: "KTEB", destination: "KMIA", departureTime: "09:00",
      pax: 6, operator: "Jet Excellence", aircraft: "Challenger 350", tailNumber: "N350JX",
      operatorPrice: 38900, clientPrice: 44200,
    }, ALL),
  ];

  const activity: ActivityItem[] = [
    { id: "a1", at: at(0.4), kind: "inquiry", text: "New email inquiry from Jordan Ellis: AUS to SJD, 8 pax, round trip", href: "/inquiries/INQ-2041" },
    { id: "a2", at: at(0.39), kind: "qualified", text: `Jordan Ellis scored ${inquiries[0].qualification.score} (${inquiries[0].qualification.tier}) with instant estimate`, href: "/inquiries/INQ-2041" },
    { id: "a3", at: at(0.45), kind: "quote", text: "Royal Flight Club quoted OPF to TEB: Learjet 60, $33,200", href: `/trip/${generateTripId("KOPF", "KTEB", C.iso)}` },
    { id: "a4", at: at(2.5), kind: "inquiry", text: "Web form lead from Tyler (Las Vegas, no date). Follow up drafted", href: "/inquiries/INQ-2040" },
    { id: "a5", at: at(5), kind: "qualified", text: "Call notes for Karen Walsh parsed: HPN to ACK, 4 pax", href: "/inquiries/INQ-2039" },
    { id: "a6", at: at(9), kind: "ops", text: "BK-1182 crew confirmed for tomorrow's PTK to TEB", href: "/schedule" },
    { id: "a7", at: at(18), kind: "rfq", text: "RFQ sent to 9 operators for OPF to TEB", href: "/inquiries/INQ-2033" },
    { id: "a8", at: at(22), kind: "rfq", text: "RFQ sent to 9 operators for VNY to ASE", href: "/inquiries/INQ-2035" },
    { id: "a9", at: at(30), kind: "rfq", text: "RFQ sent to 9 operators for TEB to PBI", href: "/inquiries/INQ-2037" },
    { id: "a10", at: at(52), kind: "booking", text: "Ben Carter booked Challenger 350, DAL to SCF. Margin $3,700", href: "/schedule" },
  ];

  return {
    version: STATE_VERSION,
    anchorMs,
    settings: DEFAULT_SETTINGS,
    inquiries,
    rfqQuotes: {},
    quoteDecisions: {},
    proposals,
    bookings,
    activity,
    history: { quotesParsed: 286, inquiriesQualified: 74, rfqsSent: 61, proposalsSent: 39, bookings: 17 },
  };
}
