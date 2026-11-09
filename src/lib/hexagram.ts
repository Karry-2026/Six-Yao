import hexagrams from '../data/hexagrams.json'
import { type InstalledHexagram, type InstalledHexagramBase, install, installLines } from './domain/install.ts'

export type Yao = 6 | 7 | 8 | 9

export interface Hexagram {
  number: number
  name: string
  pinyin: string
  lines: number[]
  judgment: string
  image: string
  interpretation: string
  fortune: string
  fortuneLevel: number
}

export interface Reading {
  /** 自下而上的六爻，1=阳 0=阴 */
  primary: number[]
  /** 动爻位置（0..5），空数组表示静卦 */
  moving: number[]
  /** 变卦，无动爻时为 null */
  changed: number[] | null
  /** 互卦 */
  mutual: number[]
  primaryHex: Hexagram
  changedHex: Hexagram | null
  mutualHex: Hexagram
  values: Yao[]
  /**
   * 装卦结果（可选字段，向后兼容）：
   * - `read(values)` 不带日期：卦画层面装卦——纳甲干支、五行、六亲、世应、爻题
   *   （`InstalledHexagramBase`），**不含**六兽与旬空（二者随起卦日而起）；
   * - `read(values, dateGanzhi)` 带日干支：完整装卦（`InstalledHexagram`），
   *   在前者基础上另含六兽、旬空标记、动爻标记与当日干支/旬名。
   * 运行时判别用 {@link isFullInstall}；旧调用方（不传日期）字段形状不变。
   */
  installed?: InstalledHexagramBase | InstalledHexagram
}

/** 判断装卦结果是否为随日起装的完整装卦（含六兽与旬空） */
export function isFullInstall(installed: InstalledHexagramBase | InstalledHexagram): installed is InstalledHexagram {
  return 'xunkongBranches' in installed
}

const byKey = new Map<string, Hexagram>()
for (const item of hexagrams as Hexagram[]) {
  byKey.set(item.lines.join(''), item)
}

export function lookup(lines: number[]): Hexagram {
  const hit = byKey.get(lines.join(''))
  if (!hit) throw new Error(`未知卦象: ${lines.join('')}`)
  return hit
}

/** 三枚铜钱：6 老阴 / 7 少阳 / 8 少阴 / 9 老阳，概率 1:3:3:1 */
export function tossLine(rng: () => number = Math.random): Yao {
  let heads = 0
  for (let i = 0; i < 3; i++) if (rng() < 0.5) heads++
  return (6 + heads) as Yao
}

export function isYang(value: Yao): boolean {
  return value === 7 || value === 9
}

export function isMoving(value: Yao): boolean {
  return value === 6 || value === 9
}

/** 自下而上六爻 */
export function toLines(values: Yao[]): number[] {
  return values.map((v) => (isYang(v) ? 1 : 0))
}

/** 互卦：2-3-4 爻为下卦，3-4-5 爻为上卦（0 基：1,2,3 与 2,3,4） */
export function mutualLines(lines: number[]): number[] {
  return [lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]]
}

export function changedLines(lines: number[], moving: number[]): number[] {
  return lines.map((line, index) => (moving.includes(index) ? (line === 1 ? 0 : 1) : line))
}

/**
 * 由铜钱爻值（6-9）读出一卦。
 * - `read(values)`：向后兼容，装卦到纳甲/六亲/世应层（无六兽旬空）；
 * - `read(values, dateGanzhi)`：另装六兽与旬空（随起卦日干支），见 {@link Reading.installed}。
 */
export function read(values: Yao[], dateGanzhi?: string | number): Reading {
  const primary = toLines(values)
  const moving = values
    .map((value, index) => (isMoving(value) ? index : -1))
    .filter((index) => index >= 0)
  const changed = moving.length > 0 ? changedLines(primary, moving) : null
  const mutual = mutualLines(primary)
  const installed = dateGanzhi === undefined ? installLines(primary) : install(values, dateGanzhi)
  return {
    primary,
    moving,
    changed,
    mutual,
    values,
    primaryHex: lookup(primary),
    changedHex: changed ? lookup(changed) : null,
    mutualHex: lookup(mutual),
    installed,
  }
}
