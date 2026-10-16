"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Building2, Briefcase, RotateCcw } from "lucide-react";
import { LogoMark } from "./brand";
import { useStore } from "./store-provider";

// Both sides render at a desktop width, then scale down to fit half the screen
const FRAME_WIDTH = 1280;

function ScaledFrame({ src, title }: { src: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = size.w ? Math.min(1, size.w / FRAME_WIDTH) : 1;
  return (
    <div ref={box} className="relative h-full w-full overflow-hidden bg-canvas">
      {size.w > 0 && (
        <iframe
          title={title}
          src={src}
          className="absolute left-0 top-0 origin-top-left border-0"
          style={{ width: FRAME_WIDTH, height: size.h / scale, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}

/** Broker workspace and operator portal side by side: every action on one side lands on the other live. */
export function NetworkSplit() {
  const store = useStore();
  const [mobileSide, setMobileSide] = useState<"broker" | "operator">("broker");
  const panes = [
    { key: "broker" as const, label: "Broker", who: store?.state.settings.companyName ?? "JetBroker", src: "/", icon: Briefcase },
    { key: "operator" as const, label: "Operator", who: "Jet Excellence", src: "/operator", icon: Building2 },
  ];

  return (
    <div className="flex h-screen flex-col bg-navy-950">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 text-white">
        <LogoMark className="h-8 w-8 rounded-[9px] ring-1 ring-white/20" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">JetBroker Network · Live view</div>
          <div className="text-[11px] text-navy-300">Broker on the left, operator on the right. One network, updating in real time.</div>
        </div>
        <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live sync
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-white/10 p-0.5 text-xs lg:hidden">
            {panes.map((p) => (
              <button key={p.key} onClick={() => setMobileSide(p.key)} className={`rounded-md px-2.5 py-1 ${mobileSide === p.key ? "bg-white text-navy-900" : "text-navy-200"}`}>{p.label}</button>
            ))}
          </div>
          {store && (
            <button
              onClick={() => confirm("Reset the demo data on both sides?") && store.resetDemo()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-navy-200 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset demo
            </button>
          )}
        </div>
      </header>
      <div className="grid min-h-0 flex-1 gap-3 px-3 pb-3 lg:grid-cols-2">
        {panes.map((p) => (
          <section key={p.key} className={`min-h-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-white/10 ${mobileSide === p.key ? "flex" : "hidden"} lg:flex`}>
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-md ${p.key === "broker" ? "bg-navy-900 text-white" : "bg-gold-400 text-navy-950"}`}>
                <p.icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-navy-900">{p.label}</span>
              <span className="text-xs text-slate-500">{p.who}</span>
              <a href={p.src} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-navy-900">
                Open full screen <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="min-h-0 flex-1">
              <ScaledFrame src={p.src} title={`${p.label} view`} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
