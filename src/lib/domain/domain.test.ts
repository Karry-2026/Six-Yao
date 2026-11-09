/**
 * 六爻装卦领域层黄金卦例测试。
 *
 * 每个黄金卦例的期望值均誊录自已网络核对的权威来源（出处写在各用例注释）：
 * - 《卜筮全书·纳甲歌》（识典古籍，原句）与《卜筮正宗·纳甲装卦歌/安世应诀》
 *   （quanxue.cn 第07章，逐卦六爻干支与世应口诀）
 * - 命格宇宙《六十四卦八宫归属表》（mingge.org，注明典据《卜筮正宗》《增删卜易》）
 * - 玄机阁《六十四卦纳甲与世应全表》（xuanjige.app，逐卦纳甲干支与世应）
 * - 六爻教程空亡篇（xnray.github.io/post/sixyao/kongwang，六旬空亡表）与
 *   《卜筮全书》六甲空亡诀
 * - 日干支锚点：1949-10-01 甲子日、2000-01-01 戊午日、2024-01-01 甲子日、
 *   2026-11-09 丁亥日（各万年历/黄历来源，见 ganzhi.ts 文件头）
 * - 六神起法：知乎《六爻基础·第三讲·装六神》与《卜筮正宗》六兽歌
 */
import { describe, expect, it } from 'vitest'

import hexagrams from '../../data/hexagrams.json'
import { lookup } from '../hexagram.ts'
import {
  GANZHI60,
  ganzhiIndexOfDate,
  ganzhiIndex,
  isBranchXunkong,
  xunOf,
  xunkongOf,
} from './ganzhi.ts'
import { PALACES, SHI_BY_RANK, findPalace, najiaOfLines, trigramsOfLines } from './najia.ts'
import { LIUSHOU_ORDER, install, installLines, liushouOf, yaoName } from './install.ts'
import { isFullInstall, read } from '../hexagram.ts'

/** 按卦名取卦画（自下而上） */
function linesOf(name: string): number[] {
  const hex = (hexagrams as { name: string; lines: number[] }[]).find((h) => h.name === name)
  if (!hex) throw new Error(`hexagrams.json 缺卦: ${name}`)
  return hex.lines
}

/** 静卦（无动爻）装卦：阳爻取少阳 7、阴爻取少阴 8 */
function installStatic(name: string, day: string | number) {
  const values = linesOf(name).map((line) => (line === 1 ? 7 : 8)) as import('../hexagram.ts').Yao[]
  return install(values, day)
}

/** 摘要一卦六爻："初九 甲子水 子孙 青龙 [世][应][空]" */
function summarize(installed: ReturnType<typeof installStatic>): string[] {
  return installed.yaos.map(
    (y) =>
      `${y.name} ${y.ganzhi}${y.wuxing} ${y.liuqin} ${y.liushou}` +
      (y.shi ? ' 世' : y.ying ? ' 应' : '') +
      (y.xunkong ? ' 空' : ''),
  )
}

describe('干支历：日干支锚点（ganzhi.ts）', () => {
  // 锚点出处见 ganzhi.ts 文件头：均为万年历/黄历核实值
  it('1949-10-01 为甲子日（开国大典，万年历）', () => {
    expect(ganzhiIndexOfDate(1949, 10, 1)).toBe(0)
  })

  it('2000-01-01 为戊午日（万年历，JDN 2451545）', () => {
    expect(ganzhiIndexOfDate(2000, 1, 1)).toBe(54)
    expect(GANZHI60[54]).toBe('戊午')
  })

  it('2024-01-01 为甲子日（多源黄历：癸卯年甲子月甲子日）', () => {
    expect(ganzhiIndexOfDate(2024, 1, 1)).toBe(0)
  })

  it('2026-11-09 为丁亥日（5000yan 万年历、smxs 黄历一致）', () => {
    expect(ganzhiIndexOfDate(2026, 11, 9)).toBe(23)
    expect(GANZHI60[23]).toBe('丁亥')
  })

  it('六十甲子首尾与非法组合校验', () => {
    expect(GANZHI60[0]).toBe('甲子')
    expect(GANZHI60[59]).toBe('癸亥')
    expect(GANZHI60).toHaveLength(60)
    expect(ganzhiIndex('庚午')).toBe(6)
    expect(() => ganzhiIndex('甲丑')).toThrow() // 干支阴阳不匹配
  })
})

