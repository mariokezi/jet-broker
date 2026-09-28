"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { AircraftArt, LogoMark } from "@/components/brand";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const from = searchParams.get("from") || "/";
        router.push(from);
        router.refresh();
      } else {
        setError("Incorrect password");
        setPassword("");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_-12px_rgba(14,31,58,0.15)]">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Enter password</span>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-navy-300 focus:ring-2 focus:ring-navy-200 transition-all"
        />

        {error && (
          <p className="text-red-700 text-xs mt-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-3 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-40 disabled:hover:bg-navy-800 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white">
        <div className="flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <span className="text-lg font-semibold tracking-tight">JetBroker</span>
        </div>
        <div>
          <AircraftArt category="Heavy Jet" label={false} className="mb-10 h-56 opacity-95" />
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Every inquiry qualified, quoted
            <br />
            and scheduled <span className="text-gold-300">without manual work.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm text-navy-200">Charter operations for private aviation brokers: lead scoring, operator sourcing, proposals, empty legs and ops in one place.</p>
        </div>
        <p className="text-xs text-navy-300">Private and confidential</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <LogoMark className="h-11 w-11 lg:hidden mb-6" />
            <h1 className="text-2xl font-semibold text-navy-900 tracking-tight">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to your charter workspace.</p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
