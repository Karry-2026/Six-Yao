/**
 * 用神选取与旺衰简断（六爻断卦第一层规则引擎）。
 *
 * 只做「问事类别 → 用神六亲」映射与「月建/日辰对用神爻支生克冲合」的简断，
 * 不做伏神飞伏、卦气旺衰等复杂推演（项目口径见 docs/adr/0002-full-najia-domain.md）。
 *
 * ── 用神映射口径（已网络核对，主流一致）────────────────────────────
 * ① 《增删卜易·用神章》（野鹤老人，维基文库 zh.wikisource.org/zh-hans/增删卜易/3、/8）：
 *    「凡占金银、买卖都以妻财为用神」；功名求官、官司、女占夫以官鬼为用神；
 *    文书、契约、书信、房屋、车船以父母为用神；子女、医药、解忧以子孙为用神。
 * ② 婚姻：《增删卜易·婚姻章》原文「男家占女……無不以財為用。女家占男，皆以官為用」
 *    ——男占婚姻看妻财（女方），女占婚姻看官鬼（男方）。
 * ③ 疾病：《增删卜易》第114章「诸书无不以官鬼为病，应为医人，子孙为药」
 *    ——官鬼为病症（宜衰），子孙为医药（宜旺）。注意：任务书示例作「父母(医药)」，
 *    与主流不合；父母爻在占病体系中的角色是「占尊长之病以父母爻为用神」（看病人），
 *    医药之神通行取子孙（子孙克官鬼，为解忧之喜神）。本引擎取主流口径并在此注明差异。
 *    自占病以世爻为用神（《增删卜易》：「自占病，若得世爻旺相……立保安康」）。
 * ④ 出行：《增删卜易·出行章》（quanxue.cn 第101章）「世为出行之人」「世爻旺相宜行」
 *    ——以世爻为用神；父母爻为行李舟车（克伤则车船有损、行李有失），为辅助参断。
 *    任务书示例「出行/父母(行李)」即出自此句，本表以世爻为主用神、父母（行李舟车）为辅。
 * ⑤ 考试文书：文书、契约、升学以父母为用神（用神章）；考功名之试兼看官鬼（名次官府）。
 * ⑥ 胎产：以子孙为用神（通行教材口径，据用神章「占子孙者以子孙爻为用神」引申：
 *    胎儿为晚辈）。
 * ⑦ 家宅：以父母爻为宅舍（用神章：房屋以父母为用神）。
 * ⑧ 自占吉凶：以世爻为用神（通行口径，用神章「占自己吉凶，以世爻为用神」一类）。
 *
 * ── 用神两现取舍（已网络核对）────────────────────────────────────
 * 《增删卜易·两现章》（维基文库 卷十六）：「按古法，舍其休囚而用旺相，舍其静爻而用动爻，
 * 舍其月破而用不破，舍其旬空而用不空，舍其被伤而用不伤。」
 * 本引擎可实现的优先级（装卦信息范围内）：动爻 > 不旬空 > 临世爻 > 首现；
 * 「旺相/月破」需月建信息，属 wangshui 阶段，不在取爻时判定（注释简化说明）。
 * 用神不上卦（如乾宫天山遁缺妻财子孙）需伏神法，本简断未实现，返回 null 由上层提示。
 *
 * ── 旺衰简断口径（已网络核对）────────────────────────────────────
 * ① 生克：月建、日辰（以地支五行论，干从支）与用神爻支五行论生克——
 *    同我（临值）最旺、生我为相、同五行异支为比扶；克我为衰；我生为泄、我克为耗。
 * ② 冲合（纳支六冲六合，通行于《卜筮正宗》《增删卜易》体系）：
 *    六冲——子午、丑未、寅申、卯酉、辰戌、巳亥；
 *    六合——子丑、寅亥、卯戌、辰酉、巳申、午未。
 * ③ 月破：月建所冲之爻为月破，纵旺亦伤，出月或逢合方可为用（通行说，
 *    免費占卜網《六爻日破月破》与各教材一致）。
 * ④ 暗动/日破：静爻旺相，被日辰冲之为暗动（吉凶之机暗萌，动则力显，可司生克之职）；
 *    静爻休囚，被日辰冲之为日破（冲散，本旬无力）。
 *    （zhanbu.org/detail/2083《六爻日破月破》与通行六爻教材一致。）
 *    动爻遇日辰冲：主事急变，休囚者恐冲散（简断从通行说，注明非定论）。
 * ⑤ 日合：静而逢合为合起（得日辰之助），动而逢合为合绊（事被绊住，应期反迟）。
 * ⑥ 旬空：以日干支所在旬查空亡（《卜筮全书》六甲空亡诀，见 ganzhi.ts）；
 *    旬空逢日辰冲则「冲空则起」（通行说：日辰冲空爻即起）。
 * ⑦ 旺衰计分（本引擎的确定性简断法，非古法定论）：临值 +2、月生/日生 +2、比扶 +1、
 *    月合/日合 +1、月克/日克 −2、泄 −1、耗 −1、冲不计分（冲的效应由暗动/日破/月破表达）。
 *    得分 > 0 旺相、= 0 平气、< 0 休囚。六爻诸家对生克权重并无统一量化，
 *    此处仅将「有无生扶/克伤」离散化，结论措辞保守（「主事有气可成」而非断吉凶）。
 *
 * 零 DOM 依赖；仅可擦除 TS 语法，供 Node type-stripping 直接执行。
 */

