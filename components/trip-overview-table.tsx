"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { Trip, UnmatchedEmail } from "@/lib/types";
import { formatPriceRange, getIATACode } from "@/lib/trip-builder";
import { ArrowUpDown, Plane, AlertTriangle } from "lucide-react";
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

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 text-xs"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader field="tripId">Trip ID</SortHeader>
              <SortHeader field="route">Route</SortHeader>
              <SortHeader field="date">Date</SortHeader>
              <SortHeader field="quotes">Quotes</SortHeader>
              <SortHeader field="priceRange">Price Range</SortHeader>
              <SortHeader field="updated">Updated</SortHeader>
              <SortHeader field="status">Status</SortHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((trip) => (
              <TableRow key={trip.tripId} className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <Link
                    href={`/trip/${trip.tripId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {trip.tripId}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">
                      {trip.origin} → {trip.destination}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({getIATACode(trip.origin)}→{getIATACode(trip.destination)})
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{trip.date}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    {trip.quotes.length}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-sm">
                  {formatPriceRange(trip.quotes)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(parseISO(trip.lastUpdated), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 font-normal"
                  >
                    {trip.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Unmatched emails section */}
      <div className="rounded-md border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Unmatched Emails ({unmatched.length})
        </div>
        {unmatched.length > 0 ? (
          <div className="mt-3 space-y-2">
            {unmatched.map((u) => (
              <div
                key={u.email.id}
                className="text-sm flex justify-between items-center py-2 border-b last:border-b-0"
              >
                <div>
                  <span className="font-medium">{u.email.subject}</span>
                  <span className="text-muted-foreground ml-2">from {u.email.fromName}</span>
                </div>
                <span className="text-xs text-muted-foreground">{u.reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">
            All emails were successfully matched to trips.
          </p>
        )}
      </div>
    </div>
  );
}
