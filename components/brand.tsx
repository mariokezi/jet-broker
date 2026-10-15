import type { AircraftCategory } from "@/lib/types";

// Brand mark: a swept jet climbing through a gold horizon line
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#0e1f3a" />
      <path d="M7 27.5 C 15 25, 25 25, 33 27.5" stroke="#cda651" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path
        d="M9.5 21.2 L 27.8 12.4 C 29.6 11.6 31.4 12.2 31.2 13.4 C 31 14.3 30 14.9 28.9 15.4 L 22.4 18.5 L 20.6 25.4 L 18.4 26.4 L 18.9 19.9 L 13.4 22.5 L 11.8 24.8 L 10.3 25.3 L 10.9 22.3 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

type Shape = { windows: number; scale: number; prop?: boolean; tail: "t" | "cruciform" };

const SHAPES: Record<AircraftCategory, Shape> = {
  Turboprop: { windows: 5, scale: 0.8, prop: true, tail: "t" },
  "Light Jet": { windows: 5, scale: 0.84, tail: "t" },
  "Midsize Jet": { windows: 6, scale: 0.9, tail: "cruciform" },
  "Super Midsize Jet": { windows: 7, scale: 0.95, tail: "t" },
  "Heavy Jet": { windows: 9, scale: 1.02, tail: "t" },
  "Ultra Long Range": { windows: 10, scale: 1.08, tail: "t" },
};

/** Side profile of an aircraft on a soft sky backdrop, sized by category. */
export function AircraftArt({
  category,
  className = "",
  label = true,
}: {
  category: AircraftCategory;
  className?: string;
  label?: boolean;
}) {
  const s = SHAPES[category] ?? SHAPES["Midsize Jet"];
  const id = category.replace(/\W/g, "");
  const winStart = 104;
  const winGap = Math.min(22, 170 / s.windows);
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-b from-navy-50 via-white to-gold-50 ${className}`}
      style={{ backgroundImage: "radial-gradient(circle at 80% 18%, rgba(245,235,210,0.9), rgba(245,235,210,0) 45%), linear-gradient(to bottom, #f3f6fb, #ffffff 60%, #fbf7ec)" }}
    >
      <svg viewBox="0 0 400 150" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-label={`${category} illustration`}>
        <defs>
          <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#eef1f6" />
            <stop offset="1" stopColor="#cfd7e3" />
          </linearGradient>
        </defs>
                <ellipse cx="80" cy="36" rx="46" ry="7" fill="#ffffff" opacity="0.9" />
        <ellipse cx="318" cy="118" rx="60" ry="8" fill="#ffffff" opacity="0.8" />
                <g transform={`translate(${200 - 200 * s.scale} ${8 + (1 - s.scale) * 40}) scale(${s.scale})`}>
          {/* shadow */}
          <ellipse cx="200" cy="128" rx="150" ry="5" fill="#0e1f3a" opacity="0.06" />
          {/* far wing */}
          <path d="M196 76 L 236 58 L 250 58 L 232 78 Z" fill="#c4ccd9" />
          {/* tail */}
          {s.tail === "t" ? (
            <>
              <path d="M316 60 L 346 16 L 368 16 L 364 58 Z" fill={`url(#body-${id})`} stroke="#b9c3d3" strokeWidth="0.8" />
              <path d="M338 18 L 384 13 L 386 19 L 342 22 Z" fill="#dfe4ec" stroke="#b9c3d3" strokeWidth="0.8" />
            </>
          ) : (
            <>
              <path d="M316 60 L 344 20 L 364 20 L 362 58 Z" fill={`url(#body-${id})`} stroke="#b9c3d3" strokeWidth="0.8" />
              <path d="M330 44 L 380 38 L 382 44 L 336 48 Z" fill="#dfe4ec" stroke="#b9c3d3" strokeWidth="0.8" />
            </>
          )}
          <path d="M349 22 L 364 20 L 363 32 L 344 33 Z" fill="#0e1f3a" opacity="0.9" />
          {/* fuselage */}
          <path
            d="M20 84 C 26 70, 50 63, 86 62 L 296 59 C 328 58, 352 56, 380 50 L 384 55 C 362 68, 330 78, 298 80 L 86 88 C 52 89, 28 90, 20 84 Z"
            fill={`url(#body-${id})`}
            stroke="#b9c3d3"
            strokeWidth="0.8"
          />
          {/* cheatline */}
          <path d="M30 81 C 120 79, 220 76, 300 72 C 330 70, 356 64, 380 56" stroke="#0e1f3a" strokeWidth="2.2" fill="none" />
          <path d="M34 84 C 120 82, 220 79, 300 75 C 330 73, 356 67, 380 59" stroke="#cda651" strokeWidth="1.2" fill="none" />
          {/* cockpit */}
          <path d="M44 70 L 62 64.5 L 68 70 L 50 73.5 Z" fill="#1d2f4d" />
          {/* door */}
          <rect x="80" y="64" width="12" height="18" rx="3" fill="none" stroke="#b9c3d3" strokeWidth="0.9" />
          {/* windows */}
          {Array.from({ length: s.windows }, (_, i) => (
            <rect key={i} x={winStart + i * winGap} y="66" width="8" height="7" rx="3.5" fill="#1d2f4d" opacity="0.85" />
          ))}
          {/* engines and wing */}
          {s.prop ? (
            <>
              <path d="M150 84 L 262 86 L 270 92 L 156 90 Z" fill="#dfe4ec" stroke="#b9c3d3" strokeWidth="0.8" />
              <rect x="150" y="76" width="54" height="13" rx="6" fill={`url(#body-${id})`} stroke="#b9c3d3" strokeWidth="0.8" />
              <ellipse cx="148" cy="82.5" rx="2.5" ry="22" fill="#0e1f3a" opacity="0.18" />
              <circle cx="149" cy="82.5" r="3" fill="#0e1f3a" />
            </>
          ) : (
            <>
              <path d="M170 84 L 256 86 L 268 94 L 178 91 Z" fill="#dfe4ec" stroke="#b9c3d3" strokeWidth="0.8" />
              <path d="M290 64 L 300 60" stroke="#b9c3d3" strokeWidth="3" />
              <rect x="262" y="48" width="62" height="17" rx="8.5" fill={`url(#body-${id})`} stroke="#b9c3d3" strokeWidth="0.8" />
              <rect x="262" y="48" width="10" height="17" rx="5" fill="#1d2f4d" opacity="0.8" />
            </>
          )}
        </g>
      </svg>
      {label && (
        <span className="absolute left-3 bottom-2 text-[10px] font-medium uppercase tracking-wider text-navy-700/70">{category}</span>
      )}
    </div>
  );
}
