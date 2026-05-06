"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ExternalLink, X, Search, Link as LinkIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { AircraftThumbnail } from "./aircraft-thumbnail";
import { StatusBadge } from "./status-badge";
import { EmailDrawer } from "./email-drawer";
import type { ParsedQuote } from "@/lib/types";

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
  | "faa";

type SortDir = "asc" | "desc";

interface QuoteDetailTableProps {
  quotes: ParsedQuote[];
}

function faaUrl(tailNumber: string): string {
  return `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${tailNumber.replace(/^N/, "")}`;
}

export function QuoteDetailTable({ quotes }: QuoteDetailTableProps) {
  const [sortField, setSortField] = useState<SortField>("price");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState("");
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

  const filtered = useMemo(() => {
    if (!filter.trim()) return quotes;
    const term = filter.toLowerCase();
    return quotes.filter(
      (q) =>
        (q.aircraft?.toLowerCase().includes(term)) ||
        (q.operator?.toLowerCase().includes(term)) ||
        (q.tailNumber?.toLowerCase().includes(term))
    );
  }, [quotes, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "status":
          return (a.status.localeCompare(b.status)) * dir;
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
        default:
          return 0;
      }
    });
  }, [filtered, sortField, sortDir]);

  function handleRowClick(quote: ParsedQuote) {
    setSelectedQuote(quote);
    setDrawerOpen(true);
  }

  const SortHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`cursor-pointer select-none px-3 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors whitespace-nowrap ${className ?? ""}`}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      </div>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input
          placeholder="Filter by aircraft, operator, or tail..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <SortHeader field="status">Status</SortHeader>
                <SortHeader field="price">Price</SortHeader>
                <SortHeader field="aircraft">Aircraft</SortHeader>
                <SortHeader field="maxPax">Max PAX</SortHeader>
                <SortHeader field="yom">YOM</SortHeader>
                <SortHeader field="refurb">Refurb (I/E)</SortHeader>
                <SortHeader field="totalHours">Tot.</SortHeader>
                <SortHeader field="operator">Seller</SortHeader>
                <SortHeader field="updated">Updated</SortHeader>
                <SortHeader field="faa">FAA</SortHeader>
                <th className="w-10 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((quote) => (
                <tr
                  key={quote.emailId}
                  className="border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.03] group transition-colors"
                  onClick={() => handleRowClick(quote)}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <AircraftThumbnail className="h-6 w-10 text-white/20 hidden sm:block" />
                      <StatusBadge status={quote.status} />
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold text-sm text-white">
                    {quote.quoteSource === "external" ? (
                      <a
                        href={quote.externalLink ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        View Portal
                      </a>
                    ) : quote.priceFormatted ? (
                      quote.priceFormatted
                    ) : (
                      <span className="text-white/20">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-blue-400 text-sm font-medium">
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
                      `${quote.totalHours.toLocaleString()} hrs`
                    ) : (
                      <span className="text-white/20">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-blue-400 text-sm font-medium">
                      {quote.operator ?? <span className="text-white/20">&mdash;</span>}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-white/40 text-sm">
                    {format(parseISO(quote.receivedAt), "MM/dd/yy")}
                  </td>
                  <td className="px-3 py-3">
                    {quote.tailNumber ? (
                      <a
                        href={faaUrl(quote.tailNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/30 hover:text-blue-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title={`FAA Registry: ${quote.tailNumber}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-white/20">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      title="Cancel quote"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center text-white/30 py-12">
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
