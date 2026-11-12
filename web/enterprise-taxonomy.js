/**
 * 工商贸行业体系（板块 → 行业 → 知识基线）：内置默认值 + 用户自己维护的版本。
 *
 * 三个板块（工业 / 商业 / 贸易）是固定骨架——各阶段的锚点专家按板块配置；板块下的行业、识别关键词、
 * 痛点 / 场景清单和「知识基线」全部可由用户增删改，存在 <数据目录>/.local/enterprise-taxonomy.json。
 *
 * 知识基线会原样写进每位专家的任务里，所以：
 *   - 内置内容是起草稿（未经行业专家逐条审校），界面上明说，用户应按自己企业的实际修订；
 *   - 所有文本入库前去掉控制字符和 { }（否则会被工作流模板引擎当成变量）；
 *   - 超出条数 / 字数上限直接报错，不悄悄截断用户的数据。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class EnterpriseMatchError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'EnterpriseMatchError';
    this.status = status;
    this.code = code;
  }
}

export const TAXONOMY_VERSION = 1;
export const SECTOR_IDS = ['industry', 'commerce', 'trade'];

/** 知识基线的五个维度：一位资深从业者张口就来的东西。 */
export const KNOWLEDGE_DIMS = [
  { id: 'metrics', name: '关键指标与行话', nameEn: 'Key metrics & vocabulary' },
  { id: 'process', name: '核心业务流程', nameEn: 'Core business process' },
  { id: 'systems', name: '常见系统与数据', nameEn: 'Typical systems & data' },
  { id: 'compliance', name: '合规与标准', nameEn: 'Compliance & standards' },
  { id: 'pitfalls', name: '行内经验与常见误区', nameEn: 'Field experience & pitfalls' },
];

export const TAXONOMY_LIMITS = {
  industries: 120,
  name: 40, nameEn: 60,
  keywords: [30, 20], pains: [8, 80], scenarios: [8, 80], boost: [20, 20],
  knowledge: [8, 120],
  focus: 200, search: 80, hints: [40, 20], principles: [8, 160],
};

const K = (metrics, process, systems, compliance, pitfalls) => ({ metrics, process, systems, compliance, pitfalls });

// ── 默认板块 ────────────────────────────────────────────────────────────────
// hints：企业名称里说明「经营方式」的词。它比产品词更能说明板块——钢铁贸易公司属于贸易，不是钢铁制造。
// principles：这个板块做 AI 赋能时通用的方法与原则，会写进该板块每位专家的任务。
export const SECTORS = [
  { id: 'industry', name: '工业', nameEn: 'Industry', fallback: 'general', hints: [],
    focus: '生产、质量、设备、供应链与研发', search: '数字化转型 智能制造 人工智能', boost: ['生产', '质量', '设备', '工艺'],
    principles: [
      '先看人、机、料、法、环、测六要素里数据最完整的一环，从那里切入',
      '数字化有分层：设备自动化 → MES 等执行系统 → ERP 等经营系统，下层没打通时上层的 AI 没有数据可用',
      '精益生产、TPM、六西格玛是多数工厂已有的改善语言，AI 方案要能接进这些既有机制',
      '可参照 GB/T 39116《智能制造能力成熟度模型》给企业现状定级，再谈下一步',
      '涉及安全、质量放行、工艺参数下发的环节，AI 先做辅助建议，由人确认',
    ] },
  { id: 'commerce', name: '商业', nameEn: 'Commerce', fallback: 'commerce-general',
    hints: ['超市', '商超', '百货', '零售', '连锁', '餐饮', '酒店', '电商', '电子商务', '商业', '商场', '便利店', '购物中心', '酒楼', '饭店'],
    focus: '获客、门店与线上运营、会员、商品与库存、客服', search: '数字化 新零售 会员运营 人工智能', boost: ['电商', '零售', '门店', '私域', '用户', '增长', '客服'],
    principles: [
      '用「人、货、场」拆解经营：客群与会员、商品与库存、门店与线上渠道',
      '收入可以拆成 流量 × 转化率 × 客单价 × 复购，先判断 AI 能动哪一个因子',
      '会员运营常用 RFM 分层和生命周期管理，个性化触达必须有用户同意作前提',
      '线上线下库存、价格、会员打通（全渠道）是多数场景的数据前提',
      '面向消费者的内容与营销，受广告法、消费者权益保护法和个人信息保护法约束',
    ] },
  { id: 'trade', name: '贸易', nameEn: 'Trade', fallback: 'trade-general',
    hints: ['贸易', '进出口', '商贸', '经贸', '外贸', '批发', '经销', '分销', '货代', '物流', '跨境', '跨境电商', '报关', '供应链管理'],
    focus: '客户开发、报价与订单、单证与合规、物流与回款', search: '数字化 供应链 跨境 人工智能', boost: ['跨境', '外贸', '供应链', '供应商', '物流', '合同', '出海'],
    principles: [
      '贸易的本质是商流、物流、资金流、信息流四流合一，哪一流对不上哪里就是风险点',
      '利润薄、周转快：盯毛利的同时要盯资金占用、账期和周转天数',
      '客户与供应商信用、货权归属、合同条款是风险控制的三个抓手',
      '单据（合同、发票、箱单、提单、报关单）是天然的结构化数据来源，适合先做自动化',
      '涉及进出口的环节受海关、外汇、税务和出口管制监管，AI 生成的单证必须人工复核',
    ] },
];

