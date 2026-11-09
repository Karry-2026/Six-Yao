/**
 * 装卦（火珠林/六爻纳甲占法）：由六位爻值（6-9）与当日日干支，
 * 装出卦宫、本宫五行、逐爻纳甲干支、五行、六亲、六兽、世应与旬空。
 *
 * ── 规则出处（均已网络核对，≥2 源）────────────────────────────────
 * 六亲（与本宫五行论生克）：
 *   同我者兄弟，生我者父母，我生者子孙，克我者官鬼，我克者妻财。
 *   ① 玄机阁《六十四卦纳甲与世应全表》六亲规则原文；
 *   ② 六爻通行口诀（生我者父母…比和者兄弟，江春义六爻基础等）；
 *   ③ 卜筮正宗六亲分类（克我者为官鬼等）。
 * 六兽起法（《卜筮正宗》六兽歌 / 《卜筮全书》六神起法，两源一致）：
 *   「甲乙起青龙，丙丁起朱雀，戊日起勾陈，己日起螣蛇，庚辛起白虎，
 *    壬癸起玄武」；按起卦日天干定初爻所起之兽，自初爻向上依次轮排
 *    青龙→朱雀→勾陈→螣蛇→白虎→玄武。
 *   出处：① 知乎《六爻基础·第三讲·装六神》（zhuanlan.zhihu.com/p/553711576）；
 *        ② 卜筮正宗六兽歌课程材料与盲派六神起法（wanlihonghu.com）；
 *        ③ 青岚六爻基础·六神篇。
 * 爻题（初九/九二/…/上九，初、上两位省数字；阴爻同位称六）：通行本《周易》
 * 爻题体例（阳爻称九、阴爻称六），如乾卦初九至上九。
 * 纳甲、八宫世应、旬空：见 najia.ts / ganzhi.ts 文件头注释。
 *
 * 爻值语义与 src/lib/hexagram.ts 一致：6 老阴 / 7 少阳 / 8 少阴 / 9 老阳
 * （hexagram.ts:43）。本模块仅 `import type` 该 Yao 类型以保持零运行时耦合
 * （scripts/*.mjs 经 Node type-stripping 复用本模块，不能连带加载
 * hexagrams.json）；少阳少阴、动爻、爻画等谓词在此独立实现，
 * 语义与 hexagram.ts:50-61 相同。
 *
 * 零 DOM 依赖；仅可擦除 TS 语法。
 */

import type { Yao } from '../hexagram.ts'
import {
  type Branch,
  type Wuxing,
  GANZHI60,
  STEMS,
  ganzhiIndex,
  ganzhiWuxing,
  isBranchXunkong,
  xunOf,
  xunkongOf,
} from './ganzhi.ts'
import { type PalaceRank, type TrigramName, findPalace, najiaOfLines } from './najia.ts'

/** 六亲（与本宫五行论生克） */
export type Liuqin = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼'

/** 六兽（六神） */
export type Liushou = '青龙' | '朱雀' | '勾陈' | '螣蛇' | '白虎' | '玄武'

/** 六兽轮排固定顺序（自初爻向上） */
export const LIUSHOU_ORDER: readonly Liushou[] = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武']

/** 六兽起法表：日干 → 初爻所起之兽在 LIUSHOU_ORDER 中的序。出处见文件头。 */
const LIUSHOU_START: Record<(typeof STEMS)[number], number> = {
  甲: 0, 乙: 0, // 甲乙起青龙
  丙: 1, 丁: 1, // 丙丁起朱雀
  戊: 2, // 戊日起勾陈
  己: 3, // 己日起螣蛇
  庚: 4, 辛: 4, // 庚辛起白虎
  壬: 5, 癸: 5, // 壬癸起玄武
}

/** 我生（五行相生：木生火，火生土，土生金，金生水，水生木） */
const GENERATES: Record<Wuxing, Wuxing> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }

/** 我克（五行相克：木克土，土克水，水克火，火克金，金克木） */
const OVERCOMES: Record<Wuxing, Wuxing> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }

