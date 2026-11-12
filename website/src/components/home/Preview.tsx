import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageProvider";

// 实际界面预览：截图取自本产品的「数字孪生推演」页（一条模拟推演的示例结果）。
export function Preview() {
  const { t, prefix } = useLanguage();
  const p = t.home.preview;
  const to = `${prefix("/enterprise")}?tab=twin`;

  return (
    <section className="container-page pb-20 md:pb-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{p.title}</h2>
        <p className="mt-4 text-muted-foreground">{p.desc}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto mt-10 max-w-5xl"
      >
        <Link
          to={to}
          className="group block overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/10 transition hover:border-primary/40 hover:shadow-primary/10"
        >
          <div className="flex items-center gap-2 border-b border-border/70 bg-muted/60 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
            <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
            <span className="ml-3 text-xs text-muted-foreground">{p.barLabel}</span>
          </div>
          <img
            src="/screenshots/momogsm-twin.webp"
            alt={p.imageAlt}
            loading="lazy"
            className="w-full transition duration-300 group-hover:scale-[1.01]"
          />
        </Link>
        <p className="mt-3 text-center text-xs text-muted-foreground">{p.caption}</p>

        <div className="mt-6 flex justify-center">
          <Link
            to={to}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90"
          >
            {p.cta}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