// ── 默认行业 ────────────────────────────────────────────────────────────────
// keywords：按企业名称粗分类用；boost：该行业额外加分的角色关键词（匹配角色名 / 描述 / 路径）；
// knowledge：五个维度的知识基线（起草稿，见文件头说明）。
export const INDUSTRIES = [
  // ── 工业 ──
  { id: 'equipment', sector: 'industry', name: '装备制造 / 工程机械', nameEn: 'Equipment & machinery', keywords: ['重工', '机械', '装备', '机床', '重机', '液压', '泵', '阀', '轴承', '起重', '工程机械', '机器人', '自动化设备'],
    pains: ['多品种小批量排产难', '设备停机与售后服务成本高', '工艺经验依赖老师傅'], scenarios: ['预测性维护', '智能排产', '工艺知识库与售后服务助手'], boost: ['机械', '设备', 'iot', '物联网', '运维'],
    knowledge: K(
      ['订单准时交付率（OTD）', '设备综合效率（OEE）', '一次交检合格率', '平均故障间隔 / 修复时间（MTBF / MTTR）', '售后首次修复率'],
      ['订单评审 → 设计（按订单设计 ETO / 按订单生产 MTO）→ 采购与外协 → 机加、焊接、装配 → 调试 → 交付安装 → 售后服务'],
      ['ERP', 'MES', 'PLM / PDM（图纸与 BOM）', 'APS 高级排产', '设备联网与 SCADA', '售后工单与 CRM'],
      ['ISO 9001 质量管理体系', '安全生产法', '起重机械、压力容器等属特种设备，需相应许可', '出口欧盟需符合 CE 机械法规'],
      ['BOM 和工艺路线数据不准，是排产算法失效的首要原因', '很多设备没有联网，预测性维护要先解决数据采集', '售后经验常散落在服务工程师个人手里，要先沉淀再谈知识库'],
    ) },
  { id: 'auto', sector: 'industry', name: '汽车及零部件', nameEn: 'Automotive & parts', keywords: ['汽车', '车业', '零部件', '底盘', '轮胎', '车桥', '动力总成', '变速', '客车', '摩托'],
    pains: ['主机厂年降压力', '质量追溯要求高', '供应链协同复杂'], scenarios: ['视觉质检', '质量追溯与根因分析', '供应链需求预测'], boost: ['质量', '供应链', '供应商', '测试'],
    knowledge: K(
      ['PPM（百万件不良数）', '一次通过率（FTT）', 'OEE', '准时交付率', '年降（主机厂每年要求的降价幅度）'],
      ['项目定点 → APQP 产品质量先期策划 → PPAP 生产件批准 → 量产爬坡 → 工程变更管理'],
      ['ERP', 'MES', 'QMS 质量管理系统', '与主机厂的 EDI 对接', 'WMS', '批次 / 单件追溯系统'],
      ['IATF 16949', 'VDA 6.3 过程审核', '五大工具：APQP、PPAP、FMEA、MSA、SPC', '电子电气件涉及 ISO 26262 功能安全'],
      ['过程变更须经主机厂批准，AI 调整工艺参数也要走变更流程', '视觉质检上线前要做测量系统分析（MSA），漏检率要有数据', '追溯要求到批次甚至单件，数据链断一环就不成立'],
    ) },
  { id: 'electronics', sector: 'industry', name: '电子信息制造', nameEn: 'Electronics manufacturing', keywords: ['电子', '半导体', '芯片', '集成电路', '显示', '光电', '元器件', '通信设备', '电路', 'pcb', '微电子'],
    pains: ['良率爬坡慢', '产品迭代快、换线频繁', '物料齐套难'], scenarios: ['良率分析', 'AOI 缺陷检测', '研发知识检索与设计辅助'], boost: ['嵌入式', '固件', '数据', '测试', '硬件'],
    knowledge: K(
      ['直通率（FPY）与良率', 'DPPM', '换线时间', '物料齐套率', '库存周转天数'],
      ['新产品导入（NPI）试产 → SMT 贴片 → 插件 → 测试（ICT / FCT）→ 组装 → 包装出货'],
      ['MES', 'ERP', 'PLM', 'SPI / AOI 等检测设备数据', 'WMS', 'SRM 供应商协同'],
      ['IPC-A-610 电子组件可接受性', 'RoHS / REACH', 'ANSI/ESD S20.20 静电防护', 'ISO 9001 / ISO 14001'],
      ['AOI 误报率高，复判占用大量人力，是视觉 AI 常见的切入点', '替代料和 BOM 版本管理混乱会让良率分析失真', '品牌客户有自己的审核标准，改流程前先核对客户要求'],
    ) },
  { id: 'metal', sector: 'industry', name: '钢铁 / 有色 / 金属加工', nameEn: 'Steel, non-ferrous & metalworking', keywords: ['钢铁', '特钢', '钢', '铝业', '铜业', '有色', '冶金', '铸造', '锻造', '金属', '矿业', '矿'],
    pains: ['能耗与碳排压力', '工艺参数调优靠经验', '安全风险高'], scenarios: ['能耗优化', '工艺参数寻优', '安全生产视觉监测'], boost: ['能耗', '安全', 'esg', '可持续', '风险'],
    knowledge: K(
      ['吨钢综合能耗', '成材率', '作业率', '吨钢成本', '碳排放强度'],
      ['长流程钢铁：原料 → 烧结 / 焦化 → 炼铁 → 炼钢 → 连铸 → 轧制 → 精整', '有色金属：采选 → 冶炼 → 加工'],
      ['L1 基础自动化 / L2 过程控制 / L3 MES / L4 ERP 的分层架构', '能源管理系统（EMS）', '设备点检与状态监测系统'],
      ['超低排放改造要求', '煤气、高温熔融金属等重大安全风险管控', '能耗与碳排放核算', '产能置换政策'],
      ['过程控制已有成熟的机理模型，AI 通常做补偿和寻优，不是替代', '安全是红线，涉及闭环控制的建议必须由人确认', '数据量大但质量参差，先做数据治理'],
    ) },
  { id: 'chemical', sector: 'industry', name: '化工 / 新材料', nameEn: 'Chemicals & new materials', keywords: ['化工', '化学', '石化', '材料', '新材料', '塑料', '橡胶', '涂料', '化纤', '树脂', '农药', '化肥'],
    pains: ['安全环保合规压力', '配方与工艺研发周期长', '装置波动影响收率'], scenarios: ['配方研发辅助', '装置运行优化', '安全合规知识库'], boost: ['合规', '安全', '风险', 'esg', '可持续'],
    knowledge: K(
      ['收率', '原料与能耗单耗', '装置负荷率', '非计划停车次数', '优等品率'],
      ['研发：小试 → 中试 → 工业化放大', '生产：原料 → 反应 → 分离提纯 → 包装储运'],
      ['DCS 集散控制系统', 'SIS 安全仪表系统', 'APC 先进过程控制', 'LIMS 实验室信息管理', 'MES / ERP'],
      ['危险化学品安全管理条例', 'HAZOP 分析与重大危险源管理', '安全生产许可证与排污许可', '出口欧盟涉及 REACH'],
      ['控制回路的任何改动都要走变更管理（MOC），AI 先做开环指导', '配方和工艺参数是核心机密，数据通常不能出厂', '安全仪表系统独立于 AI，不能被绕过'],
    ) },
  { id: 'textile', sector: 'industry', name: '纺织服装', nameEn: 'Textiles & apparel', keywords: ['纺织', '服装', '服饰', '针织', '印染', '面料', '家纺', '制衣', '鞋业', '皮革', '羽绒'],
    pains: ['订单碎片化、快反要求高', '用工密集且流动大', '库存积压'], scenarios: ['需求预测与补货', '排产与产线平衡', '款式企划与内容营销'], boost: ['服装', '工厂', '库存', '电商', '供应链'],
    knowledge: K(
      ['订单准交率', '染色一次成功率 / 一次成品率', '工时效率与人均产值', '库存周转', '售罄率（品牌端）'],
      ['制造：纺纱 → 织造 → 印染 → 成衣（裁剪、缝制、后整）', '品牌：企划 → 设计 → 打样 → 订货 → 大货生产 → 分销'],
      ['ERP', 'MES 与吊挂系统', 'PLM', 'CAD（打版、排料）', 'WMS', '电商与分销系统'],
      ['GB 18401 国家纺织产品基本安全技术规范', 'OEKO-TEX Standard 100', '印染废水排放标准', '出口订单常见社会责任验厂（如 BSCI）'],
      ['小单快反下计划变化快，排产工具要能随时重排', '款、色、码组合让 SKU 数量爆炸，主数据要先理清', '印染环保是硬约束，产能不是想扩就能扩'],
    ) },
  { id: 'food', sector: 'industry', name: '食品饮料', nameEn: 'Food & beverage', keywords: ['食品', '饮料', '乳业', '酒业', '酿酒', '粮油', '调味', '肉类', '茶业', '啤酒', '白酒', '农产品加工'],
    pains: ['食品安全与追溯', '渠道与促销复杂', '保质期带来的库存损耗'], scenarios: ['质量追溯', '销量预测与渠道补货', '品牌内容与私域运营'], boost: ['库存', '电商', '品牌', '合规', '私域'],
    knowledge: K(
      ['产品合格率', '损耗率与报废率', '订单满足率', '库存周转与货龄', '渠道费用率'],
      ['原料验收 → 加工 → 灌装 / 包装 → 检验 → 仓储 → 冷链与渠道配送'],
      ['ERP', 'MES', 'LIMS', 'WMS', '一物一码追溯', 'DMS 经销商管理', 'TPM 促销费用管理'],
      ['食品安全法', 'HACCP 与 ISO 22000', 'GB 14881 食品生产通用卫生规范', 'SC 食品生产许可', 'GB 7718 预包装食品标签通则'],
      ['普通食品的宣传不能涉及疾病预防、治疗功能', '追溯要覆盖到原料批次，否则召回范围无法收窄', '促销会扭曲销量基线，做预测要先剔除促销影响'],
    ) },
  { id: 'pharma', sector: 'industry', name: '医药 / 医疗器械', nameEn: 'Pharma & medical devices', keywords: ['医药', '制药', '药业', '生物', '医疗器械', '医疗', '中药', '疫苗', '诊断试剂'],
    pains: ['GMP 合规与文件负担重', '研发周期长', '批记录与偏差管理繁琐'], scenarios: ['合规文档与批记录审核', '研发文献检索', '质量偏差分析'], boost: ['合规', '医疗', '文档', '质量', '审计'],
    knowledge: K(
      ['批次一次合格率', '偏差关闭周期', 'OOS（检验结果超标）数量', '批放行周期', '研发管线进度'],
      ['研发 → 临床 → 注册 → 技术转移 → 商业化生产 → 药物警戒'],
      ['QMS 质量管理系统', 'LIMS', 'MES 与电子批记录（EBR）', 'ERP', '文档管理系统', '药物警戒系统'],
      ['药品管理法与 GMP（药品生产质量管理规范）', '数据完整性 ALCOA+ 原则', '计算机化系统验证（GAMP 5）', '经营环节 GSP', '医疗器械：ISO 13485 与医疗器械生产质量管理规范'],
      ['进入 GMP 流程的系统都要经过验证，AI 工具也不例外', 'AI 的输出不能直接作为批放行或质量判定的依据', '处方药不得面向公众做广告，宣传内容要先过合规'],
    ) },
  { id: 'building', sector: 'industry', name: '建材 / 家居', nameEn: 'Building materials & home', keywords: ['建材', '水泥', '玻璃', '陶瓷', '家居', '家具', '门窗', '卫浴', '地板', '定制家居', '涂料建材'],
    pains: ['定制化订单拆单排产难', '经销商体系管理粗放', '安装与售后口碑压力'], scenarios: ['设计到生产的拆单自动化', '经销商赋能助手', '售后服务调度'], boost: ['设计', '品牌', '客户', '电商', '服务'],
    knowledge: K(
      ['订单交付周期', '一次安装成功率', '板材利用率', '经销商单店产出', '客诉率'],
      ['定制家居：获客 → 量尺 → 设计 → 报价下单 → 拆单 → 生产 → 物流 → 安装 → 售后'],
      ['设计软件', '拆单软件', 'ERP', 'MES', 'CRM', '经销商门户'],
      ['GB 18580 人造板甲醛释放限量', 'GB/T 39600 甲醛释放量分级（含 ENF 级）', '绿色建材产品认证', '水泥等行业的错峰生产与排放要求'],
      ['设计数据和生产数据不通，是错单、补单的主要来源', '终端客户数据多在经销商手里，总部拿不全', '安装是口碑的最后一公里，却往往是外包的'],
    ) },
  { id: 'energy', sector: 'industry', name: '能源电力 / 新能源装备', nameEn: 'Energy, power & new-energy equipment', keywords: ['电力', '电气', '能源', '新能源', '光伏', '风电', '电池', '储能', '锂电', '电缆', '变压器', '输配电', '核电', '煤炭', '煤业'],
    pains: ['产能扩张后的质量一致性', '设备资产运维成本高', '技术迭代快'], scenarios: ['电池 / 组件缺陷检测', '设备资产健康管理', '工艺数据闭环'], boost: ['iot', '物联网', '数据', '运维', '嵌入式'],
    knowledge: K(
      ['度电成本（LCOE）', '设备可利用率', '电池 / 组件的良率与 A 品率', '转换效率', '线损率'],
      ['新能源装备：材料 → 电芯 / 电池片 → 模组 / 组件 → 系统集成 → 电站运维', '电力：发电 → 输电 → 变电 → 配电 → 用电'],
      ['MES', 'SCADA', 'EMS 能量管理系统', 'BMS 电池管理系统', 'EAM 资产管理', '功率预测系统'],
      ['电力监控系统安全防护规定（安全分区、网络专用、横向隔离、纵向认证）', '并网技术标准', 'IEC 61215 / IEC 61730（光伏组件）', 'GB 38031（动力电池安全）与 UN38.3（锂电池运输）'],
      ['电力生产控制大区与管理信息大区隔离，AI 系统能部署在哪一区要先确认', '技术迭代快，产线寿命短，投入要算回收期', '电池安全相关的判定不能只依赖模型'],
    ) },
  { id: 'light', sector: 'industry', name: '轻工 / 日用消费品', nameEn: 'Light industry & consumer goods', keywords: ['家电', '电器', '日化', '玩具', '包装', '印刷', '造纸', '五金', '厨具', '文具', '照明', '小家电'],
    pains: ['同质化竞争、利润薄', '渠道线上化带来的运营压力', '新品开发命中率低'], scenarios: ['用户洞察与新品企划', '电商内容与投放', '客服与售后自动化'], boost: ['电商', '品牌', '客户', '增长', '内容'],
    knowledge: K(
      ['新品成功率', '毛利率', '渠道库存周转', '退货率', '客诉率'],
      ['市场洞察 → 产品定义 → 研发 → 开模 → 试产 → 量产 → 渠道铺货 → 售后'],
      ['ERP', 'PLM', 'MES', '电商后台与 OMS', 'CRM', '售后工单系统'],
      ['CCC 强制性产品认证', '能效标识', '化妆品监督管理条例（日化）', 'GB 6675 玩具安全', '出口常见 CE / UL 认证'],
      ['做代工（OEM / ODM）时需求数据在品牌方手里，预测要靠客户协同', '电商大促带来明显波峰，产能和库存要提前布局', '同质化严重，AI 更适合用在洞察和内容，而不只是降本'],
    ) },
  { id: 'general', sector: 'industry', name: '其他工业 / 制造业', nameEn: 'Other industry & manufacturing', keywords: [],
    pains: ['数据分散在各系统与纸面', '管理依赖个人经验', '缺少数字化人才'], scenarios: ['经营数据看板与问答', '制度 / 工艺知识库', '重复性文书自动化'], boost: [],
    knowledge: K(
      ['准时交付率', '一次合格率', '库存周转天数', '人均产值', '设备综合效率（OEE）'],
      ['接单 → 计划 → 采购 → 生产 → 质检 → 仓储 → 交付 → 回款'],
      ['ERP', 'MES', 'WMS', 'OA', '财务系统', '大量 Excel 与纸质单据'],
      ['ISO 9001', '安全生产法', '排污许可', '数据安全法与个人信息保护法'],
      ['先治理物料、BOM、客户等主数据，再谈智能化', '从一个看得见效果的单点做起，比全面铺开更容易成功', '一线员工的接受度往往比技术本身更决定成败'],
    ) },
  // ── 商业 ──
  { id: 'retail', sector: 'commerce', name: '零售 / 商超百货', nameEn: 'Retail, supermarkets & department stores', keywords: ['超市', '商超', '百货', '便利店', '零售', '购物中心', '商场', '卖场', '免税'],
    pains: ['门店客流与坪效下滑', '商品结构与库存周转难平衡', '会员数据沉睡、复购靠促销'], scenarios: ['销量预测与自动补货', '会员分层与个性化营销', '门店经营数据问答'], boost: ['库存', '电商', '私域', '用户', '数据'],
    knowledge: K(
      ['坪效', '客单价', '同店销售增长', '库存周转天数', '损耗率', '会员复购率'],
      ['选品采购 → 定价 → 陈列 → 促销 → 销售 → 补货 → 盘点'],
      ['POS', 'ERP', 'WMS', '会员与 CRM 系统', '供应商协同（SRM）', '到家平台与小程序'],
      ['消费者权益保护法', '个人信息保护法（会员数据、客流分析）', '明码标价与价格法', '生鲜与食品安全要求', '单用途预付卡管理'],
      ['促销会扭曲基线销量，补货预测要先剔除促销', '生鲜损耗是利润黑洞，也是预测最有价值的品类', '用摄像头做客流或人脸分析有明确的合规要求'],
    ) },
  { id: 'chain', sector: 'commerce', name: '连锁品牌 / 专卖加盟', nameEn: 'Chains & franchises', keywords: ['连锁', '专卖', '加盟', '品牌管理'],
    pains: ['门店标准化执行参差', '加盟商管理与督导成本高', '总部对单店经营缺少实时洞察'], scenarios: ['巡店与标准执行稽核', '单店经营诊断助手', '加盟商培训与知识库'], boost: ['培训', '运营', '品牌', '门店'],
    knowledge: K(
      ['单店模型与回本周期', '同店增长', '闭店率', '巡店合格率', '加盟商续约率'],
      ['选址 → 招商加盟 → 开业筹备 → 培训 → 运营督导 → 供应链配送 → 品牌营销'],
      ['门店 POS / SaaS', '加盟商管理系统', '巡店系统', '订货与供应链系统', '培训系统', '会员中台'],
      ['商业特许经营管理条例（备案、信息披露、「两店一年」）', '广告法', '门店的食品安全与消防要求', '个人信息保护法'],
      ['加盟店的数据归属和回传要在合同里约定清楚', '运营手册更新慢于实际，知识库要有人持续维护', '督导人均管店数有上限，AI 巡店的价值在放大督导'],
    ) },
  { id: 'catering', sector: 'commerce', name: '餐饮 / 酒店住宿', nameEn: 'Catering & hospitality', keywords: ['餐饮', '酒店', '饭店', '酒楼', '火锅', '咖啡', '茶饮', '烘焙', '宾馆', '民宿', '食府', '餐厅'],
    pains: ['食材损耗与成本波动', '人员流动大、服务质量不稳', '线上平台抽成高、私域薄弱'], scenarios: ['客流预测与备料排班', '点评与舆情分析', '会员运营与智能客服'], boost: ['酒店', '宾客', '客服', '私域', '库存'],
    knowledge: K(
      ['餐饮：翻台率、客单价、食材成本率、人效、复购率', '酒店：入住率（OCC）、平均房价（ADR）、每间可售房收入（RevPAR）'],
      ['餐饮：采购 → 中央厨房 / 备料 → 门店出品 → 堂食与外卖 → 会员运营', '酒店：预订 → 入住 → 在住服务 → 退房 → 点评'],
      ['收银 POS', '进销存与供应链系统', '外卖与点评平台', '会员小程序', '酒店 PMS', '收益管理（RMS）与渠道管理'],
      ['食品安全法与食品经营许可', '反食品浪费法', '消防安全', '个人信息保护法（住客与会员信息）'],
      ['外卖和点评平台的数据拿不全，要考虑自有渠道沉淀', '高峰时段系统必须稳，新工具先在闲时试', '人员流动大，培训内容要短、要能在岗学'],
    ) },
  { id: 'ecommerce', sector: 'commerce', name: '电商 / 新零售', nameEn: 'E-commerce & new retail', keywords: ['电商', '电子商务', '直播', '新零售', '网店', '网络销售'],
    pains: ['流量成本持续走高', '多平台运营人效低', '客服与售后压力大'], scenarios: ['商品内容与素材批量生成', '投放与选品数据分析', '智能客服与售后自动化'], boost: ['电商', '直播', '增长', '内容', '客服'],
    knowledge: K(
      ['GMV', '转化率', '客单价', '投放 ROI', '复购率', '退货率', '获客成本（CAC）'],
      ['选品 → 内容与详情页 → 流量投放 → 转化 → 履约发货 → 售后 → 复购'],
      ['各电商平台后台', 'ERP / OMS', 'WMS', '客服系统', '投放工具', '私域 SCRM'],
      ['电子商务法', '广告法（绝对化用语等）', '网络直播营销管理办法', '七日无理由退货', '个人信息保护法', 'AI 生成合成内容的标识要求'],
      ['平台规则经常变，自动化流程要留人工兜底', 'AI 生成的素材不能虚假宣传，该标识的要标识', '刷单、虚假评价是违法行为，不在可选方案里'],
    ) },
  { id: 'services', sector: 'commerce', name: '生活服务 / 商业服务', nameEn: 'Consumer & business services', keywords: ['物业', '家政', '美容', '健身', '培训', '旅游', '旅行社', '广告', '咨询', '人力资源', '会展', '商业管理', '商务服务'],
    pains: ['获客依赖线下与转介绍', '服务过程难以标准化', '人效低、排班与调度靠经验'], scenarios: ['线索获取与跟进自动化', '服务质检与知识库', '排班调度优化'], boost: ['客户', '销售', '培训', '服务', '内容'],
    knowledge: K(
      ['线索转化率', '获客成本', '续费率与留存率', '人效', '净推荐值（NPS）'],
      ['获客 → 咨询 → 签约 → 交付服务 → 回访 → 续费与转介绍'],
      ['CRM', '企业微信与 SCRM', '排班与工单系统', '在线预约', '财务系统'],
      ['消费者权益保护法', '预付式消费的相关规定', '广告法', '个人信息保护法', '旅行社、人力资源、培训等业务需相应资质'],
      ['服务是非标品，先把话术和流程沉淀下来才谈得上自动化', '预付费模式下资金和退费风险要管住', '客户关系常跟着员工走，客户资料要沉淀到系统'],
    ) },
  { id: 'commerce-general', sector: 'commerce', name: '其他商业 / 服务业', nameEn: 'Other commerce & services', keywords: [],
    pains: ['客户数据分散在各平台', '营销与运营依赖个人经验', '重复性沟通与文书占用人力'], scenarios: ['客户数据整合与经营问答', '营销内容自动化', '客服与文书自动化'], boost: [],
    knowledge: K(
      ['营业收入与毛利率', '客单价', '复购率', '获客成本', '人效'],
      ['获客 → 转化 → 交付 → 售后 → 复购'],
      ['收银或订单系统', 'CRM', '企业微信', '各平台后台', '财务系统'],
      ['消费者权益保护法', '广告法', '个人信息保护法', '电子商务法（线上经营时）'],
      ['客户数据散在各个平台，先汇总再分析', '从重复性最高的沟通和文书入手最容易见效', '面向消费者的自动回复要给转人工的出口'],
    ) },
  // ── 贸易 ──
  { id: 'foreign-trade', sector: 'trade', name: '进出口贸易 / 外贸', nameEn: 'Import & export', keywords: ['进出口', '外贸', '国际贸易', '对外贸易', '国际经贸'],
    pains: ['询盘转化率低、跟进靠人', '汇率、关税与合规风险', '单证与报关流程繁琐'], scenarios: ['多语言询盘回复与客户背调', '单证审核与制单自动化', '市场与关税政策监测'], boost: ['翻译', '合规', '合同', '销售', '跨境'],
    knowledge: K(
      ['询盘转化率', '订单毛利率', '回款周期（DSO）', '交期达成率', '客户集中度'],
      ['客户开发 → 询盘报价 → 签约 → 备货采购 → 订舱 → 报关 → 装运 → 制单结汇 → 出口退税'],
      ['外贸 ERP', 'CRM', 'B2B 平台与独立站', '邮件系统', '国际贸易「单一窗口」', '海关数据'],
      ['Incoterms 2020 贸易术语', 'UCP 600（信用证）', 'HS 编码归类', '出口退税与外汇收支管理', '出口管制法与制裁名单筛查', 'RCEP 等协定的原产地规则'],
      ['信用证项下单证不符会导致拒付，AI 制单后必须人工复核', '客户资料常被业务员当作个人资源，要先沉淀进系统', '新客户要做制裁与信用筛查，再谈自动跟进'],
    ) },
  { id: 'cross-border', sector: 'trade', name: '跨境电商', nameEn: 'Cross-border e-commerce', keywords: ['跨境', '出海', '海外仓', '亚马逊'],
    pains: ['平台规则多变、合规风险高', '选品与备货决策难', '多语言内容与客服成本高'], scenarios: ['选品与竞品分析', '多语言商品页与广告素材生成', '多语言智能客服'], boost: ['跨境', '电商', '翻译', 'seo', '广告'],
    knowledge: K(
      ['ACOS / TACOS（广告销售成本比）', '转化率', '库存周转与库龄', '退货率', '店铺账号健康度'],
      ['选品 → 供应链 → 商品页（Listing）→ 头程物流 → 平台仓 / 海外仓 → 广告 → 客服 → 回款'],
      ['各跨境平台卖家后台', '跨境 ERP', '广告工具', '物流与海外仓系统', '跨境收款工具'],
      ['平台规则', '目的国产品合规（如 CE、FCC、CPC）', '欧盟 VAT 与 EPR', 'GDPR', '商标、专利、版权等知识产权', '目的国关税政策'],
      ['操纵评论、刷单会导致封号，不在可选方案里', '侵权是最常见的下架原因，上新前要做知识产权排查', 'AI 生成的商品页要核对合规声明与认证信息', '库龄长会产生仓储费，备货预测直接影响利润'],
    ) },
  { id: 'wholesale', sector: 'trade', name: '批发 / 分销', nameEn: 'Wholesale & distribution', keywords: ['批发', '经销', '分销', '总代', '商行'],
    pains: ['上下游账期挤压现金流', '渠道库存不透明', '报价与对账大量手工'], scenarios: ['渠道进销存可视与补货预测', '智能报价与对账', '客户信用与回款预警'], boost: ['库存', '销售', '财务', '客户', '供应商'],
    knowledge: K(
      ['库存周转', '应收账款周转天数', '毛利率', '订单满足率', '客户活跃率'],
      ['厂家授权 → 采购 → 仓储 → 分销 → 配送 → 对账 → 回款'],
      ['进销存 / ERP', 'DMS', 'WMS', '订货商城或小程序', '财务对账系统'],
      ['合同与增值税发票管理', '反不正当竞争法（商业贿赂）', '厂家的区域与价格政策（防窜货）', '食品、药品、危化品、酒类等品类需相应许可'],
      ['上游要现款、下游要账期，现金流是第一约束', '厂家返利政策复杂，对账是自动化的好切入点', '很多数据还在 Excel 和聊天记录里，先电子化'],
    ) },
  { id: 'commodity', sector: 'trade', name: '大宗商品 / 生产资料贸易', nameEn: 'Commodities & industrial inputs', keywords: ['物资', '大宗', '钢贸', '钢铁', '钢材', '煤炭', '有色', '化工原料', '粮油', '石油', '燃料'],
    pains: ['价格波动大、敞口管理难', '资金占用高、信用风险集中', '合同与物流环节多、易出错'], scenarios: ['价格与行情研判辅助', '客商信用评估与风险预警', '合同审查与履约跟踪'], boost: ['风险', '财务', '合同', '合规', '预测'],
    knowledge: K(
      ['风险敞口', '资金周转率', '吨毛利', '逾期率', '库存货值'],
      ['采购（长协 / 现货）→ 定价（点价、基差）→ 套期保值 → 物流仓储 → 销售 → 结算'],
      ['ERP 与 CTRM（大宗商品交易与风险管理系统）', '期货交易系统', '仓储监管与物联设备', '资金系统', '行情资讯平台'],
      ['期货和衍生品法', '套期保值的会计处理', '国有企业须遵守禁止融资性贸易的监管要求', '仓单与货权确认', '反洗钱要求'],
      ['货权不清、重复质押是这个行业最大的坑', '没有真实货物流转的贸易是红线', 'AI 的行情研判只能作参考，不构成交易指令'],
    ) },
  { id: 'logistics', sector: 'trade', name: '物流 / 货代 / 仓储', nameEn: 'Logistics, forwarding & warehousing', keywords: ['物流', '货代', '货运', '仓储', '快递', '运输', '报关', '船务', '供应链管理', '冷链'],
    pains: ['运力与线路调度靠经验', '订单状态查询占用大量客服', '仓储作业差错与效率'], scenarios: ['线路与装载优化', '在途跟踪与异常预警', '仓储作业与客服自动化'], boost: ['物流', '路线', '库存', '客服', '调度'],
    knowledge: K(
      ['准时率', '装载率', '单票 / 单公里成本', '库存准确率', '货损率', '回单及时率'],
      ['接单 → 调度 → 提货 → 干线运输 → 中转 → 末端配送 → 签收回单 → 结算'],
      ['TMS 运输管理', 'WMS 仓储管理', 'OMS 订单管理', 'GPS 与车联网', '报关系统与「单一窗口」', '订舱平台'],
      ['道路运输条例', '危险货物运输管理规定', '海关监管与 AEO 认证', '网络货运经营管理要求', '数据安全法'],
      ['运力多为外包，在途数据要靠司机或承运商配合采集', '异常处理高度依赖电话沟通，是客服自动化的重点', '线路优化要考虑限行、装卸时间窗等实际约束'],
    ) },
  { id: 'trade-general', sector: 'trade', name: '其他贸易', nameEn: 'Other trade', keywords: [],
    pains: ['业务信息散落在聊天与表格里', '客户与供应商管理靠个人', '单据与对账手工量大'], scenarios: ['客户与订单数据整合问答', '单据处理自动化', '供应商与客户风险监测'], boost: [],
    knowledge: K(
      ['毛利率', '资金周转天数', '应收账款逾期率', '订单履约率', '客户集中度'],
      ['找客户 → 报价 → 签约 → 采购备货 → 发货 → 对账 → 回款'],
      ['进销存或 ERP', '财务系统', '微信与邮件', '大量 Excel 表格'],
      ['民法典合同编', '增值税发票管理', '反不正当竞争法', '涉及进出口时的海关与外汇规定'],
      ['业务信息散在聊天和表格里，先集中再谈智能', '客户和供应商资料要归公司而不是归个人', '单据处理量大、规则清楚，适合最先自动化'],
    ) },
];

