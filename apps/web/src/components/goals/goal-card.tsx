import Link from "next/link";
import { getDaysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  name: string;
  description: string | null;
  color: string;
  targetAmount: number;
  savedAmount: number;
  deadline: Date | null;
  status: string;
}

interface Props {
  goal: Goal;
  actions?: React.ReactNode;
}

export function GoalCard({ goal, actions }: Props) {
  const pct = goal.targetAmount > 0 ? Math.min(Math.round((goal.savedAmount / goal.targetAmount) * 100), 100) : 0;
  const daysLeft = getDaysUntil(goal.deadline);

  return (
    <Link href={`/goals/${goal.id}`} className="block group">
      <div className="bg-card border border-border/70 rounded-2xl p-5 hover:border-border hover:shadow-sm transition-all h-full flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {goal.name}
            </h3>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{goal.description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-0.5 shrink-0 -mt-1" onClick={(e) => e.preventDefault()}>
              {actions}
            </div>
          )}
          <span
            className="text-sm font-bold tabnum shrink-0 mt-0.5"
            style={{ color: goal.color }}
          >
            {pct}%
          </span>
        </div>

        {/* Amounts */}
        <div className="space-y-1 flex-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Saved</span>
            <span className="font-semibold text-foreground tabnum">
              Rs {(goal.savedAmount / 100).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Target</span>
            <span className="text-muted-foreground tabnum">
              Rs {(goal.targetAmount / 100).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress + deadline */}
        <div>
          {daysLeft !== null && (
            <p className={cn(
              "text-[11px] font-medium mb-1.5",
              daysLeft < 0 ? "text-red-500" : daysLeft < 30 ? "text-amber-500" : "text-muted-foreground/70"
            )}>
              {daysLeft < 0 ? "Overdue" : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
            </p>
          )}
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: goal.color }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
