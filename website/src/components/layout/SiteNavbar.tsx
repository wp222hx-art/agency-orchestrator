import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

type NavChild = { to: string; label: string; external?: boolean };
type NavItem = { id?: string; to?: string; label: string; external?: boolean; children?: NavChild[] };

export function SiteNavbar() {
  const { t, prefix } = useLanguage();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // 顶层只放站内入口：文档 / 教程 / 更新日志 / 开源许可声明 收进「帮助」下拉。不挂任何外站链接。
  const links: NavItem[] = [
    { to: prefix("/studio"), label: t.nav.studio },
    { to: prefix("/experts"), label: t.nav.experts },
    { to: prefix("/enterprise"), label: t.nav.enterprise },
    { to: prefix("/creative"), label: t.nav.creative },
    { to: prefix("/prompt"), label: t.nav.prompt },
    { id: "help", label: t.nav.help, children: [
      { to: prefix("/docs"), label: t.nav.docs },
      { to: prefix("/tutorials"), label: t.nav.tutorials },
      { to: prefix("/changelog"), label: t.nav.changelog },
      { to: prefix("/licenses"), label: t.nav.licenses },
    ] },
  ];

  const linkCls = "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <nav className="container-page flex h-16 items-center justify-between">
        <Link to={prefix("/")} className="flex items-center gap-2.5 font-bold" onClick={() => setOpen(false)}>
          <img src={SITE.logo} alt="" className="h-8 w-8 drop-shadow-[0_4px_10px_rgba(99,102,241,0.35)]" />
          <span className="text-[15px]">{SITE.name}</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) =>
            l.children ? (
              <div key={l.id} className="group relative">
                <button className={cn(linkCls, "flex items-center gap-0.5")}>
                  {l.label}
                  <ChevronDown className="size-3.5 opacity-60" />
                </button>
                {/* pt-2 衔接按钮与下拉,避免移动鼠标时下拉消失 */}
                <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100 focus-within:visible focus-within:opacity-100">
                  <div className="min-w-44 rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-lg backdrop-blur-xl">
                    {l.children.map((c) =>
                      c.external ? (
                        <a key={c.to} href={c.to} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          {c.label}
                        </a>
                      ) : (
                        <NavLink key={c.to} to={c.to} className={({ isActive }) => cn("block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted hover:text-foreground", isActive && pathname === c.to ? "text-foreground" : "text-muted-foreground")}>
                          {c.label}
                        </NavLink>
                      ),
                    )}
                  </div>
                </div>
              </div>
            ) : l.external ? (
              <a key={l.to} href={l.to} target="_blank" rel="noreferrer" className={linkCls}>
                {l.label}
              </a>
            ) : (
              <NavLink
                key={l.to}
                to={l.to!}
                className={({ isActive }) => cn(linkCls, isActive && pathname === l.to ? "text-foreground" : "")}
              >
                {l.label}
              </NavLink>
            ),
          )}
        </div>

        {/* 右侧原有的语言 / 主题 / Star / GitHub 已移除：语言跟随浏览器（或 ?lang=zh|en），主题跟随系统 */}
        <div className="flex items-center md:hidden">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 md:hidden"
            onClick={() => setOpen((p) => !p)}
            aria-label="Menu"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border/60 bg-background/95 md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((l) =>
              l.children ? (
                <div key={l.id} className="py-1">
                  <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">{l.label}</div>
                  {l.children.map((c) => (
                    <a
                      key={c.to}
                      href={c.to}
                      target={c.external ? "_blank" : undefined}
                      rel={c.external ? "noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2.5 pl-5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {c.label}
                    </a>
                  ))}
                </div>
              ) : (
                <a
                  key={l.to}
                  href={l.to}
                  target={l.external ? "_blank" : undefined}
                  rel={l.external ? "noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {l.label}
                </a>
              ),
            )}
          </div>
        </div>
      )}
    </header>
  );
}
