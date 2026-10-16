"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Inbox, CalendarDays, Repeat, ShieldCheck } from "lucide-react";
import { AircraftArt, LogoMark } from "@/components/brand";
import { DEMO_OPERATOR } from "@/lib/network";

function OperatorLoginForm() {
  const [email, setEmail] = useState(DEMO_OPERATOR.email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/operator/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const from = params.get("from");
        router.push(from && from.startsWith("/operator") ? from : "/operator");
        router.refresh();
      } else {
        setError("Email or password is incorrect");
        setPassword("");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-navy-300 focus:ring-2 focus:ring-navy-200 transition-all";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_-12px_rgba(14,31,58,0.15)]">
      <label className="block text-xs font-medium text-slate-600 mb-1.5" htmlFor="op-email">Work email</label>
      <input id="op-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      <label className="block text-xs font-medium text-slate-600 mb-1.5 mt-4" htmlFor="op-password">Password</label>
      <input id="op-password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={input} />
      {error && <p className="text-red-700 text-xs mt-2">{error}</p>}
      <button
        type="submit"
        disabled={loading || !email || !password}
        className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-3 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in to the portal <ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  );
}

export default function OperatorLoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-navy-950 p-12 text-white">
        <div className="flex items-center gap-3">
          <LogoMark className="h-10 w-10 rounded-[11px] ring-1 ring-white/25" />
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-tight">JetBroker Network</div>
            <div className="text-xs text-gold-300">For charter operators</div>
          </div>
        </div>
        <div>
          <AircraftArt category="Super Midsize Jet" label={false} className="mb-10 h-52 opacity-95" />
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Broker requests in.
            <br />
            <span className="text-gold-300">Quotes out in one click.</span>
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-navy-200">
            <li className="flex items-center gap-3"><Inbox className="h-4 w-4 text-gold-300" /> Answer RFQs with your own rates, priced for you</li>
            <li className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-gold-300" /> Block dates and see every booked trip on one calendar</li>
            <li className="flex items-center gap-3"><Repeat className="h-4 w-4 text-gold-300" /> Sell empty legs to brokers the minute you post them</li>
          </ul>
        </div>
        <p className="flex items-center gap-2 text-xs text-navy-300"><ShieldCheck className="h-4 w-4" /> Verified operators only</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <LogoMark className="h-11 w-11 lg:hidden mb-6" />
            <h1 className="text-2xl font-semibold text-navy-900 tracking-tight">Operator sign in</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your fleet and answer broker requests.</p>
          </div>
          <Suspense fallback={null}>
            <OperatorLoginForm />
          </Suspense>
          <p className="mt-4 text-center text-xs text-slate-400">Broker? <a href="/login" className="font-medium text-navy-700 hover:underline">Sign in to your workspace</a></p>
        </div>
      </div>
    </div>
  );
}
