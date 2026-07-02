import { Circle, CircleDot, Eye, CheckCircle2 } from "lucide-react";

export function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "IN_PROGRESS": return <CircleDot className="h-5 w-5 text-blue-500" />;
    case "REVIEW": return <Eye className="h-5 w-5 text-amber-500" />;
    case "DONE": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    default: return <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />;
  }
}
