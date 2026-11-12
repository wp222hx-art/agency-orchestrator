import { useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/use-dialog";
import { useLanguage } from "@/i18n/LanguageProvider";

/**
 * 行业 / 板块编辑器共用的弹层外壳：标题栏、可滚动的表单区、底部的保存 / 取消。
 * 有未保存的修改时，关闭（Esc / 取消 / 右上角）先问一句——整页表单一下按没了很伤。点遮罩不关闭，原因相同。
 */
export function EditorShell({ title, dirty, busy, error, canSave, onSave, onClose, extra, children }: {
  title: string;
  dirty: boolean;
  busy: boolean;
  error: string | null;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
  /** 底部左侧的附加内容（比如起草结果提示） */
  extra?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const tx = t.enterprise.tx;
  const [asking, setAsking] = useState(false);
  const requestClose = () => {
    if (busy) return;
    if (dirty && !asking) { setAsking(true); return; }
    onClose();
  };
  const dialogRef = useDialog({ onEscape: requestClose });

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-0 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        className="flex h-full w-full max-w-3xl flex-col border-border/70 bg-background shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border"
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
          <h2 className="min-w-0 flex-1 truncate font-semibold">{title}</h2>
          <button type="button" onClick={requestClose} aria-label={t.enterprise.close} title={t.enterprise.close} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => { e.preventDefault(); if (canSave && !busy) onSave(); }}
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">{children}</div>
          <div className="border-t border-border/60 px-5 py-3.5">
            {error && <p role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-sm text-red-500">{error}</p>}
            {asking ? (
              <div role="alert" className="flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-sm text-amber-700 dark:text-amber-300">{tx.discardPrompt}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)}>{tx.keepEditing}</Button>
                <Button type="button" variant="destructive" size="sm" onClick={onClose}>{tx.discard}</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {extra && <div className="mr-auto min-w-0 text-xs leading-relaxed text-muted-foreground">{extra}</div>}
                <Button type="button" variant="ghost" size="sm" onClick={requestClose} disabled={busy}>{tx.cancel}</Button>
                <Button type="submit" size="sm" disabled={!canSave || busy}>
                  {busy && <Loader2 className="animate-spin" />}
                  {busy ? tx.saving : tx.save}
                </Button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-bold">{title}</legend>
      {hint && <p className="!mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {children}
    </fieldset>
  );
}
