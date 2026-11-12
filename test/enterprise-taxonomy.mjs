// 工商贸行业体系（web/enterprise-taxonomy.js）：默认值、校验、存储。纯本地，不联网。
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DEFAULT_TAXONOMY, INDUSTRIES, KNOWLEDGE_DIMS, SECTORS, SECTOR_IDS, TAXONOMY_LIMITS,
  createTaxonomyStore, describeTaxonomy, normalizeIndustry, normalizeTaxonomy,
} from '../web/enterprise-taxonomy.js';

const root = mkdtempSync(join(tmpdir(), 'ao-taxonomy-'));
after(() => rmSync(root, { recursive: true, force: true }));
const plain = (t) => ({ version: t.version, sectors: t.sectors, industries: t.industries });

test('内置默认值：三个板块、每个行业五个维度的知识基线都有内容，且不含模板括号', () => {
  assert.deepEqual(SECTORS.map((s) => s.id), SECTOR_IDS);
  assert.equal(DEFAULT_TAXONOMY.industries.length, INDUSTRIES.length);
  for (const sector of DEFAULT_TAXONOMY.sectors) {
    assert.ok(sector.principles.length >= 3, `${sector.id} 缺方法与原则`);
    assert.equal(DEFAULT_TAXONOMY.industryMap[sector.fallback].sector, sector.id);
  }
  for (const industry of DEFAULT_TAXONOMY.industries) {
    for (const dim of KNOWLEDGE_DIMS) assert.ok(industry.knowledge[dim.id].length >= 1, `${industry.id}/${dim.id} 是空的`);
    assert.ok(industry.pains.length && industry.scenarios.length && industry.nameEn);
  }
  // 只看文本内容（知识基线本身是对象，序列化后的花括号不算）
  const texts = [
    ...DEFAULT_TAXONOMY.sectors.flatMap((s) => [s.focus, s.search, ...s.principles]),
    ...DEFAULT_TAXONOMY.industries.flatMap((i) => [i.name, i.nameEn, ...i.pains, ...i.scenarios, ...Object.values(i.knowledge).flat()]),
  ];
  assert.ok(texts.length > 500 && texts.every((t) => typeof t === 'string' && t && !/[{}]/.test(t)));
  // 规范化是幂等的：导出再导入不会变
  assert.deepEqual(normalizeTaxonomy(plain(DEFAULT_TAXONOMY)), plain(DEFAULT_TAXONOMY));
});

test('校验：坏输入给出能照着改的报错，不悄悄截断', () => {
  const base = { id: 'pets', sector: 'commerce', name: '宠物用品' };
  const bad = (input, pattern) => assert.throws(() => normalizeIndustry(input), (e) => e.status === 400 && e.code === 'invalid_taxonomy' && pattern.test(e.message), JSON.stringify(input).slice(0, 80));
  bad({ ...base, id: 'Pets!' }, /id 只能用小写字母/);
  bad({ ...base, sector: 'finance' }, /板块必须是/);
  bad({ ...base, name: '  ' }, /名称不能为空/);
  bad({ ...base, name: 'x'.repeat(TAXONOMY_LIMITS.name + 1) }, /最多 40 个字/);
  bad({ ...base, pains: 'not-a-list' }, /必须是列表/);
  bad({ ...base, pains: [1] }, /只能是文本/);
  bad({ ...base, pains: Array.from({ length: 9 }, (_, i) => `痛点${i}`) }, /最多 8 条/);
  bad({ ...base, knowledge: { metrics: ['长'.repeat(121)] } }, /每条最多 120 个字/);
  bad({ ...base, knowledge: [] }, /知识基线格式不对/);
  // 清洗：去模板括号和控制字符、去空去重；识别词统一小写（企业名称是按小写比对的）
  const ok = normalizeIndustry({ ...base, name: ' 宠物{{report}}用品\n ', keywords: ['PET', 'pet', ' ', '宠物'], knowledge: { metrics: ['复购率', '复购率'] } });
  assert.equal(ok.name, '宠物 report 用品');
  assert.deepEqual(ok.keywords, ['pet', '宠物']);
  assert.deepEqual(ok.knowledge, { metrics: ['复购率'], process: [], systems: [], compliance: [], pitfalls: [] });
  assert.equal(ok.nameEn, ok.name, '没给英文名时用中文名');
});

