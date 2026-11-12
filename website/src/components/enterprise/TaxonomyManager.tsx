import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Pencil, Plus, RotateCcw, Search, Settings2, Trash2, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/i18n/LanguageProvider";
import { downloadText } from "@/lib/download";
import { api, type EnterpriseSectorId, type EnterpriseTaxonomy, type TaxonomyIndustry, type TaxonomySector } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { IndustryEditor } from "./IndustryEditor";
import { SectorEditor } from "./SectorEditor";
import { SECTOR_ICONS, cardCls, errorText, fieldCls, fill } from "./shared";

type Pending =
  | { kind: "delete"; industry: TaxonomyIndustry }
  | { kind: "restore"; industry: TaxonomyIndustry }
  | { kind: "reset" }
  | { kind: "import"; payload: unknown; count: number };
type Editing = { kind: "industry"; industry: TaxonomyIndustry | null; sector: EnterpriseSectorId } | { kind: "sector"; sector: TaxonomySector };

const badge = "rounded-full px-2 py-0.5 text-[11px] font-medium";
const iconBtn = "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

/**
 * 「我的行业体系」：三个板块下的行业由用户自己增删改，每个行业带识别关键词和知识基线；
 * 支持导出 / 导入（整份替换）/ 恢复默认。每次改动后调 onChanged，让匹配页重新读取。
 */
