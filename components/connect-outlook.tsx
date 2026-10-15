"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Eye, Inbox, Loader2, Lock, LogOut, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { LogoMark } from "./brand";

interface Status {
  configured: boolean;
  connected: boolean;
  account?: { name: string | null; email: string | null } | null;
  inbox?: { total: number; unread: number } | null;
  healthy?: boolean | null;
  missing: string[];
  redirectUri: string;
}

function MicrosoftLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

/** Turns Microsoft's sign-in errors into plain instructions. */
function explain(error: string, detail: string | null, redirectUri: string): { title: string; body: string } {
  const d = detail ?? "";
  if (error === "not_configured") return { title: "Outlook isn't set up yet", body: "The Microsoft app settings are missing. Follow the setup steps below, then try again." };
  if (error === "state_mismatch") return { title: "The sign-in expired", body: "That sign-in took too long or was opened in another tab. Please try again." };
  if (/AADSTS50011/.test(d)) return { title: "This address isn't registered with Microsoft", body: `Add ${redirectUri} as a Web redirect URI in your Azure app registration, then try again.` };
  if (/AADSTS700025|AADSTS7000218/.test(d)) return { title: "The redirect link is set up as a mobile app", body: `In Azure, open Authentication, remove ${redirectUri} from "Mobile and desktop applications", add it under a Web platform instead, set "Allow public client flows" to No, and save.` };
  if (/AADSTS7000215|AADSTS7000222|invalid_client/.test(d)) return { title: "The client secret is wrong or expired", body: "Create a new client secret in Azure and paste its Value into CLIENT_SECRET in Vercel, then redeploy." };
  if (/AADSTS90094|AADSTS65001|admin/i.test(d)) return { title: "This account needs admin approval", body: "The company's Microsoft 365 admin has to approve JetBroker once. Send them the app name and ask them to grant consent, or connect a personal Outlook account." };
  if (/AADSTS50020|AADSTS700016/.test(d)) return { title: "This type of account isn't allowed", body: "In Azure, set the app's supported account types to \"Accounts in any organizational directory and personal Microsoft accounts\"." };
  if (error === "access_denied" || error === "consent_required") return { title: "Permission wasn't granted", body: "The sign-in was cancelled or the read permission was declined. Try again and click Accept." };
  if (error === "token_exchange") return { title: "Microsoft didn't finish the sign-in", body: d || "Please try again." };
  return { title: "Sign-in didn't complete", body: d || error };
}