/** 六亲：以本宫五行为"我"，爻支五行为彼，论生克。 */
export function liuqinOf(palaceWuxing: Wuxing, yaoWuxing: Wuxing): Liuqin {
  if (palaceWuxing === yaoWuxing) return '兄弟' // 同我者
  if (GENERATES[palaceWuxing] === yaoWuxing) return '子孙' // 我生者
  if (GENERATES[yaoWuxing] === palaceWuxing) return '父母' // 生我者
  if (OVERCOMES[palaceWuxing] === yaoWuxing) return '妻财' // 我克者
  if (OVERCOMES[yaoWuxing] === palaceWuxing) return '官鬼' // 克我者
  throw new Error(`无法定六亲: 宫${palaceWuxing} 爻${yaoWuxing}`)
}

/** 六兽起法：日干支序 → 初爻所起之兽 */
export function liushouStartOf(dayGanzhiIndex: number): Liushou {
  const index = ((dayGanzhiIndex % 60) + 60) % 60
  const stem = STEMS[index % 10]
  return LIUSHOU_ORDER[LIUSHOU_START[stem]]
}

/** 按日干装六兽：日干支序 + 爻位（0 基） → 六兽 */
export function liushouOf(dayGanzhiIndex: number, yaoIndex: number): Liushou {
  const index = ((dayGanzhiIndex % 60) + 60) % 60
  return LIUSHOU_ORDER[(LIUSHOU_START[STEMS[index % 10]] + yaoIndex) % 6]
}

/**
 * 爻题：阳爻称九、阴爻称六；初、上两位以"初/上"起首（初九、上六），
 * 中间四位数字在前（九二、九三、九四、九五；六二…六五）。
 * 通行本《周易》体例（如乾卦初九、九二、九三、九四、九五、上九）。
 */
export function yaoName(yang: boolean, yaoIndex: number): string {
  const positions = ['初', '二', '三', '四', '五', '上']
  if (yaoIndex < 0 || yaoIndex > 5) throw new Error(`爻位越界: ${yaoIndex}`)
  const numeral = yang ? '九' : '六'
  if (yaoIndex === 0 || yaoIndex === 5) return positions[yaoIndex] + numeral
  return numeral + positions[yaoIndex]
}

/** 爻值阴阳：7 少阳 / 9 老阳 为阳（与 hexagram.ts:50 isYang 语义一致） */
function isYangValue(value: Yao): boolean {
  return value === 7 || value === 9
}

/** 爻值动否：6 老阴 / 9 老阳 为动爻（与 hexagram.ts:54 isMoving 语义一致） */
function isMovingValue(value: Yao): boolean {
  return value === 6 || value === 9
}

/** 爻值 → 卦画（1 阳 0 阴，与 hexagram.ts:59 toLines 语义一致） */
function valueToLine(value: Yao): 0 | 1 {
  return isYangValue(value) ? 1 : 0
}

export interface InstalledYaoBase {
  /** 爻位 0..5，自下而上 */
  index: number
  /** 爻题：初九/初六/九二/…/上九/上六 */
  name: string
  /** 阳爻与否（7 少阳 / 9 老阳 为阳；6 老阴 / 8 少阴 为阴） */
  yang: boolean
  /** 纳甲干支（如"甲子"） */
  ganzhi: string
  /** 爻支五行（六爻装卦以地支定五行） */
  wuxing: Wuxing
  /** 六亲（按本宫五行） */
  liuqin: Liuqin
  /** 世爻与否 */
  shi: boolean
  /** 应爻与否 */
  ying: boolean
}

export interface InstalledYao extends InstalledYaoBase {
  /** 原始爻值 6-9 */
  value: Yao
  /** 动爻与否（6 老阴 / 9 老阳） */
  moving: boolean
  /** 六兽（按起卦日天干） */
  liushou: Liushou
  /** 爻支临旬空与否（按当日日干支所在旬） */
  xunkong: boolean
}

