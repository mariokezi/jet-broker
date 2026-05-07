"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import type { ParsedQuote } from "@/lib/types";

interface EmailDrawerProps {
  quote: ParsedQuote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function openAttachment(url: string, filename: string) {
  // Handle base64 data URIs by converting to blob
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    const mimeType = match[1];
    const base64 = match[2];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  } else {
    window.open(url, "_blank");
  }
}

export function EmailDrawer({ quote, open, onOpenChange }: EmailDrawerProps) {
  if (!quote) return null;

  const faaUrl = quote.tailNumber
    ? `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${quote.tailNumber.replace(/^N/, "")}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-slate-900 border-white/10">
        <SheetHeader>
          <SheetTitle className="text-left text-sm font-medium leading-tight pr-4 text-white">
            {quote.subject}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-white/40">From</span>
              <span className="font-medium text-white/80">{quote.fromName} &lt;{quote.from}&gt;</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Received</span>
              <span className="text-white/60">{format(parseISO(quote.receivedAt), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
          </div>

          <div className="border-t border-white/5" />

          {quote.attachments.length > 0 && (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium text-white/30 uppercase tracking-wide">Attachments</p>
                {quote.attachments.map((att) => (
                  <button
                    key={att.filename}
                    onClick={() => openAttachment(att.url, att.filename)}
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13.5 7.5l-5.3 5.3a3.5 3.5 0 0 1-5-5L9 2a2.33 2.33 0 0 1 3.3 3.3L6.5 11a1.17 1.17 0 0 1-1.6-1.6L10.5 4" />
                    </svg>
                    {att.filename}
                    <svg className="h-3 w-3 opacity-50" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 8.5v4a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 2 12.5v-7A1.5 1.5 0 0 1 3.5 4H8" />
                      <path d="M10 2h4v4" />
                      <path d="M7 9L14 2" />
                    </svg>
                  </button>
                ))}
              </div>
              <div className="border-t border-white/5" />
            </>
          )}

          <ScrollArea className="h-[calc(100vh-280px)]">
            {quote.bodyType === "html" ? (
              <div
                className="prose prose-sm prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: quote.body }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/70">
                {quote.body}
              </pre>
            )}
          </ScrollArea>

          {faaUrl && (
            <>
              <div className="border-t border-white/5" />
              <a
                href={faaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-fit"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8.5v4a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 2 12.5v-7A1.5 1.5 0 0 1 3.5 4H8" />
                  <path d="M10 2h4v4" />
                  <path d="M7 9L14 2" />
                </svg>
                View on FAA Registry ({quote.tailNumber})
              </a>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
