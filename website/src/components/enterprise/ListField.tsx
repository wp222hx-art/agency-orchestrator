import { useId } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TaxonomyListLimit } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { fieldCls, fill, listError, parseList } from "./shared";

/** 列表输入：一个文本框，每行一条（loose 时逗号 / 顿号也算分隔）。右上角实时显示条数，超限时就地说明。 */
export function ListField({ label, hint, value, onChange, limit, loose = false, rows }: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  limit: TaxonomyListLimit;
  loose?: boolean;
  rows?: number;
}) {
  const { t } = useLanguage();
  const tx = t.enterprise.tx;
  const id = useId();
  const items = parseList(value, loose);
  const error = listError(items, limit, tx);
  const rule = loose ? tx.looseSep : tx.onePerLine;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <span className={cn("shrink-0 text-xs tabular-nums", error ? "text-red-500" : "text-muted-foreground")}>
          {fill(tx.count, { n: items.length, max: limit[0] })}
        </span>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? (loose ? 2 : 4)}
        placeholder={rule}
        aria-invalid={!!error}
        aria-describedby={`${id}-hint`}
        className={cn(fieldCls, "resize-y leading-relaxed", error && "border-red-500/60")}
      />
      <p id={`${id}-hint`} className={cn("mt-1 text-xs leading-relaxed", error ? "text-red-500" : "text-muted-foreground")}>
        {error ?? (hint ? `${hint}${rule}。` : `${rule}。`)}
      </p>
    </div>
  );
}