// ── 校验与规范化 ─────────────────────────────────────────────────────────────
const L = TAXONOMY_LIMITS;
const INDUSTRY_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const bad = (message) => new EnterpriseMatchError(400, 'invalid_taxonomy', message);
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const cleanText = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim();
const size = (text) => [...text].length;

export function textField(value, max, label, required = false) {
  if (value !== undefined && value !== null && typeof value !== 'string') throw bad(`${label}必须是文本`);
  const text = cleanText(value);
  if (required && !text) throw bad(`${label}不能为空`);
  if (size(text) > max) throw bad(`${label}最多 ${max} 个字`);
  return text;
}

/** 列表字段：去空、去重；超出条数或单条字数直接报错（不悄悄截断用户的数据）。lower 用于要和小写文本比对的词。 */
export function listField(value, [maxItems, maxLen], label, lower = false) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw bad(`${label}必须是列表`);
  const out = [];
  for (const item of value) {
    if (typeof item !== 'string') throw bad(`${label}里只能是文本`);
    const text = lower ? cleanText(item).toLowerCase() : cleanText(item);
    if (!text || out.includes(text)) continue;
    if (size(text) > maxLen) throw bad(`${label}每条最多 ${maxLen} 个字：「${[...text].slice(0, 16).join('')}…」`);
    out.push(text);
  }
  if (out.length > maxItems) throw bad(`${label}最多 ${maxItems} 条（现在 ${out.length} 条）`);
  return out;
}

