"use client";

import { useState } from "react";
import { LogoMark } from "./brand";
import { Check, Loader2 } from "lucide-react";
import { useStore } from "./store-provider";
import { buildInquiry, parseInquiry } from "./inquiry-intake";
import { getIATA } from "@/lib/airport-lookup";
import { money } from "@/lib/money";
import type { Inquiry } from "@/lib/types";

const input =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-navy-400 focus:ring-4 focus:ring-navy-100";

export function ClientRequestForm() {
  const store = useStore();
  const [f, setF] = useState({ name: "", email: "", phone: "", from: "", to: "", date: "", time: "", returnDate: "", pax: "", size: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<Inquiry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const company = store?.state.settings.companyName ?? "JetBroker";

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store) return;
    setLoading(true);
    setError(null);
    const text = `Web form request

From: ${f.from}
To: ${f.to}
Departure date: ${f.date}${f.time ? ` at ${f.time}` : ""}
${f.returnDate ? `Returning: ${f.returnDate}\n` : ""}Passengers: ${f.pax} passengers
${f.size ? `Aircraft preference: ${f.size}\n` : ""}${f.notes ? `Notes: ${f.notes}\n` : ""}
Thanks,
${f.name}
${f.email}
${f.phone}`;
    try {
      const result = await parseInquiry(text);
      const inq = buildInquiry({ ...result.fields, clientName: f.name || result.fields.clientName, clientEmail: f.email || result.fields.clientEmail, clientPhone: f.phone || result.fields.clientPhone }, text, "Web Form", result.aiUsed);
      store.addInquiry(inq);
      store.log({ kind: "inquiry", text: `Web form lead from ${inq.clientName ?? "visitor"} scored ${inq.qualification.score} (${inq.qualification.tier})`, href: `/inquiries/${inq.id}` });
      setDone(inq);
    } catch {
      setError("Something went wrong. Please try again or call us.");
    } finally {
      setLoading(false);
    }
  }

  const rec = done?.estimate.options.find((o) => o.category === (done.category ?? done.estimate.recommended));

  return (
    <div className="min-h-screen bg-canvas text-navy-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex items-center gap-3 mb-10">
          <LogoMark className="h-10 w-10" />
          <div>
            <div className="text-lg font-semibold tracking-tight">{company}</div>
            <div className="text-xs text-stone-500">Private Aviation</div>
          </div>
        </div>

        {done ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Request received</h1>
            <p className="text-stone-500 mt-2">
              {done.origin && done.destination ? `${getIATA(done.origin)} to ${getIATA(done.destination)}` : "Your trip"}. We&apos;re sourcing aircraft now and will send options shortly.
            </p>
            {rec && (
              <p className="mt-6 text-sm text-stone-600">
                Typical {rec.category.toLowerCase()} pricing for this trip: <span className="font-semibold text-stone-900">{money(rec.low * (done.returnDate ? 2 : 1))} to {money(rec.high * (done.returnDate ? 2 : 1))}</span>
              </p>
            )}
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Request a flight</h1>
            <p className="text-stone-500 mt-2 mb-8">Tell us where you&apos;re going. You&apos;ll have vetted aircraft options, usually within the hour.</p>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <input required className={input} placeholder="From (city or airport)" value={f.from} onChange={set("from")} />
                <input required className={input} placeholder="To (city or airport)" value={f.to} onChange={set("to")} />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-xs text-stone-500">Departure<input required type="date" className={`${input} mt-1`} value={f.date} onChange={set("date")} /></label>
                <label className="text-xs text-stone-500">Time<input type="time" className={`${input} mt-1`} value={f.time} onChange={set("time")} /></label>
                <label className="text-xs text-stone-500">Return (optional)<input type="date" className={`${input} mt-1`} value={f.returnDate} onChange={set("returnDate")} /></label>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input required type="number" min={1} className={input} placeholder="Passengers" value={f.pax} onChange={set("pax")} />
                <select className={input} value={f.size} onChange={set("size")}>
                  <option value="">Any aircraft size</option>
                  <option>Light Jet</option>
                  <option>Midsize Jet</option>
                  <option>Super Midsize Jet</option>
                  <option>Heavy Jet</option>
                </select>
              </div>
              <textarea className={input} rows={3} placeholder="Anything else? Pets, luggage, catering..." value={f.notes} onChange={set("notes")} />
              <div className="grid sm:grid-cols-3 gap-3 pt-2">
                <input required className={input} placeholder="Full name" value={f.name} onChange={set("name")} />
                <input required type="email" className={input} placeholder="Email" value={f.email} onChange={set("email")} />
                <input className={input} placeholder="Phone" value={f.phone} onChange={set("phone")} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={loading || !store} className="w-full rounded-xl bg-navy-900 py-3 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Request options
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