test('整份体系：板块固定三个；每个板块至少一个行业；兜底行业必须在本板块', () => {
  const bad = (raw, pattern) => assert.throws(() => normalizeTaxonomy(raw), (e) => e.code === 'invalid_taxonomy' && pattern.test(e.message));
  const base = plain(DEFAULT_TAXONOMY);
  bad(null, /格式不对/);
  bad({ ...base, version: 99 }, /不支持的行业体系版本/);
  bad({ sectors: base.sectors }, /缺少 industries/);
  bad({ ...base, industries: [...base.industries, base.industries[0]] }, /id 重复/);
  bad({ ...base, sectors: [...base.sectors, { id: 'finance', name: '金融' }] }, /板块固定为/);
  bad({ ...base, industries: base.industries.filter((i) => i.sector !== 'trade') }, /「贸易」板块至少要保留一个行业/);
  bad({ ...base, industries: base.industries.filter((i) => i.id !== 'general') }, /兜底行业「general」不存在/);
  bad({ ...base, sectors: base.sectors.map((s) => (s.id === 'trade' ? { ...s, fallback: 'retail' } : s)) }, /兜底行业「retail」不存在或不属于该板块/);
  bad({ ...base, industries: Array.from({ length: 121 }, (_, i) => ({ id: `x${i}`, sector: 'industry', name: `行业${i}` })) }, /行业最多 120 个/);
  // 板块名称不能改；没给的板块字段沿用内置
  const renamed = normalizeTaxonomy({ industries: base.industries, sectors: [{ id: 'trade', name: '金融', focus: '只看回款' }] });
  assert.equal(renamed.sectors[2].name, '贸易'); assert.equal(renamed.sectors[2].focus, '只看回款');
  assert.deepEqual(renamed.sectors[0], base.sectors[0]);
});

test('存储：增删改、恢复单个行业、板块设置；兜底行业受保护', () => {
  const store = createTaxonomyStore();
  assert.equal(store.describe().customized, false);
  const added = store.addIndustry({ sector: 'commerce', name: '宠物用品', keywords: ['宠物'], knowledge: { metrics: ['复购率'] } });
  assert.equal(added.id, 'custom-1');
  assert.equal(store.addIndustry({ sector: 'trade', name: '二手设备' }).id, 'custom-2');
  assert.throws(() => store.addIndustry({ id: 'retail', sector: 'commerce', name: '重复' }), { status: 409, code: 'industry_exists' });
  assert.throws(() => store.addIndustry({ sector: 'commerce' }), /新行业的名称不能为空/);

  const edited = store.updateIndustry('equipment', { name: '高端装备', pains: ['交付周期长'] });
  assert.equal(edited.name, '高端装备'); assert.deepEqual(edited.pains, ['交付周期长']);
  assert.deepEqual(edited.knowledge, DEFAULT_TAXONOMY.industryMap.equipment.knowledge, '没提交的字段保持不变');
  assert.throws(() => store.updateIndustry('nope', { name: 'x' }), { status: 404, code: 'industry_not_found' });

  const view = store.describe();
  assert.equal(view.customized, true);
  const byId = Object.fromEntries(view.industries.map((i) => [i.id, i]));
  assert.deepEqual([byId.equipment.builtin, byId.equipment.modified], [true, true]);
  assert.deepEqual([byId.auto.builtin, byId.auto.modified], [true, false]);
  assert.deepEqual([byId['custom-1'].builtin, byId['custom-1'].modified], [false, false]);

  assert.equal(store.resetIndustry('equipment').name, DEFAULT_TAXONOMY.industryMap.equipment.name);
  assert.throws(() => store.resetIndustry('custom-1'), { status: 400, code: 'not_builtin' });

  // 兜底行业：不能删、不能移走；先换兜底才行
  assert.throws(() => store.removeIndustry('commerce-general'), { status: 409, code: 'industry_is_fallback' });
  assert.throws(() => store.updateIndustry('commerce-general', { sector: 'trade' }), { status: 409, code: 'industry_is_fallback' });
  assert.throws(() => store.updateSector('commerce', { fallback: 'equipment' }), /不存在或不属于该板块/);
  assert.equal(store.updateSector('commerce', { fallback: 'custom-1', principles: ['先看复购'] }).fallback, 'custom-1');
  store.removeIndustry('commerce-general');
  assert.equal(store.current().industryMap['commerce-general'], undefined);
  assert.equal(store.describe().sectors[1].modified, true);
  assert.throws(() => store.updateSector('finance', {}), { status: 404, code: 'sector_not_found' });
  assert.throws(() => store.removeIndustry('custom-1'), { code: 'industry_is_fallback' });
  // 失败的操作不留半截状态
  assert.equal(store.current().industries.length, DEFAULT_TAXONOMY.industries.length + 1);
});