describe('旬空：六甲空亡（ganzhi.ts）', () => {
  // 口诀（卜筮全书）：甲子旬中戌亥空，甲戌旬中申酉空；甲申旬中午未空，
  // 甲午旬中辰巳空；甲辰旬中寅卯空，甲寅旬中子丑空。
  it('六旬空亡表逐旬核对（旬首日）', () => {
    expect(xunkongOf(0)).toEqual(['戌', '亥']) // 甲子
    expect(xunkongOf(10)).toEqual(['申', '酉']) // 甲戌
    expect(xunkongOf(20)).toEqual(['午', '未']) // 甲申
    expect(xunkongOf(30)).toEqual(['辰', '巳']) // 甲午
    expect(xunkongOf(40)).toEqual(['寅', '卯']) // 甲辰
    expect(xunkongOf(50)).toEqual(['子', '丑']) // 甲寅
  })

  it('旬尾日与旬中旬名一致（癸酉属甲子旬，戊戌属甲午旬，戊申属甲辰旬）', () => {
    expect(xunOf(9)).toBe('甲子旬') // 癸酉（甲子旬旬尾）
    expect(xunkongOf(9)).toEqual(['戌', '亥'])
    expect(xunOf(34)).toBe('甲午旬') // 戊戌
    expect(xunkongOf(34)).toEqual(['辰', '巳'])
    expect(xunOf(44)).toBe('甲辰旬') // 戊申
    expect(xunkongOf(44)).toEqual(['寅', '卯'])
  })

  it('isBranchXunkong：甲子日戌亥空、甲申日午未空', () => {
    expect(isBranchXunkong(0, '戌')).toBe(true)
    expect(isBranchXunkong(0, '亥')).toBe(true)
    expect(isBranchXunkong(0, '申')).toBe(false)
    expect(isBranchXunkong(20, '午')).toBe(true)
    expect(isBranchXunkong(20, '未')).toBe(true)
  })
})

describe('八宫卦序与世应（najia.ts）', () => {
  it('八纯卦世在上爻、应在三爻（安世应诀：八卦之首世六当）', () => {
    const pureNames = ['乾为天', '坤为地', '震为雷', '巽为风', '坎为水', '离为火', '艮为山', '兑为泽']
    for (const name of pureNames) {
      const result = findPalace(linesOf(name))
      expect(result.rank, name).toBe('本宫')
      expect(result.shi, name).toBe(5)
      expect(result.ying, name).toBe(2)
    }
  })

  it('安世应诀：一世至五世世居初至五爻，游魂世四、归魂世三', () => {
    expect(SHI_BY_RANK).toEqual({ 本宫: 5, 一世: 0, 二世: 1, 三世: 2, 四世: 3, 五世: 4, 游魂: 3, 归魂: 2 })
    // 例：乾宫一世天风姤世初，坎宫三世水火既济世三，乾宫游魂火地晋世四，乾宫归魂火天大有世三
    expect(findPalace(linesOf('天风姤'))).toMatchObject({ palace: '乾', rank: '一世', shi: 0, ying: 3 })
    expect(findPalace(linesOf('火地晋'))).toMatchObject({ palace: '乾', rank: '游魂', shi: 3, ying: 0 })
    expect(findPalace(linesOf('火天大有'))).toMatchObject({ palace: '乾', rank: '归魂', shi: 2, ying: 5 })
  })

  it('八宫推导恰好覆盖六十四卦且互不重复，卦宫五行合纳甲歌', () => {
    const covered = PALACES.flatMap((p) => p.members.map((m) => m.lines.join('')))
    expect(covered).toHaveLength(64)
    expect(new Set(covered).size).toBe(64)
    const allLines = (hexagrams as { lines: number[] }[]).map((h) => h.lines.join(''))
    for (const key of allLines) expect(covered).toContain(key)
    expect(PALACES.map((p) => `${p.name}${p.wuxing}`)).toEqual([
      '乾金', '坎水', '艮土', '震木', '巽木', '离火', '坤土', '兑金',
    ])
  })

  it('水火既济内卦离、外卦坎（trigramsOfLines）', () => {
    const [inner, outer] = trigramsOfLines(linesOf('水火既济'))
    expect(inner.name).toBe('离')
    expect(outer.name).toBe('坎')
  })
})

