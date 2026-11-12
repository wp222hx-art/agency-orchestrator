import { useEffect, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { RoleAvatar } from "@/components/studio/RoleAvatar";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/use-dialog";
import { useLanguage } from "@/i18n/LanguageProvider";
import { api, type EnterpriseCandidate, type EnterprisePhaseId } from "@/lib/studio";
import { errorText, fieldCls, fill } from "./shared";

/**
 * 给某个阶段增补专家。默认列出与该板块、行业最对口的；输入关键词则在整个专家库里搜。
 * 只查角色库，不调用模型（不花积分）。已经在团队里的专家不再列出——同一位专家不跨阶段重复。
 */
export function AddExpertDialog({ phase, phaseName, industry, roleLang, exclude, onAdd, onClose }: {
  phase: EnterprisePhaseId;
  phaseName: string;
  industry: string;
  roleLang: string;
  exclude: Set<string>;
  onAdd: (candidate: EnterpriseCandidate) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const x = t.enterprise;
  const title = fill(x.addExpertTitle, { phase: phaseName });
  const dialogRef = useDialog({ onEscape: onClose });
  const [query, setQuery] = useState("");
  const [list, setList] = useState<EnterpriseCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 输入停顿 250ms 再查；旧请求晚到时丢弃，免得结果倒着刷
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.enterpriseCandidates({ phase, industry, roleLang, q: query.trim() || undefined })
        .then((res) => { if (!cancelled) { setList(res.candidates); setError(null); } })
        .catch((e) => { if (!cancelled) { setList([]); setError(errorText(e)); } });
    }, query ? 250 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [phase, industry, roleLang, query]);

  const visible = (list ?? []).filter((c) => !exclude.has(c.path));

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-border/70 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
          <h2 className="min-w-0 flex-1 truncate font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={x.close} title={x.close} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 pt-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={40} placeholder={x.addExpertSearch} aria-label={x.addExpertSearch} className={`${fieldCls} pl-9`} />
          </label>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{x.addExpertHint}</p>
        </div>
        <div className="min-h-40 flex-1 overflow-y-auto px-5 py-4">
          {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-sm text-red-500">{error}</p>}
          {list === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{x.loading}</p>
          ) : visible.length === 0 ? (
            !error && <p className="text-sm text-muted-foreground">{x.addExpertEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((c) => (
                <li key={c.path} className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
                  <RoleAvatar seed={c.path} name={c.name} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.description}</p>}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => onAdd(c)} aria-label={`${x.add} ${c.name}`}>
                    <Plus />{x.add}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
