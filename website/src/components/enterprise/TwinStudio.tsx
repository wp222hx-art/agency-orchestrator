import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Download, GitBranch, Loader2, RefreshCw, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/i18n/LanguageProvider";
import { downloadText, safeFilename } from "@/lib/download";
import { api, type EnterpriseMeta, type EnterpriseSectorId, type EnterpriseTwin, type TwinScale, type TwinSummary } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { SECTOR_ICONS, cardCls, errorText, fieldCls, fill, scrollToId } from "./shared";
import { TwinFlow } from "./TwinFlow";
import { TwinMetrics } from "./TwinMetrics";
import { CATEGORY_ICONS, categoryText, formatNumber, formatTime, twinMarkdown } from "./twin-shared";

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" /><span>{children}</span>
    </p>
  );
}

/**
 * 数字孪生推演：选一类企业 → momo智脑还原现有典型流程、给出目标流程 / 设备与系统 / 指标对比 / 路线图。
 * 这是模拟推演，数字是估算：页面顶部、每个数字旁边、导出的文件里都写明。企业填了实测值的指标改用实测值对比。
 */
export function TwinStudio({ meta, ready, model, onModel, initial, onSpent }: {
  meta: EnterpriseMeta;
  /** momo智脑已连接且选好了模型 */
  ready: boolean;
  model: string;
  onModel: (model: string) => void;
  /** 从「匹配专家团队」页签带过来的板块 / 行业 */
  initial: { sector: EnterpriseSectorId | ""; industry: string };
  /** 调用过模型之后刷新余额 */
  onSpent: () => void;
}) {
  const { t, lang } = useLanguage();
  const tw = t.enterprise.tw;
  const en = lang === "en";
  const label = (item: { name: string; nameEn: string }) => (en ? item.nameEn : item.name);

  const [sector, setSector] = useState<EnterpriseSectorId>(initial.sector || "industry");
  const [industry, setIndustry] = useState(initial.industry);
  const [company, setCompany] = useState("");
  const [scale, setScale] = useState<TwinScale>("medium");
  const [situation, setSituation] = useState("");
  const [list, setList] = useState<TwinSummary[] | null>(null);
  const [listError, setListError] = useState("");
  const [twin, setTwin] = useState<EnterpriseTwin | null>(null);
  const [busy, setBusy] = useState<"generate" | "iterate" | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TwinSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const industries = meta.industries.filter((i) => i.sector === sector);
  const industryMeta = industries.find((i) => i.id === industry) ?? null;
  const scaleText: Record<TwinScale, string> = { small: tw.scaleSmall, medium: tw.scaleMedium, large: tw.scaleLarge };
  const cats = categoryText(tw);
  const limits = meta.twin.limits;

  const open = useCallback(async (id: string) => {
    setOpening(id); setError(null);
    try { setTwin(await api.enterpriseTwin(id)); }
    catch (e) { setError(`${tw.loadError}${errorText(e)}`); }
    finally { setOpening(null); }
  }, [tw.loadError]);

  const refreshList = useCallback(async () => {
    const r = await api.enterpriseTwins();
    setList(r.twins); setListError(r.error);
    return r.twins;
  }, []);

  // 进来先列出已保存的推演，并打开最近的一份
  useEffect(() => {
    let cancelled = false;
    refreshList()
      .then((twins) => { if (!cancelled && twins[0]) void open(twins[0].id); })
      .catch((e) => { if (!cancelled) { setList([]); setListError(errorText(e)); } });
    return () => { cancelled = true; };
  }, [refreshList, open]);

  const run = async (kind: "generate" | "iterate") => {
    if (busy || !ready) return;
    if (kind === "generate" && !industryMeta) return;
    if (kind === "iterate" && !twin) return;
    const known = new Set((list ?? []).map((item) => item.id));
    setBusy(kind); setError(null);
    try {
      const next = await api.enterpriseTwinGenerate(kind === "iterate" && twin
        ? { basedOn: twin.id, model }
        : { industry, company: company.trim(), scale, current: situation.trim(), model });
      setTwin(next);
      void refreshList().catch(() => undefined);
      window.setTimeout(() => scrollToId("twin-result"), 60);
    } catch (e) {
      // 连接中途断了但服务端已经生成并保存的情况：列表里会多出一份，直接打开它，而不是让用户再花一次积分
      const twins = await refreshList().catch(() => null);
      const fresh = twins?.find((item) => !known.has(item.id));
      if (fresh) { await open(fresh.id); window.setTimeout(() => scrollToId("twin-result"), 60); }
      else setError(errorText(e));
    } finally {
      setBusy(null);
      onSpent();
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      const r = await api.enterpriseTwinDelete(deleting.id);
      setList(r.twins); setListError(r.error);
      if (twin?.id === deleting.id) { setTwin(null); if (r.twins[0]) void open(r.twins[0].id); }
      setDeleting(null);
    } catch (e) { setDeleteError(errorText(e)); }
    finally { setDeleteBusy(false); }
  };

  const exportTwin = (kind: "md" | "json") => {
    if (!twin) return;
    const base = `momogsm-twin-${twin.company || label(twin.industry)}-${twin.createdAt.slice(0, 10)}`;
    if (kind === "md") downloadText(safeFilename(base, "md"), twinMarkdown(twin, tw, en));
    // 说明跟着文件走：导出的 JSON 离开页面后，仍然看得到「这是估算」
    else downloadText(safeFilename(base, "json"), `${JSON.stringify({ notice: tw.notice, twin }, null, 2)}\n`, "application/json");
  };

  const headline = twin ? twin.metrics.filter((m) => m.improvement !== null && m.improvement > 0).slice(0, 4) : [];
  const stageName = (id: string) => twin?.target.find((s) => s.id === id)?.name ?? "";

  return (
    <>
      <div className="space-y-5">
        <section className={cardCls}>
          <p className="text-sm leading-relaxed text-muted-foreground">{tw.intro}</p>
          <div className="mt-3"><Notice>{tw.notice}</Notice></div>
          {(meta.twin.error || listError) && <p role="alert" className="mt-3 text-sm text-amber-600 dark:text-amber-400">{meta.twin.error || listError}</p>}
        </section>

        {/* ① 选择企业类型 */}
        <section className={cardCls} aria-label={tw.formTitle}>
          <h2 className="text-base font-bold">{tw.formTitle}</h2>
          <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void run("generate"); }}>
            <div>
              <span id="twin-sector-label" className="mb-1.5 block text-sm font-medium">{tw.sector}</span>
              <div role="group" aria-labelledby="twin-sector-label" className="grid gap-2 sm:grid-cols-3">
                {meta.sectors.map((s) => {
                  const Icon = SECTOR_ICONS[s.id];
                  const active = sector === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { if (!active) { setSector(s.id); setIndustry(""); } }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left font-semibold transition-colors",
                        active ? "border-primary bg-primary/10" : "border-border/70 hover:border-primary/40",
                      )}
                    >
                      <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />{label(s)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span id="twin-industry-label" className="mb-1.5 block text-sm font-medium">{tw.industry}</span>
              <div role="group" aria-labelledby="twin-industry-label" className="flex flex-wrap gap-2">
                {industries.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    aria-pressed={industry === i.id}
                    onClick={() => setIndustry(i.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                      industry === i.id ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {label(i)}
                  </button>
                ))}
              </div>
              {!industryMeta && <p className="mt-2 text-xs text-muted-foreground">{tw.pickIndustry}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="sm:col-span-1">
                <span className="mb-1.5 block text-sm font-medium">{tw.company}</span>
                <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={60} placeholder={tw.companyPlaceholder} className={fieldCls} />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-medium">{tw.scale}</span>
                <select value={scale} onChange={(e) => setScale(e.target.value as TwinScale)} className={fieldCls}>
                  {meta.twin.scales.map((s) => <option key={s} value={s}>{scaleText[s]}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-medium">{tw.model}</span>
                <select value={model} onChange={(e) => onModel(e.target.value)} disabled={!meta.brain.models.length} className={fieldCls}>
                  {meta.brain.models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-3">{tw.companyHint}</p>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{tw.current}</span>
              <textarea
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                maxLength={limits.current}
                rows={3}
                placeholder={tw.currentPlaceholder}
                className={cn(fieldCls, "resize-y leading-relaxed")}
              />
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{fill(tw.currentHint, { max: limits.current })}</span>
            </label>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button type="submit" disabled={!ready || !industryMeta || busy !== null}>
                {busy === "generate" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {busy === "generate" ? tw.generating : tw.generate}
              </Button>
              <span className="min-w-0 flex-1 basis-56 text-xs leading-relaxed text-muted-foreground">{ready ? tw.generateHint : tw.notReady}</span>
            </div>
          </form>
        </section>

        {error && <p role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {/* ② 已保存的推演 */}
        <section className={cardCls} aria-label={tw.savedTitle}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-bold">{tw.savedTitle}</h2>
            <span className="text-xs text-muted-foreground">{fill(tw.savedNote, { n: limits.saved })}</span>
            <button type="button" onClick={() => { void refreshList().catch((e) => setListError(errorText(e))); }} aria-label={t.enterprise.refresh} title={t.enterprise.refresh} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <RefreshCw className="size-4" />
            </button>
          </div>
          {list === null ? (
            <p className="mt-3 text-sm text-muted-foreground">{t.enterprise.loading}</p>
          ) : list.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{tw.savedEmpty}</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {list.map((item) => {
                const active = twin?.id === item.id;
                return (
                  <li key={item.id} className={cn("flex items-stretch rounded-xl border transition-colors", active ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/40")}>
                    <button type="button" aria-pressed={active} onClick={() => { if (!active) void open(item.id); }} className="min-w-0 flex-1 px-3.5 py-2.5 text-left">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{item.company || tw.typical} · {label(item.industry)}</span>
                        {opening === item.id && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{formatTime(item.createdAt, en)} · {item.model}</span>
                    </button>
                    <button type="button" onClick={() => { setDeleteError(null); setDeleting(item); }} aria-label={`${tw.delete} ${item.company || label(item.industry)}`} title={tw.delete} className="rounded-r-xl px-3 text-muted-foreground hover:bg-muted hover:text-red-500">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ③ 推演结果 */}
        {twin && (
          <div id="twin-result" className="scroll-mt-24 space-y-5">
            <section className={cardCls}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-72">
                  <h2 className="text-xl font-bold">{twin.company || tw.typical} · {label(twin.industry)}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium">{label(twin.sector)}</span>
                    <span className="rounded-full bg-muted px-2.5 py-1">{scaleText[twin.scale]}</span>
                    {twin.basedOn && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><GitBranch className="size-3" />{tw.iteratedFrom}</span>}
                    <span className="text-muted-foreground">{fill(tw.metaLine, { time: formatTime(twin.createdAt, en), model: twin.model })}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={() => void run("iterate")} disabled={!ready || busy !== null}>
                    {busy === "iterate" ? <Loader2 className="animate-spin" /> : <GitBranch />}
                    {busy === "iterate" ? tw.iterating : tw.iterate}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => exportTwin("md")}><Download />{tw.exportMd}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => exportTwin("json")}><Download />{tw.exportJson}</Button>
                </div>
              </div>
              {twin.summary && <p className="mt-4 text-sm leading-relaxed">{twin.summary}</p>}
              {twin.input && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{tw.inputLabel}：{twin.input}</p>}
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{tw.iterateHint}</p>

              {headline.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold">{tw.headline}</h3>
                  <ul className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {headline.map((m) => (
                      <li key={m.id} className="rounded-xl border border-border/60 p-3.5">
                        <p className="truncate text-xs text-muted-foreground" title={m.name}>{m.name}</p>
                        <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {m.better === "lower" ? "−" : "+"}{formatNumber(m.improvement ?? 0, en)}%
                        </p>
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          {formatNumber(m.baseline, en)} → {formatNumber(m.target, en)} {m.unit}
                        </p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {tw.now}：{m.baselineSource === "measured" ? tw.measured : tw.estimate} · {tw.target}：{tw.estimate}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <TwinFlow key={twin.id} twin={twin} />

            {twin.equipment.length > 0 && (
              <section className={cardCls} aria-label={tw.equipmentTitle}>
                <h2 className="text-lg font-bold">{tw.equipmentTitle}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tw.equipmentNote}</p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {twin.equipment.map((e) => {
                    const Icon = CATEGORY_ICONS[e.category];
                    return (
                      <li key={e.id} className="flex flex-col rounded-xl border border-border/60 p-4">
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold leading-snug">{e.name}</h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {cats[e.category]}{e.stage && stageName(e.stage) ? ` · ${fill(tw.atStage, { stage: stageName(e.stage) })}` : ""}
                            </p>
                          </div>
                        </div>
                        {e.specs.length > 0 && (
                          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">{e.specs.map((spec) => <li key={spec}>{spec}</li>)}</ul>
                        )}
                        {e.replaces && <p className="mt-3 text-xs leading-relaxed"><span className="text-muted-foreground">{tw.replaces}：</span>{e.replaces}</p>}
                        {e.benefit && <p className="mt-1.5 text-xs leading-relaxed"><span className="text-muted-foreground">{tw.benefit}：</span>{e.benefit}</p>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <TwinMetrics twin={twin} onChanged={setTwin} />

            {twin.roadmap.length > 0 && (
              <section className={cardCls} aria-label={tw.roadmapTitle}>
                <h2 className="text-lg font-bold">{tw.roadmapTitle}</h2>
                <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {twin.roadmap.map((phase, index) => (
                    <li key={phase.horizon} className="rounded-xl border border-border/60 p-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{index + 1}</span>
                        {phase.horizon}
                      </h3>
                      <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">{phase.items.map((item) => <li key={item}>{item}</li>)}</ul>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {(twin.assumptions.length > 0 || twin.risks.length > 0) && (
              <section className={cn(cardCls, "grid gap-5 sm:grid-cols-2")}>
                {([[tw.assumptionsTitle, twin.assumptions], [tw.risksTitle, twin.risks]] as const).map(([title, items]) => items.length > 0 && (
                  <div key={title}>
                    <h2 className="text-base font-bold">{title}</h2>
                    <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">{items.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                ))}
              </section>
            )}

            <Notice>{tw.notice}</Notice>
          </div>
        )}
      </div>

      {deleting && (
        <ConfirmDialog
          title={tw.deleteTitle}
          body={tw.deleteBody}
          confirmLabel={tw.confirm}
          cancelLabel={tw.cancel}
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void remove()}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