import type { Branch, Wuxing } from './ganzhi.ts'
import { BRANCH_WUXING, GANZHI60, branchOf, ganzhiIndex, xunkongOf } from './ganzhi.ts'
import type { InstalledHexagramBase, InstalledYaoBase, Liuqin } from './install.ts'

/** 纳支六冲：子午、丑未、寅申、卯酉、辰戌、巳亥相冲 */
export const SIX_CLASH: Readonly<Record<Branch, Branch>> = {
  子: '午', 午: '子',
  丑: '未', 未: '丑',
  寅: '申', 申: '寅',
  卯: '酉', 酉: '卯',
  辰: '戌', 戌: '辰',
  巳: '亥', 亥: '巳',
}

/** 纳支六合：子丑、寅亥、卯戌、辰酉、巳申、午未相合 */
export const SIX_COMBINE: Readonly<Record<Branch, Branch>> = {
  子: '丑', 丑: '子',
  寅: '亥', 亥: '寅',
  卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰',
  巳: '申', 申: '巳',
  午: '未', 未: '午',
}

/** 月建/日辰对爻支的关系枚举 */
export type SourceRelation = '值' | '比' | '生' | '克' | '泄' | '耗' | '冲' | '合'

/** 计算月建（或日辰地支）对用神爻支的全部关系：冲合优先于五行生克列出，可并存 */
export function relationsOf(source: Branch, target: Branch): SourceRelation[] {
  const relations: SourceRelation[] = []
  if (source === target) relations.push('值')
  else if (BRANCH_WUXING[source] === BRANCH_WUXING[target]) relations.push('比')
  if (SIX_CLASH[source] === target) relations.push('冲')
  if (SIX_COMBINE[source] === target) relations.push('合')
  if (relations.includes('值')) return relations // 临值不另论生克（同支同五行）
  const sourceWuxing = BRANCH_WUXING[source]
  const targetWuxing = BRANCH_WUXING[target]
  const GENERATES: Record<Wuxing, Wuxing> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
  const OVERCOMES: Record<Wuxing, Wuxing> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
  if (GENERATES[sourceWuxing] === targetWuxing) relations.push('生')
  if (GENERATES[targetWuxing] === sourceWuxing) relations.push('泄')
  if (OVERCOMES[sourceWuxing] === targetWuxing) relations.push('克')
  if (OVERCOMES[targetWuxing] === sourceWuxing) relations.push('耗')
  return relations
}

/** 旺衰计分口径：见文件头注释⑦（确定性简断，非古法定论） */
const RELATION_SCORE: Record<SourceRelation, number> = {
  值: 2, 生: 2, 比: 1, 合: 1, 冲: 0, 泄: -1, 耗: -1, 克: -2,
}

/** 单条生克冲合明细 */
export interface WangshuiItem {
  /** 来源：月建 / 日辰 */
  source: '月建' | '日辰'
  /** 原始关系 */
  relation: SourceRelation
  /** 简称：临月建/月生/月克/月破/月合/日生/日克/日冲/日合… */
  label: string
  /** 明细说明（含暗动/日破/合绊等判定） */
  note: string
}

/** 旺衰等级 */
export type WangshuiLevel = '旺相' | '平' | '休囚'

