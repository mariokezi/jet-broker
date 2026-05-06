"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Paperclip } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ParsedQuote } from "@/lib/types";

interface EmailDrawerProps {
  quote: ParsedQuote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailDrawer({ quote, open, onOpenChange }: EmailDrawerProps) {
  if (!quote) return null;

  const faaUrl = quote.tailNumber
    ? `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${quote.tailNumber.replace(/^N/, "")}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-left text-sm font-medium leading-tight pr-4">
            {quote.subject}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">From</span>
              <span className="font-medium">{quote.fromName} &lt;{quote.from}&gt;</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Received</span>
              <span>{format(parseISO(quote.receivedAt), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
          </div>

          <Separator />

          {quote.attachments.length > 0 && (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachments</p>
                {quote.attachments.map((att) => (
                  <a
                    key={att.filename}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {att.filename}
                  </a>
                ))}
              </div>
              <Separator />
            </>
          )}

          <ScrollArea className="h-[calc(100vh-280px)]">
            {quote.bodyType === "html" ? (
              <div
                className="prose prose-sm max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: quote.body }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                {quote.body}
              </pre>
            )}
          </ScrollArea>

          {faaUrl && (
            <>
              <Separator />
              <a
                href={faaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors w-fit"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on FAA Registry ({quote.tailNumber})
              </a>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
