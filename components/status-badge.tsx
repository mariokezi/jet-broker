import { Badge } from "@/components/ui/badge";
import { MessageCircle, Clock } from "lucide-react";

export function StatusBadge({ status }: { status: "Accepted" | "Unanswered" }) {
  if (status === "Accepted") {
    return (
      <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1 font-normal">
        <MessageCircle className="h-3 w-3" />
        Accepted
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <Clock className="h-3 w-3" />
      Unanswered
    </Badge>
  );
}