/** 旺衰简断结果 */
export interface Wangshui {
  /** 用神爻支 */
  branch: Branch
  /** 用神爻支五行 */
  wuxing: Wuxing
  /** 月建地支 */
  month: Branch
  /** 日干支名（如"甲子"） */
  dayGanzhi: string
  /** 日辰地支 */
  dayBranch: Branch
  /** 月建、日辰逐条生克冲合枚举（月生/月克/日生/日克/日冲…） */
  items: WangshuiItem[]
  /** 旺衰等级（计分法，见文件头注释⑦） */
  level: WangshuiLevel
  /** 得分（仅供解释，非古法） */
  score: number
  /** 特殊标记 */
  flags: {
    /** 月建所冲：月破 */
    yuepo: boolean
    /** 静爻休囚遇日冲：日破 */
    ripo: boolean
    /** 静爻旺相遇日冲：暗动 */
    andong: boolean
    /** 用神爻支临当日旬空 */
    xunkong: boolean
  }
  /** 简明结论字符串（一段话，可直接呈现） */
  summary: string
}

export interface WangshuiOptions {
  /** 用神爻支 */
  branch: Branch
  /** 用神爻是否动爻（6 老阴 / 9 老阳） */
  moving?: boolean
  /** 月建地支 */
  month: Branch
  /** 日干支（"甲子"或干支序 0-59） */
  day: string | number
}

/**
 * 旺衰简断：枚举月建、日辰对用神爻支的生克冲合，给出等级与简明结论。
 * 口径见文件头注释（暗动/日破/月破/旬空各条）。
 */
export function wangshui(options: WangshuiOptions): Wangshui {
  const { branch, month } = options
  const moving = options.moving ?? false
  // 日干支归一与 install.ts resolveDayIndex 同口径：数字越界 [0,59] 抛错，字符串非法抛错
  const rawIndex = typeof options.day === 'number' ? options.day : ganzhiIndex(options.day)
  const dayIndex = ((rawIndex % 60) + 60) % 60
  if (typeof options.day === 'number' && rawIndex !== dayIndex) {
    throw new Error(`日干支序越界 [0,59]: ${rawIndex}`)
  }
  const dayGanzhi = GANZHI60[dayIndex]
  const dayBranch = branchOf(dayIndex)
  const wuxing = BRANCH_WUXING[branch]

  const monthRelations = relationsOf(month, branch)
  const dayRelations = relationsOf(dayBranch, branch)
  const score =
    monthRelations.reduce((sum, r) => sum + RELATION_SCORE[r], 0) +
    dayRelations.reduce((sum, r) => sum + RELATION_SCORE[r], 0)
  const level: WangshuiLevel = score > 0 ? '旺相' : score === 0 ? '平' : '休囚'

  const yuepo = monthRelations.includes('冲')
  const dayChong = dayRelations.includes('冲')
  const andong = dayChong && !moving && level === '旺相'
  const ripo = dayChong && !moving && level !== '旺相'
  const xunkong = xunkongOf(dayIndex).includes(branch)

  const items: WangshuiItem[] = []
  const push = (source: '月建' | '日辰', relation: SourceRelation, label: string, note: string) =>
    items.push({ source, relation, label, note })

  for (const relation of monthRelations) {
    if (relation === '值') push('月建', relation, '临月建', '爻临月建，当令最旺')
    else if (relation === '比') push('月建', relation, '月比扶', '与月建同五行异支，得月扶')
    else if (relation === '生') push('月建', relation, '月生', '月建生之，爻相（月相）')
    else if (relation === '克') push('月建', relation, '月克', '月建克之，爻衰')
    else if (relation === '泄') push('月建', relation, '泄于月', '爻生月建，气有泄')
    else if (relation === '耗') push('月建', relation, '耗于月', '爻克月建，力有耗')
    else if (relation === '冲') push('月建', relation, '月破', '月建冲之，为月破：纵旺亦伤，出月或逢合方可为用')
    else if (relation === '合') push('月建', relation, '月合', '月建合之，得月护持')
  }
  for (const relation of dayRelations) {
    if (relation === '值') push('日辰', relation, '临日辰', '爻临日辰，其力最切')
    else if (relation === '比') push('日辰', relation, '日比扶', '与日辰同五行异支，得日扶')
    else if (relation === '生') push('日辰', relation, '日生', '日辰生之，爻相')
    else if (relation === '克') push('日辰', relation, '日克', '日辰克之，爻衰')
    else if (relation === '泄') push('日辰', relation, '泄于日', '爻生日辰，气有泄')
    else if (relation === '耗') push('日辰', relation, '耗于日', '爻克日辰，力有耗')
    else if (relation === '冲') {
      // 暗动/日破判定口径：静爻旺相遇日冲为暗动，休囚遇日冲为日破（见文件头注释④）
      if (moving) push('日辰', relation, '日冲', '动爻遇日辰冲：主事急变，休囚者恐冲散（简断从通行说）')
      else if (andong) push('日辰', relation, '日冲', '静爻旺相遇日辰冲为暗动：吉凶之机暗萌，应期提前')
      else push('日辰', relation, '日冲', '静爻休囚遇日辰冲为日破：冲散，本旬内无力')
    } else if (relation === '合') {
      // 静而逢合为合起，动而逢合为合绊（见文件头注释⑤）
      push('日辰', relation, '日合', moving ? '动而逢合为合绊：事被绊住，应期反迟' : '静而逢合为合起，得日辰之助')
    }
  }

  const flags = { yuepo, ripo, andong, xunkong }

  // 简明结论：月建一句、日辰一句 + 等级断语 + 特殊标记补注
  const describe = (source: '月建' | '日辰', other: string) => {
    const own = items.filter((item) => item.source === source).map((item) => item.label)
    return own.length > 0 ? `${other}：${own.join('、')}` : `${other}：无生克冲合`
  }
  const levelText =
    level === '旺相' ? '用神旺相，主事有气可成' : level === '平' ? '用神平气，成败须看动爻变爻' : '用神休囚，主事无力难成'
  const extras: string[] = []
  if (yuepo) extras.push('惟犯月破，出月方可用')
  if (andong) extras.push('暗动主事萌于内，应期近')
  if (ripo) extras.push('又逢日破，本旬无力')
  if (xunkong) extras.push(dayChong ? '旬空得日辰冲，冲空则起' : '用神临旬空，出空逢值之期方验')
  const summary =
    `用神${branch}支${wuxing}。` +
    `${describe('月建', `月建${month}支${BRANCH_WUXING[month]}`)}；` +
    `${describe('日辰', `日辰${dayGanzhi}（${dayBranch}支${BRANCH_WUXING[dayBranch]}）`)}。` +
    `${levelText}${extras.length > 0 ? `；${extras.join('；')}` : ''}。`

  return { branch, wuxing, month, dayGanzhi, dayBranch, items, level, score, flags, summary }
}

