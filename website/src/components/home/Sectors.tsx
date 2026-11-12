import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SECTOR_ICONS } from "@/components/enterprise/shared";
import { useLanguage } from "@/i18n/LanguageProvider";

const ORDER = ["industry", "commerce", "trade"] as const;

// 三大板块：点进去直接落到「工商贸赋能」并预选该板块。
export function Sectors() {
  const { t, prefix } = useLanguage();
  const s = t.home.sectors;

  return (
    <section id="sectors" className="container-page scroll-mt-24 py-20 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{s.title}</h2>
        <p className="mt-4 text-muted-foreground">{s.subtitle}</p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {ORDER.map((id) => {
          const item = s.items[id];
          const Icon = SECTOR_ICONS[id];
          return (
            <Link
              key={id}
              to={`${prefix("/enterprise")}?sector=${id}`}
              className="group flex flex-col rounded-2xl border border-border/70 bg-card/60 p-6 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </span>
                <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-xs text-muted-foreground">
                  {s.industriesCount.replace("{n}", item.count)}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold">{item.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.examples.map((e) => (
                  <span key={e} className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{e}</span>
                ))}
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                {s.cta.replace("{sector}", item.name)}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
