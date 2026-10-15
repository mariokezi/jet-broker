import { MessageCircle, Clock, Star, XCircle } from "lucide-react";

export function StatusBadge({ status }: { status: "Accepted" | "Unanswered" | "Shortlisted" | "Declined" }) {
  if (status === "Accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <MessageCircle className="h-3 w-3" />
        Accepted
      </span>
    );
  }

  if (status === "Shortlisted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 border border-navy-200 px-2 py-0.5 text-xs font-medium text-navy-700">
        <Star className="h-3 w-3" />
        Proposed
      </span>
    );
  }

  if (status === "Declined") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
        <XCircle className="h-3 w-3" />
        Declined
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
      <Clock className="h-3 w-3" />
      New
    </span>
  );
}
