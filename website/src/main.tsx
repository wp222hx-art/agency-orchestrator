import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { applyInitialTheme } from "@/components/ui/theme-toggle";
import "@/lib/web-token";   // 启动时就读取访问令牌（见该文件说明）
import "./index.css";

applyInitialTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
