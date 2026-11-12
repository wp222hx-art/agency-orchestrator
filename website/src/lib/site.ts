export const SITE = {
  // 统一品牌：产品名 momogsm，模型服务名 momo智脑。
  // `ao` 是命令行可执行文件的真实名字（不是品牌位），界面只在命令示例里出现。
  name: "momogsm",
  logo: "/logo/momogsm-icon.svg",
  short: "ao",
  /** 本机启动工作台的命令（首页 / 安装提示里展示） */
  startCmd: "ao web",
  /** 供应商列表里的「赞助商」标签、金色高亮与优惠码条。momogsm 没有赞助合作，保持关闭。 */
  showSponsorMarks: false as boolean,
};

// 供应商数据里的注册链接带着上游项目的推广码 / 渠道参数（返利归上游）。
// momogsm 不沿用它们：去掉这些参数，其余部分（路径、功能性参数）原样保留。
const REFERRAL_PARAMS = ["invitecode", "inviteCode", "invite", "aff", "ref", "referral_code", "code", "c", "from", "s", "ytag", "source", "campaign", "promo"];
/** 推广码写在路径里的站点：只能退回首页。 */
const REFERRAL_PATH_HOSTS: Record<string, string> = { "apinebula.ai": "https://apinebula.ai", "go.apimart.ai": "https://apimart.ai" };
export function neutralLink(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (SITE.showSponsorMarks) return url;
  try {
    const u = new URL(url);
    if (REFERRAL_PATH_HOSTS[u.host]) return REFERRAL_PATH_HOSTS[u.host];
    for (const key of [...u.searchParams.keys()]) {
      if (REFERRAL_PARAMS.includes(key) || key.startsWith("utm_")) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return undefined;
  }
}
