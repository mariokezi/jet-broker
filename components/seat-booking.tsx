"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Plane, ShieldCheck } from "lucide-react";
import { useStore } from "./store-provider";
import { AircraftArt, LogoMark } from "./brand";
import { CabinMap, SeatLegend, ZONE_COLORS } from "./seat-share";
import { seatStats, zoneSold } from "@/lib/seats";
import { distanceNm, getAirportCity, getAirportName, getIATA } from "@/lib/airport-lookup";
import { blockMinutes, durationLabel } from "@/lib/tracking";
import { money } from "@/lib/money";

const input =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-navy-950 placeholder:text-stone-400 outline-none focus:border-navy-400 focus:ring-4 focus:ring-navy-100";

/** Public page where passengers pick a cabin zone and book seats on a shared flight. */
export function SeatBooking({ legId }: { legId: string }) {
  const store = useStore();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [f, setF] = useState({ seats: 1, whole: false, name: "", email: "", phone: "" });
  const [done, setDone] = useState<{ seats: number; zone: string; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!store) return <div className="min-h-screen bg-canvas" />;
  const leg = store.state.emptyLegs.find((l) => l.id === legId);
  const { settings } = store.state;

  if (!leg?.seatShare) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-center">
        <div>
          <LogoMark className="mx-auto mb-4 h-12 w-12" />
          <h1 className="text-xl font-semibold text-navy-900">This flight is not open for seat booking</h1>
          <p className="mt-1 text-sm text-stone-500">Contact {settings.brokerName} at {settings.brokerPhone}.</p>
        </div>
      </div>
    );
  }
  const share = leg.seatShare;
  const stats = seatStats(share);
  const active = share.zones.find((z) => z.id === (zoneId ?? "")) ?? share.zones.find((z) => zoneSold(share, z.id) < z.seats) ?? share.zones[0];
  const open = active.seats - zoneSold(share, active.id);
  const seats = f.whole ? active.seats : f.seats;
  const amount = f.whole ? active.zonePrice : active.pricePerSeat * f.seats;
  const nm = distanceNm(leg.origin, leg.destination);
  const date = leg.earliest === leg.latest ? format(parseISO(leg.earliest), "EEEE, MMMM d") : `${format(parseISO(leg.earliest), "MMM d")} to ${format(parseISO(leg.latest), "MMM d")}`;

  function book() {
    if (!f.name.trim() || !f.email.trim()) {
      setError("Add your name and email so we can send your confirmation.");
      return;
    }
    const ok = store!.sellSeats(leg!.id, { zoneId: active.id, seats: f.seats, wholeZone: f.whole, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || null, source: "Online" });
    if (!ok) {
      setError("Those seats were just taken. Pick another zone or fewer seats.");
      return;
    }
    setDone({ seats, zone: active.name, amount });
  }

  return (
    <div className="min-h-screen bg-canvas text-navy-950">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <header className="mb-10 flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <div>
            <div className="text-lg font-semibold tracking-tight">{settings.companyName}</div>
            <div className="text-xs text-stone-500">Shared private flight</div>
          </div>
        </header>

        <p className="text-sm font-medium uppercase tracking-wider text-gold-600">Seats available</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {getAirportCity(leg.origin)} to {getAirportCity(leg.destination)}
        </h1>
        <p className="mt-2 text-stone-500">
          {date} · {leg.aircraft} · {stats.open} of {stats.total} seats left · from {money(stats.fromPrice)} per seat
        </p>

        <section className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <AircraftArt category={leg.category} className="h-44 rounded-none" />
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            <div>
              <div className="text-2xl font-semibold">{getIATA(leg.origin)}</div>
              <div className="text-xs text-stone-500">{getAirportName(leg.origin)}</div>
            </div>
            <div className="flex flex-col items-center justify-center text-xs text-stone-500">
              <Plane className="mb-1 h-4 w-4 text-gold-600" />
              {nm ? `${nm.toLocaleString()} nm · about ${durationLabel(blockMinutes({ origin: leg.origin, destination: leg.destination, aircraft: leg.aircraft }))}` : ""}
            </div>
            <div className="sm:text-right">
              <div className="text-2xl font-semibold">{getIATA(leg.destination)}</div>
              <div className="text-xs text-stone-500">{getAirportName(leg.destination)}</div>
            </div>
          </div>
        </section>

        {done ? (
          <section className="mt-8 rounded-2xl border border-emerald-200 bg-white p-8 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-6 w-6" /></span>
            <h2 className="text-2xl font-semibold">You&apos;re on the flight</h2>
            <p className="mt-2 text-stone-600">
              {done.seats} seat{done.seats === 1 ? "" : "s"} in the {done.zone.toLowerCase()} for {money(done.amount)}. {settings.brokerName} will email your confirmation and payment link shortly.
            </p>
          </section>
        ) : (
          <>
            <h2 className="mb-3 mt-10 text-sm font-medium uppercase tracking-wider text-stone-500">Choose your zone</h2>
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <CabinMap share={share} activeZone={active.id} onPick={(id) => { setZoneId(id); setF({ ...f, whole: false, seats: 1 }); setError(null); }} />
              <div className="mt-2"><SeatLegend /></div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {share.zones.map((z, i) => {
                const left = z.seats - zoneSold(share, z.id);
                return (
                  <button
                    key={z.id}
                    disabled={left === 0}
                    onClick={() => { setZoneId(z.id); setF({ ...f, whole: false, seats: 1 }); setError(null); }}
                    className={`rounded-2xl border bg-white p-4 text-left transition-shadow disabled:opacity-50 ${active.id === z.id ? "border-navy-900 ring-4 ring-navy-100" : "border-stone-200 hover:shadow-md"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                      <span className="font-semibold">{z.name}</span>
                      <span className="ml-auto text-xs text-stone-500">{left === 0 ? "Sold out" : `${left} of ${z.seats} left`}</span>
                    </div>
                    <div className="mt-2 text-xl font-semibold tabular-nums">{money(z.pricePerSeat)} <span className="text-sm font-normal text-stone-500">per seat</span></div>
                    <div className="text-xs text-stone-500">Whole zone for {money(z.zonePrice)}</div>
                  </button>
                );
              })}
            </div>

            <section className="mt-6 space-y-3 rounded-2xl border border-stone-200 bg-white p-6">
              <div className="font-semibold">Book in the {active.name.toLowerCase()}</div>
              {open === active.seats && (
                <label className="flex items-center gap-2 text-sm text-stone-600">
                  <input type="checkbox" checked={f.whole} onChange={(e) => setF({ ...f, whole: e.target.checked })} /> Take the whole zone ({active.seats} seats) for {money(active.zonePrice)}
                </label>
              )}
              {!f.whole && (
                <label className="block text-sm text-stone-600" htmlFor="pub-seats">
                  Seats
                  <select id="pub-seats" value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} className={`${input} mt-1`}>
                    {Array.from({ length: open }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <input id="pub-name" placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} />
                <input id="pub-email" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} />
              </div>
              <input id="pub-phone" placeholder="Mobile (for flight updates)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={book} disabled={open === 0} className="w-full rounded-xl bg-navy-900 py-3 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
                Reserve {seats} seat{seats === 1 ? "" : "s"} for {money(amount)}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-stone-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Operated by a Part 135 certificated air carrier. Taxes and fees included.
              </p>
            </section>
          </>
        )}

        <footer className="mt-12 border-t border-stone-200 pt-5 text-xs text-stone-500">
          {settings.brokerName} · {settings.companyName} · {settings.brokerPhone} · {settings.brokerEmail}
        </footer>
      </div>
    </div>
  );
}
