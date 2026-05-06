import { MessageCircle, Clock } from "lucide-react";

export function StatusBadge({ status }: { status: "Accepted" | "Unanswered" }) {
  if (status === "Accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
        <MessageCircle className="h-3 w-3" />
        Accepted
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-xs font-medium text-white/50">
      <Clock className="h-3 w-3" />
      Unanswered
    </span>
  );
}