describe('黄金卦例（install.ts，期望值誊录自文献）', () => {
  it('乾为天：乾宫本宫，世六应三；初九甲子水子孙（任务指定＋卜筮正宗装卦歌）', () => {
    const installed = installStatic('乾为天', '甲子')
    expect(installed.palace).toBe('乾')
    expect(installed.palaceName).toBe('乾宫')
    expect(installed.palaceWuxing).toBe('金')
    expect(installed.rank).toBe('本宫')
    expect(installed.shi).toBe(5)
    expect(installed.ying).toBe(2)
    expect(summarize(installed)).toEqual([
      '初九 甲子水 子孙 青龙', // 任务指定：乾为天初爻甲子水、六亲子孙
      '九二 甲寅木 妻财 朱雀',
      '九三 甲辰土 父母 勾陈 应',
      '九四 壬午火 官鬼 螣蛇',
      '九五 壬申金 兄弟 白虎',
      '上九 壬戌土 父母 玄武 世 空', // 甲子旬戌亥空，上九临戌
    ])
  })

  it('坤为地：初六乙未土兄弟（任务指定；坤宫土）', () => {
    const installed = installStatic('坤为地', '甲子')
    expect(installed).toMatchObject({ palace: '坤', palaceWuxing: '土', rank: '本宫', shi: 5, ying: 2 })
    expect(summarize(installed)).toEqual([
      '初六 乙未土 兄弟 青龙', // 任务指定：坤为地初爻乙未土
      '六二 乙巳火 父母 朱雀',
      '六三 乙卯木 官鬼 勾陈 应',
      '六四 癸丑土 兄弟 螣蛇',
      '六五 癸亥水 妻财 白虎 空', // 甲子旬戌亥空，六五临亥
      '上六 癸酉金 子孙 玄武 世',
    ])
  })

  it('水火既济：坎宫三世，世三应上，内离外坎（任务指定＋玄机阁全表）', () => {
    const installed = installStatic('水火既济', '甲子')
    expect(installed).toMatchObject({ palace: '坎', palaceWuxing: '水', rank: '三世', shi: 2, ying: 5 })
    const [inner, outer] = trigramsOfLines(linesOf('水火既济'))
    expect(inner.name).toBe('离') // 内卦离：纳己卯、己丑、己亥
    expect(outer.name).toBe('坎') // 外卦坎：纳戊申、戊戌、戊子
    expect(summarize(installed)).toEqual([
      '初九 己卯木 子孙 青龙',
      '六二 己丑土 官鬼 朱雀',
      '九三 己亥水 兄弟 勾陈 世 空', // 甲子旬戌亥空，九三临亥
      '六四 戊申金 父母 螣蛇',
      '九五 戊戌土 官鬼 白虎 空', // 九五临戌
      '上六 戊子水 兄弟 玄武 应',
    ])
  })

  it('火天大有：乾宫归魂，世三应上；纳甲甲子甲寅甲辰己酉己未己巳（玄机阁全表）', () => {
    const installed = installStatic('火天大有', '甲子')
    expect(installed).toMatchObject({ palace: '乾', rank: '归魂', shi: 2, ying: 5 })
    expect(najiaOfLines(linesOf('火天大有'))).toEqual(['甲子', '甲寅', '甲辰', '己酉', '己未', '己巳'])
    expect(installed.yaos.map((y) => y.liuqin)).toEqual(['子孙', '妻财', '父母', '兄弟', '父母', '官鬼'])
  })

  it('天风姤：乾宫一世，世初应四；九四官鬼壬午火、九三兄弟辛酉金（玄机阁全表＋六爻卦例）', () => {
    const installed = installStatic('天风姤', '甲子')
    expect(installed).toMatchObject({ palace: '乾', rank: '一世', shi: 0, ying: 3 })
    expect(summarize(installed)).toEqual([
      '初六 辛丑土 父母 青龙 世',
      '九二 辛亥水 子孙 朱雀 空', // 甲子旬戌亥空，九二临亥
      '九三 辛酉金 兄弟 勾陈',
      '九四 壬午火 官鬼 螣蛇 应', // 通行卦例：官鬼壬午火 应
      '九五 壬申金 兄弟 白虎',
      '上九 壬戌土 父母 玄武 空', // 上九临戌
    ])
  })

  it('泽水困：兑宫一世，世初应四（玄机阁全表＋八宫归属表）', () => {
    const installed = installStatic('泽水困', '丁亥')
    expect(installed).toMatchObject({ palace: '兑', palaceWuxing: '金', rank: '一世', shi: 0, ying: 3 })
    expect(summarize(installed)).toEqual([
      '初六 戊寅木 妻财 朱雀 世',
      '九二 戊辰土 父母 勾陈',
      '六三 戊午火 官鬼 螣蛇 空', // 丁亥日属甲申旬，午未空
      '九四 丁亥水 子孙 白虎 应',
      '九五 丁酉金 兄弟 玄武',
      '上六 丁未土 父母 青龙 空',
    ])
  })

  it('地天泰：坤宫三世，世三应上；六亲按坤宫土论（八宫归属表＋六亲生克规则）', () => {
    const installed = installStatic('地天泰', '甲子')
    expect(installed).toMatchObject({ palace: '坤', palaceWuxing: '土', rank: '三世', shi: 2, ying: 5 })
    expect(installed.yaos.map((y) => `${y.ganzhi}${y.wuxing}${y.liuqin}`)).toEqual([
      '甲子水妻财', '甲寅木官鬼', '甲辰土兄弟', '癸丑土兄弟', '癸亥水妻财', '癸酉金子孙',
    ])
  })

  it('雷天大壮：坤宫四世，世四应初（玄机阁全表＋八宫归属表）', () => {
    const installed = installStatic('雷天大壮', '甲子')
    expect(installed).toMatchObject({ palace: '坤', rank: '四世', shi: 3, ying: 0 })
    expect(najiaOfLines(linesOf('雷天大壮'))).toEqual(['甲子', '甲寅', '甲辰', '庚午', '庚申', '庚戌'])
  })

  it('泽火革：坎宫四世，世四应初（玄机阁全表＋八宫归属表）', () => {
    const installed = installStatic('泽火革', '甲子')
    expect(installed).toMatchObject({ palace: '坎', rank: '四世', shi: 3, ying: 0 })
    expect(summarize(installed)).toEqual([
      '初九 己卯木 子孙 青龙 应',
      '六二 己丑土 官鬼 朱雀',
      '九三 己亥水 兄弟 勾陈 空', // 甲子旬戌亥空
      '九四 丁亥水 兄弟 螣蛇 世 空', // 四爻为阳爻（外兑），临亥亦空
      '九五 丁酉金 父母 白虎',
      '上六 丁未土 官鬼 玄武',
    ])
  })

  it('山水蒙：离宫四世，世四应初（玄机阁全表＋八宫归属表）', () => {
    const installed = installStatic('山水蒙', '甲子')
    expect(installed).toMatchObject({ palace: '离', palaceWuxing: '火', rank: '四世', shi: 3, ying: 0 })
    expect(installed.yaos.map((y) => `${y.ganzhi}${y.wuxing}${y.liuqin}`)).toEqual([
      '戊寅木父母', '戊辰土子孙', '戊午火兄弟', '丙戌土子孙', '丙子水官鬼', '丙寅木父母',
    ])
  })

  it('山雷颐：巽宫游魂，世四应初（玄机阁全表纳甲＋八宫归属表宫位）', () => {
    const installed = installStatic('山雷颐', '甲子')
    expect(installed).toMatchObject({ palace: '巽', rank: '游魂', shi: 3, ying: 0 })
    expect(najiaOfLines(linesOf('山雷颐'))).toEqual(['庚子', '庚寅', '庚辰', '丙戌', '丙子', '丙寅'])
  })

  it('雷泽归妹：兑宫归魂，世三应上（玄机阁全表＋八宫归属表）', () => {
    const installed = installStatic('雷泽归妹', '甲子')
    expect(installed).toMatchObject({ palace: '兑', rank: '归魂', shi: 2, ying: 5 })
    expect(installed.yaos.map((y) => `${y.ganzhi}${y.wuxing}${y.liuqin}`)).toEqual([
      '丁巳火官鬼', '丁卯木妻财', '丁丑土父母', '庚午火官鬼', '庚申金兄弟', '庚戌土父母',
    ])
  })
})

