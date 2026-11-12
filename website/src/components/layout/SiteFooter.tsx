import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SITE } from "@/lib/site";

// 页脚只放 momogsm 自己的站内入口：不挂外部仓库 / 包管理站 / 第三方学习站。
// 依许可证必须保留的版权与署名统一收在「开源许可声明」一页，不占品牌位。
export function SiteFooter() {
  const { t, prefix } = useLanguage();
  const f = t.footer;

  const cols = [
    {
      title: f.product,
      links: [
        { label: f.links.studio, href: prefix("/studio") },
        { label: f.links.experts, href: prefix("/experts") },
        { label: f.links.enterprise, href: prefix("/enterprise") },
        { label: f.links.creative, href: prefix("/creative") },
        { label: f.links.prompt, href: prefix("/prompt") },
      ],
    },
    {
      title: f.help,
      links: [
        { label: f.links.docs, href: prefix("/docs") },
        { label: f.links.tutorials, href: prefix("/tutorials") },
        { label: f.links.changelog, href: prefix("/changelog") },
      ],
    },
    {
      title: f.about,
      links: [
        { label: f.links.features, href: prefix("/#modules") },
        { label: f.links.licenses, href: prefix("/licenses") },
      ],
    },
  ];

  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link to={prefix("/")} className="flex items-center gap-2.5 font-bold">
            <img src={SITE.logo} alt="" className="h-8 w-8" />
            {SITE.name}
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{f.tagline}</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">{f.brandLine}</p>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold">{col.title}</h4>
            <ul className="mt-3 space-y-2.5 text-sm">
              {col.links.map((l) =>
                l.href.includes("#") ? (
                  <li key={l.label}>
                    <a href={l.href} className="text-muted-foreground hover:text-foreground">
                      {l.label}
                    </a>
                  </li>
                ) : (
                  <li key={l.label}>
                    <Link to={l.href} className="text-muted-foreground hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} {SITE.name}</span>
          <Link to={prefix("/licenses")} className="hover:text-foreground">
            {f.copyright}
          </Link>
        </div>
      </div>
    </footer>
  );
}
