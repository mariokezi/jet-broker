"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { formatDistanceToNow, parseISO, isToday, isYesterday, subDays, isAfter } from "date-fns";
import type { Trip, UnmatchedEmail } from "@/lib/types";
import { formatPriceRange, getIATACode } from "@/lib/format-utils";

type DateFilter = "all" | "today" | "yesterday" | "week";
type SortField = "date" | "route" | "quotes" | "priceRange" | "updated";
type SortDir = "asc" | "desc";

interface TripOverviewTableProps {
  trips: Trip[];
  unmatched: UnmatchedEmail[];
}

export function TripOverviewTable({ trips, unmatched }: TripOverviewTableProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);

  // Date filter logic — filters by when the email was received (lastUpdated)
  const filtered = useMemo(() => {
    if (dateFilter === "all") return trips;
    return trips.filter((trip) => {
      const received = parseISO(trip.lastUpdated);
      switch (dateFilter) {
        case "today":
          return isToday(received);
        case "yesterday":
          return isYesterday(received);
        case "week":
          return isAfter(received, subDays(new Date(), 7));
        default:
          return true;
      }
    });
  }, [trips, dateFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "route":
          return `${a.origin}${a.destination}`.localeCompare(`${b.origin}${b.destination}`) * dir;
        case "date":
          return a.date.localeCompare(b.date) * dir;
        case "quotes":
          return (a.quotes.length - b.quotes.length) * dir;
        case "priceRange": {
          const aMin = Math.min(...a.quotes.map((q) => q.price ?? Infinity));
          const bMin = Math.min(...b.quotes.map((q) => q.price ?? Infinity));
          return (aMin - bMin) * dir;
        }
        case "updated":
          return a.lastUpdated.localeCompare(b.lastUpdated) * dir;
        default:
          return 0;
      }
    });
  }, [filtered, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filters: { key: DateFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "week", label: "Last 7 Days" },
  ];

  // Count quotes with missing critical data (has external link but no price extracted)
  const flaggedCount = trips.reduce((sum, t) =>
    sum + t.quotes.filter((q) => q.quoteSource === "external" && q.price === null).length, 0
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-0.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                dateFilter === f.key
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/20"
                  : "text-white/40 hover:text-white/60 border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/25 uppercase tracking-wider">Sort</span>
          {(["date", "route", "quotes", "priceRange", "updated"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-all ${
                sortField === field
                  ? "text-white/70 bg-white/[0.05]"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {field === "priceRange" ? "Price" : field === "updated" ? "Updated" : field.charAt(0).toUpperCase() + field.slice(1)}
              {sortField === field && (
                <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor">
                  {sortDir === "asc" ? (
                    <path d="M5 2L9 8H1L5 2Z" />
                  ) : (
                    <path d="M5 8L1 2H9L5 8Z" />
                  )}
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center gap-3 text-xs text-white/30">
        <span>{filtered.length} trips</span>
        <span className="text-white/10">|</span>
        <span>{filtered.reduce((s, t) => s + t.quotes.length, 0)} quotes</span>
        {flaggedCount > 0 && (
          <>
            <span className="text-white/10">|</span>
            <span className="flex items-center gap-1 text-amber-400/70">
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1.5L14.5 13H1.5L8 1.5Z" />
                <path d="M8 6v3" />
                <circle cx="8" cy="11" r="0.5" fill="currentColor" />
              </svg>
              {flaggedCount} needs review
            </span>
          </>
        )}
      </div>

      {/* Trip cards */}
      <div className="grid gap-2">
        {sorted.map((trip) => {
          const hasFlags = trip.quotes.some((q) => q.quoteSource === "external" && q.price === null);
          return (
            <Link
              key={trip.tripId}
              href={`/trip/${trip.tripId}`}
              className={`group rounded-xl border bg-white/[0.02] hover:bg-white/[0.05] transition-all p-4 ${
                hasFlags
                  ? "border-amber-500/20 hover:border-amber-500/30"
                  : "border-white/5 hover:border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  {/* Plane icon */}
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg border ${
                    hasFlags
                      ? "bg-amber-600/10 border-amber-500/15"
                      : "bg-blue-600/10 border-blue-500/10"
                  }`}>
                    {hasFlags ? (
                      <svg className="h-4 w-4 text-amber-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 1.5L14.5 13H1.5L8 1.5Z" />
                        <path d="M8 6v3" />
                        <circle cx="8" cy="11" r="0.5" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
                      </svg>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">
                        {trip.origin}
                      </span>
                      <svg className="h-3 w-3 text-white/25" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 6h8M7 3l3 3-3 3" />
                      </svg>
                      <span className="font-semibold text-white text-sm">
                        {trip.destination}
                      </span>
                      <span className="text-xs text-white/25">
                        {getIATACode(trip.origin)}/{getIATACode(trip.destination)}
                      </span>
                      <span className="text-[10px] font-mono text-white/15 bg-white/[0.04] rounded px-1.5 py-0.5">
                        {trip.tripId}
                      </span>
                    </div>
                    <div className="text-xs text-white/35 mt-0.5">
                      {trip.originName} to {trip.destinationName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {formatPriceRange(trip.quotes)}
                    </div>
                    <div className="text-xs text-white/35 mt-0.5">
                      {trip.quotes.length} quote{trip.quotes.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="text-sm text-white/50">{trip.date}</div>
                    <div className="text-xs text-white/25 mt-0.5">
                      {formatDistanceToNow(parseISO(trip.lastUpdated), { addSuffix: true })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      hasFlags
                        ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                        : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    }`}>
                      {hasFlags ? "Review" : trip.status}
                    </span>
                    <svg className="h-4 w-4 text-white/15 group-hover:text-white/40 transition-colors" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {sorted.length === 0 && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
            <svg className="h-8 w-8 text-white/15 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-6l-2 3h-4l-2-3H2" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
            </svg>
            <p className="text-sm text-white/30">No trips match this filter.</p>
          </div>
        )}
      </div>

      {/* Unmatched emails — collapsible "Needs Review" section */}
      {unmatched.length > 0 && (
        <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03]">
          <button
            onClick={() => setUnmatchedOpen(!unmatchedOpen)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/15">
                <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 5v3.5" />
                  <circle cx="8" cy="11" r="0.5" fill="currentColor" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-red-300">
                  {unmatched.length} Untracked Email{unmatched.length !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-red-300/40 ml-2">
                  Could not parse route or date
                </span>
              </div>
            </div>
            <svg
              className={`h-4 w-4 text-red-400/50 transition-transform ${unmatchedOpen ? "rotate-180" : ""}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>

          {unmatchedOpen && (
            <div className="px-4 pb-4 space-y-1">
              {unmatched.map((u) => (
                <div
                  key={u.email.id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <svg className="h-3.5 w-3.5 text-red-400/50 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
                      <path d="M1.5 5.5L8 9.5l6.5-4" />
                    </svg>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-white/70 truncate block">
                        {u.email.subject}
                      </span>
                      <span className="text-[11px] text-white/30">
                        from {u.email.fromName} &middot; {formatDistanceToNow(parseISO(u.email.receivedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-red-300/50 bg-red-500/10 rounded px-2 py-0.5 shrink-0 ml-3">
                    {u.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
