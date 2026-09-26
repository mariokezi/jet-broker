"use client";

import { useState } from "react";
import { RotateCcw, Check } from "lucide-react";
import { useStore } from "./store-provider";
import { LoadingBlock, PageHeader, Panel, btnPrimary, btnSecondary, inputCls } from "./ui-bits";
import type { BrokerSettings } from "@/lib/types";

export function SettingsForm() {
  const store = useStore();
  if (!store) return <LoadingBlock />;
  return <Form key={store.state.anchorMs} initial={store.state.settings} />;
}

function Form({ initial }: { initial: BrokerSettings }) {
  const store = useStore()!;
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const field = (key: keyof BrokerSettings, label: string, type = "text") => (
    <label className="block">
      <span className="text-xs text-white/45">{label}</span>
      <input
        type={type}
        className={`${inputCls} mt-1`}
        value={s[key]}
        onChange={(e) => setS({ ...s, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
      />
    </label>
  );

  return (
    <>
      <PageHeader title="Settings" subtitle="Branding used on proposals and drafted emails." />
      <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
        <Panel title="Brokerage">
          <div className="space-y-3">
            {field("companyName", "Company name")}
            {field("brokerName", "Broker name")}
            {field("brokerEmail", "Email")}
            {field("brokerPhone", "Phone")}
            {field("defaultMarkupPct", "Default markup (%)", "number")}
            <button
              onClick={() => {
                store.updateSettings(s);
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
              }}
              className={btnPrimary}
            >
              {saved ? <Check className="h-4 w-4" /> : null} {saved ? "Saved" : "Save settings"}
            </button>
          </div>
        </Panel>

        <Panel title="Demo data">
          <p className="text-sm text-white/55 mb-4">
            Resets inquiries, quotes, proposals, and bookings to a fresh demo dataset dated from today. Use this before a walkthrough.
          </p>
          {confirmReset ? (
            <div className="flex gap-2">
              <button onClick={() => { store.resetDemo(); setConfirmReset(false); }} className={btnPrimary}>Yes, reset demo data</button>
              <button onClick={() => setConfirmReset(false)} className={btnSecondary}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className={btnSecondary}>
              <RotateCcw className="h-4 w-4" /> Reset demo data
            </button>
          )}
          <div className="mt-6 pt-4 border-t border-white/5 text-xs text-white/40 space-y-1.5">
            <p><span className="text-white/60">AI:</span> set <code className="text-white/60">ANTHROPIC_API_KEY</code> to have Claude parse quotes, qualify inquiries, and draft emails. Without it, the built-in rules engine and templates run instead.</p>
            <p><span className="text-white/60">Live inbox:</span> connect Outlook (read-only Mail.Read) and switch the header toggle to Live inbox.</p>
          </div>
        </Panel>
      </div>
    </>
  );
}
