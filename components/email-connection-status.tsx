"use client";

import { useEffect, useState } from "react";
import { Mail, MailX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailConnectionStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => setConnected(data.connected))
      .catch(() => setConnected(false));
  }, []);

  if (connected === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking email connection...
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <Mail className="h-4 w-4" />
          Outlook connected — showing live emails
        </div>
        <a href="/api/auth/logout">
          <Button variant="outline" size="sm">
            Disconnect
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MailX className="h-4 w-4" />
        Using demo data
      </div>
      <a href="/api/auth/login">
        <Button variant="outline" size="sm">
          Connect Outlook
        </Button>
      </a>
    </div>
  );
}