export function TaxonomyManager({ model, canDraft, editTarget, onEditTargetConsumed, onChanged }: {
  model: string;
  canDraft: boolean;
  /** 从匹配页点「去修改」带过来的行业 id：加载完直接打开它的编辑器 */
  editTarget: string | null;
  onEditTargetConsumed: () => void;
  onChanged: () => void;
}) {
  const { t, lang } = useLanguage();
  const tx = t.enterprise.tx;
  const en = lang === "en";
  const [taxonomy, setTaxonomy] = useState<EnterpriseTaxonomy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.enterpriseTaxonomy().then((tax) => { setTaxonomy(tax); setLoadError(null); }).catch((e) => setLoadError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!taxonomy || !editTarget) return;
    const industry = taxonomy.industries.find((i) => i.id === editTarget);
    if (industry) setEditing({ kind: "industry", industry, sector: industry.sector });
    onEditTargetConsumed();
  }, [taxonomy, editTarget, onEditTargetConsumed]);

  const applied = (next: EnterpriseTaxonomy) => { setTaxonomy(next); setEditing(null); setNotice(null); onChanged(); };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true); setActionError(null);
    try {
      const next = pending.kind === "delete" ? await api.enterpriseIndustryDelete(pending.industry.id)
        : pending.kind === "restore" ? await api.enterpriseIndustryReset(pending.industry.id)
          : pending.kind === "reset" ? await api.enterpriseTaxonomyReset()
            : await api.enterpriseTaxonomyImport(pending.payload);
      setPending(null);
      applied(next);
    } catch (e) {
      setActionError(errorText(e));   // 留在确认框里：让用户看到原因再决定
    } finally {
      setBusy(false);
    }
  };
  const closePending = () => { setPending(null); setActionError(null); };

  const exportFile = () => {
    if (!taxonomy) return;
    // 只导出内容本身；「内置 / 已修改」这些标记是算出来的，不进文件
    const industries = taxonomy.industries.map(({ builtin: _b, modified: _m, ...rest }) => rest);
    const sectors = taxonomy.sectors.map(({ modified: _m, ...rest }) => rest);
    const day = new Date().toISOString().slice(0, 10);
    downloadText(`momogsm-industry-taxonomy-${day}.json`, `${JSON.stringify({ version: taxonomy.version, sectors, industries }, null, 2)}\n`, "application/json");
  };

  const importFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";   // 同一个文件再选一次也要能触发
    if (!file) return;
    setNotice(null);
    try {
      if (file.size > 2_000_000) throw new Error("too large");
      const payload = JSON.parse(await file.text());
      if (!payload || typeof payload !== "object" || !Array.isArray(payload.industries)) throw new Error("shape");
      setPending({ kind: "import", payload, count: payload.industries.length });
    } catch {
      setNotice(tx.importBad);
    }
  };

  if (!taxonomy) {
    return loadError
      ? <p role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">{tx.loadError}{loadError}</p>
      : <p className={cn(cardCls, "flex items-center gap-2 text-sm text-muted-foreground")}><Loader2 className="size-4 animate-spin" />{t.enterprise.loading}</p>;
  }

  const q = query.trim().toLowerCase();
  const matches = (i: TaxonomyIndustry) => !q || `${i.name} ${i.nameEn} ${i.keywords.join(" ")}`.toLowerCase().includes(q);
  const knowledgeOf = (i: TaxonomyIndustry) => taxonomy.dims.reduce((n, dim) => n + (i.knowledge[dim.id]?.length ?? 0), 0);
  const when = taxonomy.updatedAt ? new Date(taxonomy.updatedAt).toLocaleString(en ? "en-US" : "zh-CN") : "";
  const shown = taxonomy.industries.filter(matches).length;

  const dialog = pending && {
    delete: { title: fill(tx.deleteTitle, { name: pending.kind === "delete" ? pending.industry.name : "" }), body: tx.deleteBody, label: tx.delete, danger: true },
    restore: { title: fill(tx.restoreTitle, { name: pending.kind === "restore" ? pending.industry.name : "" }), body: tx.restoreBody, label: tx.confirm, danger: false },
    reset: { title: tx.resetTitle, body: tx.resetBody, label: tx.reset, danger: true },
    import: { title: tx.importTitle, body: fill(tx.importBody, { n: pending.kind === "import" ? pending.count : 0 }), label: tx.import, danger: true },
  }[pending.kind];

  // 弹层放在 space-y 容器外面：那个容器会给每个子元素加上边距，fixed 的遮罩会被顶下来 20px，顶部露出一条没遮住的页面
  return (
    <>
    <div className="space-y-5">
      <div className={cardCls}>
        <p className="text-sm leading-relaxed">{tx.intro}</p>
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />{tx.draftNote}
        </p>
        {taxonomy.error && <p role="alert" className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{taxonomy.error}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx.search} aria-label={tx.search} className={cn(fieldCls, "pl-9")} />
          </label>
          <Button type="button" size="sm" onClick={() => setEditing({ kind: "industry", industry: null, sector: "industry" })}><Plus />{tx.add}</Button>
          <Button type="button" size="sm" variant="outline" onClick={exportFile}><Download />{tx.export}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload />{tx.import}</Button>
          <Button type="button" size="sm" variant="outline" disabled={!taxonomy.customized} onClick={() => setPending({ kind: "reset" })}><RotateCcw />{tx.reset}</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{taxonomy.customized ? fill(tx.customized, { time: when }) : tx.pristine}</p>
        {notice && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{notice}</p>}
      </div>

      {taxonomy.sectors.map((sector) => {
        const Icon = SECTOR_ICONS[sector.id];
        const own = taxonomy.industries.filter((i) => i.sector === sector.id);
        const visible = own.filter(matches);
        if (q && visible.length === 0) return null;
        const sectorName = en ? sector.nameEn : sector.name;
        return (
          <section key={sector.id} className={cardCls} aria-label={sectorName}>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1 basis-64">
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
                  <Icon className="size-5 text-primary" />{sectorName}
                  <span className="text-sm font-normal text-muted-foreground">{fill(tx.industriesCount, { n: own.length })}</span>
                  {sector.modified && <span className={cn(badge, "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>{tx.modified}</span>}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {tx.sectorFocus}：{sector.focus} · {fill(tx.sectorPrinciples, { n: sector.principles.length })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing({ kind: "sector", sector })}><Settings2 />{tx.sectorSettings}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing({ kind: "industry", industry: null, sector: sector.id })}><Plus />{tx.add}</Button>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border/60">
              {visible.map((industry) => {
                const isFallback = sector.fallback === industry.id;
                const count = knowledgeOf(industry);
                const name = en ? industry.nameEn : industry.name;
                return (
                  <li key={industry.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                    <div className="min-w-0 flex-1 basis-60">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {name}
                        {!industry.builtin && <span className={cn(badge, "bg-primary/10 text-primary")}>{tx.custom}</span>}
                        {industry.modified && <span className={cn(badge, "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>{tx.modified}</span>}
                        {isFallback && <span title={tx.fallbackTip} className={cn(badge, "bg-muted text-muted-foreground")}>{tx.fallback}</span>}
                      </p>
                      <p className={cn("mt-0.5 text-xs", count ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")}>
                        {count ? fill(tx.knowledgeCount, { n: count }) : tx.noKnowledge} · {fill(tx.keywordsCount, { n: industry.keywords.length })}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button type="button" className={iconBtn} title={tx.edit} aria-label={`${tx.edit} ${name}`} onClick={() => setEditing({ kind: "industry", industry, sector: industry.sector })}>
                        <Pencil className="size-4" />
                      </button>
                      {industry.modified && (
                        <button type="button" className={iconBtn} title={tx.restore} aria-label={`${tx.restore} ${name}`} onClick={() => setPending({ kind: "restore", industry })}>
                          <RotateCcw className="size-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        className={iconBtn}
                        disabled={isFallback}
                        title={isFallback ? tx.fallbackTip : tx.delete}
                        aria-label={`${tx.delete} ${name}`}
                        onClick={() => setPending({ kind: "delete", industry })}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {q && shown === 0 && <p className={cn(cardCls, "text-sm text-muted-foreground")}>{tx.empty}</p>}
    </div>

      {editing?.kind === "industry" && (
        <IndustryEditor
          taxonomy={taxonomy}
          industry={editing.industry}
          defaultSector={editing.sector}
          model={model}
          canDraft={canDraft}
          onSaved={applied}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === "sector" && (
        <SectorEditor taxonomy={taxonomy} sector={editing.sector} onSaved={applied} onClose={() => setEditing(null)} />
      )}
      {pending && dialog && (
        <ConfirmDialog
          title={dialog.title}
          body={dialog.body}
          confirmLabel={dialog.label}
          cancelLabel={tx.cancel}
          danger={dialog.danger}
          busy={busy}
          error={actionError}
          onConfirm={() => void confirm()}
          onClose={closePending}
        />
      )}
    </>
  );
}
