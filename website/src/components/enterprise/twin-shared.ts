import { AppWindow, Bot, Box, Cog, Radar, ScanSearch, Truck } from "lucide-react";
import type { EnterpriseTwin, TwinCategory, TwinMetric, TwinMode } from "@/lib/studio";
import type { Translation } from "@/i18n/translations";
import { fill } from "./shared";

export type TwinText = Translation["enterprise"]["tw"];

export const CATEGORY_ICONS: Record<TwinCategory, typeof Bot> = {
  robot: Bot, inspection: ScanSearch, logistics: Truck, processing: Cog, sensing: Radar, software: AppWindow, other: Box,
};

/** 环节的作业方式配色：人工 = 琥珀，半自动 = 天蓝，自动 = 翠绿。颜色之外始终带文字标签，不只靠颜色区分。 */
export const MODE_STYLES: Record<TwinMode, { node: string; bar: string; badge: string }> = {
  manual: { node: "border-amber-500/50 bg-amber-500/[0.08]", bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  semi: { node: "border-sky-500/50 bg-sky-500/[0.08]", bar: "bg-sky-500", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  auto: { node: "border-emerald-500/50 bg-emerald-500/[0.08]", bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
};

export const modeText = (tw: TwinText): Record<TwinMode, string> => ({ manual: tw.modeManual, semi: tw.modeSemi, auto: tw.modeAuto });
export const categoryText = (tw: TwinText): Record<TwinCategory, string> => ({
  robot: tw.catRobot, inspection: tw.catInspection, logistics: tw.catLogistics, processing: tw.catProcessing,
  sensing: tw.catSensing, software: tw.catSoftware, other: tw.catOther,
});
export const confidenceText = (tw: TwinText): Record<TwinMetric["confidence"], string> => ({ high: tw.confHigh, medium: tw.confMedium, low: tw.confLow });

export const formatNumber = (value: number, en: boolean) => value.toLocaleString(en ? "en-US" : "zh-CN", { maximumFractionDigits: 2 });
export const formatTime = (iso: string, en: boolean) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(en ? "en-US" : "zh-CN", { dateStyle: "medium", timeStyle: "short" });
};

/** 导出成 Markdown。开头就写明这是估算，免得文件脱离页面后被当成实测结论。 */
export function twinMarkdown(twin: EnterpriseTwin, tw: TwinText, en: boolean): string {
  const name = (item: { name: string; nameEn: string }) => (en ? item.nameEn : item.name);
  const modes = modeText(tw);
  const cats = categoryText(tw);
  const conf = confidenceText(tw);
  const stageName = (id: string) => twin.target.find((s) => s.id === id)?.name ?? "";
  const lines: string[] = [
    `# ${twin.company || tw.typical} · ${name(twin.industry)}`,
    "",
    `> ${tw.notice}`,
    "",
    `${name(twin.sector)} / ${name(twin.industry)} · ${fill(tw.metaLine, { time: formatTime(twin.createdAt, en), model: twin.model })}`,
  ];
  if (twin.input) lines.push("", `${tw.inputLabel}: ${twin.input}`);
  if (twin.summary) lines.push("", twin.summary);

  lines.push("", `## ${tw.metricsTitle}`, "", `| | ${tw.now} | ${tw.target} | | ${tw.confidence} | ${tw.basis} |`, "|---|---|---|---|---|---|");
  for (const m of twin.metrics) {
    const source = m.baselineSource === "measured" ? tw.measured : tw.estimate;
    const gain = m.improvement === null ? "" : m.improvement > 0 ? fill(tw.improvement, { n: formatNumber(m.improvement, en) }) : tw.noGain;
    lines.push(`| ${m.name} (${m.unit || "-"}) | ${formatNumber(m.baseline, en)} (${source}) | ${formatNumber(m.target, en)} (${tw.estimate}) | ${gain} | ${conf[m.confidence]} | ${m.basis.replace(/\|/g, "/")} |`);
  }

  lines.push("", `## ${tw.laneCurrent}`, "");
  twin.current.forEach((s, i) => {
    lines.push(`${i + 1}. **${s.name}** (${modes[s.mode]})${s.note ? `: ${s.note}` : ""}`);
    s.issues.forEach((issue) => lines.push(`   - ${issue}`));
  });
  lines.push("", `## ${tw.laneTarget}`, "");
  twin.target.forEach((s, i) => {
    lines.push(`${i + 1}. **${s.name}** (${modes[s.mode]})${s.change ? `: ${s.change}` : ""}`);
    if (s.tech.length) lines.push(`   - ${tw.stageTech}: ${s.tech.join(en ? ", " : "、")}`);
  });

  if (twin.equipment.length) {
    lines.push("", `## ${tw.equipmentTitle}`, "", `> ${tw.equipmentNote}`, "");
    for (const e of twin.equipment) {
      lines.push(`- **${e.name}** (${cats[e.category]}${e.stage && stageName(e.stage) ? ` · ${fill(tw.atStage, { stage: stageName(e.stage) })}` : ""})`);
      e.specs.forEach((spec) => lines.push(`  - ${spec}`));
      if (e.replaces) lines.push(`  - ${tw.replaces}: ${e.replaces}`);
      if (e.benefit) lines.push(`  - ${tw.benefit}: ${e.benefit}`);
    }
  }
  if (twin.roadmap.length) {
    lines.push("", `## ${tw.roadmapTitle}`, "");
    for (const phase of twin.roadmap) {
      lines.push(`- **${phase.horizon}**`);
      phase.items.forEach((item) => lines.push(`  - ${item}`));
    }
  }
  for (const [title, items] of [[tw.assumptionsTitle, twin.assumptions], [tw.risksTitle, twin.risks]] as const) {
    if (!items.length) continue;
    lines.push("", `## ${title}`, "");
    items.forEach((item) => lines.push(`- ${item}`));
  }
  return `${lines.join("\n")}\n`;
}