export function ConnectOutlook() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const error = params.get("error");
  const detail = params.get("detail");
  const justConnected = params.get("connected") === "1";
  const disconnected = params.get("disconnected") === "1";

  async function load() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/auth/status?check=1", { cache: "no-store" });
      setStatus(await r.json());
    } catch {
      setStatus({ configured: false, connected: false, missing: ["Could not reach the server"], redirectUri: "" });
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load connection state once on mount
    load();
  }, []);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard blocked: the text stays selectable on the page
    }
  }

  const problem = error ? explain(error, detail, status?.redirectUri ?? "") : null;
  const signIn = `/api/auth/login${email.trim() ? `?hint=${encodeURIComponent(email.trim())}` : ""}`;

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark className="h-10 w-10 rounded-[11px] ring-1 ring-white/25" />
          <span className="text-lg font-semibold tracking-tight">JetBroker</span>
        </Link>
        <div>
          <div className="mb-8 flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white"><MicrosoftLogo className="h-7 w-7" /></span>
            <ArrowRight className="h-5 w-5 text-gold-300" />
            <LogoMark className="h-14 w-14 rounded-[16px] ring-1 ring-white/25" />
          </div>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Your inbox, read for you.
            <br />
            <span className="text-gold-300">Every operator quote, organized.</span>
          </h2>
          <ul className="mt-8 space-y-4 text-sm text-navy-100">
            <li className="flex gap-3"><Eye className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> Read only. JetBroker can read mail but can never send, move or delete anything.</li>
            <li className="flex gap-3"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> Your sign-in is encrypted and kept only in this browser. We never see your password.</li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> Disconnect any time here, or remove access from your Microsoft account settings.</li>
          </ul>
        </div>
        <p className="text-xs text-navy-300">Works with Outlook.com, Hotmail, Live and Microsoft 365 work accounts.</p>
      </aside>

      {/* Connect panel */}
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-900">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>

          {problem && (
            <div role="alert" className="mb-6 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div className="text-sm">
                <div className="font-semibold text-rose-800">{problem.title}</div>
                <div className="mt-0.5 break-words text-rose-700">{problem.body}</div>
              </div>
            </div>
          )}
          {justConnected && status && !status.connected && !error && (
            <div role="alert" className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="font-semibold text-amber-900">Microsoft signed you in, but this browser didn&apos;t keep the connection</div>
                <div className="mt-0.5 text-amber-800">Allow cookies for this site (private windows and strict tracking settings can block them), then sign in again.</div>
              </div>
            </div>
          )}
          {disconnected && !status?.connected && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Disconnected. The app is back on demo data.</div>
          )}

          {!status ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking your connection…</div>
          ) : status.connected ? (
            <Connected status={status} justConnected={justConnected} refreshing={refreshing} onRefresh={load} />
          ) : !status.configured ? (
            <Setup status={status} copied={copied} onCopy={copy} onRetry={load} />
          ) : (
            <>
              <LogoMark className="mb-6 h-12 w-12 lg:hidden" />
              <h1 className="text-2xl font-semibold tracking-tight text-navy-900">Connect an Outlook inbox</h1>
              <p className="mt-1.5 text-sm text-slate-500">Sign in with the Microsoft account whose email JetBroker should read. You can connect any Outlook account and switch later.</p>
              <form
                className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_-12px_rgba(14,31,58,0.15)]"
                onSubmit={(e) => {
                  e.preventDefault();
                  window.location.href = signIn;
                }}
              >
                <label htmlFor="outlook-email" className="block text-sm font-medium text-navy-900">Email address <span className="font-normal text-slate-400">(optional)</span></label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="outlook-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-navy-900 placeholder-slate-400 outline-none focus:border-navy-400 focus:ring-4 focus:ring-navy-100"
                  />
                </div>
                <button type="submit" className="flex w-full items-center justify-center gap-3 rounded-xl bg-navy-900 py-3 text-sm font-medium text-white hover:bg-navy-800">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-white"><MicrosoftLogo className="h-4 w-4" /></span>
                  Sign in with Microsoft
                </button>
                <p className="text-center text-xs text-slate-500">You&apos;ll go to Microsoft&apos;s sign-in page, then come right back here.</p>
              </form>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
                <div className="mb-2 font-medium text-navy-900">What JetBroker reads</div>
                <ul className="space-y-1.5 text-slate-600">
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Operator quote emails and their PDF attachments</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Your name and email address, to show who is connected</li>
                </ul>
                <p className="mt-3 text-xs text-slate-500">Company accounts: if Microsoft says the app needs admin approval, the company&apos;s IT admin approves it once for everyone.</p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Connected({ status, justConnected, refreshing, onRefresh }: { status: Status; justConnected: boolean; refreshing: boolean; onRefresh: () => void }) {
  const a = status.account;
  const initials = (a?.name ?? a?.email ?? "?").split(/[\s@.]/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <>
      {justConnected && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> Outlook connected. The app is now on the live inbox.
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-navy-900">Outlook is connected</h1>
      <p className="mt-1.5 text-sm text-slate-500">JetBroker is reading this inbox for operator quotes.</p>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_-12px_rgba(14,31,58,0.15)]">
        <div className="flex items-center gap-4">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white"><MicrosoftLogo className="h-3 w-3" /></span>
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-navy-900">{a?.name ?? "Microsoft account"}</div>
            <div className="truncate text-sm text-slate-500">{a?.email ?? "Address not shared"}</div>
          </div>
          <span className={`ml-auto shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.healthy === false ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {status.healthy === false ? "Needs sign-in" : "Active"}
          </span>
        </div>
        {status.healthy === false ? (
          <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Microsoft ended this sign-in (password change or access removed). Click Switch account to sign in again.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><Inbox className="h-3.5 w-3.5" /> Inbox</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums text-navy-900">{status.inbox ? status.inbox.total.toLocaleString() : "—"}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><Mail className="h-3.5 w-3.5" /> Unread</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums text-navy-900">{status.inbox ? status.inbox.unread.toLocaleString() : "—"}</div>
            </div>
          </div>
        )}
        <Link href="/quotes" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3 text-sm font-medium text-white hover:bg-navy-800">
          See quotes from this inbox <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href="/api/auth/logout?switch=1" className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-navy-900 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Switch account
          </a>
          <a href="/api/auth/logout" className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50">
            <LogOut className="h-4 w-4" /> Disconnect
          </a>
        </div>
      </div>
      <button onClick={onRefresh} className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-navy-900">
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Check connection again
      </button>
    </>
  );
}

function Setup({ status, copied, onCopy, onRetry }: { status: Status; copied: string | null; onCopy: (text: string, key: string) => void; onRetry: () => void }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-navy-900">One-time setup</h1>
      <p className="mt-1.5 text-sm text-slate-500">Register JetBroker with Microsoft once. After that, anyone can connect their Outlook from this page.</p>
      <ol className="mt-6 space-y-4 text-sm">
        <li className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="font-medium text-navy-900">1. Register the app in Azure</div>
          <p className="mt-1 text-slate-600">
            In portal.azure.com, open App registrations, then New registration. Name it JetBroker and choose <em>Accounts in any organizational directory and personal Microsoft accounts</em>. Under Redirect URI pick Web and paste:
          </p>
          <CopyRow label="redirect URI" value={status.redirectUri} copied={copied === "redirect"} onCopy={() => onCopy(status.redirectUri, "redirect")} />
        </li>
        <li className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="font-medium text-navy-900">2. Add permissions and a secret</div>
          <p className="mt-1 text-slate-600">API permissions: Microsoft Graph, Delegated, add <code>Mail.Read</code>, <code>User.Read</code>, <code>offline_access</code>, <code>openid</code>, <code>profile</code>, <code>email</code>. Certificates &amp; secrets: New client secret, copy its Value.</p>
        </li>
        <li className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="font-medium text-navy-900">3. Add the settings in Vercel and redeploy</div>
          <p className="mt-1 text-slate-600">Project Settings, Environment Variables. Still missing:</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {status.missing.map((m) => (
              <li key={m} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">{m}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">CLIENT_ID is the Application (client) ID. CLIENT_SECRET is the secret Value. COOKIE_SECRET is any 64 character hex key.</p>
        </li>
      </ol>
      <button onClick={onRetry} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3 text-sm font-medium text-white hover:bg-navy-800">
        <RefreshCw className="h-4 w-4" /> I&apos;ve added them, check again
      </button>
    </>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <code className="min-w-0 flex-1 truncate text-xs text-navy-900" title={value}>{value}</code>
      <button type="button" onClick={onCopy} className="shrink-0 text-xs font-medium text-navy-700 hover:text-navy-900" aria-label={`Copy ${label}`}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
