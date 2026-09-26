import { MessageCircle, Clock, Star, XCircle } from "lucide-react";

export function StatusBadge({ status }: { status: "Accepted" | "Unanswered" | "Shortlisted" | "Declined" }) {
  if (status === "Accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
        <MessageCircle className="h-3 w-3" />
        Accepted
      </span>
    );
  }

  if (status === "Shortlisted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
        <Star className="h-3 w-3" />
        Proposed
      </span>
    );
  }

  if (status === "Declined") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-xs font-medium text-white/40">
        <XCircle className="h-3 w-3" />
        Declined
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-xs font-medium text-white/50">
      <Clock className="h-3 w-3" />
      New
    </span>
  );
}
