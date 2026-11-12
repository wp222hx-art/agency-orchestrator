import { ArrowRight, Bot, FolderTree, Image, LayoutDashboard, Sparkles, Users, UsersRound, Workflow, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageProvider";

const MODULES: { id: "match" | "twin" | "taxonomy" | "agents"; icon: LucideIcon; query: string }[] = [
  { id: "match", icon: UsersRound, query: "" },
  { id: "twin", icon: Workflow, query: "?tab=twin" },
  { id: "taxonomy", icon: FolderTree, query: "?tab=taxonomy" },
  { id: "agents", icon: Bot, query: "?tab=agents" },
];

const TOOLS: { id: "studio" | "experts" | "creative" | "prompt"; icon: LucideIcon; path: string }[] = [
  { id: "studio", icon: LayoutDashboard, path: "/studio" },
  { id: "experts", icon: Users, path: "/experts" },
  { id: "creative", icon: Image, path: "/creative" },
  { id: "prompt", icon: Sparkles, path: "/prompt" },
];

// 四个模块（工商贸赋能页的四个标签）+ 配套工具 + 模型服务说明。全部是站内入口。
export function Modules() {
  const { t, prefix } = useLanguage();
  const m = t.home.modules;
  const tools = t.home.tools;
  const brain = t.home.brain;

  return (
    <section id="modules" className="container-page scroll-mt-24 py-20 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m.title}</h2>
        <p className="mt-4 text-muted-foreground">{m.subtitle}</p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {MODULES.map(({ id, icon: Icon, query }) => (
          <Link
            key={id}
            to={`${prefix("/enterprise")}${query}`}
            className="group flex gap-4 rounded-2xl border border-border/70 bg-card/60 p-6 transition hover:border-primary/40"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-6" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-lg font-bold">
                {m.items[id].title}
                <ArrowRight className="size-4 text-primary opacity-0 transition group-hover:opacity-100" />
              </span>
              <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">{m.items[id].desc}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-14">
        <h3 className="text-center text-xl font-bold">{tools.title}</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map(({ id, icon: Icon, path }) => (
            <Link
              key={id}
              to={prefix(path)}
              className="rounded-2xl border border-border/70 bg-card/60 p-5 transition hover:border-primary/40"
            >
              <Icon className="size-5 text-primary" />
              <div className="mt-3 font-semibold">{tools.items[id].title}</div>
              <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{tools.items[id].desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-gold/30 bg-gold/[0.06] p-6 text-center">
        <h3 className="text-base font-bold text-gold">{brain.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{brain.body}</p>
      </div>
    </section>
  );
}
