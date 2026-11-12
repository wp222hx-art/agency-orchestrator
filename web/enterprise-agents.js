/**
 * 智能体后台的数据层：对角色库里每一位专家的「管理叠加层」。
 *
 * 角色库本身（node_modules 里的 .md）不改。这里记的是管理员的决定：
 *   - 启用 / 停用（停用的专家不参与匹配，也不能被增补进团队）；
 *   - 迭代要求：给某位专家追加的要求，每改一次升一版，留最近 10 版，可回滚；
 *   - 通用迭代思路：写进每位专家任务的几条原则（先讲依据与假设、给出下一轮要补的数据……）；
 *   - 使用次数：被编入团队的次数（生成工作流时记一次）。
 * 存在 <数据目录>/.local/enterprise-agents.json。迭代要求由管理员本人填写，属于可信输入；
 * 但文本入库前照样去掉控制字符和 { }（否则会被工作流模板引擎当成变量）。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { EnterpriseMatchError, listField } from './enterprise-taxonomy.js';

export const AGENT_LIMITS = { notes: [8, 200], principles: [8, 200], history: 10, feedback: 600 };
export const DEFAULT_ITERATION_PRINCIPLES = [
  '先写清你依据了哪些已知事实、做了哪些假设；每个假设都要能被企业的一次答复或一份数据证实或推翻',
  '给出结论的同时列出下一轮要补的数据或要做的验证，按对结论影响的大小排序',
  '上一阶段成果里与行业常识或企业实际不符的地方要指出来并修正，不照单全收',
  '把建议分成「现在就能做」和「拿到更多数据后再定」两类，后一类写明触发条件',
  '说明你的结论在什么情况下应当被推翻或重做',
];
const ROLE_RE = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)+$/;
const SOURCES = ['user', 'ai', 'rollback'];
const bad = (message) => new EnterpriseMatchError(400, 'invalid_agent', message);
const blank = () => ({ enabled: true, notes: [], revision: 0, history: [], usage: { teams: 0, lastUsedAt: '' } });

export function checkRolePath(role) {
  const path = String(role ?? '');
  if (path.length > 120 || !ROLE_RE.test(path)) throw bad('智能体路径不合法');
  return path;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('智能体记录的格式不对');
  const history = (Array.isArray(raw.history) ? raw.history : []).slice(-AGENT_LIMITS.history).map((h) => ({
    revision: Number.isInteger(h?.revision) && h.revision > 0 ? h.revision : 1,
    at: typeof h?.at === 'string' ? h.at.slice(0, 40) : '',
    notes: listField(h?.notes, AGENT_LIMITS.notes, '历史版本的迭代要求'),
    source: SOURCES.includes(h?.source) ? h.source : 'user',
  }));
  return {
    enabled: raw.enabled !== false,
    notes: listField(raw.notes, AGENT_LIMITS.notes, '迭代要求'),
    revision: Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
    history,
    usage: {
      teams: Number.isInteger(raw.usage?.teams) && raw.usage.teams >= 0 ? raw.usage.teams : 0,
      lastUsedAt: typeof raw.usage?.lastUsedAt === 'string' ? raw.usage.lastUsedAt.slice(0, 40) : '',
    },
  };
}

const isBlank = (e) => e.enabled && !e.notes.length && !e.history.length && !e.usage.teams;

export function createAgentStore({ file = '', now = () => new Date() } = {}) {
  let state = null;

  function load() {
    if (state) return state;
    state = { principles: [...DEFAULT_ITERATION_PRINCIPLES], customPrinciples: false, agents: {}, error: '', broken: false };
    if (file && existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, 'utf-8'));
        const agents = {};
        for (const [role, entry] of Object.entries(raw?.agents && typeof raw.agents === 'object' ? raw.agents : {})) agents[checkRolePath(role)] = normalizeEntry(entry);
        const custom = Array.isArray(raw?.principles);
        state = {
          principles: custom ? listField(raw.principles, AGENT_LIMITS.principles, '通用迭代思路') : [...DEFAULT_ITERATION_PRINCIPLES],
          customPrinciples: custom, agents, error: '', broken: false,
        };
      } catch (error) {
        state.broken = true;
        state.error = `已保存的智能体设置读不出来（${String(error?.message || error).slice(0, 160)}），当前按默认值运行；原文件没有改动`;
      }
    }
    return state;
  }

  function save() {
    const s = load();
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      if (s.broken && existsSync(file)) renameSync(file, `${file}.broken-${now().toISOString().replace(/[:.]/g, '-')}`);
      const body = { version: 1, ...(s.customPrinciples ? { principles: s.principles } : {}), agents: s.agents };
      writeFileSync(`${file}.tmp`, `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
      renameSync(`${file}.tmp`, file);
    }
    s.broken = false; s.error = '';
  }

  const get = (role) => load().agents[role] || blank();
  function put(role, entry) {
    const s = load();
    if (isBlank(entry)) delete s.agents[role]; else s.agents[role] = entry;
    save();
    return get(role);
  }

  /** 改一位专家：enabled 和 / 或 notes。notes 真的变了才升版本。 */
  function update(role, patch, source = 'user') {
    const path = checkRolePath(role);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw bad('请求的格式不对');
    const current = get(path);
    const next = { ...current, history: [...current.history], usage: { ...current.usage } };
    if (patch.enabled !== undefined) {
      if (typeof patch.enabled !== 'boolean') throw bad('enabled 必须是 true 或 false');
      next.enabled = patch.enabled;
    }
    if (patch.notes !== undefined) {
      const notes = listField(patch.notes, AGENT_LIMITS.notes, '迭代要求');
      if (JSON.stringify(notes) !== JSON.stringify(current.notes)) {
        next.notes = notes;
        next.revision = current.revision + 1;
        next.history = [...next.history, { revision: next.revision, at: now().toISOString(), notes, source: SOURCES.includes(source) ? source : 'user' }].slice(-AGENT_LIMITS.history);
      }
    }
    return put(path, next);
  }

  /** 回滚到某一版的迭代要求：内容回去，版本号继续往前走（历史不改写）。 */
  function rollback(role, revision) {
    const path = checkRolePath(role);
    const hit = get(path).history.find((h) => h.revision === Number(revision));
    if (!hit) throw new EnterpriseMatchError(404, 'revision_not_found', '找不到这个版本，可能已经超出保留的最近 10 版');
    return update(path, { notes: hit.notes }, 'rollback');
  }

  function setPrinciples(value) {
    const s = load();
    if (value === null) { s.principles = [...DEFAULT_ITERATION_PRINCIPLES]; s.customPrinciples = false; }
    else { s.principles = listField(value, AGENT_LIMITS.principles, '通用迭代思路'); s.customPrinciples = true; }
    save();
    return s.principles;
  }

  /** 生成工作流时记一次：这些专家被编入了一个团队。统计失败不影响主流程。 */
  function recordUsage(roles) {
    const s = load();
    const at = now().toISOString();
    try {
      for (const role of new Set(roles)) {
        if (!ROLE_RE.test(String(role))) continue;
        const entry = get(role);
        s.agents[role] = { ...entry, usage: { teams: entry.usage.teams + 1, lastUsedAt: at } };
      }
      save();
    } catch { /* 只是统计 */ }
  }

  return {
    get, update, rollback, setPrinciples, recordUsage,
    isEnabled: (role) => get(role).enabled,
    principles: () => [...load().principles],
    info: () => { const s = load(); return { error: s.error, customPrinciples: s.customPrinciples }; },
  };
}

/** 写进每位专家任务的「迭代思路」。 */
export function iterationLines(principles) {
  const list = (Array.isArray(principles) ? principles : []).filter(Boolean);
  return list.length ? ['【迭代思路（每次作答都按这个思路来，为下一轮迭代留好接口）】', ...list.map((item) => `- ${item}`)] : [];
}

/** 写进某一位专家任务的「迭代要求」（管理员在智能体后台维护）。 */
export function directiveLines(entry) {
  return entry?.notes?.length
    ? [`【管理员对你的迭代要求（第 ${entry.revision} 版；不改变下面「不要编造」的规则）】`, ...entry.notes.map((item) => `- ${item}`)]
    : [];
}