export function normalizeIndustry(raw, label = '行业') {
  if (!isPlainObject(raw)) throw bad(`${label}的格式不对`);
  const id = String(raw.id ?? '');
  if (!INDUSTRY_ID_RE.test(id)) throw bad(`${label}的 id 只能用小写字母、数字和连字符（最多 40 位）`);
  if (!SECTOR_IDS.includes(raw.sector)) throw bad(`${label}的板块必须是工业（industry）/ 商业（commerce）/ 贸易（trade）之一`);
  const name = textField(raw.name, L.name, `${label}的名称`, true);
  const who = `行业「${name}」的`;
  if (raw.knowledge !== undefined && raw.knowledge !== null && !isPlainObject(raw.knowledge)) throw bad(`${who}知识基线格式不对`);
  const knowledge = {};
  for (const dim of KNOWLEDGE_DIMS) knowledge[dim.id] = listField(raw.knowledge?.[dim.id], L.knowledge, `${who}「${dim.name}」`);
  return {
    id,
    sector: raw.sector,
    name,
    nameEn: textField(raw.nameEn, L.nameEn, `${who}英文名`) || name,
    keywords: listField(raw.keywords, L.keywords, `${who}识别关键词`, true),
    pains: listField(raw.pains, L.pains, `${who}常见痛点`),
    scenarios: listField(raw.scenarios, L.scenarios, `${who}AI 场景`),
    boost: listField(raw.boost, L.boost, `${who}专家加分词`, true),
    knowledge,
  };
}