/** 问事类别（可按需扩充） */
export type Topic =
  | '求财'
  | '事业功名'
  | '疾病'
  | '考试文书'
  | '婚姻'
  | '官司诉讼'
  | '出行'
  | '胎产'
  | '家宅'
  | '自占吉凶'

/** 用神角色：某六亲在所占事中的含义 */
export interface YongshenRole {
  /** 六亲，或径取世爻（世爻非六亲，单列） */
  liuqin: Liuqin | '世爻'
  /** 所指：病症/医药/行李舟车/文书名次… */
  label: string
  /** 是否主用神 */
  primary: boolean
}

/** 用神选取规格（口径出处见文件头注释①—⑧，亦逐条写在表内） */
export interface YongshenSpec {
  topic: Topic
  /** 主用神 */
  primary: YongshenRole
  /** 辅助参断（医药/行李舟车/名次等） */
  helpers: YongshenRole[]
  /** 取用说明（含流派差异注释） */
  note: string
}

/**
 * 问事类别 → 用神六亲映射表。口径出处逐条标注（增删卜易用神章/婚姻章/出行章/114章，
 * 均已网络核对原文或权威转述）。
 */
export const TOPIC_YONGSHEN: Readonly<Record<Topic, YongshenSpec>> = {
  求财: {
    topic: '求财',
    primary: { liuqin: '妻财', label: '财帛货物', primary: true },
    helpers: [],
    note: '《增删卜易·用神章》：凡占金银、买卖都以妻财为用神。',
  },
  事业功名: {
    topic: '事业功名',
    primary: { liuqin: '官鬼', label: '官职名位', primary: true },
    helpers: [],
    note: '《增删卜易·用神章》：功名求官以官鬼为用神（求官者官鬼持世，求名必成）。',
  },
  疾病: {
    topic: '疾病',
    primary: { liuqin: '官鬼', label: '病症鬼祟', primary: true },
    helpers: [{ liuqin: '子孙', label: '医药解忧', primary: false }],
    note:
      '《增删卜易》第114章：「诸书无不以官鬼为病，应为医人，子孙为药」——官鬼为病症（宜衰），' +
      '子孙为医药（宜旺）。任务书示例作「父母(医药)」与主流不合：父母爻的角色是「占尊长之病以父母爻' +
      '为用神」（看病人），医药之神通行取子孙。自占病以世爻为用神。',
  },
  考试文书: {
    topic: '考试文书',
    primary: { liuqin: '父母', label: '文书卷籍', primary: true },
    helpers: [{ liuqin: '官鬼', label: '名次功名', primary: false }],
    note:
      '《增删卜易·用神章》：文书、契约、升学以父母为用神；应试求名兼看官鬼（名次官府）。',
  },
  婚姻: {
    topic: '婚姻',
    primary: { liuqin: '妻财', label: '女方（男占）', primary: true },
    helpers: [],
    note:
      '《增删卜易·婚姻章》原文：「男家占女……無不以財為用。女家占男，皆以官為用」' +
      '——男占婚姻看妻财，女占婚姻看官鬼；用 yongshenOf(topic, { male }) 按性别取。',
  },
  官司诉讼: {
    topic: '官司诉讼',
    primary: { liuqin: '官鬼', label: '官府听讼', primary: true },
    helpers: [],
    note: '《增删卜易·用神章》：官司词讼以官鬼为用神（官府）。',
  },
  出行: {
    topic: '出行',
    primary: { liuqin: '世爻', label: '出行之人', primary: true },
    helpers: [{ liuqin: '父母', label: '行李舟车', primary: false }],
    note:
      '《增删卜易·出行章》（quanxue.cn 第101章）：「世为出行之人」「世爻旺相宜行」——以世爻为用神；' +
      '父母爻为行李舟车（克伤则车船有损、行李有失），为辅助参断。',
  },
  胎产: {
    topic: '胎产',
    primary: { liuqin: '子孙', label: '胎儿', primary: true },
    helpers: [],
    note: '通行教材口径（据《增删卜易·用神章》「占子孙者以子孙爻为用神」引申）：胎儿为晚辈，以子孙为用神。',
  },
  家宅: {
    topic: '家宅',
    primary: { liuqin: '父母', label: '宅舍', primary: true },
    helpers: [],
    note: '《增删卜易·用神章》：房屋以父母为用神。',
  },
  自占吉凶: {
    topic: '自占吉凶',
    primary: { liuqin: '世爻', label: '己身', primary: true },
    helpers: [],
    note: '通行口径：自占吉凶以世爻为用神（《增删卜易》自占病「若得世爻旺相……立保安康」同此理）。',
  },
}

