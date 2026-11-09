/**
 * 京房纳甲：八经卦纳甲干支表与八宫卦序（本宫/一世…五世/游魂/归魂 + 世应）。
 *
 * ── 纳甲表（已网络核对，两源逐卦一致）────────────────────────────
 * ① 《卜筮全书·纳甲歌》（识典古籍，原句引用）：
 *    乾金甲子外壬午，坎水戊寅外戊申，艮土丙辰外丙戌，震木庚子庚午临，
 *    巽木辛丑并辛未，离火己卯己酉寻，坤土乙未加癸丑，兑金丁巳丁亥凭。
 * ② 《卜筮正宗·纳甲装卦歌（从下装起）》（quanxue.cn 第07章，逐卦六爻干支表）：
 *    乾 内甲子寅辰 外壬午申戌；震 内庚子寅辰 外庚午申戌；坎 内戊寅辰午 外戊申戌子；
 *    艮 内丙辰午申 外丙戌子寅；巽 内辛丑亥酉 外辛未巳卯；离 内己卯丑亥 外己酉未巳；
 *    兑 内丁巳卯丑 外丁亥酉未；坤 内乙未巳卯 外癸丑亥酉。
 * ③ 原理互证：清·黄宗羲《易学象数论·纳甲二》——阳卦支顺行（子寅辰午申戌）、
 *    阴卦支逆行（未巳卯丑亥酉）；乾纳甲壬、坤纳乙癸、艮纳丙、兑纳丁、
 *    坎纳戊、离纳己、震纳庚、巽纳辛。
 *
 * ── 八宫卦序与世应（已网络核对，两源一致）────────────────────────
 * ① 六十四卦八宫归属全表（命格宇宙，注明典据《卜筮正宗》《增删卜易》）：
 *    https://mingge.org/compendium/liuyao/gua
 * ② 《卜筮正宗·安世应诀》（quanxue.cn 第07章，原句引用）：
 *    「八卦之首世六当，以下初爻轮上扬。游魂八宫四爻立，归魂八卦三爻详。」
 *    即：本宫纯卦世在上爻（第六爻），一世至五世世在初爻至五爻，
 *    游魂世在四爻，归魂世在三爻；应爻恒与世爻相隔三位。
 * ③ 变卦规则（国易堂《京氏易学八宫卦序说》等）：一世至五世自初爻起逐爻变，
 *    游魂 = 五世卦复变第四爻，归魂 = 游魂卦内卦复归本宫。
 *
 * 卦宫五行：乾兑金、坎水、艮坤土、震巽木、离火（《纳甲歌》句首金水土木
 * 与八宫归属表所注五行一致）。
 *
 * 零 DOM 依赖；仅可擦除 TS 语法，供 Node type-stripping 直接执行。
 */

import type { Wuxing } from './ganzhi.ts'

/** 三爻卦画，自下而上，1 = 阳爻，0 = 阴爻 */
export type TrigramLines = readonly [number, number, number]

/** 八经卦名 */
export type TrigramName = '乾' | '坎' | '艮' | '震' | '巽' | '离' | '坤' | '兑'

/** 三爻卦画键：自下而上按二进制编码（乾=7 … 坤=0） */
export type TrigramKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

/** 八宫卦序中的卦位 */
export type PalaceRank = '本宫' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂'

export interface TrigramInfo {
  /** 经卦名 */
  name: TrigramName
  /** 卦宫五行（乾兑金、坎水、艮坤土、震巽木、离火） */
  wuxing: Wuxing
  /** 三爻卦画（自下而上，1 阳 0 阴） */
  lines: TrigramLines
  /** 内卦（下卦）三爻纳甲干支，自下而上 */
  inner: readonly [string, string, string]
  /** 外卦（上卦）三爻纳甲干支，自下而上 */
  outer: readonly [string, string, string]
}

