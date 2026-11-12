/**
 * 可选的访问令牌（服务端 `AO_WEB_TOKEN`，默认没有）。首次用 `?token=xxx` 打开，这里存进 sessionStorage
 * 并把它从地址栏抹掉（免得被截图、被写进历史记录），之后本标签页的请求自动带上。
 * sessionStorage 而不是 localStorage：标签页关了就没了，共用电脑上不留。
 *
 * 必须在应用启动时就读（main.tsx 里 import 本模块）：首页不加载工作台代码，
 * 如果等到进入工作台页面才读，从首页点进去时地址栏里的令牌早就没了，页面会被当成「引擎离线」。
 */
const TOKEN_KEY = "ao.webToken";
function readToken(): string {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("token");
    if (fromUrl) {
      sessionStorage.setItem(TOKEN_KEY, fromUrl);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
      return fromUrl;
    }
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";   // 隐私模式 / 禁了 storage：当没有令牌，服务端没开这功能时一切照常
  }
}
export const webToken = typeof window === "undefined" ? "" : readToken();
