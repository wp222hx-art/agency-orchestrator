import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { CircleHelp, ExternalLink, Factory, Loader2, Plus, RefreshCw, Sparkles, TriangleAlert, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AddExpertDialog } from "@/components/enterprise/AddExpertDialog";
import { AgentAdmin } from "@/components/enterprise/AgentAdmin";
import { FlowProgress, type FlowStep } from "@/components/enterprise/FlowProgress";
import { KnowledgePanel, knowledgeCount } from "@/components/enterprise/KnowledgePanel";
import { OnboardingGuide, guideSeen, markGuideSeen } from "@/components/enterprise/OnboardingGuide";
import { TaxonomyManager } from "@/components/enterprise/TaxonomyManager";
import { TwinStudio } from "@/components/enterprise/TwinStudio";
import { SECTOR_ICONS, cardCls as card, errorText, fieldCls as field, fill, scrollToId } from "@/components/enterprise/shared";
import { RoleAvatar } from "@/components/studio/RoleAvatar";
import { RunDock } from "@/components/studio/RunDock";
import { RunProvider, useRunManager } from "@/components/studio/RunManager";
import { RunViewer } from "@/components/studio/RunViewer";
import { useBackend } from "@/components/studio/useBackend";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SITE } from "@/lib/site";
import { useSeo } from "@/lib/useSeo";
import {
  api,
  type EnterpriseAnalysis,
  type EnterpriseCandidate,
  type EnterpriseMeta,
  type EnterprisePhaseId,
  type EnterpriseSectorId,
  type EnterpriseTeamMember,
  type EnterpriseTeamSize,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

const SIZES: EnterpriseTeamSize[] = ["lean", "standard", "full"];
/** 示例企业依次对应的板块：点示例时一并选好，免得「超市」配着「工业」去分析 */
const SAMPLE_SECTORS: EnterpriseSectorId[] = ["industry", "commerce", "trade"];
const TABS = ["match", "twin", "taxonomy", "agents"] as const;
type Tab = (typeof TABS)[number];

/** 带序号的步骤卡片：页面按「板块 → 行业 → 企业与团队」从上到下走。scroll-mt 给吸顶的导航和进度条留位置。 */
function Step({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className={cn(card, "scroll-mt-24 md:scroll-mt-52")} aria-label={title}>
      <h2 className="flex items-center gap-2.5 text-base font-bold">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EnterpriseMatchInner() {
  const { t, lang } = useLanguage();
  const x = t.enterprise;
  const en = lang === "en";
  useSeo(`${x.title} | ${SITE.name}`, x.seoDesc);
  const { status } = useBackend();
  const { start, runs, open: openRun } = useRunManager();

  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: Tab = TABS.find((id) => id === tabParam) ?? "match";
  const setTab = useCallback((next: Tab) => {
    setParams((prev) => {
      const q = new URLSearchParams(prev);
      if (next === "match") q.delete("tab"); else q.set("tab", next);
      q.delete("token");   // 访问令牌已存进 sessionStorage，不再写回地址栏
      return q;
    }, { replace: true });
  }, [setParams]);

  const [meta, setMeta] = useState<EnterpriseMeta | null>(null);
  const [balance, setBalance] = useState<number | null | undefined>(undefined);
  // 首页的板块卡片带 ?sector=industry|commerce|trade 过来：直接预选该板块
  const sectorParam = SAMPLE_SECTORS.find((id) => id === params.get("sector")) ?? "";
  const [sector, setSector] = useState<EnterpriseSectorId | "">(sectorParam);
  const [sectorChosen, setSectorChosen] = useState(sectorParam !== "");
  const [industry, setIndustry] = useState("");
  const [industryChosen, setIndustryChosen] = useState(false);
  const [company, setCompany] = useState("");
  const [roleLib, setRoleLib] = useState(en ? "en" : "zh");
  const [size, setSize] = useState<EnterpriseTeamSize>("standard");
  const [model, setModel] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<EnterpriseAnalysis | null>(null);
  const [team, setTeam] = useState<Record<EnterprisePhaseId, EnterpriseTeamMember[]> | null>(null);
  const [balanceBefore, setBalanceBefore] = useState<number | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [injected, setInjected] = useState<{ knowledge: number; iteration: number; tuned: number } | null>(null);
  const [adding, setAdding] = useState<EnterprisePhaseId | null>(null);
  const [guide, setGuide] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    try { const r = await api.enterpriseCredits(); setBalance(r.balance); return r.balance; }
    catch { setBalance(null); return null; }
  }, []);

  const loadMeta = useCallback(async () => {
    const m = await api.enterpriseMeta();
    setMeta(m);
    setModel((cur) => cur || m.brain.defaultModel);
    setRoleLib((cur) => (m.roleLibs.some((l) => l.id === cur) ? cur : m.roleLibs[0]?.id ?? "zh"));
    // 行业体系改过之后，原先选的行业可能已经不在了
    setIndustry((cur) => (cur && !m.industries.some((i) => i.id === cur) ? "" : cur));
  }, []);

  // 没有引擎后端（公开演示站）时不发请求——静态站对 /api 只会回 404/405
  useEffect(() => {
    if (status !== "online") return;
    let cancelled = false;
    loadMeta().catch((e) => { if (!cancelled) setError(errorText(e)); });
    void refreshBalance();
    return () => { cancelled = true; };
  }, [status, loadMeta, refreshBalance]);

  // 第一次进来自动弹新手引导（引擎在线时才弹：离线时页面本身用不了）
  useEffect(() => {
    if (status === "online" && !guideSeen()) setGuide(true);
  }, [status]);
  const closeGuide = () => { markGuideSeen(); setGuide(false); };

  const run = runId ? runs.find((r) => r.id === runId) ?? null : null;
  const runState = run?.state ?? null;
  // 跑完（或失败）后刷新一次余额，让「启动前 / 现在」对得上
  useEffect(() => {
    if (runState === "done" || runState === "error") void refreshBalance();
  }, [runState, refreshBalance]);

  const ready = status === "online" && !!meta?.brain.configured && !!model;
  const memberCount = useMemo(() => (team ? Object.values(team).reduce((n, list) => n + list.length, 0) : 0), [team]);
  const stepCount = memberCount + 1;
  const fmt = (n: number) => n.toLocaleString(en ? "en-US" : "zh-CN", { maximumFractionDigits: 0 });
  const sizeLabel = { lean: x.sizeLean, standard: x.sizeStandard, full: x.sizeFull };
  const label = (item: { name: string; nameEn: string }) => (en ? item.nameEn : item.name);

  const sectorMeta = meta?.sectors.find((s) => s.id === sector) ?? null;
  const sectorIndustries = useMemo(() => (meta && sector ? meta.industries.filter((i) => i.sector === sector) : []), [meta, sector]);
  const industryMeta = sectorIndustries.find((i) => i.id === industry) ?? null;
  const maxPerPhase = meta?.teamSizes.full.perPhase ?? 3;

  const pickSector = (id: EnterpriseSectorId | "") => { setSector(id); setSectorChosen(true); setIndustry(""); setIndustryChosen(false); };
  const pickIndustry = (id: string) => { setIndustry(id); setIndustryChosen(true); };
  const pickSample = (name: string, index: number) => {
    setCompany(name);
    const next = SAMPLE_SECTORS[index];
    if (next && sector !== next) { setSector(next); setIndustry(""); setIndustryChosen(false); }
    setSectorChosen(true);
  };

  const analyze = async () => {
    if (!ready || analyzing || company.trim().length < 2) return;
    setAnalyzing(true); setError(null); setAnalysis(null); setTeam(null); setBalanceBefore(null); setRunId(null); setInjected(null);
    try {
      const result = await api.enterpriseAnalyze({
        company: company.trim(), sector: sector || undefined, industry: industry || undefined, roleLang: roleLib, size, model,
      });
      setAnalysis(result); setTeam(result.team);
      window.setTimeout(() => scrollToId("step-team"), 60);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setAnalyzing(false);
      void refreshBalance();
    }
  };

  const removeMember = (phase: EnterprisePhaseId, role: string) =>
    setTeam((cur) => (cur ? { ...cur, [phase]: cur[phase].filter((m) => m.role !== role) } : cur));
  const addMember = (phase: EnterprisePhaseId, c: EnterpriseCandidate) => {
    setTeam((cur) => (cur ? { ...cur, [phase]: [...cur[phase], { role: c.path, name: c.name, reason: "", by: "user" as const }] } : cur));
    setAdding(null);
  };
  const usedRoles = useMemo(() => {
    const used = new Set<string>(team ? Object.values(team).flat().map((m) => m.role) : []);
    if (analysis?.lead) used.add(analysis.lead.role);
    return used;
  }, [team, analysis]);

  const launch = async () => {
    if (!analysis || !team || starting || memberCount === 0) return;
    setStarting(true); setError(null);
    try {
      const before = await refreshBalance();
      const wf = await api.enterpriseWorkflow({
        company: analysis.company,
        industry: analysis.industry.id,
        roleLang: analysis.roleLang,
        model: analysis.model,
        lang,
        lead: analysis.lead?.role,
        team: Object.fromEntries(Object.entries(team).map(([phase, list]) => [phase, list.map((m) => m.role)])),
        context: { summary: analysis.summary, pains: analysis.pains, scenarios: analysis.scenarios },
      });
      setBalanceBefore(before);
      setInjected({ knowledge: wf.knowledgeItems, iteration: wf.iterationItems, tuned: wf.tunedAgents });
      // 不传 provider：这条工作流固定走 momo智脑（服务端也会忽略 provider 覆盖）
      setRunId(start({
        kind: "workflow",
        title: wf.name,
        file: wf.file,
        cast: wf.cast.map((c) => ({ id: c.id, role: c.role, name: c.name })),
        deliverables: wf.deliverables,
      }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setStarting(false);
    }
  };

  // ── 流程进度：选板块 → 选行业 → 填企业 → 定团队 → 看报告 ──
  const hasAnalysis = !!analysis && !!team;
  // 板块和行业都可以不选（交给 momo智脑判断）：一旦开始分析，这两步就算过了，提示不再停在「选行业」
  const decided = hasAnalysis || analyzing;
  const flow: FlowStep[] = [
    { id: "step-sector", label: x.flowSector, done: sectorChosen || decided, enabled: true },
    // 板块选了「自动判断」时行业也交给 momo智脑，这一步没有要选的
    { id: "step-industry", label: x.flowIndustry, done: (sectorChosen && (sector === "" || industryChosen)) || decided, enabled: true },
    { id: "step-company", label: x.flowCompany, done: hasAnalysis, enabled: true },
    { id: "step-team", label: x.flowTeam, done: hasAnalysis && !!run, enabled: hasAnalysis },
    { id: "step-run", label: x.flowReport, done: runState === "done", enabled: hasAnalysis },
  ];
  const firstOpen = flow.findIndex((s) => !s.done);
  const current = firstOpen < 0 ? flow.length : firstOpen;
  const hint = current === 0 ? x.nextSector
    : current === 1 ? x.nextIndustry
      : current === 2 ? (analyzing ? x.nextAnalyzing : status === "online" && meta && !ready ? x.nextConnect : x.nextCompany)
        : current === 3 ? x.nextTeam
          : runState === "running" ? x.nextRunning : runState === "error" ? x.nextError : x.nextDone;
  const flowAction = run ? { label: x.openRun, onClick: () => openRun(run.id) } : null;

  const sourceText = { user: x.sourceUser, model: x.sourceModel, name: x.sourceName };
  const byText = { model: x.byModel, rule: x.byRule, user: x.byUser };
  const confidenceLabel = analysis ? { high: x.confidenceHigh, medium: x.confidenceMedium, low: x.confidenceLow }[analysis.confidence] : "";
  const ResultIcon = analysis ? SECTOR_ICONS[analysis.sector.id] : Factory;
  const willInject = analysis ? knowledgeCount(meta, analysis.industry.id) : 0;
  const addingPhase = adding ? meta?.phases.find((p) => p.id === adding) : null;

  const tabBtn = (id: Tab, text: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={tab === id}
      aria-controls={`panel-${id}`}
      onClick={() => setTab(id)}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {text}
    </button>
  );

  return (
    <>
      <main className="pt-24">
        <div className="container-page pb-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{x.title}</h1>
            <p className="mx-auto mt-4 text-pretty leading-relaxed text-muted-foreground">{x.subtitle}</p>
          </div>

          <div className="mx-auto mt-8 max-w-5xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label={x.tabsLabel} className="inline-flex max-w-full flex-wrap rounded-xl border border-border/70 bg-muted/50 p-1">
                {tabBtn("match", x.tabMatch)}
                {tabBtn("twin", x.tabTwin)}
                {tabBtn("taxonomy", x.tabTaxonomy)}
                {tabBtn("agents", x.tabAgents)}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setGuide(true)}>
                <CircleHelp />{x.guideOpen}
              </Button>
            </div>

            {status === "offline" && (
              <p role="status" className={cn(card, "text-sm text-muted-foreground")}>{x.offline}</p>
            )}

            {status === "online" && meta && (
              <div className={cn(card, "flex flex-wrap items-center gap-x-6 gap-y-3 py-3.5 text-sm")}>
                {meta.brain.configured ? (
                  <span className="inline-flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500" />{x.brainReady}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="size-4" />{x.brainMissing}
                  </span>
                )}
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  {x.balance}：
                  <strong className="text-foreground">{typeof balance === "number" ? fmt(balance) : balance === undefined ? "…" : x.balanceUnknown}</strong>
                  <button type="button" onClick={() => void refreshBalance()} aria-label={x.refresh} title={x.refresh} className="rounded-md p-1 hover:bg-muted">
                    <RefreshCw className="size-3.5" />
                  </button>
                </span>
                {!meta.brain.configured && <p className="basis-full text-muted-foreground">{x.brainMissingHint}</p>}
                {meta.brain.configured && meta.brain.error && <p className="basis-full text-amber-600 dark:text-amber-400">{meta.brain.error}</p>}
                {meta.taxonomy.error && <p role="alert" className="basis-full text-amber-600 dark:text-amber-400">{meta.taxonomy.error}</p>}
              </div>
            )}

            {tab === "taxonomy" && (
              <div role="tabpanel" id="panel-taxonomy" aria-labelledby="tab-taxonomy">
                {status === "online" && (
                  <TaxonomyManager
                    model={model}
                    canDraft={ready}
                    editTarget={editTarget}
                    onEditTargetConsumed={() => setEditTarget(null)}
                    onChanged={() => { loadMeta().catch((e) => setError(errorText(e))); }}
                  />
                )}
              </div>
            )}

            {tab === "twin" && (
              <div role="tabpanel" id="panel-twin" aria-labelledby="tab-twin">
                {status === "online" && meta && (
                  <TwinStudio
                    meta={meta}
                    ready={ready}
                    model={model}
                    onModel={setModel}
                    initial={{ sector, industry }}
                    onSpent={() => { void refreshBalance(); }}
                  />
                )}
              </div>
            )}

            {tab === "agents" && (
              <div role="tabpanel" id="panel-agents" aria-labelledby="tab-agents">
                {status === "online" && meta && (
                  <AgentAdmin
                    meta={meta}
                    roleLang={roleLib}
                    onRoleLang={setRoleLib}
                    model={model}
                    canSuggest={ready}
                    onChanged={() => { loadMeta().catch((e) => setError(errorText(e))); }}
                    onSpent={() => { void refreshBalance(); }}
                  />
                )}
              </div>
            )}

            {tab === "match" && (
              <div role="tabpanel" id="panel-match" aria-labelledby="tab-match" className="space-y-5">
                <FlowProgress
                  label={x.flowLabel}
                  steps={flow}
                  current={current}
                  nextLabel={x.nextLabel}
                  hint={hint}
                  action={flowAction}
                  onSelect={scrollToId}
                />

                {/* ① 板块：工业 / 商业 / 贸易，或交给 momo智脑判断 */}
                <Step id="step-sector" n={1} title={x.stepSector}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(meta?.sectors ?? []).map((s) => {
                      const Icon = SECTOR_ICONS[s.id];
                      const active = sector === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => pickSector(s.id)}
                          className={cn(
                            "flex flex-col rounded-xl border p-4 text-left transition-colors",
                            active ? "border-primary bg-primary/10" : "border-border/70 hover:border-primary/40",
                          )}
                        >
                          <span className="flex items-center gap-2.5 text-lg font-bold">
                            <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />{label(s)}
                          </span>
                          {!en && <span className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.focus}</span>}
                          <span className="mt-2 text-xs text-muted-foreground">
                            {x.industriesCount.replace("{n}", String(meta?.industries.filter((i) => i.sector === s.id).length ?? 0))}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      aria-pressed={sector === "" && sectorChosen}
                      onClick={() => pickSector("")}
                      className={cn(
                        "flex flex-col rounded-xl border border-dashed p-4 text-left transition-colors",
                        sector === "" && sectorChosen ? "border-primary bg-primary/10" : "border-border/70 hover:border-primary/40",
                      )}
                    >
                      <span className="flex items-center gap-2.5 text-lg font-bold">
                        <Wand2 className={cn("size-5", sector === "" && sectorChosen ? "text-primary" : "text-muted-foreground")} />{x.sectorAuto}
                      </span>
                      <span className="mt-2 text-xs leading-relaxed text-muted-foreground">{x.sectorAutoDesc}</span>
                    </button>
                  </div>
                </Step>

                {/* ② 行业：只列所选板块下的行业 */}
                <Step id="step-industry" n={2} title={x.stepIndustry}>
                  {!sectorMeta ? (
                    <p className="text-sm text-muted-foreground">{x.industryAutoBoth}</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Chip active={industry === "" && industryChosen} onClick={() => pickIndustry("")}>{x.industryAuto}</Chip>
                        {sectorIndustries.map((i) => (
                          <Chip key={i.id} active={industry === i.id} onClick={() => pickIndustry(i.id)}>{label(i)}</Chip>
                        ))}
                      </div>
                      {!industryMeta ? (
                        <p className="mt-3 text-xs text-muted-foreground">{x.industryAutoHint.replace("{sector}", label(sectorMeta))}</p>
                      ) : (
                        <>
                          {(industryMeta.pains.length > 0 || industryMeta.scenarios.length > 0) && (
                            <div className="mt-4 rounded-xl border border-border/60 p-4">
                              <h3 className="text-sm font-semibold">{x.reference} · {label(industryMeta)}</h3>
                              <p className="mt-1 text-xs text-muted-foreground">{x.referenceNote}</p>
                              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                {([["pains", x.pains], ["scenarios", x.scenarios]] as const).map(([key, title]) => (
                                  <div key={key}>
                                    <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
                                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                      {industryMeta[key].map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {meta && (
                            <KnowledgePanel
                              key={industryMeta.id}
                              meta={meta}
                              sector={sectorMeta}
                              industry={industryMeta}
                              onEdit={() => { setEditTarget(industryMeta.id); setTab("taxonomy"); }}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                </Step>

                {/* ③ 企业与团队 */}
                <Step id="step-company" n={3} title={x.stepCompany}>
                  <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void analyze(); }}>
                    <div className="sm:col-span-3">
                      <label>
                        <span className="mb-1.5 block text-sm font-medium">{x.company}</span>
                        <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={60} placeholder={x.companyPlaceholder} className={field} />
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{x.samples}</span>
                        {x.sampleCompanies.map((name, index) => (
                          <button key={name} type="button" onClick={() => pickSample(name, index)} className="rounded-full border border-border/70 px-2.5 py-1 transition-colors hover:border-primary/40 hover:text-foreground">
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label>
                      <span className="mb-1.5 block text-sm font-medium">{x.roleLib}</span>
                      <select value={roleLib} onChange={(e) => setRoleLib(e.target.value)} className={field}>
                        {(meta?.roleLibs ?? [{ id: roleLib, label: roleLib }]).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1.5 block text-sm font-medium">{x.teamSize}</span>
                      <select value={size} onChange={(e) => setSize(e.target.value as EnterpriseTeamSize)} className={field}>
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {sizeLabel[s]}{meta ? ` · ${x.steps.replace("{n}", String(meta.teamSizes[s].steps))}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-1.5 block text-sm font-medium">{x.model}</span>
                      <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!meta?.brain.models.length} className={field}>
                        {(meta?.brain.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </label>
                    <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-3">{x.modelHint}</p>
                    <div className="sm:col-span-3">
                      <Button type="submit" disabled={!ready || analyzing || company.trim().length < 2}>
                        {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
                        {analyzing ? x.analyzing : x.analyze}
                      </Button>
                    </div>
                  </form>
                </Step>

                {error && (
                  <p role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                {analysis && team && (
                  <>
                    <section id="step-team" className={cn(card, "scroll-mt-24 md:scroll-mt-52")} aria-label={x.resultTitle}>
                      <h2 className="text-lg font-bold">{x.resultTitle} · {analysis.company}</h2>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-medium">
                          <ResultIcon className="size-4 text-primary" />{label(analysis.sector)}
                          <span className="font-normal text-muted-foreground">· {sourceText[analysis.sector.source]}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium">
                          {label(analysis.industry)}
                          <span className="font-normal text-muted-foreground">· {sourceText[analysis.industry.source]}</span>
                        </span>
                        <span className="text-muted-foreground">{x.confidence}：{confidenceLabel}</span>
                      </div>
                      {analysis.degraded && (
                        <p role="status" className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                          {x.degraded}{analysis.degradedReason}
                        </p>
                      )}
                      {!analysis.searched && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{x.noSources}</p>}
                      <p className="mt-3 text-sm leading-relaxed">{analysis.summary || x.noSummary}</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {([["pains", x.pains], ["scenarios", x.scenarios]] as const).map(([key, title]) => (
                          <div key={key}>
                            <h3 className="text-sm font-semibold">{title}</h3>
                            {analysis.generic[key] && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{x.genericNote}</p>}
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                              {analysis[key].map((item) => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                      {analysis.sources.length > 0 && (
                        <div className="mt-4">
                          <h3 className="text-sm font-semibold">{x.sources}</h3>
                          <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                            {analysis.sources.map((s) => (
                              <li key={s.link} className="min-w-0">
                                <a href={s.link} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                                  <span className="truncate">{s.title}</span><ExternalLink className="size-3 shrink-0" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>

                    {/* 四个阶段横向排开：诊断 → 设计 → 宣传 → 服务 */}
                    <section className={card} aria-label={x.teamTitle}>
                      <h2 className="text-lg font-bold">{x.teamTitle}</h2>
                      <ol className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {(meta?.phases ?? []).map((phase, index) => (
                          <li key={phase.id} className="flex flex-col rounded-xl border border-border/60 p-4">
                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">{index + 1}</span>
                              {en ? phase.nameEn : phase.name}
                            </h3>
                            {!en && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{phase.goal}</p>}
                            {team[phase.id].length === 0 ? (
                              <p className="mt-3 text-xs text-muted-foreground">{x.emptyPhase}</p>
                            ) : (
                              <ul className="mt-3 space-y-3">
                                {team[phase.id].map((m) => (
                                  <li key={m.role} className="flex items-start gap-2.5">
                                    <RoleAvatar seed={m.role} name={m.name} className="size-8" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium">{m.name}</p>
                                      <p className="mt-0.5 text-[11px] text-muted-foreground">{byText[m.by]}</p>
                                      {m.reason && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.reason}</p>}
                                    </div>
                                    <button type="button" onClick={() => removeMember(phase.id, m.role)} aria-label={`${x.remove} ${m.name}`} title={x.remove} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                                      <X className="size-4" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {team[phase.id].length < maxPerPhase && (
                              <button
                                type="button"
                                onClick={() => setAdding(phase.id)}
                                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/80 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground [&:not(:first-child)]:mt-4"
                              >
                                <Plus className="size-3.5" />{x.addExpert}
                              </button>
                            )}
                          </li>
                        ))}
                      </ol>
                      {analysis.lead && (
                        <p className="mt-4 text-sm text-muted-foreground">{x.lead}：<strong className="text-foreground">{analysis.lead.name}</strong></p>
                      )}
                    </section>

                    <section id="step-run" className={cn(card, "flex scroll-mt-24 flex-wrap items-center justify-between gap-4 md:scroll-mt-52")} aria-label={x.runTitle}>
                      <div className="min-w-0 flex-1 basis-72 text-sm">
                        <h2 className="text-lg font-bold">{x.runTitle}</h2>
                        {memberCount === 0 ? (
                          <p className="mt-1 text-amber-700 dark:text-amber-300">{x.emptyTeam}</p>
                        ) : (
                          <p className="mt-1 text-muted-foreground">{x.runHint.replace("{steps}", String(stepCount)).replace("{model}", analysis.model)}</p>
                        )}
                        {memberCount > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {injected !== null && run
                              ? fill(x.knowledgeInjected, { n: injected.knowledge })
                              : willInject > 0 ? fill(x.knowledgeWillInject, { industry: label(analysis.industry), n: willInject }) : x.knowledgeEmpty}
                            {" "}
                            {injected !== null && run
                              ? fill(x.iterationInjected, { n: injected.iteration, m: injected.tuned })
                              : (meta?.agents.principles ?? 0) > 0 ? fill(x.iterationWillInject, { n: meta?.agents.principles ?? 0 }) : ""}
                          </p>
                        )}
                        {balanceBefore !== null && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {x.balanceBefore.replace("{n}", fmt(balanceBefore))}
                            {runState && runState !== "running" && typeof balance === "number" ? ` → ${fill(x.balanceNow, { n: fmt(balance) })}` : ""}
                            {" · "}{x.balanceNote}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {run && <Button type="button" variant="outline" onClick={() => openRun(run.id)}>{x.openRun}</Button>}
                        <Button onClick={() => void launch()} disabled={starting || memberCount === 0 || runState === "running"}>
                          {starting || runState === "running" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                          {starting ? x.starting : x.run}
                        </Button>
                      </div>
                    </section>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {adding && addingPhase && analysis && (
        <AddExpertDialog
          phase={adding}
          phaseName={en ? addingPhase.nameEn : addingPhase.name}
          industry={analysis.industry.id}
          roleLang={analysis.roleLang}
          exclude={usedRoles}
          onAdd={(c) => addMember(adding, c)}
          onClose={() => setAdding(null)}
        />
      )}
      {guide && <OnboardingGuide onClose={closeGuide} onTaxonomy={() => { closeGuide(); setTab("taxonomy"); }} />}

      <RunViewer />
      <RunDock />
      <SiteFooter />
    </>
  );
}

export default function EnterpriseMatch() {
  return (
    <RunProvider>
      <EnterpriseMatchInner />
    </RunProvider>
  );
}