describe('装卦随日起装：六兽与旬空（install.ts）', () => {
  it('甲子日装乾为天：初爻起青龙，自下而上青龙至玄武（六兽歌）', () => {
    const installed = installStatic('乾为天', '甲子')
    expect(installed.yaos.map((y) => y.liushou)).toEqual([...LIUSHOU_ORDER])
  })

  it('六兽起法逐日干核对：甲乙青龙、丙丁朱雀、戊勾陈、己螣蛇、庚辛白虎、壬癸玄武', () => {
    const startByStem: Record<string, string> = {
      甲: '青龙', 乙: '青龙', 丙: '朱雀', 丁: '朱雀', 戊: '勾陈',
      己: '螣蛇', 庚: '白虎', 辛: '白虎', 壬: '玄武', 癸: '玄武',
    }
    // 十干各配阴阳相合之支（甲子…癸酉），逐一核对初爻所起六兽
    const validPairs = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉']
    for (const [stem, start] of Object.entries(startByStem)) {
      const pair = validPairs.find((p) => p[0] === stem)
      expect(liushouOf(ganzhiIndex(pair!), 0), `${stem}日初爻`).toBe(start)
    }
    // 壬日自初爻起玄武，向上轮转
    expect(
      [0, 1, 2, 3, 4, 5].map((i) => liushouOf(ganzhiIndex('壬午'), i)),
    ).toEqual(['玄武', '青龙', '朱雀', '勾陈', '螣蛇', '白虎'])
  })

  it('甲戌日装乾为天：甲戌旬申酉空，九五壬申金临空', () => {
    const installed = installStatic('乾为天', '甲戌')
    expect(installed.xun).toBe('甲戌旬')
    expect(installed.xunkongBranches).toEqual(['申', '酉'])
    expect(installed.yaos[4].ganzhi).toBe('壬申')
    expect(installed.yaos[4].xunkong).toBe(true)
    expect(installed.yaos[0].xunkong).toBe(false)
  })

  it('动爻装卦：9 老阳 6 老阴标记 moving，爻题随本爻阴阳', () => {
    // 乾之姤：初爻动（9），余少阳
    const installed = install([9, 7, 7, 7, 7, 7], '甲子')
    expect(installed.lines).toEqual([1, 1, 1, 1, 1, 1])
    expect(installed.values).toEqual([9, 7, 7, 7, 7, 7])
    expect(installed.yaos[0].moving).toBe(true)
    expect(installed.yaos[1].moving).toBe(false)
    expect(installed.yaos[0].yang).toBe(true)
    // 坤之复：初爻动（6），余少阴
    const kunFu = install([6, 8, 8, 8, 8, 8], '甲子')
    expect(kunFu.lines).toEqual([0, 0, 0, 0, 0, 0])
    expect(kunFu.yaos[0].moving).toBe(true)
    expect(kunFu.yaos[0].yang).toBe(false)
    expect(kunFu.yaos[0].name).toBe('初六')
  })

  it('爻题体例：初九/九二/九三/九四/九五/上九 与 初六/六二/六三/六四/六五/上六', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => yaoName(true, i))).toEqual(['初九', '九二', '九三', '九四', '九五', '上九'])
    expect([0, 1, 2, 3, 4, 5].map((i) => yaoName(false, i))).toEqual(['初六', '六二', '六三', '六四', '六五', '上六'])
  })

  it('非法输入拒绝：爻值越界与非法日干支', () => {
    // 编译期已拒绝非 Yao 字面量，此处绕过类型以验证运行时防护
    const badValues = [5, 7, 7, 7, 7, 7] as unknown as import('../hexagram.ts').Yao[]
    expect(() => install(badValues, '甲子')).toThrow()
    expect(() => install([7, 7, 7, 7, 7], '甲子')).toThrow()
    expect(() => installStatic('乾为天', '甲丑')).toThrow()
    expect(() => installStatic('乾为天', 60)).toThrow()
  })
})