/** 板块：id 与名称固定；其余字段没给就用内置默认值。 */
function normalizeSector(raw, base) {
  if (!isPlainObject(raw)) throw bad(`板块「${base.name}」的格式不对`);
  const who = `「${base.name}」板块的`;
  const pick = (key) => (raw[key] === undefined || raw[key] === null ? base[key] : raw[key]);
  return {
    id: base.id,
    name: base.name,
    nameEn: base.nameEn,
    fallback: String(pick('fallback')),
    focus: textField(pick('focus'), L.focus, `${who}关注重点`, true),
    search: textField(pick('search'), L.search, `${who}检索词`),
    hints: listField(pick('hints'), L.hints, `${who}名称识别词`, true),
    boost: listField(pick('boost'), L.boost, `${who}专家加分词`, true),
    principles: listField(pick('principles'), L.principles, `${who}方法与原则`),
  };
}

/** 整份行业体系的校验：板块固定三个，每个板块至少一个行业，且兜底行业必须在本板块内。 */
export function normalizeTaxonomy(raw) {
  if (!isPlainObject(raw)) throw bad('行业体系的格式不对');
  if (raw.version !== undefined && raw.version !== TAXONOMY_VERSION) throw bad(`不支持的行业体系版本：${cleanText(raw.version).slice(0, 20)}`);
  if (!Array.isArray(raw.industries)) throw bad('行业体系里缺少 industries 列表');
  if (raw.industries.length > L.industries) throw bad(`行业最多 ${L.industries} 个（现在 ${raw.industries.length} 个）`);
  const industries = raw.industries.map((item, index) => normalizeIndustry(item, `第 ${index + 1} 个行业`));
  const ids = new Set();
  for (const industry of industries) {
    if (ids.has(industry.id)) throw bad(`行业 id 重复：${industry.id}`);
    ids.add(industry.id);
  }
  if (raw.sectors !== undefined && !Array.isArray(raw.sectors)) throw bad('sectors 必须是列表');
  const rawSectors = raw.sectors || [];
  for (const item of rawSectors) {
    if (!isPlainObject(item) || !SECTOR_IDS.includes(item.id)) throw bad('板块固定为工业（industry）/ 商业（commerce）/ 贸易（trade）三个，不能新增或改 id');
  }
  const sectors = SECTORS.map((base) => normalizeSector(rawSectors.find((item) => item.id === base.id) || {}, base));
  for (const sector of sectors) {
    const own = industries.filter((industry) => industry.sector === sector.id);
    if (!own.length) throw bad(`「${sector.name}」板块至少要保留一个行业`);
    if (!own.some((industry) => industry.id === sector.fallback)) {
      throw bad(`「${sector.name}」板块的兜底行业「${sector.fallback}」不存在或不属于该板块；请先在板块设置里换一个兜底行业`);
    }
  }
  return { version: TAXONOMY_VERSION, sectors, industries };
}

