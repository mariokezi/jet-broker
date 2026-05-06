"use client";

import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { Trip, UnmatchedEmail } from "@/lib/types";
import { formatPriceRange, getIATACode } from "@/lib/format-utils";
import { ArrowUpDown, Plane, AlertTriangle, ChevronRight } from "lucide-react";
import { useState } from "react";

type SortField = "tripId" | "route" | "date" | "quotes" | "priceRange" | "updated" | "status";
type SortDir = "asc" | "desc";

interface TripOverviewTableProps {
  trips: Trip[];
  unmatched: UnmatchedEmail[];
}

export function TripOverviewTable({ trips, unmatched }: TripOverviewTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = [...trips].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "tripId":
        return a.tripId.localeCompare(b.tripId) * dir;
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
      case "status":
        return a.status.localeCompare(b.status) * dir;
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-6">
      {/* Trip cards */}
      <div className="grid gap-3">
        {sorted.map((trip) => (
          <Link
            key={trip.tripId}
            href={`/trip/${trip.tripId}`}
            className="group rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/10">
                  <Plane className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">
                      {trip.origin} → {trip.destination}
                    </span>
                    <span className="text-xs text-white/30">
                      {getIATACode(trip.origin)}→{getIATACode(trip.destination)}
                    </span>
                    <span className="text-[10px] font-mono text-white/20 bg-white/5 rounded px-1.5 py-0.5">
                      {trip.tripId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                    <span>{trip.originName} to {trip.destinationName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">
                    {formatPriceRange(trip.quotes)}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">
                    {trip.quotes.length} quotes
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <div className="text-sm text-white/60">{trip.date}</div>
                  <div className="text-xs text-white/30 mt-0.5">
                    {formatDistanceToNow(parseISO(trip.lastUpdated), { addSuffix: true })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    {trip.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Unmatched emails section */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-white/60">
          <AlertTriangle className="h-4 w-4 text-amber-400/60" />
          Unmatched Emails ({unmatched.length})
        </div>
        {unmatched.length > 0 ? (
          <div className="mt-3 space-y-2">
            {unmatched.map((u) => (
              <div
                key={u.email.id}
                className="text-sm flex justify-between items-center py-2 border-b border-white/5 last:border-b-0"
              >
                <div>
                  <span className="font-medium text-white/80">{u.email.subject}</span>
                  <span className="text-white/30 ml-2">from {u.email.fromName}</span>
                </div>
                <span className="text-xs text-white/30">{u.reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/30 mt-1">
            All emails matched to trips.
          </p>
        )}
      </div>
    </div>
  );
}
