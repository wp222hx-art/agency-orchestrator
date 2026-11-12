import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { BackToTop } from "@/components/layout/BackToTop";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageProvider";

const Home = lazy(() => import("@/pages/Home"));
const Studio = lazy(() => import("@/pages/Studio"));
const Experts = lazy(() => import("@/pages/Experts"));
const EnterpriseMatch = lazy(() => import("@/pages/EnterpriseMatch"));
const PromptStudio = lazy(() => import("@/pages/PromptStudio"));
const CreativeLibrary = lazy(() => import("@/pages/CreativeLibrary"));
const Docs = lazy(() => import("@/pages/Docs"));
const Tutorials = lazy(() => import("@/pages/Tutorials"));
const TutorialDetail = lazy(() => import("@/pages/TutorialDetail"));
const Changelog = lazy(() => import("@/pages/Changelog"));
const Licenses = lazy(() => import("@/pages/Licenses"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Fallback() {
  const { t } = useLanguage();
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">{t.common.loading}</div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ScrollToTop />
      <SiteNavbar />
      <BackToTop />
      <Suspense fallback={<Fallback />}>
        <Routes>
          {["/", "/zh", "/en"].map((p) => (
            <Route key={p} path={p} element={<Home />} />
          ))}
          {["/studio", "/zh/studio", "/en/studio"].map((p) => (
            <Route key={p} path={p} element={<Studio />} />
          ))}
          {["/experts", "/zh/experts", "/en/experts"].map((p) => (
            <Route key={p} path={p} element={<Experts />} />
          ))}
          {["/enterprise", "/zh/enterprise", "/en/enterprise"].map((p) => (
            <Route key={p} path={p} element={<EnterpriseMatch />} />
          ))}
          {["/creative", "/zh/creative", "/en/creative"].map((p) => (
            <Route key={p} path={p} element={<CreativeLibrary />} />
          ))}
          {["/prompt", "/zh/prompt", "/en/prompt"].map((p) => (
            <Route key={p} path={p} element={<PromptStudio />} />
          ))}
          {["/docs", "/zh/docs", "/en/docs"].map((p) => (
            <Route key={p} path={p} element={<Docs />} />
          ))}
          {["/docs/:slug", "/zh/docs/:slug", "/en/docs/:slug"].map((p) => (
            <Route key={p} path={p} element={<Docs />} />
          ))}
          {["/tutorials", "/zh/tutorials", "/en/tutorials"].map((p) => (
            <Route key={p} path={p} element={<Tutorials />} />
          ))}
          {["/tutorials/:slug", "/zh/tutorials/:slug", "/en/tutorials/:slug"].map((p) => (
            <Route key={p} path={p} element={<TutorialDetail />} />
          ))}
          {["/changelog", "/zh/changelog", "/en/changelog"].map((p) => (
            <Route key={p} path={p} element={<Changelog />} />
          ))}
          {["/licenses", "/zh/licenses", "/en/licenses"].map((p) => (
            <Route key={p} path={p} element={<Licenses />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  );
}
