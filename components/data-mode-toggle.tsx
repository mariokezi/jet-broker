"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DATA_MODE_COOKIE } from "@/lib/demo-clock";

export function DataModeToggle({ mode, outlookLinked }: { mode: "demo" | "live"; outlookLinked: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: "demo" | "live") {
    document.cookie = `${DATA_MODE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={`flex w-full items-center rounded-xl border border-slate-200 bg-white p-1 text-[11px] font-medium ${pending ? "opacity-60" : ""}`}
      title={outlookLinked ? "Switch between the demo inbox and your live Outlook inbox" : "Connect Outlook to enable live data"}
    >
      <button
        onClick={() => choose("demo")}
        className={`flex-1 rounded-lg px-2.5 py-1.5 transition-colors ${mode === "demo" ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:text-slate-700"}`}
      >
        Demo data
      </button>
      <button
        onClick={() => choose("live")}
        className={`flex-1 rounded-lg px-2.5 py-1.5 transition-colors ${mode === "live" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:text-slate-700"}`}
      >
        Live inbox
      </button>
    </div>
  );
}
