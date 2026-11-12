import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { EnterpriseMeta } from "@/lib/studio";
import { fill } from "./shared";

type Sector = EnterpriseMeta["sectors"][number];
type Industry = EnterpriseMeta["industries"][number];

/** 一个行业带了多少条知识：板块的方法与原则 + 行业五个维度。 */
export function knowledgeCount(meta: EnterpriseMeta | null, industryId: string): number {
  const industry = meta?.industries.find((i) => i.id === industryId);
  if (!meta || !industry) return 0;
  const sector = meta.sectors.find((s) => s.id === industry.sector);
  return (sector?.principles.length ?? 0) + meta.knowledgeDims.reduce((n, dim) => n + (industry.knowledge[dim.id]?.length ?? 0), 0);
}

/** 所选行业的知识基线：默认收起只显示条数，展开能逐条看；内容在「我的行业体系」里改。 */
export function KnowledgePanel({ meta, sector, industry, onEdit }: { meta: EnterpriseMeta; sector: Sector; industry: Industry; onEdit: () => void }) {
  const { t, lang } = useLanguage();
  const x = t.enterprise;
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const count = knowledgeCount(meta, industry.id);
  const groups = [
    { title: `${en ? sector.nameEn : sector.name} · ${x.knowledgePrinciples}`, items: sector.principles },
    ...meta.knowledgeDims.map((dim) => ({ title: en ? dim.nameEn : dim.name, items: industry.knowledge[dim.id] ?? [] })),
  ].filter((group) => group.items.length);

  return (
    <div className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4 text-primary" />{x.knowledgeTitle}
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{fill(x.knowledgeCount, { n: count })}</span>
        </h3>
        <div className="ml-auto flex items-center gap-1">
          {count > 0 && (
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {open ? x.knowledgeHide : x.knowledgeShow}{open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          )}
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
            <Pencil className="size-3.5" />{x.knowledgeEdit}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{count > 0 ? x.knowledgeNote : x.knowledgeEmpty}</p>
      {open && count > 0 && (
        <div className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-semibold text-foreground">{group.title}</h4>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                {group.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