export interface InstalledHexagramBase {
  /** 本卦卦画（自下而上六位，1 阳 0 阴） */
  lines: number[]
  /** 卦宫（八纯卦经卦名，如"乾"） */
  palace: TrigramName
  /** 卦宫名（如"乾宫"） */
  palaceName: string
  /** 本宫五行 */
  palaceWuxing: Wuxing
  /** 卦位：本宫/一世…五世/游魂/归魂 */
  rank: PalaceRank
  /** 世爻位置（0 基） */
  shi: number
  /** 应爻位置（0 基） */
  ying: number
  /** 自下而上六爻（不含随日起装的六兽与旬空） */
  yaos: InstalledYaoBase[]
}

export interface InstalledHexagram extends InstalledHexagramBase {
  /** 原始爻值（自下而上） */
  values: Yao[]
  /** 当日日干支 */
  dayGanzhi: string
  /** 当日日干支序（0 = 甲子） */
  dayGanzhiIndex: number
  /** 当日所在旬（如"甲子旬"） */
  xun: string
  /** 当日旬空两支 */
  xunkongBranches: [Branch, Branch]
  /** 自下而上六爻（含六兽与旬空） */
  yaos: InstalledYao[]
}

function resolveDayIndex(dayGanzhi: string | number): number {
  const index = typeof dayGanzhi === 'number' ? dayGanzhi : ganzhiIndex(dayGanzhi)
  const normalized = ((index % 60) + 60) % 60
  if (typeof dayGanzhi === 'number' && index !== normalized) {
    throw new Error(`日干支序越界 [0,59]: ${dayGanzhi}`)
  }
  return normalized
}

/**
 * 装卦（卦画层面，不随日起装）：输入六爻卦画，
 * 输出卦宫、本宫五行、卦位世应与逐爻纳甲干支、五行、六亲、爻题。
 * 供 scripts/generate-install-table.mjs 生成 src/data/install.json 全表。
 */
export function installLines(lines: readonly number[]): InstalledHexagramBase {
  if (lines.length !== 6) throw new Error(`卦画长度应为 6: ${lines.join('')}`)
  const palace = findPalace(lines)
  const ganzhiList = najiaOfLines(lines)
  const yaos = ganzhiList.map((ganzhi, index) => {
    const wuxing = ganzhiWuxing(ganzhi)
    return {
      index,
      name: yaoName(lines[index] === 1, index),
      yang: lines[index] === 1,
      ganzhi,
      wuxing,
      liuqin: liuqinOf(palace.palaceWuxing, wuxing),
      shi: index === palace.shi,
      ying: index === palace.ying,
    }
  })
  return {
    lines: [...lines],
    palace: palace.palace,
    palaceName: `${palace.palace}宫`,
    palaceWuxing: palace.palaceWuxing,
    rank: palace.rank,
    shi: palace.shi,
    ying: palace.ying,
    yaos,
  }
}

/**
 * 装卦：输入六位爻值（6-9，自下而上）与当日日干支（"甲子"或干支序 0-59），
 * 输出完整装卦结果（含六兽与旬空标记）。
 */
export function install(values: readonly Yao[], dayGanzhi: string | number): InstalledHexagram {
  if (values.length !== 6) throw new Error(`爻值长度应为 6: ${values.join(',')}`)
  for (const value of values) {
    if (value !== 6 && value !== 7 && value !== 8 && value !== 9) {
      throw new Error(`爻值应为 6-9，得到 ${value}`)
    }
  }
  const lines = values.map(valueToLine)
  const base = installLines(lines)
  const dayIndex = resolveDayIndex(dayGanzhi)
  const dayName = GANZHI60[dayIndex]
  const emptyBranches = xunkongOf(dayIndex)
  const yaos: InstalledYao[] = base.yaos.map((yao, index) => ({
    ...yao,
    value: values[index],
    moving: isMovingValue(values[index]),
    liushou: liushouOf(dayIndex, index),
    xunkong: isBranchXunkong(dayIndex, yao.ganzhi[1]),
  }))
  return {
    ...base,
    values: [...values],
    dayGanzhi: dayName,
    dayGanzhiIndex: dayIndex,
    xun: xunOf(dayIndex),
    xunkongBranches: emptyBranches,
    yaos,
  }
}
