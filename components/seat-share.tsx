"use client";

import { useState } from "react";
import { Armchair, Check, Copy, Link2, Users } from "lucide-react";
import { useStore } from "./store-provider";
import { btnPrimary, btnSecondary, inputCls } from "./ui-bits";
import { cabinSeats, seatStats, zoneSold, type SeatShare } from "@/lib/seats";
import { money } from "@/lib/money";
import type { EmptyLeg } from "@/lib/empty-legs";

// One color per cabin zone, front to back
export const ZONE_COLORS = ["#0e1f3a", "#b88d38", "#3d7ea6", "#6b8f71"];

/** Top down cabin drawing, nose on the left. Sold seats are filled, open seats outlined. */
export function CabinMap({ share, activeZone, onPick, className = "" }: { share: SeatShare; activeZone?: string | null; onPick?: (zoneId: string) => void; className?: string }) {
  const { dots, zoneBounds } = cabinSeats(share);
  const tail = Math.max(...zoneBounds.map((z) => z.x1)) + 30;
  const width = tail + 60;
  return (
    <svg viewBox={`0 0 ${width} 160`} className={`w-full ${className}`} role="img" aria-label="Cabin seat map">
      {/* fuselage */}
      <path
        d={`M 20 80 C 30 30, 90 22, 130 22 L ${tail} 22 C ${tail + 30} 22, ${tail + 50} 50, ${tail + 55} 80 C ${tail + 50} 110, ${tail + 30} 138, ${tail} 138 L 130 138 C 90 138, 30 130, 20 80 Z`}
        fill="#f3f6fb"
        stroke="#c7d3e6"
        strokeWidth="1.5"
      />
      <path d="M 40 70 L 70 56 L 70 104 L 40 90 Z" fill="#c7d3e6" />
      <text x="54" y="84" fontSize="9" fill="#6d86b0" textAnchor="middle" transform="rotate(-90 54 84)">COCKPIT</text>
      <rect x="92" y="30" width="26" height="22" rx="4" fill="#e4eaf4" />
      <text x="105" y="44" fontSize="7" fill="#6d86b0" textAnchor="middle">GALLEY</text>
      <rect x="92" y="108" width="26" height="22" rx="4" fill="#e4eaf4" />
      <text x="105" y="122" fontSize="7" fill="#6d86b0" textAnchor="middle">DOOR</text>
      {zoneBounds.map((z, i) => {
        const zone = share.zones.find((x) => x.id === z.zoneId)!;
        const active = activeZone === z.zoneId;
        return (
          <g key={z.zoneId} onClick={() => onPick?.(z.zoneId)} style={{ cursor: onPick ? "pointer" : "default" }}>
            <rect x={z.x0} y="30" width={z.x1 - z.x0} height="100" rx="10" fill={ZONE_COLORS[i % ZONE_COLORS.length]} opacity={active ? 0.14 : 0.05} stroke={active ? ZONE_COLORS[i % ZONE_COLORS.length] : "none"} strokeDasharray="4 3" />
            <text x={(z.x0 + z.x1) / 2} y="84" fontSize="9" fontWeight="600" fill={ZONE_COLORS[i % ZONE_COLORS.length]} textAnchor="middle">{zone.name.toUpperCase()}</text>
          </g>
        );
      })}
      {dots.map((d) => {
        const color = ZONE_COLORS[d.zoneIndex % ZONE_COLORS.length];
        const w = share.zones[d.zoneIndex].kind === "divan" ? 26 : 22;
        return (
          <rect
            key={`${d.zoneId}-${d.seatIndex}`}
            x={d.x - w / 2}
            y={d.y - 11}
            width={w}
            height="22"
            rx="6"
            fill={d.sold ? color : "#ffffff"}
            stroke={color}
            strokeWidth="2"
            onClick={() => onPick?.(d.zoneId)}
            style={{ cursor: onPick ? "pointer" : "default" }}
          />
        );
      })}
    </svg>
  );
}

export function SeatLegend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-slate-500">
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-navy-900 bg-navy-900" /> Sold</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-navy-900 bg-white" /> Open</span>
    </div>
  );
}

