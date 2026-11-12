import { useState } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageProvider";
import { api, type EnterpriseTwin, type TwinMetric } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { cardCls, errorText, fieldCls, fill } from "./shared";
import { confidenceText, formatNumber } from "./twin-shared";

/** 来源标签：估算（虚线框）/ 实测（实心）。每个数字旁边都带，避免估算被当成事实。 */
function SourceTag({ measured }: { measured: boolean }) {
  const { t } = useLanguage();
  const tw = t.enterprise.tw;
  return (
    <span className={cn(
      "rounded px-1.5 py-0.5 text-[10px] font-medium",
      measured ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border border-dashed border-border text-muted-foreground",
    )}>
      {measured ? tw.measured : tw.estimate}
    </span>
  );
}

function MetricRow({ twinId, metric, onChanged }: { twinId: string; metric: TwinMetric; onChanged: (twin: EnterpriseTwin) => void }) {
  const { t, lang } = useLanguage();
  const tw = t.enterprise.tw;
  const en = lang === "en";
  const conf = confidenceText(tw);
  const [draft, setDraft] = useState(metric.measured === null ? "" : String(metric.measured));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const measured = metric.baselineSource === "measured";
  const max = Math.max(metric.baseline, metric.target) || 1;
  const pct = (value: number) => `${Math.max(2, Math.round((value / max) * 100))}%`;
  const value = draft.trim() === "" ? null : Number(draft);
  const invalid = value !== null && (!Number.isFinite(value) || value < 0);
  const unchanged = value === metric.measured;

  const submit = async (next: number | null) => {
    setBusy(true); setError(null);
    try {
      onChanged(await api.enterpriseTwinMeasured(twinId, { [metric.id]: next }));
      if (next === null) setDraft("");
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  const Trend = metric.better === "lower" ? TrendingDown : TrendingUp;
  return (
    <li className="rounded-xl border border-border/60 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-semibold">{metric.name}{metric.unit && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{metric.unit}</span>}</h3>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Trend className="size-3.5" />{metric.better === "lower" ? tw.lowerBetter : tw.higherBetter}</span>
        <span className="ml-auto text-sm font-semibold">
          {metric.improvement === null ? null : metric.improvement > 0
            ? <span className="text-emerald-600 dark:text-emerald-400">{fill(tw.improvement, { n: formatNumber(metric.improvement, en) })}</span>
            : <span className="text-xs font-normal text-amber-700 dark:text-amber-300">{tw.noGain}</span>}
        </span>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        {([[tw.now, metric.baseline, measured, "bg-muted-foreground/50"], [tw.target, metric.target, false, "bg-primary"]] as const).map(([label, number, isMeasured, bar]) => (
          <div key={label} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", bar)} style={{ width: pct(number) }} /></div>
            <dd className="flex items-center gap-1.5 tabular-nums">
              <span className="font-semibold">{formatNumber(number, en)}</span>
              <SourceTag measured={isMeasured} />
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {tw.confidence}：{conf[metric.confidence]}
        {metric.basis && <> · {tw.basis}：{metric.basis}</>}
        {measured && <> · {fill(tw.modelEstimate, { n: formatNumber(metric.current, en) })}</>}
      </p>

      <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!invalid && value !== null && !unchanged && !busy) void submit(value); }}>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={fill(tw.measuredLabel, { name: metric.name })}
          aria-invalid={invalid}
          placeholder={tw.measuredPlaceholder}
          className={cn(fieldCls, "w-48 py-1.5", invalid && "border-red-500/60")}
        />
        <Button type="submit" size="sm" variant="outline" disabled={busy || invalid || value === null || unchanged}>
          {busy && <Loader2 className="animate-spin" />}{tw.saveMeasured}
        </Button>
        {metric.measured !== null && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void submit(null)}>{tw.clearMeasured}</Button>
        )}
        {(invalid || error) && <span role="alert" className="basis-full text-xs text-red-500">{invalid ? tw.measuredInvalid : error}</span>}
      </form>
    </li>
  );
}

/** 指标对比：每个指标「现有 → 目标」两根条，各自标明估算还是实测；可以填入实测现状值。 */
export function TwinMetrics({ twin, onChanged }: { twin: EnterpriseTwin; onChanged: (twin: EnterpriseTwin) => void }) {
  const { t } = useLanguage();
  const tw = t.enterprise.tw;
  return (
    <section className={cardCls} aria-label={tw.metricsTitle}>
      <h2 className="text-lg font-bold">{tw.metricsTitle}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tw.metricsNote}</p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {/* key 带上实测值：保存或清除后输入框跟着服务端的结果走 */}
        {twin.metrics.map((m) => <MetricRow key={`${m.id}:${m.measured}`} twinId={twin.id} metric={m} onChanged={onChanged} />)}
      </ul>
    </section>
  );
}
