"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
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
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 text-xs whitespace-nowrap ${className ?? ""}`}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by aircraft, operator, or tail number..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableHead className="text-xs w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((quote) => (
              <TableRow
                key={quote.emailId}
                className="cursor-pointer hover:bg-muted/30 group"
                onClick={() => handleRowClick(quote)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <AircraftThumbnail className="h-6 w-10 text-muted-foreground hidden sm:block" />
                    <StatusBadge status={quote.status} />
                  </div>
                </TableCell>
                <TableCell className="font-semibold text-sm">
                  {quote.quoteSource === "external" ? (
                    <a
                      href={quote.externalLink ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      View Portal
                    </a>
                  ) : quote.priceFormatted ? (
                    quote.priceFormatted
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-blue-600 text-sm font-medium">
                    {quote.aircraft ?? <span className="text-muted-foreground">&mdash;</span>}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {quote.maxPax ?? <span className="text-muted-foreground">&mdash;</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {quote.yom ?? <span className="text-muted-foreground">&mdash;</span>}
                </TableCell>
                <TableCell className="text-sm">
                  {quote.refurbInterior || quote.refurbExterior ? (
                    `${quote.refurbInterior ?? "—"}/${quote.refurbExterior ?? "—"}`
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {quote.totalHours ? (
                    `${quote.totalHours.toLocaleString()} hrs`
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-blue-600 text-sm font-medium">
                    {quote.operator ?? <span className="text-muted-foreground">&mdash;</span>}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(parseISO(quote.receivedAt), "MM/dd/yy")}
                </TableCell>
                <TableCell>
                  {quote.tailNumber ? (
                    <a
                      href={faaUrl(quote.tailNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                      title={`FAA Registry: ${quote.tailNumber}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Cancel action placeholder
                    }}
                    title="Cancel quote"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  No quotes match your filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <EmailDrawer
        quote={selectedQuote}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
