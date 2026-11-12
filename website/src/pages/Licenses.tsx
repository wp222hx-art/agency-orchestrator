import { SiteFooter } from "@/components/layout/SiteFooter";
import { Markdown } from "@/components/studio/Markdown";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useSeo } from "@/lib/useSeo";
// 仓库根的 THIRD_PARTY_NOTICES.md 是唯一来源；这一页只负责把它原样展示出来。
import notices from "../../../THIRD_PARTY_NOTICES.md?raw";

// 开源许可声明：许可证要求保留的版权与署名集中在这一处。
const body = notices.replace(/^# .*\n/, "");

export default function Licenses() {
  const { t } = useLanguage();
  const l = t.licenses;
  useSeo(`${l.title} · momogsm`, l.subtitle);

  return (
    <>
      <main className="pt-24">
        <div className="container-page max-w-3xl pb-20">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{l.title}</h1>
          <p className="mt-3 text-muted-foreground">{l.subtitle}</p>
          <div className="mt-8 rounded-2xl border border-border/70 bg-card/60 p-6">
            <Markdown>{body}</Markdown>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