/** 八经卦纳甲总表。键为三爻卦画编码（自下而上），出处见文件头注释。 */
export const TRIGRAMS: Record<TrigramKey, TrigramInfo> = {
  7: { name: '乾', wuxing: '金', lines: [1, 1, 1], inner: ['甲子', '甲寅', '甲辰'], outer: ['壬午', '壬申', '壬戌'] },
  6: { name: '兑', wuxing: '金', lines: [1, 1, 0], inner: ['丁巳', '丁卯', '丁丑'], outer: ['丁亥', '丁酉', '丁未'] },
  5: { name: '离', wuxing: '火', lines: [1, 0, 1], inner: ['己卯', '己丑', '己亥'], outer: ['己酉', '己未', '己巳'] },
  4: { name: '震', wuxing: '木', lines: [1, 0, 0], inner: ['庚子', '庚寅', '庚辰'], outer: ['庚午', '庚申', '庚戌'] },
  3: { name: '巽', wuxing: '木', lines: [0, 1, 1], inner: ['辛丑', '辛亥', '辛酉'], outer: ['辛未', '辛巳', '辛卯'] },
  2: { name: '坎', wuxing: '水', lines: [0, 1, 0], inner: ['戊寅', '戊辰', '戊午'], outer: ['戊申', '戊戌', '戊子'] },
  1: { name: '艮', wuxing: '土', lines: [0, 0, 1], inner: ['丙辰', '丙午', '丙申'], outer: ['丙戌', '丙子', '丙寅'] },
  0: { name: '坤', wuxing: '土', lines: [0, 0, 0], inner: ['乙未', '乙巳', '乙卯'], outer: ['癸丑', '癸亥', '癸酉'] },
}

/** 三爻卦画 → 卦画键 */
export function trigramKeyOf3(lines: TrigramLines | readonly number[]): TrigramKey {
  if (lines.length !== 3) throw new Error(`三爻卦画长度应为 3: ${lines.join('')}`)
  const key = (lines[0] << 2) | (lines[1] << 1) | lines[2]
  if (key < 0 || key > 7) throw new Error(`非法三爻卦画: ${lines.join('')}`)
  return key as TrigramKey
}

/** 三爻卦画 → 经卦信息 */
export function trigramOf3(lines: TrigramLines | readonly number[]): TrigramInfo {
  return TRIGRAMS[trigramKeyOf3(lines)]
}

/**
 * 六爻卦画 → [内卦信息, 外卦信息]。六爻自下而上：0-2 为内卦，3-5 为外卦。
 * 例：水火既济 [1,0,1,0,1,0] → 内离外坎。
 */
export function trigramsOfLines(lines: readonly number[]): [TrigramInfo, TrigramInfo] {
  if (lines.length !== 6) throw new Error(`六爻卦画长度应为 6: ${lines.join('')}`)
  return [trigramOf3(lines.slice(0, 3)), trigramOf3(lines.slice(3, 6))]
}

/**
 * 六爻卦画 → 逐爻纳甲干支（自下而上六位）。
 * 内卦三爻取该经卦 inner，外卦三爻取该经卦 outer。
 */
export function najiaOfLines(lines: readonly number[]): string[] {
  const [inner, outer] = trigramsOfLines(lines)
  return [...inner.inner, ...outer.outer]
}

/** 各卦位对应的世爻位置（0 基爻序；0 = 初爻，5 = 上爻）。出处：安世应诀。 */
export const SHI_BY_RANK: Record<PalaceRank, number> = {
  本宫: 5, // 八卦之首世六当
  一世: 0, // 以下初爻轮上扬
  二世: 1,
  三世: 2,
  四世: 3,
  五世: 4,
  游魂: 3, // 游魂八宫四爻立
  归魂: 2, // 归魂八卦三爻详
}

export interface PalaceMember {
  /** 卦画（自下而上六爻，1 阳 0 阴） */
  lines: number[]
  /** 卦位：本宫/一世…五世/游魂/归魂 */
  rank: PalaceRank
  /** 世爻位置（0 基） */
  shi: number
  /** 应爻位置（0 基，恒为世隔三位） */
  ying: number
}

export interface Palace {
  /** 宫名（八纯卦经卦名） */
  name: TrigramName
  /** 本宫五行 */
  wuxing: Wuxing
  /** 本宫纯卦卦画 */
  baseLines: number[]
  /** 该宫八卦，序：本宫、一世…五世、游魂、归魂 */
  members: PalaceMember[]
}

/**
 * 按京房变卦规则推导一宫八卦：
 * 一世至五世自初爻起逐爻变；游魂 = 五世卦复变第四爻；归魂 = 游魂卦内卦复归本宫。
 * 出处：文件头注释（卜筮正宗/国易堂）。
 */
