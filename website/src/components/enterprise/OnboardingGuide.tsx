import { useState } from "react";
import { Building2, Layers, Library, Sparkles, Users, Workflow, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/use-dialog";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

const GUIDE_KEY = "momogsm.enterprise.guide.v1";
const ICONS = [Sparkles, Layers, Building2, Users, Workflow, Library];

/** 看过引导没有。读不了 localStorage（隐私模式）时当作看过——不然每次进来都弹。 */
export function guideSeen(): boolean {
  try { return window.localStorage.getItem(GUIDE_KEY) === "done"; } catch { return true; }
}
export function markGuideSeen() {
  try { window.localStorage.setItem(GUIDE_KEY, "done"); } catch { /* 存不了就算了 */ }
}

/**
 * 新手引导：第一次进入页面自动弹出，可跳过；之后随时能从页面右上的「新手引导」重新打开。
 * 「跳过」在 DOM 里排在最后：弹出时初始焦点落在「下一步」上，按回车是往下看，而不是直接关掉。
 */
export function OnboardingGuide({ onClose, onTaxonomy }: { onClose: () => void; onTaxonomy: () => void }) {
  const { t } = useLanguage();
  const x = t.enterprise;
  const [index, setIndex] = useState(0);
  const dialogRef = useDialog({ onEscape: onClose });
  const steps = x.guideSteps;
  const step = steps[index];
  const last = index === steps.length - 1;
  const Icon = ICONS[index] ?? Sparkles;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={x.guideTitle}
        ref={dialogRef}
        className="relative w-full max-w-lg rounded-2xl border border-border/70 bg-background p-6 shadow-2xl"
      >
        <p className="text-xs font-medium text-muted-foreground">{x.guideTitle} · {index + 1} / {steps.length}</p>
        <div aria-live="polite" className="mt-4 min-h-[11.5rem]">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
          <h2 className="mt-4 text-lg font-bold">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </div>
        <div className="mt-5 flex items-center gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span key={s.title} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-primary" : i < index ? "w-1.5 bg-primary/50" : "w-1.5 bg-border")} />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="mr-auto" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            {x.guideBack}
          </Button>
          {last && <Button type="button" variant="outline" size="sm" onClick={onTaxonomy}>{x.guideToTaxonomy}</Button>}
          <Button type="button" size="sm" onClick={last ? onClose : () => setIndex((i) => i + 1)}>
            {last ? x.guideStart : x.guideNext}
          </Button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {x.guideSkip}<X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
