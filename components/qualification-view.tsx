import { money } from "@/lib/money";
import type { AircraftCategory, LeadTier, TripEstimate } from "@/lib/types";

const TIER_COLOR: Record<LeadTier, string> = { Hot: "#e11d48", Warm: "#d97706", Cold: "#0284c7" };

export function ScoreRing({ score, tier, size = 76 }: { score: number; tier: LeadTier; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Lead score ${score} of 100`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f6" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={TIER_COLOR[tier]}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-navy-900" fontSize={size * 0.28} fontWeight={600}>
        {score}
      </text>
    </svg>
  );
}

export function ReasonsList({ reasons, missing }: { reasons: { label: string; impact: number }[]; missing: string[] }) {
  return (
    <div className="mt-4 space-y-1">
      {reasons.map((r) => (
        <div key={r.label} className="flex items-center justify-between text-xs">
          <span className="text-slate-600">{r.label}</span>
          <span className={`tabular-nums font-medium ${r.impact >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {r.impact >= 0 ? "+" : "−"}
            {Math.abs(r.impact)}
          </span>
        </div>
      ))}
      {missing.length > 0 && (
        <div className="pt-2 mt-2 border-t border-slate-200">
          <span className="text-[11px] text-slate-500">Missing: </span>
          {missing.map((m) => (
            <span key={m} className="mr-1.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EstimateTable({ estimate, selected, roundTrip }: { estimate: TripEstimate; selected: AircraftCategory | null; roundTrip: boolean }) {
  if (!estimate.distanceNm) {
    return <p className="text-xs text-slate-500">Add departure and arrival airports to price the trip.</p>;
  }
  const legs = roundTrip ? 2 : 1;
  const highlight = selected ?? estimate.recommended;
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">
        {estimate.distanceNm.toLocaleString()} nm{roundTrip ? ", round trip (2 legs)" : ", one way"}. All-in retail ranges incl. FET and fees.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="font-normal py-1">Category</th>
            <th className="font-normal py-1 text-right">Flight</th>
            <th className="font-normal py-1 text-right">Estimate</th>
          </tr>
        </thead>
        <tbody>
          {estimate.options.map((o) => (
            <tr key={o.category} className={`border-t border-slate-200 ${o.fits ? "" : "opacity-35"}`}>
              <td className="py-1.5">
                <span className={o.category === highlight ? "text-slate-900 font-medium" : "text-slate-600"}>{o.category}</span>
                {o.category === estimate.recommended && <span className="ml-1.5 rounded bg-navy-50 px-1 py-0.5 text-[10px] text-navy-700">Recommended</span>}
                {!o.fits && <span className="ml-1.5 text-[10px] text-slate-500">(pax or range)</span>}
              </td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">{o.flightHours.toFixed(1)} h</td>
              <td className={`py-1.5 text-right tabular-nums ${o.category === highlight ? "text-slate-900 font-medium" : "text-slate-600"}`}>
                {money(o.low * legs)} to {money(o.high * legs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
