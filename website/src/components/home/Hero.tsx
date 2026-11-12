import { motion } from "framer-motion";
import { ArrowRight, LayoutDashboard, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageProvider";

// 首页主视觉：直接讲 momogsm 现在做的事（工业 / 商业 / 贸易企业的 AI 赋能），入口全部是站内页面。
export function Hero() {
  const { t, prefix } = useLanguage();
  const h = t.hero;

  return (
    <section className="relative overflow-hidden pt-28 md:pt-36">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <div className="container-page relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge className="mx-auto border-primary/30 bg-primary/10 text-primary">{h.badge}</Badge>
          <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            {h.title} <span className="block text-gradient">{h.titleHighlight}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {h.subtitle}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to={prefix("/enterprise")}>
                {h.ctaMatch}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={`${prefix("/enterprise")}?tab=twin`}>
                <Workflow className="size-5" />
                {h.ctaTwin}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={prefix("/studio")}>
                <LayoutDashboard className="size-5" />
                {h.ctaStudio}
              </Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {h.stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl px-4 py-4 text-center">
              <div className="text-2xl font-extrabold text-gradient">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
