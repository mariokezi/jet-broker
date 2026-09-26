import { format, parseISO } from "date-fns";
import { getAirportCity, getIATA } from "./airport-lookup";
import type { BrokerSettings, Inquiry, Proposal } from "./types";

function niceDate(iso: string | null): string {
  if (!iso) return "TBD";
  try {
    return format(parseISO(iso), "EEEE, MMMM d");
  } catch {
    return iso;
  }
}

function signature(s: BrokerSettings): string {
  return `${s.brokerName}\n${s.companyName}\n${s.brokerPhone} | ${s.brokerEmail}`;
}

function firstName(name: string | null): string {
  return name?.split(" ")[0] ?? "there";
}

export function followupTemplate(inq: Inquiry, s: BrokerSettings) {
  const asks = inq.qualification.missing.map((m) => `  - ${m}`).join("\n");
  return {
    subject: `Your charter request${inq.destination ? ` to ${getAirportCity(inq.destination)}` : ""}`,
    body: `Hi ${firstName(inq.clientName)},

Thanks for reaching out. I'd love to put options together for you. To get accurate, all-in pricing I just need a couple of details:

${asks || "  - Preferred departure time"}

As soon as I have these I'll send aircraft options, usually within the hour.

Best,
${signature(s)}`,
  };
}

export function rfqTemplate(inq: Inquiry, s: BrokerSettings) {
  return {
    subject: `RFQ ${inq.origin ? getIATA(inq.origin) : "?"}-${inq.destination ? getIATA(inq.destination) : "?"} ${inq.date ?? ""}`,
    body: `Hello,

Please quote the following trip:

  Route: ${inq.origin ?? "TBD"} to ${inq.destination ?? "TBD"}
  Date: ${niceDate(inq.date)}${inq.departureTime ? `, ${inq.departureTime}` : ""}
${inq.returnDate ? `  Return: ${niceDate(inq.returnDate)}\n` : ""}  Passengers: ${inq.pax ?? "TBD"}
  Category: ${inq.category ?? inq.estimate.recommended ?? "Open"}
${inq.pets ? "  Pets on board: yes\n" : ""}${inq.notes ? `  Notes: ${inq.notes}\n` : ""}
Please include all-in price (FET, fuel, crew, segment fees), tail number, year, refurb, and ARGUS/Wyvern status.

Thank you,
${signature(s)}`,
  };
}

export function proposalTemplate(p: Proposal, s: BrokerSettings) {
  const lines = p.options
    .map((o, i) => `  Option ${i + 1}: ${o.aircraft ?? "Aircraft"}${o.yom ? ` (${o.yom})` : ""}, up to ${o.maxPax ?? "?"} seats: $${o.clientPrice.toLocaleString()} all-in`)
    .join("\n");
  return {
    subject: `Your flight options: ${getAirportCity(p.origin)} to ${getAirportCity(p.destination)}, ${niceDate(p.date)}`,
    body: `Hi ${firstName(p.clientName)},

Thank you for the opportunity. I've reviewed the market for your trip from ${getAirportCity(p.origin)} to ${getAirportCity(p.destination)} on ${niceDate(p.date)}${p.pax ? ` for ${p.pax} passengers` : ""} and selected the best options by safety rating, aircraft age, and value:

${lines}

All prices include federal excise tax, fuel, crew, and segment fees. Every operator is ARGUS or Wyvern rated. Aircraft are subject to availability until confirmed, so just reply with the option you prefer and I'll send the charter agreement right away.

Best,
${signature(s)}`,
  };
}