/**
 * 按问事类别取用神规格。婚姻按问者性别取用（男占妻财、女占官鬼），
 * 其余类别与表一致。
 */
export function yongshenOf(topic: Topic, options?: { male?: boolean }): YongshenSpec {
  const spec = TOPIC_YONGSHEN[topic]
  if (topic === '婚姻' && options && typeof options.male === 'boolean') {
    // 《增删卜易·婚姻章》：男家占女以财为用，女家占男以官为用
    return options.male
      ? { ...spec, primary: { liuqin: '妻财', label: '女方', primary: true } }
      : { ...spec, primary: { liuqin: '官鬼', label: '男方', primary: true } }
  }
  return spec
}

/** 用神取爻结果 */
export interface YongshenPick {
  /** 选定的用神爻 */
  yao: InstalledYaoBase
  /** 该六亲（或世爻）在卦中的全部爻位（用神两现） */
  candidates: number[]
}

/**
 * 在装卦结果中取用神爻。用神两现取舍依《增删卜易·两现章》古法可实现部分：
 * 动爻 > 不旬空 > 临世爻 > 首现（旺相/月破需月建信息，不在取爻时判定）。
 * 用神不上卦（伏藏）返回 null（伏神法未实现，见文件头注释）。
 *
 * @param installed 装卦结果（卦画层即可）
 * @param liuqin    用神六亲，或 '世爻'
 * @param hints     moving：动爻位列表；xunkongOfYao：判爻是否旬空（有日干支时提供）
 */
export function findYongshenYao(
  installed: InstalledHexagramBase,
  liuqin: Liuqin | '世爻',
  hints?: { moving?: number[]; xunkongOfYao?: (yao: InstalledYaoBase) => boolean },
): YongshenPick | null {
  if (liuqin === '世爻') {
    const yao = installed.yaos[installed.shi]
    return { yao, candidates: [installed.shi] }
  }
  const candidates = installed.yaos
    .filter((yao) => yao.liuqin === liuqin)
    .map((yao) => yao.index)
  if (candidates.length === 0) return null
  const rank = (index: number): number[] => [
    hints?.moving?.includes(index) ? 0 : 1, // 舍静取动
    hints?.xunkongOfYao?.(installed.yaos[index]) ? 1 : 0, // 舍其旬空，用其不空
    installed.yaos[index].shi ? 0 : 1, // 临世优先（通行补法）
    index, // 首现
  ]
  const sorted = [...candidates].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < ra.length; i++) {
      if (ra[i] !== rb[i]) return ra[i] - rb[i]
    }
    return 0
  })
  return { yao: installed.yaos[sorted[0]], candidates }
}

