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
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                dateFilter === f.key
                  ? "bg-navy-50 text-navy-700 border border-navy-200"
                  : "text-slate-500 hover:text-slate-600 border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Sort</span>
          {(["date", "route", "quotes", "priceRange", "updated"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-all ${
                sortField === field
                  ? "text-slate-700 bg-slate-50"
                  : "text-slate-400 hover:text-slate-600"
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
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>{filtered.length} trips</span>
        <span className="text-slate-300">|</span>
        <span>{filtered.reduce((s, t) => s + t.quotes.length, 0)} quotes</span>
        {flaggedCount > 0 && (
          <>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 text-amber-700">
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
              className={`group rounded-xl border bg-white hover:bg-slate-50 transition-all p-4 ${
                hasFlags
                  ? "border-amber-200 hover:border-amber-200"
                  : "border-slate-200 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  {/* Plane icon */}
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg border ${
                    hasFlags
                      ? "bg-amber-50 border-amber-200"
                      : "bg-navy-50 border-navy-200"
                  }`}>
                    {hasFlags ? (
                      <svg className="h-4 w-4 text-amber-700" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 1.5L14.5 13H1.5L8 1.5Z" />
                        <path d="M8 6v3" />
                        <circle cx="8" cy="11" r="0.5" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-navy-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
                      </svg>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">
                        {trip.origin}
                      </span>
                      <svg className="h-3 w-3 text-slate-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 6h8M7 3l3 3-3 3" />
                      </svg>
                      <span className="font-semibold text-slate-900 text-sm">
                        {trip.destination}
                      </span>
                      <span className="text-xs text-slate-400">
                        {getIATACode(trip.origin)}/{getIATACode(trip.destination)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-300 bg-slate-50 rounded px-1.5 py-0.5">
                        {trip.tripId}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {trip.originName} to {trip.destinationName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatPriceRange(trip.quotes)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {trip.quotes.length} quote{trip.quotes.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="text-sm text-slate-600">{trip.date}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {formatDistanceToNow(parseISO(trip.lastUpdated), { addSuffix: true })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      hasFlags
                        ? "bg-amber-50 border border-amber-200 text-amber-700"
                        : trip.status === "Closed"
                          ? "bg-navy-50 border border-navy-200 text-navy-700"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    }`}>
                      {hasFlags ? "Review" : trip.status === "Closed" ? "Booked" : trip.status}
                    </span>
                    <svg className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {sorted.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <svg className="h-8 w-8 text-slate-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-6l-2 3h-4l-2-3H2" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
            </svg>
            <p className="text-sm text-slate-400">No trips match this filter.</p>
          </div>
        )}
      </div>

      {/* Unmatched emails — collapsible "Needs Review" section */}
      {unmatched.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50">
          <button
            onClick={() => setUnmatchedOpen(!unmatchedOpen)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 border border-red-200">
                <svg className="h-3.5 w-3.5 text-red-700" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 5v3.5" />
                  <circle cx="8" cy="11" r="0.5" fill="currentColor" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-red-700">
                  {unmatched.length} Untracked Email{unmatched.length !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-red-700 ml-2">
                  Could not parse route or date
                </span>
              </div>
            </div>
            <svg
              className={`h-4 w-4 text-red-700 transition-transform ${unmatchedOpen ? "rotate-180" : ""}`}
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
                  className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <svg className="h-3.5 w-3.5 text-red-700 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
                      <path d="M1.5 5.5L8 9.5l6.5-4" />
                    </svg>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-700 truncate block">
                        {u.email.subject}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        from {u.email.fromName} &middot; {formatDistanceToNow(parseISO(u.email.receivedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-red-700 bg-red-50 rounded px-2 py-0.5 shrink-0 ml-3">
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
