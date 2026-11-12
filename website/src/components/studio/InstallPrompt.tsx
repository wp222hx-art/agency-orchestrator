import { useEffect } from "react";
import { TerminalSquare, X } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SITE } from "@/lib/site";

// 演示模式下点「运行 / 填 key」时弹出：引导在本机启动引擎（部署步骤见站内文档）。
export function InstallPrompt({ onClose }: { onClose: () => void }) {
  const { t, prefix } = useLanguage();
  const d = t.studio.demo;
  const cmd = SITE.startCmd;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={d.installTitle}
        className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-border/70 bg-background shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <h3 className="text-lg font-bold">{d.installTitle}</h3>
          <button onClick={onClose} aria-label={d.close} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{d.installDesc}</p>

          <div className="mt-4 rounded-xl border border-border/70 bg-card/50 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                <TerminalSquare className="size-5" />
              </span>
              <div className="min-w-0">
                <span className="block font-semibold">{d.optCliTitle}</span>
                <span className="block text-xs text-muted-foreground">{d.optCliDesc}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2 font-mono text-xs">
              <span className="truncate">{cmd}</span>
              <CopyButton value={cmd} />
            </div>
            <a href={prefix("/docs/install")} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
              {d.optCliCta} →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