describe('装卦全表与 hexagrams.json 对齐', () => {
  it('六十四卦逐一可装卦且卦名可查（installLines × lookup）', () => {
    for (const hex of hexagrams as { name: string; lines: number[] }[]) {
      const installed = installLines(hex.lines)
      expect(installed.palaceName, hex.name).toMatch(/宫$/)
      expect(installed.shi, hex.name).toBeGreaterThanOrEqual(0)
      expect(installed.ying, hex.name).toBe((installed.shi + 3) % 6)
      expect(lookup(hex.lines).name, hex.name).toBe(hex.name)
    }
  })
})

describe('read() 装卦分层：无日期出纳甲/六亲/世应，有日期另装六兽旬空（hexagram.ts）', () => {
  // 向后兼容口径：read(values) 旧签名行为不变，新增可选字段 installed；
  // 六兽与旬空随起卦日而起，故无日期时不装（ADR-0002 分层呈现口径）。
  it('read(values) 无日期：installed 含纳甲/六亲/世应，不含六兽与旬空字段', () => {
    const reading = read([7, 7, 7, 7, 7, 7]) // 乾为天
    expect(reading.installed).toBeDefined()
    expect(reading.installed!.palace).toBe('乾')
    expect(reading.installed!.shi).toBe(5)
    expect(reading.installed!.ying).toBe(2)
    expect(reading.installed!.yaos.map((y) => `${y.name} ${y.ganzhi}${y.wuxing} ${y.liuqin}`)).toEqual([
      '初九 甲子水 子孙',
      '九二 甲寅木 妻财',
      '九三 甲辰土 父母',
      '九四 壬午火 官鬼',
      '九五 壬申金 兄弟',
      '上九 壬戌土 父母',
    ])
    expect(isFullInstall(reading.installed!)).toBe(false)
    expect('liushou' in reading.installed!.yaos[0]).toBe(false)
    expect('xunkong' in reading.installed!.yaos[0]).toBe(false)
    expect('moving' in reading.installed!.yaos[0]).toBe(false)
  })

  it('read(values, 日干支)：完整装卦，六兽随日干、旬空随日柱（甲子日起青龙、戌亥空）', () => {
    const reading = read([7, 7, 7, 7, 7, 7], '甲子')
    expect(isFullInstall(reading.installed!)).toBe(true)
    const installed = reading.installed as Extract<typeof reading.installed, { xunkongBranches: unknown }>
    expect(installed.dayGanzhi).toBe('甲子')
    expect(installed.xunkongBranches).toEqual(['戌', '亥'])
    expect(installed.yaos.map((y) => y.liushou)).toEqual([...LIUSHOU_ORDER]) // 甲乙起青龙
    expect(installed.yaos[5].xunkong).toBe(true) // 上九壬戌，甲子旬戌亥空
    expect(installed.yaos[0].xunkong).toBe(false)
  })

  it('动爻读卦：read 标 moving 与 installed 装卦并存（9 老阳初爻动，乾之姤）', () => {
    const reading = read([9, 7, 7, 7, 7, 7], '丁亥')
    expect(reading.moving).toEqual([0])
    expect(reading.changedHex!.name).toBe('天风姤')
    expect(isFullInstall(reading.installed!)).toBe(true)
    const installed = reading.installed as Extract<typeof reading.installed, { xunkongBranches: unknown }>
    expect(installed.yaos[0].moving).toBe(true)
    // 丁亥日属甲申旬（午未空），九四壬午临空
    expect(installed.xunkongBranches).toEqual(['午', '未'])
    expect(installed.yaos[3].xunkong).toBe(true)
  })
})