/** Broker panel on a leg: zones, prices, seat sales and the manifest. */
export function SeatSharePanel({ leg }: { leg: EmptyLeg }) {
  const store = useStore()!;
  const share = leg.seatShare!;
  const stats = seatStats(share);
  const firstOpen = share.zones.find((z) => zoneSold(share, z.id) < z.seats)?.id ?? share.zones[0].id;
  const [zoneId, setZoneId] = useState(firstOpen);
  const [selling, setSelling] = useState(false);
  const [f, setF] = useState({ seats: 1, whole: false, name: "", email: "" });
  const [copied, setCopied] = useState(false);
  const zone = share.zones.find((z) => z.id === zoneId)!;
  const open = zone.seats - zoneSold(share, zone.id);
  const amount = f.whole ? zone.zonePrice : zone.pricePerSeat * f.seats;
  const vsWhole = stats.revenue - leg.askingPrice;
  const link = typeof window !== "undefined" ? `${window.location.origin}/seats/${leg.id}` : `/seats/${leg.id}`;

  function sell() {
    const ok = store.sellSeats(leg.id, { zoneId, seats: f.seats, wholeZone: f.whole, name: f.name.trim(), email: f.email.trim() || null, phone: null, source: "Broker" });
    if (ok) {
      setSelling(false);
      setF({ seats: 1, whole: false, name: "", email: "" });
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gold-200 bg-gold-50/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <Armchair className="h-4 w-4 text-gold-600" /> Sold by zone and seat
        </div>
        <span className="text-xs font-medium tabular-nums text-slate-600">{stats.sold} of {stats.total} seats sold</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-gold-500" style={{ width: `${(stats.sold / stats.total) * 100}%` }} />
      </div>

      <div className="rounded-lg bg-white p-2">
        <CabinMap share={share} activeZone={zoneId} onPick={setZoneId} />
      </div>
      <div className="mt-2 flex justify-between"><SeatLegend /><span className="text-[11px] text-slate-400">Tap a zone to select it</span></div>

      <ul className="mt-3 space-y-1.5">
        {share.zones.map((z, i) => {
          const sold = zoneSold(share, z.id);
          return (
            <li key={z.id}>
              <button
                onClick={() => setZoneId(z.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${zoneId === z.id ? "border-navy-300 bg-white" : "border-transparent bg-white/60 hover:bg-white"}`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                <span className="flex-1">
                  <span className="font-medium text-navy-900">{z.name}</span>
                  <span className="text-slate-500"> · {z.seats - sold} of {z.seats} open</span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="font-semibold text-navy-900">{money(z.pricePerSeat)}</span><span className="text-slate-500">/seat</span>
                  <span className="block text-[10px] text-slate-500">whole zone {money(z.zonePrice)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Seat revenue so far</div>
          <div className="text-sm font-semibold tabular-nums text-navy-900">{money(stats.revenue)}</div>
        </div>
        <div className="rounded-lg bg-white px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{vsWhole >= 0 ? "Above whole plane price" : "To match whole plane price"}</div>
          <div className={`text-sm font-semibold tabular-nums ${vsWhole >= 0 ? "text-emerald-700" : "text-slate-700"}`}>{money(Math.abs(vsWhole))}</div>
        </div>
      </div>

      {selling ? (
        <div className="mt-3 space-y-2 rounded-lg bg-white p-3">
          <div className="text-xs font-medium text-navy-900">Sell in {zone.name} ({open} open)</div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={f.whole} disabled={open !== zone.seats} onChange={(e) => setF({ ...f, whole: e.target.checked })} />
            Whole zone for {money(zone.zonePrice)} {open !== zone.seats && <span className="text-slate-400">(some seats already sold)</span>}
          </label>
          {!f.whole && (
            <label className="block text-xs text-slate-500" htmlFor="seat-count">
              Seats
              <input id="seat-count" type="number" min={1} max={open} value={f.seats} onChange={(e) => setF({ ...f, seats: Math.max(1, Math.min(open, Number(e.target.value))) })} className={`${inputCls} mt-1`} />
            </label>
          )}
          <input id="seat-name" placeholder="Passenger or client name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} />
          <input id="seat-email" placeholder="Email (optional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} />
          <div className="flex gap-2">
            <button onClick={() => setSelling(false)} className={`${btnSecondary} flex-1`}>Cancel</button>
            <button onClick={sell} disabled={!f.name.trim() || open === 0} className={`${btnPrimary} flex-1`}>
              <Check className="h-4 w-4" /> Sell for {money(amount)}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button onClick={() => setSelling(true)} disabled={stats.open === 0} className={`${btnPrimary} flex-1`}>
            <Users className="h-4 w-4" /> {stats.open === 0 ? "Sold out" : leg.isMine ? "Sell seats" : "Buy seats for a client"}
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                window.open(`/seats/${leg.id}`, "_blank");
              }
            }}
            className={btnSecondary}
            title="Copy the public booking link"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Booking link"}
          </button>
        </div>
      )}
      <a href={`/seats/${leg.id}`} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:text-navy-900">
        <Link2 className="h-3.5 w-3.5" /> Open the passenger booking page
      </a>

      {share.sales.length > 0 && (
        <div className="mt-4 border-t border-gold-200 pt-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Manifest</div>
          <ul className="space-y-1.5 text-xs">
            {share.sales.map((s) => {
              const z = share.zones.find((x) => x.id === s.zoneId);
              return (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">
                    <span className="font-medium text-navy-900">{s.name}</span> · {s.wholeZone ? `whole ${z?.name.toLowerCase()}` : `${s.seats} seat${s.seats === 1 ? "" : "s"}, ${z?.name.toLowerCase()}`}
                    {s.source === "Online" && <span className="ml-1 rounded bg-sky-50 px-1 text-[10px] text-sky-700">online</span>}
                  </span>
                  <span className="tabular-nums text-slate-600">{money(s.amount)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