function derivePalace(name: TrigramName, wuxing: Wuxing, lines: TrigramLines): Palace {
  const base = [...lines, ...lines]
  const flip = (source: number[], position: number) =>
    source.map((bit, index) => (index === position ? 1 - bit : bit))
  const flipInner = (source: number[]) =>
    source.map((bit, index) => (index < 3 ? 1 - bit : bit))

  const first = flip(base, 0)
  const second = flip(first, 1)
  const third = flip(second, 2)
  const fourth = flip(third, 3)
  const fifth = flip(fourth, 4)
  const wandering = flip(fifth, 3)
  const returning = flipInner(wandering)

  const members: PalaceMember[] = (
    [
      ['本宫', base],
      ['一世', first],
      ['二世', second],
      ['三世', third],
      ['四世', fourth],
      ['五世', fifth],
      ['游魂', wandering],
      ['归魂', returning],
    ] as [PalaceRank, number[]][]
  ).map(([rank, memberLines]) => {
    const shi = SHI_BY_RANK[rank]
    return { lines: [...memberLines], rank, shi, ying: (shi + 3) % 6 }
  })

  return { name, wuxing, baseLines: [...base], members }
}

/**
 * 八宫全表（按后天八卦序排列：乾、坎、艮、震、巽、离、坤、兑；
 * 京房原序为乾震坎艮坤巽离兑，仅宫次不同，各宫成员与世应一致）。
 * 各宫八卦归属已与 mingge.org 六十四卦八宫归属表（典据卜筮正宗/增删卜易）
 * 及 scripts/verify-hexagrams.mjs 内置独立对照表逐一核对。
 */
export const PALACES: Palace[] = [
  derivePalace('乾', '金', [1, 1, 1]), // 乾为天 姤 遁 否 观 剥 晋 大有
  derivePalace('坎', '水', [0, 1, 0]), // 坎为水 节 屯 既济 革 丰 明夷 师
  derivePalace('艮', '土', [0, 0, 1]), // 艮为山 贲 大畜 损 睽 履 中孚 渐
  derivePalace('震', '木', [1, 0, 0]), // 震为雷 豫 解 恒 升 井 大过 随
  derivePalace('巽', '木', [0, 1, 1]), // 巽为风 小畜 家人 益 无妄 噬嗑 颐 蛊
  derivePalace('离', '火', [1, 0, 1]), // 离为火 旅 鼎 未济 蒙 涣 讼 同人
  derivePalace('坤', '土', [0, 0, 0]), // 坤为地 复 临 泰 大壮 夬 需 比
  derivePalace('兑', '金', [1, 1, 0]), // 兑为泽 困 萃 咸 蹇 谦 小过 归妹
]

/** 卦画（六爻，自下而上）→ 宫内归属 */
export interface PalaceLookup {
  /** 卦宫名（八纯卦经卦名，如"乾"） */
  palace: TrigramName
  /** 本宫五行 */
  palaceWuxing: Wuxing
  /** 卦位：本宫/一世…五世/游魂/归魂 */
  rank: PalaceRank
  /** 世爻位置（0 基） */
  shi: number
  /** 应爻位置（0 基） */
  ying: number
}

const palaceByLines = new Map<string, PalaceLookup>()
for (const palace of PALACES) {
  for (const member of palace.members) {
    const existing = palaceByLines.get(member.lines.join(''))
    if (existing) throw new Error(`八宫推导出现重复卦画: ${member.lines.join('')}`)
    palaceByLines.set(member.lines.join(''), {
      palace: palace.name,
      palaceWuxing: palace.wuxing,
      rank: member.rank,
      shi: member.shi,
      ying: member.ying,
    })
  }
}

/**
 * 查六爻卦画所属卦宫、卦位与世应。八宫推导恰好覆盖六十四卦且互不重复，
 * 未覆盖的卦画抛错。
 */
export function findPalace(lines: readonly number[]): PalaceLookup {
  const hit = palaceByLines.get(lines.join(''))
  if (!hit) throw new Error(`未知卦画（八宫未覆盖）: ${lines.join('')}`)
  return hit
}
