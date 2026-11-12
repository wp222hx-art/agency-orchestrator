import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageProvider";

export function FinalCta() {
  const { t, prefix } = useLanguage();
  const c = t.home.cta;

  return (
    <section className="container-page pb-20 md:pb-28">
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-10 text-center md:p-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/25 blur-[100px]" />
        <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">{c.title}</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">{c.desc}</p>

        <div className="relative mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to={prefix("/enterprise")}>
              {t.hero.ctaMatch}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to={prefix("/docs")}>{t.nav.docs}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
