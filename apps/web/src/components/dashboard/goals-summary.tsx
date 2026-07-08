import Link from "next/link";
import { getDaysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  savedAmount: number;
  deadline: Date | null;
  priority: string;
}

export function GoalsSummary({ goals, baseSymbol = "Rs" }: { goals: Goal[]; baseSymbol?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Active Goals</h3>
        <Link href="/goals" className="text-xs text-primary hover:underline">View all</Link>
      </div>

      {goals.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          No active goals.{" "}
          <Link href="/goals" className="text-primary hover:underline">Create one</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const pct = goal.targetAmount > 0 ? Math.min(Math.round((goal.savedAmount / goal.targetAmount) * 100), 100) : 0;
            const daysLeft = getDaysUntil(goal.deadline);
            return (
              <Link key={goal.id} href={`/goals/${goal.id}`} className="block group">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: goal.color }}
                  >
                    {pct}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{goal.name}</span>
                      {daysLeft !== null && (
                        <span className={cn("text-xs shrink-0 ml-2", daysLeft < 30 ? "text-red-500" : "text-muted-foreground")}>
                          {daysLeft > 0 ? `${daysLeft}d left` : "Overdue"}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: goal.color }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{baseSymbol} {(goal.savedAmount / 100).toLocaleString()}</span>
                      <span>{baseSymbol} {(goal.targetAmount / 100).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