test('落盘：原子写入、重启后还在；导入先校验再留底；恢复默认删文件但留 .bak', () => {
  const file = join(root, 'data', '.local', 'enterprise-taxonomy.json');
  const first = createTaxonomyStore({ file, now: () => new Date('2026-11-11T08:00:00Z') });
  first.addIndustry({ sector: 'trade', name: '二手设备贸易', keywords: ['二手'] });
  assert.ok(existsSync(file) && !existsSync(`${file}.tmp`));
  const saved = JSON.parse(readFileSync(file, 'utf-8'));
  assert.equal(saved.updatedAt, '2026-11-11T08:00:00.000Z');
  assert.ok(!('sectorMap' in saved) && !('industryMap' in saved), '索引不落盘');

  const second = createTaxonomyStore({ file });
  assert.equal(second.current().industryMap['custom-1'].name, '二手设备贸易');
  assert.equal(second.describe().updatedAt, '2026-11-11T08:00:00.000Z');

  // 导入坏文件：报错，磁盘和内存都不变
  assert.throws(() => second.replace({ industries: [] }), /至少要保留一个行业/);
  assert.equal(JSON.parse(readFileSync(file, 'utf-8')).industries.length, saved.industries.length);
  assert.ok(!existsSync(`${file}.bak`), '校验没过不该留底');
  // 导入好文件：整份替换，上一版留在 .bak
  const next = plain(DEFAULT_TAXONOMY);
  next.industries = next.industries.map((i) => (i.id === 'retail' ? { ...i, name: '大卖场' } : i));
  second.replace({ ...next, updatedAt: 'ignored', limits: 'ignored' });
  assert.equal(second.current().industryMap.retail.name, '大卖场');
  assert.equal(second.current().industryMap['custom-1'], undefined);
  assert.equal(JSON.parse(readFileSync(`${file}.bak`, 'utf-8')).industries.length, saved.industries.length);

  second.reset();
  assert.ok(!existsSync(file));
  assert.equal(JSON.parse(readFileSync(`${file}.bak`, 'utf-8')).industries.find((i) => i.id === 'retail').name, '大卖场');
  assert.equal(second.describe().customized, false);
  assert.equal(createTaxonomyStore({ file }).current().industryMap.retail.name, DEFAULT_TAXONOMY.industryMap.retail.name);
});

test('存储文件损坏：用内置默认值顶上并说明原因；原文件不被覆盖，下次保存时改名留底', () => {
  const dir = join(root, 'broken');
  const file = join(dir, 'enterprise-taxonomy.json');
  createTaxonomyStore({ file }).addIndustry({ sector: 'trade', name: '先建目录' });
  writeFileSync(file, '{ not json');
  const store = createTaxonomyStore({ file, now: () => new Date('2026-11-11T09:00:00Z') });
  assert.equal(store.current().industries.length, DEFAULT_TAXONOMY.industries.length);
  const view = store.describe();
  assert.match(view.error, /读不出来/); assert.equal(view.customized, false);
  assert.equal(readFileSync(file, 'utf-8'), '{ not json', '只读不写时原文件原样保留');
  store.addIndustry({ sector: 'commerce', name: '宠物用品' });
  assert.equal(store.describe().error, '');
  const kept = readdirSync(dir).filter((f) => f.includes('.broken-'));
  assert.equal(kept.length, 1);
  assert.equal(readFileSync(join(dir, kept[0]), 'utf-8'), '{ not json');
  assert.equal(JSON.parse(readFileSync(file, 'utf-8')).industries.at(-1).name, '宠物用品');
  // 内容合法但不合规（比如手改坏了兜底行业）也按损坏处理
  writeFileSync(file, JSON.stringify({ industries: [{ id: 'a', sector: 'industry', name: 'A' }] }));
  assert.match(createTaxonomyStore({ file }).describe().error, /至少要保留一个行业|兜底行业/);
});

test('describeTaxonomy：给界面的视图带上限与维度定义', () => {
  const view = describeTaxonomy(DEFAULT_TAXONOMY);
  assert.deepEqual(view.dims.map((d) => d.id), ['metrics', 'process', 'systems', 'compliance', 'pitfalls']);
  assert.equal(view.limits.knowledge[0], 8);
  assert.ok(view.sectors.every((s) => s.modified === false) && view.industries.every((i) => i.builtin && !i.modified));
});
