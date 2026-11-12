import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, RotateCcw, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RoleAvatar } from "@/components/studio/RoleAvatar";
import { useLanguage } from "@/i18n/LanguageProvider";
import { api, type AdminAgent, type AgentAdminState, type EnterpriseMeta } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { AgentEditor } from "./AgentEditor";
import { EditorShell } from "./EditorShell";
import { ListField } from "./ListField";
import { cardCls, errorText, fieldCls, fill, listError, parseList } from "./shared";

const PAGE = 40;
type StatusFilter = "all" | "enabled" | "disabled" | "tuned";

/** 通用迭代思路的编辑器：写进每一位专家任务的几条原则。 */
function PrinciplesEditor({ state, roleLang, onSaved, onClose }: {
  state: AgentAdminState; roleLang: string; onSaved: (state: AgentAdminState) => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const ag = t.enterprise.ag;
  const tx = t.enterprise.tx;
  const initial = useMemo(() => state.principles.join("\n"), [state.principles]);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = parseList(text, false);
  const invalid = items.length === 0 || !!listError(items, state.limits.principles, tx);

  const save = async () => {
    setBusy(true); setError(null);
    try { onSaved(await api.enterpriseAgentPrinciples({ principles: items, roleLang })); }
    catch (e) { setError(errorText(e)); setBusy(false); }
  };

  return (
    <EditorShell
      title={ag.principlesEditTitle}
      dirty={text !== initial}
      busy={busy}
      error={error}
      canSave={text !== initial && !invalid}
      onSave={() => void save()}
      onClose={onClose}
      extra={items.length === 0 ? ag.principlesRequired : undefined}
    >
      <ListField label={ag.principlesLabel} hint={ag.principlesHint} value={text} onChange={setText} limit={state.limits.principles} rows={9} />
    </EditorShell>
  );
}

/**
 * 智能体后台：管理专家库里的每一位智能体。
 * 启用 / 停用立刻生效；迭代要求和通用迭代思路都要管理员确认后才保存，留版本、可回滚。
 */
export function AgentAdmin({ meta, roleLang, onRoleLang, model, canSuggest, onChanged, onSpent }: {
  meta: EnterpriseMeta;
  roleLang: string;
  onRoleLang: (lib: string) => void;
  model: string;
  canSuggest: boolean;
  /** 通用迭代思路改了：页面上的 meta 要跟着刷新 */
  onChanged: () => void;
  onSpent: () => void;
}) {
  const { t } = useLanguage();
  const ag = t.enterprise.ag;
  const [state, setState] = useState<AgentAdminState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [shown, setShown] = useState(PAGE);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editPrinciples, setEditPrinciples] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setState(await api.enterpriseAgents(roleLang)); }
    catch (e) { setError(`${ag.loadError}${errorText(e)}`); }
  }, [roleLang, ag.loadError]);
  useEffect(() => { void load(); }, [load]);
  // 换了筛选条件就回到第一页
  useEffect(() => { setShown(PAGE); }, [query, category, status, roleLang]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of state?.agents ?? []) if (!map.has(a.category)) map.set(a.category, a.categoryName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [state]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state?.agents ?? []).filter((a) =>
      (!category || a.category === category)
      && (status === "all" || (status === "enabled" ? a.enabled : status === "disabled" ? !a.enabled : a.notes.length > 0))
      && (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.path.toLowerCase().includes(q)));
  }, [state, query, category, status]);

  const toggle = async (agent: AdminAgent) => {
    setToggling(agent.path); setError(null);
    try { setState(await api.enterpriseAgentUpdate({ role: agent.path, roleLang, enabled: !agent.enabled })); }
    catch (e) { setError(errorText(e)); }
    finally { setToggling(null); }
  };

  const resetPrinciples = async () => {
    setResetBusy(true); setResetError(null);
    try { setState(await api.enterpriseAgentPrinciples({ principles: null, roleLang })); setResetting(false); onChanged(); }
    catch (e) { setResetError(errorText(e)); }
    finally { setResetBusy(false); }
  };

  const editingAgent = editing ? state?.agents.find((a) => a.path === editing) ?? null : null;
  const used = state ? state.agents.filter((a) => a.usage.teams > 0).length : 0;
  const stats: [string, number][] = state ? [[ag.statTotal, state.total], [ag.statEnabled, state.enabled], [ag.statTuned, state.tuned], [ag.statUsed, used]] : [];

  return (
    <>
      <div className="space-y-5">
        <section className={cardCls}>
          <p className="text-sm leading-relaxed text-muted-foreground">{ag.intro}</p>
          <p role="note" className="mt-3 flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/40 p-3.5 text-sm leading-relaxed text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /><span>{ag.notice}</span>
          </p>
          {(state?.error || meta.agents.error) && <p role="alert" className="mt-3 text-sm text-amber-600 dark:text-amber-400">{state?.error || meta.agents.error}</p>}
          {state && (
            <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map(([name, value]) => (
                <div key={name} className="rounded-xl border border-border/60 px-4 py-3">
                  <dt className="text-xs text-muted-foreground">{name}</dt>
                  <dd className="mt-0.5 text-2xl font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {error && <p role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!state && !error && <p className={cn(cardCls, "text-sm text-muted-foreground")}>{t.enterprise.loading}</p>}

        {state && (
          <>
            {/* 所有智能体共同的迭代思路 */}
            <section className={cardCls} aria-label={ag.principlesTitle}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 className="text-base font-bold">{ag.principlesTitle}</h2>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", state.customPrinciples ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                  {state.customPrinciples ? ag.principlesCustom : ag.principlesDefault}
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {state.customPrinciples && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setResetError(null); setResetting(true); }}><RotateCcw />{ag.resetPrinciples}</Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditPrinciples(true)}><Pencil />{ag.editPrinciples}</Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{ag.principlesNote}</p>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                {state.principles.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </section>

            {/* 智能体列表 */}
            <section className={cardCls} aria-label={ag.statTotal}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_11rem]">
                <label className="relative block">
                  <span className="sr-only">{ag.search}</span>
                  <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ag.search} className={cn(fieldCls, "pl-9")} />
                </label>
                <label>
                  <span className="sr-only">{ag.allCategories}</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls}>
                    <option value="">{ag.allCategories}</option>
                    {categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">{ag.filterLabel}</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={fieldCls}>
                    <option value="all">{ag.filterAll}</option>
                    <option value="enabled">{ag.filterEnabled}</option>
                    <option value="disabled">{ag.filterDisabled}</option>
                    <option value="tuned">{ag.filterTuned}</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">{ag.library}</span>
                  <select value={roleLang} onChange={(e) => onRoleLang(e.target.value)} className={fieldCls}>
                    {meta.roleLibs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </label>
              </div>
              <p role="status" className="mt-3 text-xs text-muted-foreground">{fill(ag.showing, { n: Math.min(shown, filtered.length), total: filtered.length })}</p>

              {filtered.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">{ag.empty}</p>
              ) : (
                <ul className="mt-3 divide-y divide-border/60">
                  {filtered.slice(0, shown).map((a) => (
                    <li key={a.path} className={cn("flex flex-wrap items-start gap-3 py-3.5", !a.enabled && "opacity-70")}>
                      <RoleAvatar seed={a.path} name={a.name} className="size-9" />
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                          {a.name}
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">{a.categoryName}</span>
                          {a.notes.length > 0 && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                              {fill(ag.revision, { n: a.revision })} · {fill(ag.notesCount, { n: a.notes.length })}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{a.description}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{a.usage.teams > 0 ? fill(ag.usage, { n: a.usage.teams }) : ag.unused}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">{a.enabled ? ag.enabled : ag.disabled}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={a.enabled}
                          aria-label={fill(ag.toggle, { name: a.name })}
                          disabled={toggling !== null}
                          onClick={() => void toggle(a)}
                          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60", a.enabled ? "bg-emerald-500" : "bg-muted-foreground/40")}
                        >
                          <span className={cn("absolute left-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-white shadow transition-transform", a.enabled && "translate-x-5")}>
                            {toggling === a.path && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                          </span>
                        </button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(a.path)}><Pencil />{ag.manage}</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {filtered.length > shown && (
                <div className="mt-4 text-center">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>{ag.more}</Button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {state && editingAgent && (
        <AgentEditor
          // 回滚 / 保存后版本号变了：重新挂载，让输入框和「有没有未保存修改」的判断都以新版本为准
          key={`${editingAgent.path}:${editingAgent.revision}`}
          state={state}
          agent={editingAgent}
          roleLang={roleLang}
          model={model}
          canSuggest={canSuggest}
          onSaved={(next, keepOpen) => { setState(next); if (!keepOpen) setEditing(null); }}
          onClose={() => setEditing(null)}
          onSpent={onSpent}
        />
      )}
      {state && editPrinciples && (
        <PrinciplesEditor
          state={state}
          roleLang={roleLang}
          onSaved={(next) => { setState(next); setEditPrinciples(false); onChanged(); }}
          onClose={() => setEditPrinciples(false)}
        />
      )}
      {resetting && (
        <ConfirmDialog
          title={ag.resetTitle}
          body={ag.resetBody}
          confirmLabel={ag.confirm}
          cancelLabel={ag.cancel}
          busy={resetBusy}
          error={resetError}
          onConfirm={() => void resetPrinciples()}
          onClose={() => setResetting(false)}
        />
      )}
    </>
  );
}