/** 加上按 id 查找的索引（匹配与生成工作流时用）。 */
export function indexTaxonomy(taxonomy) {
  return {
    ...taxonomy,
    sectorMap: Object.fromEntries(taxonomy.sectors.map((sector) => [sector.id, sector])),
    industryMap: Object.fromEntries(taxonomy.industries.map((industry) => [industry.id, industry])),
  };
}

// 模块加载时就把内置默认值过一遍校验：默认值自己超限 / 兜底行业写错，启动即报错，不会带病上线。
export const DEFAULT_TAXONOMY = indexTaxonomy(normalizeTaxonomy({ version: TAXONOMY_VERSION, sectors: SECTORS, industries: INDUSTRIES }));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plain = ({ version, sectors, industries }) => ({ version, sectors, industries });

/** 给界面 / 导出用的完整视图：每个行业标出是不是内置、有没有被改过。 */
export function describeTaxonomy(taxonomy, info = {}) {
  return {
    version: TAXONOMY_VERSION,
    customized: !!info.customized,
    updatedAt: info.updatedAt || '',
    error: info.error || '',
    limits: TAXONOMY_LIMITS,
    dims: KNOWLEDGE_DIMS,
    sectors: taxonomy.sectors.map((sector) => ({ ...sector, modified: !same(sector, DEFAULT_TAXONOMY.sectorMap[sector.id]) })),
    industries: taxonomy.industries.map((industry) => {
      const builtin = DEFAULT_TAXONOMY.industryMap[industry.id];
      return { ...industry, builtin: !!builtin, modified: !!builtin && !same(industry, builtin) };
    }),
  };
}

