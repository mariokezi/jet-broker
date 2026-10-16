"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Wifi, MapPin, Gauge } from "lucide-react";
import { useStore } from "../store-provider";
import { useOperator } from "./operator-shell";
import { AircraftArt } from "../brand";
import { PageHeader, btnPrimary, btnSecondary, btnGhost, inputCls, LoadingBlock } from "../ui-bits";
import { getIATA, listAirports } from "@/lib/airport-lookup";
import { CATEGORIES } from "@/lib/fleet";
import { money } from "@/lib/money";
import { newId } from "@/lib/demo-state";
import { aircraftConflict, categoryOfModel, type FleetAircraft } from "@/lib/network";
import type { AircraftCategory } from "@/lib/types";

export function OperatorFleet() {
  const store = useStore();
  const account = useOperator();
  const [editing, setEditing] = useState<FleetAircraft | "new" | null>(null);
  if (!store) return <LoadingBlock />;
  const today = new Date(store.now).toISOString().slice(0, 10);
  const fleet = store.state.fleet.filter((a) => a.operatorId === account.id);
  const seats = fleet.reduce((s, a) => s + a.seats, 0);

  return (
    <div>
      <PageHeader
        title="Fleet"
        subtitle={`${fleet.length} aircraft, ${seats} seats. Brokers see these when they send requests, and your quotes price from these rates.`}
        actions={<button className={btnPrimary} onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add aircraft</button>}
      />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {fleet.map((ac) => {
          const conflict = aircraftConflict(ac, today, store.state.blocks, store.state.bookings);
          return (
            <article key={ac.id} data-tail={ac.tail} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(14,31,58,0.04),0_8px_24px_-12px_rgba(14,31,58,0.08)]">
              <div className="relative">
                <AircraftArt category={ac.category} className="h-40 rounded-none" />
                <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${conflict ? "bg-white text-slate-600" : "bg-emerald-500 text-white"}`}>
                  {conflict ? `Today: ${conflict}` : "Available today"}
                </span>
                <span className="absolute right-3 top-3 rounded-lg bg-navy-950/85 px-2 py-1 font-mono text-xs font-semibold text-white">{ac.tail}</span>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-navy-900">{ac.model}</h3>
                    <p className="text-xs text-slate-500">{ac.category} · {ac.year}{ac.refurb ? ` · refurbished ${ac.refurb}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold tabular-nums text-navy-900">{money(ac.hourlyRate)}</div>
                    <div className="text-[11px] text-slate-500">per hour</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600">
                  <Spec icon={<span className="text-sm font-semibold text-navy-900">{ac.seats}</span>} label="seats" />
                  <Spec icon={<MapPin className="h-4 w-4 text-navy-700" />} label={`Based ${getIATA(ac.base)}`} />
                  <Spec icon={<Gauge className="h-4 w-4 text-navy-700" />} label={`${ac.totalHours.toLocaleString()} hrs`} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-xs ${ac.wifi ? "text-navy-700" : "text-slate-400"}`}><Wifi className="h-3.5 w-3.5" /> {ac.wifi ? "Wifi" : "No wifi"}</span>
                  <div className="flex gap-1">
                    <button className={btnGhost} onClick={() => setEditing(ac)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                    <button
                      className={btnGhost}
                      onClick={() => {
                        if (confirm(`Remove ${ac.tail} from your fleet?`)) store.removeAircraft(ac.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        <button onClick={() => setEditing("new")} className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 text-slate-500 hover:border-navy-300 hover:text-navy-900 transition-colors">
          <Plus className="h-8 w-8" />
          <span className="mt-2 text-sm font-medium">Add an aircraft</span>
        </button>
      </div>
      {editing && <AircraftDialog initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-canvas px-2 py-2.5 text-center">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function AircraftDialog({ initial, onClose }: { initial: FleetAircraft | null; onClose: () => void }) {
  const store = useStore()!;
  const account = useOperator();
  const [f, setF] = useState(() => ({
    tail: initial?.tail ?? "",
    model: initial?.model ?? "",
    category: initial?.category ?? ("Midsize Jet" as AircraftCategory),
    year: initial?.year ?? 2016,
    seats: initial?.seats ?? 8,
    hourlyRate: initial?.hourlyRate ?? CATEGORIES.find((c) => c.category === "Midsize Jet")!.hourlyRate,
    base: initial?.base ?? account.base,
    refurb: initial?.refurb ?? null,
    totalHours: initial?.totalHours ?? 3000,
    wifi: initial?.wifi ?? true,
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const tail = f.tail.trim().toUpperCase();
  const duplicate = store.state.fleet.some((a) => a.tail === tail && a.id !== initial?.id);
  const valid = /^N[0-9A-Z]{1,5}$/.test(tail) && !duplicate && f.model.trim() && f.seats > 0 && f.hourlyRate > 0 && f.year >= 1970 && f.year <= 2030;
  const models = CATEGORIES.flatMap((c) => c.models.map((m) => m.name));

  function onModel(model: string) {
    const category = categoryOfModel(model);
    const spec = CATEGORIES.find((c) => c.category === category);
    const m = spec?.models.find((x) => x.name.toLowerCase() === model.toLowerCase());
    setF((p) => ({
      ...p,
      model,
      ...(category && !initial ? { category, hourlyRate: spec!.hourlyRate } : {}),
      ...(m && !initial ? { seats: m.pax } : {}),
    }));
  }

  function save() {
    if (!valid) return;
    store.saveAircraft({
      id: initial?.id ?? newId("AC"),
      operatorId: account.id,
      tail,
      model: f.model.trim(),
      category: f.category,
      year: f.year,
      seats: f.seats,
      hourlyRate: f.hourlyRate,
      base: f.base,
      refurb: f.refurb,
      totalHours: f.totalHours,
      wifi: f.wifi,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-label={initial ? "Edit aircraft" : "Add aircraft"} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-navy-900">{initial ? `Edit ${initial.tail}` : "Add an aircraft"}</h3>
        <AircraftArt category={f.category} className="mt-3 h-28" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Tail number">
            <input aria-label="Tail number" className={`${inputCls} font-mono uppercase`} placeholder="N123AB" value={f.tail} onChange={(e) => set("tail", e.target.value)} />
            {duplicate && <span className="text-[11px] text-rose-600">Already in a fleet on the network</span>}
          </Field>
          <Field label="Model">
            <input aria-label="Model" list="op-models" className={inputCls} placeholder="Challenger 350" value={f.model} onChange={(e) => onModel(e.target.value)} />
            <datalist id="op-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label="Category">
            <select className={inputCls} value={f.category} onChange={(e) => set("category", e.target.value as AircraftCategory)}>
              {CATEGORIES.map((c) => <option key={c.category}>{c.category}</option>)}
            </select>
          </Field>
          <Field label="Year"><input aria-label="Year" type="number" className={inputCls} value={f.year} onChange={(e) => set("year", Number(e.target.value))} /></Field>
          <Field label="Seats"><input aria-label="Seats" type="number" min={1} className={inputCls} value={f.seats} onChange={(e) => set("seats", Number(e.target.value))} /></Field>
          <Field label="Hourly rate (USD)"><input aria-label="Hourly rate" type="number" min={0} step={100} className={inputCls} value={f.hourlyRate} onChange={(e) => set("hourlyRate", Number(e.target.value))} /></Field>
          <Field label="Home base">
            <select className={inputCls} value={f.base} onChange={(e) => set("base", e.target.value)}>
              {listAirports().filter((a) => a.icao.startsWith("K")).map((a) => <option key={a.icao} value={a.icao}>{getIATA(a.icao)} · {a.city}</option>)}
            </select>
          </Field>
          <Field label="Interior refurb year"><input type="number" className={inputCls} placeholder="None" value={f.refurb ?? ""} onChange={(e) => set("refurb", e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Airframe hours"><input type="number" className={inputCls} value={f.totalHours} onChange={(e) => set("totalHours", Number(e.target.value))} /></Field>
          <label className="flex items-end gap-2 pb-2.5 text-sm text-navy-900"><input type="checkbox" checked={f.wifi} onChange={(e) => set("wifi", e.target.checked)} /> Wifi on board</label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnSecondary} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={!valid} onClick={save}>{initial ? "Save changes" : "Add to fleet"}</button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
