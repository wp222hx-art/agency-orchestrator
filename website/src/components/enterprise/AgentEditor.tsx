import { useMemo, useState } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageProvider";
import { api, type AdminAgent, type AgentAdminState } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { EditorShell, FormSection } from "./EditorShell";
import { ListField } from "./ListField";
import { errorText, fieldCls, fill, listError, parseList } from "./shared";
import { formatTime } from "./twin-shared";

/**
 * 一位智能体的迭代：改迭代要求（每次保存升一版）、让 momo智脑按反馈起草、查看版本记录并回滚。
 * 起草只把草稿填进输入框，不保存——要不要采纳由管理员决定（建议 → 校验 → 确认 → 留痕）。
 */
export function AgentEditor({ state, agent, roleLang, model, canSuggest, onSaved, onClose, onSpent }: {
  state: AgentAdminState;
  agent: AdminAgent;
  roleLang: string;
  model: string;
  canSuggest: boolean;
  /** 保存 / 回滚成功：带回最新的完整列表。keepOpen = 回滚后留在编辑器里看结果 */
  onSaved: (state: AgentAdminState, keepOpen?: boolean) => void;
  onClose: () => void;
  onSpent: () => void;
}) {
  const { t, lang } = useLanguage();
  const ag = t.enterprise.ag;
  const tx = t.enterprise.tx;
  const en = lang === "en";
  const initial = useMemo(() => agent.notes.join("\n"), [agent.notes]);
  const [text, setText] = useState(initial);
  // 草稿来自 momo智脑且之后没再手改时，保存记为「采纳草稿」
  const [fromAi, setFromAi] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [rolling, setRolling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const notes = parseList(text, false);
  const invalid = !!listError(notes, state.limits.notes, tx);
  const dirty = text !== initial;
  const sourceText = { user: ag.srcUser, ai: ag.srcAi, rollback: ag.srcRollback };
  const history = [...agent.history].reverse();

  const save = async () => {
    setBusy(true); setError(null);
    try { onSaved(await api.enterpriseAgentUpdate({ role: agent.path, roleLang, notes, source: fromAi ? "ai" : "user" })); }
    catch (e) { setError(errorText(e)); setBusy(false); }
  };

  const suggest = async () => {
    if (feedback.trim().length < 4) { setError(ag.feedbackShort); return; }
    setSuggesting(true); setError(null); setInfo(null);
    try {
      const r = await api.enterpriseAgentSuggest({ role: agent.path, roleLang, feedback: feedback.trim(), model });
      setText(r.notes.join("\n")); setFromAi(true);
      setInfo(fill(ag.suggestDone, { why: r.why }));
    } catch (e) { setError(errorText(e)); }
    finally { setSuggesting(false); onSpent(); }
  };

  const rollback = async (revision: number) => {
    if (dirty) { setError(ag.unsavedRollback); return; }
    setRolling(revision); setError(null); setInfo(null);
    try {
      const next = await api.enterpriseAgentRollback({ role: agent.path, roleLang, revision });
      const fresh = next.agents.find((a) => a.path === agent.path);
      if (fresh) { setText(fresh.notes.join("\n")); setFromAi(false); }
      onSaved(next, true);
    } catch (e) { setError(errorText(e)); }
    finally { setRolling(null); }
  };

  return (
    <EditorShell
      title={fill(ag.editorTitle, { name: agent.name })}
      dirty={dirty}
      busy={busy}
      error={error}
      canSave={dirty && !invalid && !suggesting && rolling === null}
      onSave={() => void save()}
      onClose={onClose}
      extra={info}
    >
      <div className="text-sm">
        <p className="leading-relaxed text-muted-foreground">{agent.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {agent.categoryName} · {agent.path}
          {agent.revision > 0 && <> · {fill(ag.revision, { n: agent.revision })}</>}
          {" · "}{agent.usage.teams > 0 ? fill(ag.usage, { n: agent.usage.teams }) : ag.unused}
        </p>
        {!agent.enabled && <p role="status" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{ag.disabledWarn}</p>}
      </div>

      <ListField
        label={ag.notes}
        hint={ag.notesHint}
        value={text}
        onChange={(v) => { setText(v); setFromAi(false); }}
        limit={state.limits.notes}
        rows={6}
      />

      <FormSection title={ag.aiSection} hint={canSuggest ? ag.suggestHint : ag.suggestUnavailable}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{ag.feedback}</span>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            maxLength={state.limits.feedback}
            rows={3}
            placeholder={ag.feedbackPlaceholder}
            disabled={!canSuggest}
            className={cn(fieldCls, "resize-y leading-relaxed")}
          />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => void suggest()} disabled={!canSuggest || suggesting || busy}>
          {suggesting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {suggesting ? ag.suggesting : ag.suggest}
        </Button>
      </FormSection>

      <FormSection title={ag.history} hint={fill(ag.historyNote, { n: state.limits.history })}>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{ag.historyEmpty}</p>
        ) : (
          <ol className="space-y-2.5">
            {history.map((h) => {
              const isCurrent = h.revision === agent.revision;
              return (
                <li key={h.revision} className={cn("rounded-xl border p-3.5", isCurrent ? "border-primary/50 bg-primary/[0.06]" : "border-border/60")}>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                    <span className="font-semibold text-foreground">{fill(ag.revision, { n: h.revision })}</span>
                    {isCurrent && <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">{ag.current}</span>}
                    <span className="text-muted-foreground">{sourceText[h.source]} · {formatTime(h.at, en)}</span>
                    {!isCurrent && (
                      <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={() => void rollback(h.revision)} disabled={rolling !== null || busy || suggesting}>
                        {rolling === h.revision ? <Loader2 className="animate-spin" /> : <RotateCcw />}{ag.rollback}
                      </Button>
                    )}
                  </div>
                  {h.notes.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">{ag.noNotes}</p>
                  ) : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">{h.notes.map((note) => <li key={note}>{note}</li>)}</ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </FormSection>
    </EditorShell>
  );
}