// ── 存储 ────────────────────────────────────────────────────────────────────
/**
 * 行业体系存储。file 为空 = 只在内存里（测试用）。
 * 没有文件时用内置默认值；文件读不出来时也用默认值，但把原因报给界面，且不动原文件——
 * 用户下一次保存时原文件会改名留底，不会被直接覆盖。导入和恢复默认之前也会留一份 .bak。
 */
export function createTaxonomyStore({ file = '', now = () => new Date() } = {}) {
  let state = null;

  function load() {
    if (state) return state;
    state = { taxonomy: DEFAULT_TAXONOMY, updatedAt: '', error: '', customized: false, broken: false };
    if (file && existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, 'utf-8'));
        state = {
          taxonomy: indexTaxonomy(normalizeTaxonomy(raw)),
          updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt.slice(0, 40) : '',
          error: '', customized: true, broken: false,
        };
      } catch (error) {
        state.broken = true;
        state.error = `已保存的行业体系读不出来（${String(error?.message || error).slice(0, 160)}），当前显示的是内置默认值；原文件没有改动`;
      }
    }
    return state;
  }

  const stamp = () => now().toISOString();

  function commit(raw) {
    const previous = load();
    const taxonomy = normalizeTaxonomy(raw);
    const updatedAt = stamp();
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      if (previous.broken && existsSync(file)) renameSync(file, `${file}.broken-${updatedAt.replace(/[:.]/g, '-')}`);
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, `${JSON.stringify({ ...taxonomy, updatedAt }, null, 2)}\n`, 'utf-8');
      renameSync(tmp, file);
    }
    state = { taxonomy: indexTaxonomy(taxonomy), updatedAt, error: '', customized: true, broken: false };
    return state.taxonomy;
  }

  /** 覆盖式操作（导入 / 恢复默认）之前留一份上一版。 */
  function backup() {
    if (!file || !existsSync(file)) return;
    try { writeFileSync(`${file}.bak`, readFileSync(file)); } catch { /* 留底失败不阻断用户的操作 */ }
  }

  const current = () => load().taxonomy;
  const describe = () => { const s = load(); return describeTaxonomy(s.taxonomy, s); };
  const draftOf = () => plain(current());

  function nextCustomId(taken) {
    let n = 1;
    for (const id of taken) { const m = /^custom-(\d+)$/.exec(id); if (m) n = Math.max(n, Number(m[1]) + 1); }
    return `custom-${n}`;
  }

  function addIndustry(input) {
    if (!isPlainObject(input)) throw bad('行业的格式不对');
    const draft = draftOf();
    const taken = draft.industries.map((industry) => industry.id);
    const id = input.id === undefined || input.id === null || input.id === '' ? nextCustomId(taken) : String(input.id);
    if (taken.includes(id)) throw new EnterpriseMatchError(409, 'industry_exists', `行业 id「${id.slice(0, 40)}」已存在`);
    if (taken.length >= L.industries) throw bad(`行业最多 ${L.industries} 个，请先删除不用的行业`);
    draft.industries = [...draft.industries, normalizeIndustry({ ...input, id }, '新行业')];
    return commit(draft).industryMap[id];
  }

  function findIndustry(id) {
    const industry = current().industryMap[String(id)];
    if (!industry) throw new EnterpriseMatchError(404, 'industry_not_found', '这个行业不存在，可能已被删除');
    return industry;
  }

  function updateIndustry(id, input) {
    if (!isPlainObject(input)) throw bad('行业的格式不对');
    const existing = findIndustry(id);
    const draft = draftOf();
    const sector = current().sectorMap[existing.sector];
    if (sector.fallback === existing.id && input.sector !== undefined && input.sector !== existing.sector) {
      throw new EnterpriseMatchError(409, 'industry_is_fallback', `「${existing.name}」是「${sector.name}」板块的兜底行业，不能移到别的板块；请先在板块设置里换一个兜底行业`);
    }
    const next = normalizeIndustry({ ...existing, ...input, id: existing.id }, '行业');
    draft.industries = draft.industries.map((industry) => (industry.id === existing.id ? next : industry));
    return commit(draft).industryMap[existing.id];
  }

  function removeIndustry(id) {
    const existing = findIndustry(id);
    const sector = current().sectorMap[existing.sector];
    if (sector.fallback === existing.id) {
      throw new EnterpriseMatchError(409, 'industry_is_fallback', `「${existing.name}」是「${sector.name}」板块的兜底行业（识别不出具体行业时用它），不能删除；请先在板块设置里换一个兜底行业`);
    }
    const draft = draftOf();
    draft.industries = draft.industries.filter((industry) => industry.id !== existing.id);
    commit(draft);
  }

  /** 把一个内置行业恢复成内置内容（自定义行业没有内置版本）。 */
  function resetIndustry(id) {
    const existing = findIndustry(id);
    const builtin = DEFAULT_TAXONOMY.industryMap[existing.id];
    if (!builtin) throw new EnterpriseMatchError(400, 'not_builtin', `「${existing.name}」是你自己添加的行业，没有内置版本可恢复`);
    const sector = current().sectorMap[existing.sector];
    if (sector.fallback === existing.id && builtin.sector !== existing.sector) {
      throw new EnterpriseMatchError(409, 'industry_is_fallback', `「${existing.name}」现在是「${sector.name}」板块的兜底行业，恢复后会回到原板块；请先换一个兜底行业`);
    }
    const draft = draftOf();
    draft.industries = draft.industries.map((industry) => (industry.id === existing.id ? builtin : industry));
    return commit(draft).industryMap[existing.id];
  }

  function updateSector(id, patch) {
    if (!SECTOR_IDS.includes(String(id))) throw new EnterpriseMatchError(404, 'sector_not_found', '板块只有工业 / 商业 / 贸易三个');
    if (!isPlainObject(patch)) throw bad('板块设置的格式不对');
    const draft = draftOf();
    draft.sectors = draft.sectors.map((sector) => (sector.id === id ? { ...sector, ...patch, id: sector.id } : sector));
    return commit(draft).sectorMap[id];
  }

  /** 导入：整份替换。先校验再留底再写——校验不过时什么都不动。 */
  function replace(raw) {
    const checked = normalizeTaxonomy(raw);
    backup();
    return commit(checked);
  }

  function reset() {
    load();
    backup();
    if (file) rmSync(file, { force: true });
    state = { taxonomy: DEFAULT_TAXONOMY, updatedAt: '', error: '', customized: false, broken: false };
    return state.taxonomy;
  }

  return { current, describe, addIndustry, updateIndustry, removeIndustry, resetIndustry, updateSector, replace, reset };
}
