"use client";

import { useState, useMemo } from "react";
import { format, parseISO, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { StatusBadge } from "./status-badge";
import { EmailDrawer } from "./email-drawer";
import type { ParsedQuote, QuoteDecision } from "@/lib/types";

type SortField =
  | "status"
  | "price"
  | "aircraft"
  | "maxPax"
  | "yom"
  | "refurb"
  | "totalHours"
  | "operator"
  | "updated"
  | "faa"
  | "value";

type SortDir = "asc" | "desc";
type DateFilter = "all" | "today" | "yesterday" | "week";

interface QuoteDetailTableProps {
  quotes: ParsedQuote[];
  selected?: Set<string>;
  onToggleSelect?: (quote: ParsedQuote) => void;
  decisions?: Record<string, QuoteDecision>;
  valueScores?: Map<string, number>;
  onBook?: (quote: ParsedQuote) => void;
  newIds?: Set<string>;
}

function faaUrl(tailNumber: string): string {
  return `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${tailNumber.replace(/^N/, "")}`;
}

function SortHeader({
  field,
  children,
  className,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  children: React.ReactNode;
  className?: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  return (
    <th
      className={`cursor-pointer select-none px-3 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors whitespace-nowrap ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <svg className={`h-3 w-3 ${sortField === field ? "opacity-70" : "opacity-25"}`} viewBox="0 0 12 12" fill="currentColor">
          {sortField === field && sortDir === "desc" ? (
            <path d="M6 9L2 4h8L6 9Z" />
          ) : sortField === field && sortDir === "asc" ? (
            <path d="M6 3L10 8H2L6 3Z" />
          ) : (
            <>
              <path d="M6 2L9 5.5H3L6 2Z" />
              <path d="M6 10L3 6.5H9L6 10Z" />
            </>
          )}
        </svg>
      </div>
    </th>
  );
}

export function QuoteDetailTable({ quotes, selected, onToggleSelect, decisions, valueScores, onBook, newIds }: QuoteDetailTableProps) {
  const [sortField, setSortField] = useState<SortField>("price");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedQuote, setSelectedQuote] = useState<ParsedQuote | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const dateFiltered = useMemo(() => {
    if (dateFilter === "all") return quotes;
    return quotes.filter((q) => {
      const received = parseISO(q.receivedAt);
      switch (dateFilter) {
        case "today": return isToday(received);
        case "yesterday": return isYesterday(received);
        case "week": return isAfter(received, subDays(new Date(), 7));
        default: return true;
      }
    });
  }, [quotes, dateFilter]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return dateFiltered;
    const term = filter.toLowerCase();
    return dateFiltered.filter(
      (q) =>
        (q.aircraft?.toLowerCase().includes(term)) ||
        (q.operator?.toLowerCase().includes(term)) ||
        (q.tailNumber?.toLowerCase().includes(term))
    );
  }, [dateFiltered, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "price":
          return ((a.price ?? Infinity) - (b.price ?? Infinity)) * dir;
        case "aircraft":
          return (a.aircraft ?? "zzz").localeCompare(b.aircraft ?? "zzz") * dir;
        case "maxPax":
          return ((a.maxPax ?? 0) - (b.maxPax ?? 0)) * dir;
        case "yom":
          return ((a.yom ?? 0) - (b.yom ?? 0)) * dir;
        case "refurb":
          return (a.refurbInterior ?? "0").localeCompare(b.refurbInterior ?? "0") * dir;
        case "totalHours":
          return ((a.totalHours ?? 0) - (b.totalHours ?? 0)) * dir;
        case "operator":
          return (a.operator ?? "zzz").localeCompare(b.operator ?? "zzz") * dir;
        case "updated":
          return a.receivedAt.localeCompare(b.receivedAt) * dir;
        case "faa":
          return (a.tailNumber ?? "zzz").localeCompare(b.tailNumber ?? "zzz") * dir;
        case "value":
          return ((valueScores?.get(a.emailId) ?? -1) - (valueScores?.get(b.emailId) ?? -1)) * dir;
        default:
          return 0;
      }
    });
  }, [filtered, sortField, sortDir, valueScores]);

  const bestValueId = useMemo(() => {
    if (!valueScores || valueScores.size === 0) return null;
    return [...valueScores.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }, [valueScores]);

  function handleRowClick(quote: ParsedQuote) {
    setSelectedQuote(quote);
    setDrawerOpen(true);
  }

  function isFlagged(q: ParsedQuote): boolean {
    return q.quoteSource === "external" && q.price === null;
  }

  const flaggedCount = filtered.filter(isFlagged).length;

  const dateFilters: { key: DateFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "week", label: "7 Days" },
  ];

  const sortProps = { sortField, sortDir, onSort: toggleSort };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date filter pills */}
        <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-0.5">
          {dateFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                dateFilter === f.key
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/20"
                  : "text-white/40 hover:text-white/60 border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="7" r="5" />
            <path d="M14 14l-3.5-3.5" />
          </svg>
          <input
            placeholder="Filter aircraft, operator, tail..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-lg border border-white/8 bg-white/[0.03] pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-xs text-white/30 ml-auto">
          <span>{filtered.length} quotes</span>
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400/70">
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1.5L14.5 13H1.5L8 1.5Z" />
                <path d="M8 6v3" />
                <circle cx="8" cy="11" r="0.5" fill="currentColor" />
              </svg>
              {flaggedCount} unresolved
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                {onToggleSelect && <th className="w-8 px-3 py-3" aria-label="Select for proposal" />}
                <SortHeader {...sortProps} field="status">Status</SortHeader>
                <SortHeader {...sortProps} field="price">Price</SortHeader>
                {valueScores && <SortHeader {...sortProps} field="value">Value</SortHeader>}
                <SortHeader {...sortProps} field="aircraft">Aircraft</SortHeader>
                <SortHeader {...sortProps} field="maxPax">PAX</SortHeader>
                <SortHeader {...sortProps} field="yom">YOM</SortHeader>
                <SortHeader {...sortProps} field="refurb">Refurb</SortHeader>
                <SortHeader {...sortProps} field="totalHours">Hours</SortHeader>
                <SortHeader {...sortProps} field="operator">Seller</SortHeader>
                <SortHeader {...sortProps} field="updated">Received</SortHeader>
                <SortHeader {...sortProps} field="faa">FAA</SortHeader>
                {onBook && <th className="px-3 py-3" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((quote) => {
                const flagged = isFlagged(quote);
                const decision = decisions?.[quote.emailId];
                const isSelected = selected?.has(quote.emailId) ?? false;
                const score = valueScores?.get(quote.emailId);
                return (
                  <tr
                    key={quote.emailId}
                    className={`border-b border-white/[0.03] cursor-pointer group transition-colors ${
                      newIds?.has(quote.emailId) ? "animate-in fade-in slide-in-from-top-1 duration-500 " : ""
                    }${
                      decision === "Declined"
                        ? "opacity-40 hover:opacity-70"
                        : isSelected
                          ? "bg-blue-500/[0.07] hover:bg-blue-500/[0.1]"
                          : flagged
                            ? "hover:bg-amber-500/[0.04] bg-amber-500/[0.02]"
                            : "hover:bg-white/[0.03]"
                    }`}
                    onClick={() => handleRowClick(quote)}
                  >
                    {onToggleSelect && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={quote.price === null}
                          onChange={() => onToggleSelect(quote)}
                          className="h-4 w-4 accent-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          aria-label={`Add ${quote.aircraft ?? "quote"} to proposal`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={decision ?? quote.status} />
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-sm text-white">
                      {quote.quoteSource === "external" ? (
                        <div className="flex items-center gap-1.5">
                          {flagged && (
                            <svg className="h-3.5 w-3.5 text-amber-400 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 1.5L14.5 13H1.5L8 1.5Z" />
                              <path d="M8 6v3" />
                              <circle cx="8" cy="11" r="0.5" fill="currentColor" />
                            </svg>
                          )}
                          <a
                            href={quote.externalLink ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 8.5v4a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 2 12.5v-7A1.5 1.5 0 0 1 3.5 4H8" />
                              <path d="M10 2h4v4" />
                              <path d="M7 9L14 2" />
                            </svg>
                            Portal
                          </a>
                        </div>
                      ) : quote.priceFormatted ? (
                        quote.priceFormatted
                      ) : (
                        <span className="text-white/20">&mdash;</span>
                      )}
                    </td>
                    {valueScores && (
                      <td className="px-3 py-3">
                        {score !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-12 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden>
                              <div className="h-full rounded-full bg-blue-400/80" style={{ width: `${score}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-white/55">{score}</span>
                            {quote.emailId === bestValueId && (
                              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 whitespace-nowrap">Best value</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-white/20">&mdash;</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <span className="text-blue-400 text-sm font-medium whitespace-nowrap">
                        {quote.aircraft ?? <span className="text-white/20">&mdash;</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-white/60">
                      {quote.maxPax ?? <span className="text-white/20">&mdash;</span>}
                    </td>
                    <td className="px-3 py-3 text-sm text-white/60">
                      {quote.yom ?? <span className="text-white/20">&mdash;</span>}
                    </td>
                    <td className="px-3 py-3 text-sm text-white/60">
                      {quote.refurbInterior || quote.refurbExterior ? (
                        `${quote.refurbInterior ?? "\u2014"}/${quote.refurbExterior ?? "\u2014"}`
                      ) : (
                        <span className="text-white/20">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-white/60">
                      {quote.totalHours ? (
                        `${quote.totalHours.toLocaleString()}`
                      ) : (
                        <span className="text-white/20">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-white/60">
                        {quote.operator ?? <span className="text-white/20">&mdash;</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-white/40 text-sm tabular-nums">
                      {format(parseISO(quote.receivedAt), "MM/dd HH:mm")}
                    </td>
                    <td className="px-3 py-3">
                      {quote.tailNumber ? (
                        <a
                          href={faaUrl(quote.tailNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/30 hover:text-blue-400 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title={`FAA: ${quote.tailNumber}`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 8.5v4a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 2 12.5v-7A1.5 1.5 0 0 1 3.5 4H8" />
                            <path d="M10 2h4v4" />
                            <path d="M7 9L14 2" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-white/20">&mdash;</span>
                      )}
                    </td>
                    {onBook && (
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {decision === "Accepted" ? (
                          <span className="text-xs text-emerald-400">Booked</span>
                        ) : quote.price !== null ? (
                          <button
                            onClick={() => onBook(quote)}
                            className="rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/60 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
                          >
                            Book
                          </button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center text-white/30 py-12">
                    No quotes match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmailDrawer
        quote={selectedQuote}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
