/**
 * 干支历：六十甲子、公历日期 → 日干支、旬空（六甲空亡）。
 *
 * 零 DOM 依赖的纯函数模块；仅使用可擦除 TS 语法（无 enum/namespace），
 * 以便 Node 原生 type-stripping 直接执行（scripts/*.mjs 会复用本模块）。
 *
 * ── 日干支锚点与算法（已网络核对，多源一致）──────────────────────────
 * 干支纪日自春秋以来连续循环，公式：日干支序 = (儒略日数 JDN + 49) mod 60，
 * 余 0 为甲子（等价形式见「历法漫谈」：ad = JD − 11，ad mod 60，0 = 甲子）。
 * JDN 采用格里高利历整数公式（Meeus《Astronomical Algorithms》ch.7 /
 * Fliegel & Van Flandern, 1968），对公历按 proleptic Gregorian 处理。
 *
 * 锚点核对（四个独立万年历来源，与本实现逐一吻合，见 domain.test.ts）：
 * - 1949-10-01 = 甲子日（开国大典；万年历，
 *   https://kuku.baidu.com/landing/tscp_doc/0f061a9fad75340b5703b78adc82868b）
 * - 2000-01-01 = 戊午日（万年历；JDN 2451545）
 * - 2024-01-01 = 甲子日（多个黄历网站：qmrl888.com 等，癸卯年甲子月甲子日）
 * - 2026-11-09 = 丁亥日（5000yan 万年历、smxs 每日黄历一致）
 *
 * ── 旬空（《卜筮全书》六甲空亡诀，已网络核对两源）──────────────────
 * 「甲子旬中戌亥空，甲戌旬中申酉空；甲申旬中午未空，甲午旬中辰巳空；
 *   甲辰旬中寅卯空，甲寅旬中子丑空。」
 * 出处：①《卜筮全书》六甲空亡（guoxue.com 收录）；
 *      ② 六爻教程 https://xnray.github.io/post/sixyao/kongwang（逐旬对照表）；
 *      ③ 国易堂「如何查空亡」、知乎六甲空亡词条（同表）。
 */

/** 天干，序 0..9 */
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const

/** 地支，序 0..11 */
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

export type Stem = (typeof STEMS)[number]
export type Branch = (typeof BRANCHES)[number]

/** 六十甲子，序 0 = 甲子 … 59 = 癸亥 */
export const GANZHI60: string[] = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12])

/** 干支序 → 天干 */
export function stemOf(index: number): Stem {
  return STEMS[mod(index, 10)]
}

/** 干支序 → 地支 */
export function branchOf(index: number): Branch {
  return BRANCHES[mod(index, 12)]
}

/** 干支名（"甲子"…）→ 六十甲子序；非法组合抛错 */
export function ganzhiIndex(name: string): number {
  if (name.length !== 2) throw new Error(`非法干支: ${name}`)
  const stem = STEMS.indexOf(name[0] as Stem)
  const branch = BRANCHES.indexOf(name[1] as Branch)
  if (stem < 0 || branch < 0) throw new Error(`非法干支: ${name}`)
  if ((stem - branch) % 2 !== 0) throw new Error(`非法干支组合（阴阳不匹配）: ${name}`)
  const index = GANZHI60.indexOf(name)
  if (index < 0) throw new Error(`非法干支: ${name}`)
  return index
}

/** 非负取模（JS % 对负数返回负值，这里归一） */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/**
 * 公历（格里高利历，含 proleptic）日期 → 儒略日数 JDN（正午起算的整数）。
 * 公式：Meeus《Astronomical Algorithms》ch.7（与 Fliegel & Van Flandern 1968 等价）。
 * 已用锚点 2000-01-01 → 2451545 验证。
 */
export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

/** 儒略日数 → 日干支序（0 = 甲子） */
export function jdnToGanzhiIndex(jdn: number): number {
  return mod(jdn + 49, 60)
}

/** 公历日期 → 日干支序（0 = 甲子） */
export function ganzhiIndexOfDate(year: number, month: number, day: number): number {
  return jdnToGanzhiIndex(gregorianToJdn(year, month, day))
}

/** 公历日期 → 日干支名 */
export function ganzhiOfDate(year: number, month: number, day: number): string {
  return GANZHI60[ganzhiIndexOfDate(year, month, day)]
}

/** 六旬名，序 = 干支序整除十（0 = 甲子旬 … 5 = 甲寅旬） */
export const XUN_NAMES = ['甲子旬', '甲戌旬', '甲申旬', '甲午旬', '甲辰旬', '甲寅旬'] as const

/** 六旬空亡表：每旬所空两支。出处见文件头注释（卜筮全书六甲空亡诀等）。 */
export const XUNKONG: readonly [Branch, Branch][] = [
  ['戌', '亥'], // 甲子旬
  ['申', '酉'], // 甲戌旬
  ['午', '未'], // 甲申旬
  ['辰', '巳'], // 甲午旬
  ['寅', '卯'], // 甲辰旬
  ['子', '丑'], // 甲寅旬
]

/** 干支序 → 所在旬名 */
export function xunOf(index: number): (typeof XUN_NAMES)[number] {
  return XUN_NAMES[mod(Math.floor(mod(index, 60) / 10), 6)]
}

/** 干支序 → 该旬所空两支 */
export function xunkongOf(index: number): [Branch, Branch] {
  return XUNKONG[mod(Math.floor(mod(index, 60) / 10), 6)]
}

/** 判断某地支是否为某日干支旬空 */
export function isBranchXunkong(dayGanzhiIndex: number, branch: Branch | string): boolean {
  return xunkongOf(dayGanzhiIndex).includes(branch as Branch)
}

/** 干支序 → 爻位六亲所用五行（六爻装卦以地支定五行） */
export type Wuxing = '木' | '火' | '土' | '金' | '水'

/** 天干五行：甲乙木、丙丁火、戊己土、庚辛金、壬癸水 */
export const STEM_WUXING: Record<Stem, Wuxing> = {
  甲: '木', 乙: '木',
  丙: '火', 丁: '火',
  戊: '土', 己: '土',
  庚: '金', 辛: '金',
  壬: '水', 癸: '水',
}

/** 地支五行：寅卯木、巳午火、申酉金、亥子水、辰戌丑未土 */
export const BRANCH_WUXING: Record<Branch, Wuxing> = {
  寅: '木', 卯: '木',
  巳: '火', 午: '火',
  申: '金', 酉: '金',
  亥: '水', 子: '水',
  辰: '土', 戌: '土', 丑: '土', 未: '土',
}

/** 干支五行（六爻装卦取地支五行） */
export function ganzhiWuxing(ganzhi: string): Wuxing {
  if (ganzhi.length !== 2) throw new Error(`非法干支: ${ganzhi}`)
  return BRANCH_WUXING[ganzhi[1] as Branch]
}
