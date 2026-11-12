import { useState } from "react";
import { ArrowDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { EnterpriseTwin, TwinMode, TwinStageCurrent, TwinStageTarget } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { cardCls, fill } from "./shared";
import { CATEGORY_ICONS, MODE_STYLES, categoryText, modeText } from "./twin-shared";

type Stage = TwinStageCurrent | TwinStageTarget;
const MODES: TwinMode[] = ["manual", "semi", "auto"];

/** 一条泳道里各作业方式的占比条（人工 / 半自动 / 自动各几个环节）。 */
function ModeMix({ stages, label }: { stages: Stage[]; label: string }) {
  const { t } = useLanguage();
  const names = modeText(t.enterprise.tw);
  const counts = MODES.map((mode) => ({ mode, n: stages.filter((s) => s.mode === mode).length })).filter((c) => c.n > 0);
  const summary = counts.map((c) => `${names[c.mode]} ${c.n}`).join(" · ");
  return (
    <div className="flex min-w-0 flex-1 basis-56 items-center gap-2.5 text-xs text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <div role="img" aria-label={`${label}: ${summary}`} className="flex h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
        {counts.map((c) => <span key={c.mode} className={MODE_STYLES[c.mode].bar} style={{ width: `${(c.n / stages.length) * 100}%` }} />)}
      </div>
      <span className="shrink-0 tabular-nums">{summary}</span>
    </div>
  );
}

function Lane({ title, stages, selected, onSelect, accent }: {
  title: string; stages: Stage[]; selected: string; onSelect: (id: string) => void; accent: boolean;
}) {
  const { t } = useLanguage();
  const tw = t.enterprise.tw;
  const names = modeText(tw);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className={cn("shrink-0 text-sm font-semibold", accent && "text-primary")}>{title}</h3>
        <ModeMix stages={stages} label={tw.automation} />
      </div>
      {/* 环节多时横向滚动：流程是有先后的，换行会打乱阅读顺序 */}
      <ol className="mt-3 flex items-stretch gap-1 overflow-x-auto pb-2">
        {stages.map((stage, index) => (
          <li key={stage.id} className="flex shrink-0 items-stretch gap-1">
            <button
              type="button"
              aria-pressed={selected === stage.id}
              onClick={() => onSelect(stage.id)}
              className={cn(
                "flex w-36 flex-col rounded-xl border p-3 text-left transition-shadow hover:shadow-md",
                MODE_STYLES[stage.mode].node,
                selected === stage.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            >
              <span className="text-[11px] tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              <span className="mt-0.5 text-sm font-semibold leading-snug">{stage.name}</span>
              <span className={cn("mt-2 self-start rounded-full px-2 py-0.5 text-[11px] font-medium", MODE_STYLES[stage.mode].badge)}>{names[stage.mode]}</span>
            </button>
            {index < stages.length - 1 && <ChevronRight aria-hidden className="size-4 shrink-0 self-center text-muted-foreground/60" />}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 流程对比：上面是现有典型流程，下面是目标流程；点任一环节在下方看详情（目标环节带出它用到的设备与系统）。 */
export function TwinFlow({ twin }: { twin: EnterpriseTwin }) {
  const { t } = useLanguage();
  const tw = t.enterprise.tw;
  const names = modeText(tw);
  const cats = categoryText(tw);
  const [selected, setSelected] = useState(twin.target[0]?.id ?? "");

  const currentIndex = twin.current.findIndex((s) => s.id === selected);
  const targetIndex = twin.target.findIndex((s) => s.id === selected);
  const current = currentIndex >= 0 ? twin.current[currentIndex] : null;
  const target = targetIndex >= 0 ? twin.target[targetIndex] : null;
  const stage = current ?? target;
  const gear = target ? twin.equipment.filter((e) => e.stage === target.id) : [];
  const empty = current ? !current.note && !current.issues.length : target ? !target.change && !target.tech.length && !gear.length : true;

  return (
    <section className={cardCls} aria-label={tw.flowTitle}>
      <h2 className="text-lg font-bold">{tw.flowTitle}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tw.flowNote}</p>
      <div className="mt-4 space-y-2">
        <Lane title={tw.laneCurrent} stages={twin.current} selected={selected} onSelect={setSelected} accent={false} />
        <div aria-hidden className="flex justify-center text-muted-foreground/60"><ArrowDown className="size-5" /></div>
        <Lane title={tw.laneTarget} stages={twin.target} selected={selected} onSelect={setSelected} accent />
      </div>

      {stage && (
        <div aria-live="polite" className="mt-4 rounded-xl border border-border/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{stage.name}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", MODE_STYLES[stage.mode].badge)}>{names[stage.mode]}</span>
            <span className="text-xs text-muted-foreground">
              {current ? tw.laneCurrent : tw.laneTarget} · {fill(tw.stageOf, { i: (current ? currentIndex : targetIndex) + 1, n: current ? twin.current.length : twin.target.length })}
            </span>
          </div>
          {empty && <p className="mt-3 text-sm text-muted-foreground">{tw.stageNone}</p>}
          {current && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {current.note && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground">{tw.stageNow}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed">{current.note}</p>
                </div>
              )}
              {current.issues.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground">{tw.stageIssues}</h4>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed">{current.issues.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )}
            </div>
          )}
          {target && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {target.change && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground">{tw.stageChange}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed">{target.change}</p>
                </div>
              )}
              {target.tech.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground">{tw.stageTech}</h4>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {target.tech.map((item) => <li key={item} className="rounded-full bg-muted px-2.5 py-1 text-xs">{item}</li>)}
                  </ul>
                </div>
              )}
              {gear.length > 0 && (
                <div className="sm:col-span-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">{tw.stageEquipment}</h4>
                  <ul className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    {gear.map((e) => {
                      const Icon = CATEGORY_ICONS[e.category];
                      return (
                        <li key={e.id} className="flex items-start gap-2.5 rounded-lg border border-border/60 p-2.5 text-sm">
                          <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="font-medium">{e.name}</span>
                            <span className="ml-1.5 text-xs text-muted-foreground">{cats[e.category]}</span>
                            {e.benefit && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{e.benefit}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
