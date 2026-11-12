import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FlowStep { id: string; label: string; done: boolean; enabled: boolean }

/**
 * 流程进度条：一眼看出走到哪一步、下一步该做什么。
 * 步骤可点（滚到对应区块）；还没到的步骤置灰不可点。桌面端吸顶，手机上不吸顶（屏幕太矮）。
 */
export function FlowProgress({ label, steps, current, nextLabel, hint, action, onSelect }: {
  label: string;
  steps: FlowStep[];
  /** 当前步的下标；全部完成时等于 steps.length */
  current: number;
  nextLabel: string;
  hint: string;
  action?: { label: string; onClick: () => void } | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label={label} className="rounded-2xl border border-border/70 bg-background/90 px-4 py-3 shadow-sm backdrop-blur-xl md:sticky md:top-[4.5rem] md:z-30">
      <ol className="flex items-center gap-1.5 sm:gap-2.5">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          return (
            <li key={step.id} className={cn("flex items-center gap-1.5 sm:gap-2.5", index < steps.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!step.enabled}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(step.id)}
                className="flex shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-0.5 transition-colors enabled:hover:bg-muted disabled:cursor-default sm:flex-row sm:gap-2"
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs font-bold",
                    step.done ? "bg-emerald-500 text-white" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className={cn("whitespace-nowrap text-[11px] sm:text-sm", isCurrent ? "font-semibold text-foreground" : step.done ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </span>
              </button>
              {index < steps.length - 1 && <span aria-hidden className={cn("h-px min-w-2 flex-1", step.done ? "bg-emerald-500/60" : "bg-border")} />}
            </li>
          );
        })}
      </ol>
      <div role="status" className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-border/60 pt-2.5 text-sm">
        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{nextLabel}</span>
        <span className="min-w-0 flex-1 basis-56 leading-relaxed text-muted-foreground">{hint}</span>
        {action && (
          <Button type="button" size="sm" variant="outline" onClick={action.onClick}>{action.label}</Button>
        )}
      </div>
    </nav>
  );
}