/** analyzeReading 可接受的 Reading 最小形状（结构化类型，避免运行时耦合 hexagram.ts） */
export interface AnalysisLikeReading {
  installed: InstalledHexagramBase
  /** 动爻位列表（0..5），静卦为空数组 */
  moving?: number[]
}

/** 一卦一问的简断结果 */
export interface ReadingAnalysis {
  topic: Topic
  /** 用神规格与取用说明 */
  spec: YongshenSpec
  /** 选定的用神爻（不上卦为 null——伏神法未实现） */
  yongshen: {
    liuqin: Liuqin | '世爻'
    label: string
    /** 爻位（0 基，自下而上） */
    yaoIndex: number
    /** 爻题（初九/九二/…） */
    yaoName: string
    /** 纳甲干支（如"甲子"） */
    ganzhi: string
    branch: Branch
    wuxing: Wuxing
    shi: boolean
    moving: boolean
    /** 用神两现的全部爻位 */
    candidates: number[]
  } | null
  /** 辅助参断之爻（医药/行李舟车等；不上卦为 null） */
  helpers: { liuqin: Liuqin | '世爻'; label: string; yaoIndex: number | null }[]
  /** 用神旺衰简断（用神不上卦为 null） */
  wangshui: Wangshui | null
  /** 简明结论字符串 */
  summary: string
}

export interface AnalyzeOptions {
  topic: Topic
  /** 婚姻按问者性别取用（男占妻财、女占官鬼） */
  male?: boolean
  /** 月建地支 */
  month: Branch
  /** 日干支（"甲子"或干支序 0-59） */
  day: string | number
}

/**
 * 一卦一问简断：问事类别 → 用神 → 取爻（两现取舍）→ 旺衰简断 → 结论串。
 */
export function analyzeReading(reading: AnalysisLikeReading, options: AnalyzeOptions): ReadingAnalysis {
  const spec = yongshenOf(options.topic, { male: options.male })
  const rawDayIndex =
    typeof options.day === 'number' ? options.day : ganzhiIndex(options.day)
  const dayIndex = ((rawDayIndex % 60) + 60) % 60
  const xunkongOfYao = (yao: InstalledYaoBase) => xunkongOf(dayIndex).includes(yao.ganzhi[1] as Branch)
  const pick = findYongshenYao(reading.installed, spec.primary.liuqin, {
    moving: reading.moving,
    xunkongOfYao,
  })

  const helpers = spec.helpers.map((helper) => {
    const helperPick = findYongshenYao(reading.installed, helper.liuqin, { moving: reading.moving, xunkongOfYao })
    return { liuqin: helper.liuqin, label: helper.label, yaoIndex: helperPick ? helperPick.yao.index : null }
  })

  if (!pick) {
    return {
      topic: options.topic,
      spec,
      yongshen: null,
      helpers,
      wangshui: null,
      summary:
        `占${options.topic}：用神${spec.primary.liuqin}（${spec.primary.label}）不上卦，` +
        `当以伏神取用；本简断未实现伏神法，暂不判旺衰。`,
    }
  }

  const { yao } = pick
  const moving = reading.moving?.includes(yao.index) ?? false
  const ws = wangshui({ branch: yao.ganzhi[1] as Branch, moving, month: options.month, day: options.day })
  const yongshen = {
    liuqin: spec.primary.liuqin,
    label: spec.primary.label,
    yaoIndex: yao.index,
    yaoName: yao.name,
    ganzhi: yao.ganzhi,
    branch: ws.branch,
    wuxing: ws.wuxing,
    shi: yao.shi,
    moving,
    candidates: pick.candidates,
  }
  const summary =
    `占${options.topic}：用神取${yongshen.liuqin}（${yongshen.label}），` +
    `上卦为${yao.name} ${yao.ganzhi}${ws.wuxing}${pick.candidates.length > 1 ? '（用神两现，' + yao.name + '）' : ''}；` +
    ws.summary
  return { topic: options.topic, spec, yongshen, helpers, wangshui: ws, summary }
}
