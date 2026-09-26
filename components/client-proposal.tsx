"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Plane, Printer, ShieldCheck } from "lucide-react";
import { useStore } from "./store-provider";
import { getAirportCity, getAirportName, getIATA, distanceNm } from "@/lib/airport-lookup";
import { checklistTemplate, newId } from "@/lib/demo-state";
import { categoryFromAircraft, CATEGORIES } from "@/lib/fleet";
import { money } from "@/lib/money";
import type { Booking, ProposalOption } from "@/lib/types";

export function ClientProposal({ tripId }: { tripId: string }) {
  const store = useStore();
  const [chosen, setChosen] = useState<string | null>(null);

  if (!store) return <div className="min-h-screen bg-white" />;
  const p = store.state.proposals[tripId];
  const { settings } = store.state;

  if (!p) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500 text-sm">
        This proposal is no longer available.
      </div>
    );
  }

  const dist = distanceNm(p.origin, p.destination);
  const accepted = p.status === "Accepted" ? p.acceptedQuoteId : chosen;

  function accept(o: ProposalOption) {
    if (!store || !p) return;
    const inquiry = store.state.inquiries.find((i) => i.origin === p.origin && i.destination === p.destination && i.date === p.date);
    const bk: Booking = {
      id: newId("BK"),
      tripId,
      inquiryId: inquiry?.id ?? null,
      createdAt: new Date().toISOString(),
      clientName: p.clientName,
      origin: p.origin,
      destination: p.destination,
      date: p.date,
      departureTime: inquiry?.departureTime && /^\d{2}:\d{2}$/.test(inquiry.departureTime) ? inquiry.departureTime : "09:00",
      pax: p.pax,
      operator: o.operator ?? "Operator",
      aircraft: o.aircraft ?? "Aircraft",
      tailNumber: o.tailNumber,
      operatorPrice: o.operatorPrice,
      clientPrice: o.clientPrice,
      checklist: checklistTemplate(),
    };
    store.createBooking(bk, o.quoteId);
    setChosen(o.quoteId);
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <header className="flex items-start justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">{settings.companyName}</div>
              <div className="text-xs text-stone-500">Private Aviation</div>
            </div>
          </div>
          <button onClick={() => window.print()} className="print:hidden inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100">
            <Printer className="h-3.5 w-3.5" /> Save as PDF
          </button>
        </header>

        <p className="text-sm text-stone-500">Prepared for</p>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">{p.clientName}</h1>

        <section className="mt-8 rounded-2xl bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-4xl font-semibold tracking-tight">{getIATA(p.origin)}</div>
              <div className="text-sm text-stone-500">{getAirportCity(p.origin)}</div>
              <div className="text-xs text-stone-400">{getAirportName(p.origin)}</div>
            </div>
            <div className="flex-1 flex flex-col items-center text-stone-400">
              <Plane className="h-5 w-5" />
              {dist && <span className="text-[11px] mt-1">{dist.toLocaleString()} nm</span>}
            </div>
            <div className="text-right">
              <div className="text-4xl font-semibold tracking-tight">{getIATA(p.destination)}</div>
              <div className="text-sm text-stone-500">{getAirportCity(p.destination)}</div>
              <div className="text-xs text-stone-400">{getAirportName(p.destination)}</div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-stone-100 flex gap-6 text-sm">
            <div><span className="text-stone-400">Date</span><div className="font-medium">{format(parseISO(p.date), "EEEE, MMMM d, yyyy")}</div></div>
            {p.pax && <div><span className="text-stone-400">Passengers</span><div className="font-medium">{p.pax}</div></div>}
          </div>
        </section>

        <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wider text-stone-500">Your aircraft options</h2>
        <div className="space-y-4">
          {p.options.map((o, i) => {
            const category = categoryFromAircraft(o.aircraft);
            const spec = CATEGORIES.find((c) => c.category === category);
            const hours = dist && spec ? dist / spec.cruiseKts + 0.35 : null;
            const isChosen = accepted === o.quoteId;
            return (
              <div key={o.quoteId} className={`rounded-2xl border bg-white p-6 transition-shadow ${isChosen ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-stone-200"}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xs text-stone-400">Option {i + 1}{category ? ` · ${category}` : ""}</div>
                    <div className="text-xl font-semibold mt-0.5">{o.aircraft}</div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600">
                      {o.yom && <span>Year {o.yom}</span>}
                      {o.refurbInterior && <span>Interior refurbished {o.refurbInterior}</span>}
                      {o.maxPax && <span>Up to {o.maxPax} seats</span>}
                      {hours && <span>~{Math.floor(hours)}h {Math.round((hours % 1) * 60)}m flight</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular-nums">{money(o.clientPrice)}</div>
                    <div className="text-xs text-stone-400">all-in</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> ARGUS / Wyvern rated operator
                  </span>
                  {accepted ? (
                    isChosen && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                        <Check className="h-4 w-4" /> Selected. Your broker will send the agreement.
                      </span>
                    )
                  ) : (
                    <button onClick={() => accept(o)} className="print:hidden rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
                      Reserve this aircraft
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <section className="mt-10 grid sm:grid-cols-2 gap-6 text-sm text-stone-600">
          <div>
            <h3 className="font-medium text-stone-900 mb-1">Included</h3>
            <p>Federal excise tax, fuel, crew, segment fees, and standard catering. De-icing, international fees, and overnight crew costs are billed only if incurred.</p>
          </div>
          <div>
            <h3 className="font-medium text-stone-900 mb-1">Next steps</h3>
            <p>Reserve an option and we&apos;ll send the charter agreement. Aircraft are held once the agreement is signed and payment is received.</p>
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t border-stone-200 text-sm text-stone-500 flex flex-wrap justify-between gap-2">
          <span>{settings.brokerName} &middot; {settings.companyName}</span>
          <span>{settings.brokerPhone} &middot; {settings.brokerEmail}</span>
        </footer>
        <p className="mt-4 text-[11px] text-stone-400">
          {settings.companyName} acts as an agent for the client and does not own or operate aircraft. All flights are operated by FAA Part 135 certificated air carriers who exercise full operational control.
        </p>
      </div>
    </div>
  );
}
