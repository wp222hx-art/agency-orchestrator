import { Factory, Ship, Store } from "lucide-react";
import type { EnterpriseSectorId, TaxonomyListLimit } from "@/lib/studio";

export const SECTOR_ICONS: Record<EnterpriseSectorId, typeof Factory> = { industry: Factory, commerce: Store, trade: Ship };
export const fieldCls = "w-full rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 text-sm outline-none focus:border-primary/40 disabled:opacity-60";
export const cardCls = "rounded-2xl border border-border/70 bg-card/60 p-5";

/** 文案里的 {name} 占位符替换；没给值的占位符原样保留，方便一眼看出漏传。 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** 文本框 → 列表。loose：逗号 / 顿号 / 分号 / 换行都算分隔（关键词用）；否则每行一条。去空、去重。 */
export function parseList(text: string, loose: boolean): string[] {
  const parts = text.split(loose ? /[,，、;；\n]/ : /\n/).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  return [...new Set(parts)];
}

/** 与服务端同一套上限（服务端仍是最终裁决）：超条数 / 单条超长时返回给用户看的原因。 */
export function listError(items: string[], [maxItems, maxLen]: TaxonomyListLimit, tx: { tooMany: string; tooLong: string }): string | null {
  if (items.length > maxItems) return fill(tx.tooMany, { max: maxItems });
  const index = items.findIndex((item) => [...item].length > maxLen);
  return index >= 0 ? fill(tx.tooLong, { i: index + 1, max: maxLen }) : null;
}

export function scrollToId(id: string) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
