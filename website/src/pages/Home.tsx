import { FinalCta } from "@/components/home/FinalCta";
import { Flow } from "@/components/home/Flow";
import { Hero } from "@/components/home/Hero";
import { Modules } from "@/components/home/Modules";
import { Preview } from "@/components/home/Preview";
import { Sectors } from "@/components/home/Sectors";
import { SiteFooter } from "@/components/layout/SiteFooter";

// 首页按 momogsm 现在的体系组织：三大板块 → 协作流程 → 四个模块与配套工具 → 实际界面。
export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <Sectors />
        <Flow />
        <Modules />
        <Preview />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
