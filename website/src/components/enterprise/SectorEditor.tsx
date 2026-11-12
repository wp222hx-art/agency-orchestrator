import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { api, type EnterpriseTaxonomy, type TaxonomySector, type TaxonomySectorFields } from "@/lib/studio";
import { EditorShell } from "./EditorShell";
import { ListField } from "./ListField";
import { errorText, fieldCls, fill, listError, parseList } from "./shared";

/** 板块设置：关注重点、检索补充词、名称识别词、专家加分词、方法与原则、兜底行业。板块本身固定三个，不能增删改名。 */
export function SectorEditor({ taxonomy, sector, onSaved, onClose }: {
  taxonomy: EnterpriseTaxonomy;
  sector: TaxonomySector;
  onSaved: (taxonomy: EnterpriseTaxonomy) => void;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const tx = t.enterprise.tx;
  const en = lang === "en";
  const sep = en ? ", " : "、";
  const initial = useMemo(() => ({
    focus: sector.focus, search: sector.search, fallback: sector.fallback,
    hints: sector.hints.join(sep), boost: sector.boost.join(sep), principles: sector.principles.join("\n"),
    // 只在打开时取一次初始值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof initial, value: string) => setForm((cur) => ({ ...cur, [key]: value }));

  const limits = taxonomy.limits;
  const hints = parseList(form.hints, true);
  const boost = parseList(form.boost, true);
  const principles = parseList(form.principles, false);
  const own = taxonomy.industries.filter((i) => i.sector === sector.id);
  const focus = form.focus.replace(/\s+/g, " ").trim();
  const invalid = !focus || !!listError(hints, limits.hints, tx) || !!listError(boost, limits.boost, tx) || !!listError(principles, limits.principles, tx);

  const save = async () => {
    setBusy(true); setError(null);
    const body: TaxonomySectorFields = { focus, search: form.search.trim(), fallback: form.fallback, hints, boost, principles };
    try { onSaved(await api.enterpriseSectorUpdate(sector.id, body)); }
    catch (e) { setError(errorText(e)); setBusy(false); }
  };

  return (
    <EditorShell
      title={fill(tx.sectorTitle, { sector: en ? sector.nameEn : sector.name })}
      dirty={JSON.stringify(form) !== JSON.stringify(initial)}
      busy={busy}
      error={error}
      canSave={!invalid}
      onSave={() => void save()}
      onClose={onClose}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{tx.focus}</span>
        <textarea value={form.focus} onChange={(e) => set("focus", e.target.value)} maxLength={limits.focus} rows={2} className={`${fieldCls} resize-y leading-relaxed`} />
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{tx.focusHint}</span>
      </label>
      <ListField label={tx.principles} hint={tx.principlesHint} value={form.principles} onChange={(v) => set("principles", v)} limit={limits.principles} rows={6} />
      <ListField label={tx.hints} hint={tx.hintsHint} value={form.hints} onChange={(v) => set("hints", v)} limit={limits.hints} loose />
      <ListField label={tx.boost} hint={tx.boostHint} value={form.boost} onChange={(v) => set("boost", v)} limit={limits.boost} loose />
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-sm font-medium">{tx.searchWords}</span>
          <input value={form.search} onChange={(e) => set("search", e.target.value)} maxLength={limits.search} className={fieldCls} />
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{tx.searchWordsHint}</span>
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium">{tx.fallbackLabel}</span>
          <select value={form.fallback} onChange={(e) => set("fallback", e.target.value)} className={fieldCls}>
            {own.map((i) => <option key={i.id} value={i.id}>{en ? i.nameEn : i.name}</option>)}
          </select>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{tx.fallbackHint}</span>
        </label>
      </div>
    </EditorShell>
  );
}
