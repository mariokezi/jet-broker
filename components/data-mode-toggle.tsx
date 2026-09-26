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
      className={`flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-[11px] font-medium ${pending ? "opacity-60" : ""}`}
      title={outlookLinked ? "Switch between the demo inbox and your live Outlook inbox" : "Connect Outlook to enable live data"}
    >
      <button
        onClick={() => choose("demo")}
        className={`rounded-md px-2.5 py-1 transition-colors ${mode === "demo" ? "bg-amber-500/15 text-amber-300" : "text-white/40 hover:text-white/70"}`}
      >
        Demo data
      </button>
      <button
        onClick={() => choose("live")}
        className={`rounded-md px-2.5 py-1 transition-colors ${mode === "live" ? "bg-emerald-500/15 text-emerald-300" : "text-white/40 hover:text-white/70"}`}
      >
        Live inbox
      </button>
    </div>
  );
}
