import { useLanguage } from "@/i18n/LanguageProvider";

// 从企业名称到赋能方案的四步，以及团队协作的四个阶段。
export function Flow() {
  const { t } = useLanguage();
  const f = t.home.flow;

  return (
    <section id="flow" className="scroll-mt-24 border-y border-border/60 bg-muted/20">
      <div className="container-page py-20 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{f.title}</h2>
          <p className="mt-4 text-muted-foreground">{f.subtitle}</p>
        </div>

        <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {f.steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-border/70 bg-card/70 p-6">
              <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <h3 className="mt-4 font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-primary/25 bg-primary/[0.05] p-6">
          <h3 className="text-center text-sm font-semibold text-primary">{f.phasesTitle}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {f.phases.map((p) => (
              <div key={p.name} className="rounded-xl border border-border/60 bg-background/70 p-4">
                <div className="font-bold">{p.name}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.goal}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
