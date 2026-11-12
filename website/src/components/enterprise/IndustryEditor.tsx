import { useMemo, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  api,
  type EnterpriseKnowledgeDimId,
  type EnterpriseSectorId,
  type EnterpriseTaxonomy,
  type TaxonomyIndustry,
  type TaxonomyIndustryFields,
} from "@/lib/studio";
import { EditorShell, FormSection } from "./EditorShell";
import { ListField } from "./ListField";
import { errorText, fieldCls, fill, listError, parseList } from "./shared";

type ListKey = "keywords" | "boost" | "pains" | "scenarios";
interface Form {
  name: string; nameEn: string; sector: EnterpriseSectorId;
  keywords: string; boost: string; pains: string; scenarios: string;
  knowledge: Record<EnterpriseKnowledgeDimId, string>;
}
const LOOSE: Record<ListKey, boolean> = { keywords: true, boost: true, pains: false, scenarios: false };

/** 新增 / 编辑一个行业：名称与板块、识别与匹配用的词、通用参考清单、五个维度的知识基线。 */
export function IndustryEditor({ taxonomy, industry, defaultSector, model, canDraft, onSaved, onClose }: {
  taxonomy: EnterpriseTaxonomy;
  /** null = 新增 */
  industry: TaxonomyIndustry | null;
  defaultSector: EnterpriseSectorId;
  model: string;
  /** momo智脑已连接才能起草 */
  canDraft: boolean;
  onSaved: (taxonomy: EnterpriseTaxonomy) => void;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const tx = t.enterprise.tx;
  const en = lang === "en";
  const sep = en ? ", " : "、";
  const toText = (list: string[], loose: boolean) => list.join(loose ? sep : "\n");

  const initial = useMemo<Form>(() => ({
    name: industry?.name ?? "",
    // 没单独起英文名时服务端会用中文名顶上；编辑时把它当作「没填」，免得改了中文名英文名还是旧的
    nameEn: industry && industry.nameEn !== industry.name ? industry.nameEn : "",
    sector: industry?.sector ?? defaultSector,
    keywords: toText(industry?.keywords ?? [], true),
    boost: toText(industry?.boost ?? [], true),
    pains: toText(industry?.pains ?? [], false),
    scenarios: toText(industry?.scenarios ?? [], false),
    knowledge: Object.fromEntries(taxonomy.dims.map((dim) => [dim.id, toText(industry?.knowledge[dim.id] ?? [], false)])) as Form["knowledge"],
    // 只在打开时取一次初始值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const [form, setForm] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((cur) => ({ ...cur, [key]: value }));
  const setDim = (id: EnterpriseKnowledgeDimId, value: string) => setForm((cur) => ({ ...cur, knowledge: { ...cur.knowledge, [id]: value } }));

  const limits = taxonomy.limits;
  const lists = {
    keywords: parseList(form.keywords, true), boost: parseList(form.boost, true),
    pains: parseList(form.pains, false), scenarios: parseList(form.scenarios, false),
  };
  const knowledge = Object.fromEntries(taxonomy.dims.map((dim) => [dim.id, parseList(form.knowledge[dim.id] ?? "", false)])) as TaxonomyIndustryFields["knowledge"];
  const name = form.name.trim();
  const invalid = (Object.keys(lists) as ListKey[]).some((key) => listError(lists[key], limits[key], tx))
    || taxonomy.dims.some((dim) => listError(knowledge[dim.id], limits.knowledge, tx));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const isFallback = !!industry && taxonomy.sectors.some((s) => s.fallback === industry.id);

  const save = async () => {
    if (!name) { setError(tx.nameRequired); return; }
    setBusy(true); setError(null);
    const body: TaxonomyIndustryFields = { sector: form.sector, name, nameEn: form.nameEn.trim(), ...lists, knowledge };
    try {
      onSaved(industry ? await api.enterpriseIndustryUpdate(industry.id, body) : await api.enterpriseIndustryAdd(body));
    } catch (e) {
      setError(errorText(e)); setBusy(false);
    }
  };

  // 起草只填空着的栏目：用户已经写的内容一个字都不动
  const draft = async () => {
    if (!name) { setError(tx.nameRequired); return; }
    setDrafting(true); setError(null); setNotice(null);
    try {
      const { draft: d } = await api.enterpriseTaxonomyDraft({ sector: form.sector, name, model: model || undefined });
      let filled = 0;
      setForm((cur) => {
        const next: Form = { ...cur, knowledge: { ...cur.knowledge } };
        if (!cur.nameEn.trim() && d.nameEn && d.nameEn !== d.name) { next.nameEn = d.nameEn; filled++; }
        for (const key of Object.keys(LOOSE) as ListKey[]) {
          if (!cur[key].trim() && d[key]?.length) { next[key] = toText(d[key], LOOSE[key]); filled++; }
        }
        for (const dim of taxonomy.dims) {
          if (!(cur.knowledge[dim.id] ?? "").trim() && d.knowledge?.[dim.id]?.length) { next.knowledge[dim.id] = toText(d.knowledge[dim.id], false); filled++; }
        }
        return next;
      });
      setNotice(filled ? fill(tx.draftDone, { n: filled }) : tx.draftNothing);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setDrafting(false);
    }
  };

  return (
    <EditorShell
      title={industry ? fill(tx.editTitle, { name: industry.name }) : tx.addTitle}
      dirty={dirty}
      busy={busy}
      error={error}
      canSave={!invalid && !drafting}
      onSave={() => void save()}
      onClose={onClose}
      extra={notice}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">{tx.name}</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={limits.name} className={fieldCls} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium">{tx.sector}</span>
          <select value={form.sector} disabled={isFallback} onChange={(e) => set("sector", e.target.value as EnterpriseSectorId)} className={fieldCls}>
            {taxonomy.sectors.map((s) => <option key={s.id} value={s.id}>{en ? s.nameEn : s.name}</option>)}
          </select>
          {isFallback && <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{tx.sectorLocked}</span>}
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium">{tx.nameEn}</span>
          <input value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} maxLength={limits.nameEn} className={fieldCls} />
        </label>
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" variant="outline" disabled={!canDraft || drafting || busy || !name} onClick={() => void draft()}>
            {drafting ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {drafting ? tx.drafting : tx.draft}
          </Button>
          <p className="min-w-0 flex-1 basis-60 text-xs leading-relaxed text-muted-foreground">{canDraft ? tx.draftHint : tx.draftUnavailable}</p>
        </div>
      </div>

      <FormSection title={tx.matchSection}>
        <ListField label={tx.keywords} hint={tx.keywordsHint} value={form.keywords} onChange={(v) => set("keywords", v)} limit={limits.keywords} loose />
        <ListField label={tx.boost} hint={tx.boostHint} value={form.boost} onChange={(v) => set("boost", v)} limit={limits.boost} loose />
      </FormSection>

      <FormSection title={tx.referenceSection} hint={tx.referenceHint}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ListField label={tx.pains} value={form.pains} onChange={(v) => set("pains", v)} limit={limits.pains} />
          <ListField label={tx.scenarios} value={form.scenarios} onChange={(v) => set("scenarios", v)} limit={limits.scenarios} />
        </div>
      </FormSection>

      <FormSection title={tx.knowledgeSection} hint={tx.knowledgeHint}>
        {taxonomy.dims.map((dim) => (
          <ListField key={dim.id} label={en ? dim.nameEn : dim.name} value={form.knowledge[dim.id] ?? ""} onChange={(v) => setDim(dim.id, v)} limit={limits.knowledge} rows={4} />
        ))}
      </FormSection>
    </EditorShell>
  );
}
