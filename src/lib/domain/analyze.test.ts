/**
 * 用神选取与旺衰简断黄金用例。
 *
 * 期望值均已网络核对主流口径，出处写在各用例注释：
 * - 《增删卜易》（野鹤老人，维基文库 zh.wikisource.org/zh-hans/增删卜易）：
 *   用神章（金银买卖以妻财为用神、功名官司以官鬼、文书房屋车船以父母、
 *   子女医药解忧以子孙）、婚姻章（「男家占女……無不以財為用。女家占男，皆以官為用」）、
 *   出行章（quanxue.cn 第101章「世为出行之人」，父母为行李舟车）、
 *   第114章（「诸书无不以官鬼为病，应为医人，子孙为药」）、
 *   两现章（「舍其静爻而用动爻……舍其旬空而用不空」）。
 * - 暗动/日破/月破：静爻旺相遇日辰冲为暗动、休囚遇日辰冲为日破、月建所冲为月破
 *   （zhanbu.org/detail/2083《六爻日破月破》与通行六爻教材一致）。
 * - 六冲六合纳支表、六甲空亡（卜筮全书口诀，见 ganzhi.ts 文件头）。
 * - 旺衰计分为本引擎确定性简断法（见 analyze.ts 文件头注释⑦），非古法定论，
 *   用例按「有无生扶/克伤 + 冲合」逐条手算核对。
 */
import { describe, expect, it } from 'vitest'

import hexagrams from '../../data/hexagrams.json'
import { installLines } from './install.ts'
import {
  analyzeReading,
  findYongshenYao,
  relationsOf,
  wangshui,
  yongshenOf,
} from './analyze.ts'

/** 按卦名取卦画（自下而上） */
function linesOf(name: string): number[] {
  const hex = (hexagrams as { name: string; lines: number[] }[]).find((h) => h.name === name)
  if (!hex) throw new Error(`hexagrams.json 缺卦: ${name}`)
  return hex.lines
}

describe('用神映射：问事类别 → 用神六亲（analyze.ts）', () => {
  it('求财→妻财、事业功名→官鬼、官司诉讼→官鬼（增删卜易·用神章）', () => {
    // 用神章：凡占金银、买卖都以妻财为用神；功名求官、官司以官鬼为用神
    expect(yongshenOf('求财').primary.liuqin).toBe('妻财')
    expect(yongshenOf('事业功名').primary.liuqin).toBe('官鬼')
    expect(yongshenOf('官司诉讼').primary.liuqin).toBe('官鬼')
  })

  it('考试文书→父母为用神、官鬼（名次）为辅（增删卜易·用神章）', () => {
    // 用神章：文书、契约、升学以父母为用神；应试求名兼看官鬼（名次官府）
    const spec = yongshenOf('考试文书')
    expect(spec.primary).toMatchObject({ liuqin: '父母', label: '文书卷籍' })
    expect(spec.helpers).toHaveLength(1)
    expect(spec.helpers[0].liuqin).toBe('官鬼')
  })

  it('疾病→官鬼为病症、子孙为医药（增删卜易第114章；任务书示例「父母(医药)」与主流不合，注释存疑）', () => {
    // 第114章原文：「诸书无不以官鬼为病，应为医人，子孙为药」——医药之神通行取子孙；
    // 父母爻在占病中的角色是「占尊长之病以父母爻为用神」（看病人），故取主流口径
    const spec = yongshenOf('疾病')
    expect(spec.primary).toMatchObject({ liuqin: '官鬼', label: '病症鬼祟' })
    expect(spec.helpers[0]).toMatchObject({ liuqin: '子孙', label: '医药解忧' })
    expect(spec.note).toContain('主流')
  })

  it('婚姻：男占妻财、女占官鬼（增删卜易·婚姻章原文「男家占女無不以財為用，女家占男皆以官為用」）', () => {
    expect(yongshenOf('婚姻', { male: true }).primary.liuqin).toBe('妻财')
    expect(yongshenOf('婚姻', { male: false }).primary.liuqin).toBe('官鬼')
    // 未给性别时取表默认（妻财），由上层决定是否必须传性别
    expect(yongshenOf('婚姻').primary.liuqin).toBe('妻财')
  })

  it('出行→世爻为用神、父母（行李舟车）为辅（增删卜易·出行章「世为出行之人」）', () => {
    // 出行章（quanxue.cn 第101章）：「世爻旺相宜行」；父母爻克伤则车船有损、行李有失。
    // 任务书示例「出行/父母(行李)」即此句，主用神按原文取世爻
    const spec = yongshenOf('出行')
    expect(spec.primary).toMatchObject({ liuqin: '世爻', label: '出行之人' })
    expect(spec.helpers[0]).toMatchObject({ liuqin: '父母', label: '行李舟车' })
  })

  it('补充类别：家宅→父母（宅舍）、胎产→子孙、自占吉凶→世爻（用神章及通行口径）', () => {
    expect(yongshenOf('家宅').primary.liuqin).toBe('父母')
    expect(yongshenOf('胎产').primary.liuqin).toBe('子孙')
    expect(yongshenOf('自占吉凶').primary.liuqin).toBe('世爻')
  })
})

describe('用神取爻：两现取舍与不上卦（findYongshenYao，增删卜易·两现章）', () => {
  const qianLines = linesOf('乾为天') // 乾宫本宫，六亲：子孙/妻财/父母/官鬼/兄弟/父母，世在上爻

  it('乾为天父母两现：无日干支（无旬空信息）时临世优先，取上九壬戌（世在上爻）', () => {
    // 两现章古法可实现的优先级：动爻 > 不旬空 > 临世 > 首现；本例无动无空，临世胜出
    const pick = findYongshenYao(installLines(qianLines), '父母')
    expect(pick).not.toBeNull()
    expect(pick!.candidates).toEqual([2, 5]) // 九三甲辰土 与 上九壬戌土
    expect(pick!.yao.index).toBe(5)
    expect(pick!.yao.ganzhi).toBe('壬戌')
  })

  it('甲子日（戌亥空）取父母：舍其旬空，用其不空 → 取九三甲辰，胜过临世之上九壬戌', () => {
    // 两现章：「舍其旬空而用不空」。甲子旬戌亥空：上九临戌空、九三临辰不空 → 不空优先
    const pick = findYongshenYao(installLines(qianLines), '父母', {
      xunkongOfYao: (yao) => yao.ganzhi[1] === '戌' || yao.ganzhi[1] === '亥',
    })
    expect(pick!.yao.index).toBe(2)
    expect(pick!.yao.ganzhi).toBe('甲辰')
  })

  it('乾为天父母两现：九三发动时舍静取动 → 取九三甲辰（两现章「舍其静爻而用动爻」）', () => {
    const pick = findYongshenYao(installLines(qianLines), '父母', { moving: [2] })
    expect(pick!.yao.index).toBe(2)
  })

  it('天山遁（乾宫二世）妻财不上卦 → 返回 null（伏神法未实现；遁卦六亲为父母/官鬼/兄弟/官鬼/兄弟/父母）', () => {
    // 乾宫金，遁卦纳甲丙辰/丙午/丙申/壬午/壬申/壬戌，全为土火金，无木水 → 缺妻财子孙，
    // 通行以伏神甲子水子孙、甲寅木妻财伏初二爻取用（本简断未实现伏神，返回 null 由上层提示）
    const installed = installLines(linesOf('天山遁'))
    expect(installed.yaos.map((y) => y.liuqin)).toEqual(['父母', '官鬼', '兄弟', '官鬼', '兄弟', '父母'])
    expect(findYongshenYao(installed, '妻财')).toBeNull()
    expect(findYongshenYao(installed, '子孙')).toBeNull()
  })
})

describe('旺衰简断：月建/日辰生克冲合枚举（wangshui，口径见 analyze.ts 文件头）', () => {
  it('月生+日生 → 旺相（卯木，亥月子日：亥水月生卯、子水日生卯）', () => {
    // 生克口径：月建/日辰生用神爻支五行则相。亥水生卯木、子水生卯木，无冲合无空（甲子旬空戌亥）
    const result = wangshui({ branch: '卯', month: '亥', day: '甲子' })
    expect(result.items.map((i) => i.label)).toEqual(['月生', '日生'])
    expect(result.level).toBe('旺相')
    expect(result.score).toBe(4)
    expect(result.summary).toContain('旺相')
    expect(result.flags).toMatchObject({ yuepo: false, ripo: false, andong: false, xunkong: false })
  })

  it('月克+日克 → 休囚（卯木，申月甲申日：申金两重克卯，申不冲卯）', () => {
    // 申金克卯木（月克−2、日克−2）；寅申相冲故此例特避寅支，酉日则犯卯酉冲不合本例
    const result = wangshui({ branch: '卯', month: '申', day: '甲申' })
    expect(result.items.map((i) => i.label)).toEqual(['月克', '日克'])
    expect(result.level).toBe('休囚')
    expect(result.summary).toContain('休囚')
  })

  it('月破：子水遇午月，午冲子 → 月破，纵旺亦伤（丁卯日又泄于日）', () => {
    // 月建所冲为月破（通行说）：午冲子；子水克午火为耗（−1），卯木泄子水（−1）→ 休囚兼月破
    const result = wangshui({ branch: '子', month: '午', day: '丁卯' })
    expect(result.items.map((i) => `${i.source}${i.relation}`)).toEqual(['月建冲', '月建耗', '日辰泄'])
    expect(result.flags.yuepo).toBe(true)
    expect(result.summary).toContain('月破')
    expect(result.summary).toContain('出月')
  })

  it('暗动：静爻旺相遇日冲（酉金，丑月卯日：丑土月生酉，卯酉相冲 → 暗动）', () => {
    // 静爻旺相，被日辰冲之为暗动（zhanbu.org《六爻日破月破》与通行教材一致）：
    // 丑土生酉金（+2）、酉金克卯木为耗（−1）→ 得分 +1 旺相 → 暗动（非日破）
    const result = wangshui({ branch: '酉', month: '丑', day: '丁卯' })
    // 枚举顺序：同一来源先列冲合、后列生克（relationsOf 口径）
    expect(result.items.map((i) => i.label)).toEqual(['月生', '日冲', '耗于日'])
    expect(result.flags.andong).toBe(true)
    expect(result.flags.ripo).toBe(false)
    expect(result.summary).toContain('暗动')
  })

  it('日破：静爻休囚遇日冲（酉金，巳月卯日：巳火月克酉，卯酉相冲 → 日破）', () => {
    // 静爻休囚，被日辰冲之为日破（冲散）：巳火克酉金（−2）、耗于日（−1）→ −3 休囚 → 日破
    const result = wangshui({ branch: '酉', month: '巳', day: '丁卯' })
    expect(result.items.map((i) => i.label)).toEqual(['月克', '日冲', '耗于日'])
    expect(result.flags.ripo).toBe(true)
    expect(result.flags.andong).toBe(false)
    expect(result.summary).toContain('日破')
  })

  it('临月建+临日辰 → 当令最旺（寅木，寅月甲寅日）', () => {
    // 同我（临值）最旺：甲寅为六十甲子第 51 位（序 50），寅不空（甲寅旬空子丑）
    const result = wangshui({ branch: '寅', month: '寅', day: '甲寅' })
    expect(result.items.map((i) => i.label)).toEqual(['临月建', '临日辰'])
    expect(result.dayGanzhi).toBe('甲寅')
    expect(result.level).toBe('旺相')
    expect(result.flags.xunkong).toBe(false)
  })

  it('旬空：戌土遇庚午日（甲子旬戌亥空）→ 临旬空，旺相待出空', () => {
    // 六甲空亡诀「甲子旬中戌亥空」（卜筮全书）；未戌同五行比扶（+1）、午火生戌土（+2）→ 旺相而空，
    // 日辰午不冲戌，故为「出空逢值之期方验」而非冲空则起
    const result = wangshui({ branch: '戌', month: '未', day: '庚午' })
    expect(result.flags.xunkong).toBe(true)
    expect(result.level).toBe('旺相')
    expect(result.summary).toContain('旬空')
    expect(result.summary).toContain('出空')
  })

  it('日合（静爻）：亥水寅日 → 寅亥六合，静而逢合为合起（酉月亥水又得月生）', () => {
    // 六合：寅亥合；酉金生亥水（+2）、日合（+1）、亥水生寅木为泄（−1）→ +2 旺相
    const result = wangshui({ branch: '亥', month: '酉', day: '丙寅' })
    expect(result.items.map((i) => i.label)).toEqual(['月生', '日合', '泄于日'])
    expect(result.items.find((i) => i.relation === '合')!.note).toContain('合起')
    expect(result.level).toBe('旺相')
  })

  it('动爻逢日冲与动而逢合：子水动遇午日冲（主急变）、寅木动遇亥日合（合绊应期迟）', () => {
    // 动爻遇日辰冲：主事急变（简断从通行说，非定论）；动而逢合为合绊（事被绊住，应期反迟）
    const chong = wangshui({ branch: '子', moving: true, month: '酉', day: '庚午' })
    expect(chong.items.find((i) => i.relation === '冲')!.note).toContain('动爻')
    expect(chong.flags.andong).toBe(false) // 暗动/日破仅论静爻
    expect(chong.flags.ripo).toBe(false)
    // 子水得酉月生（+2）、子水克午火为耗（−1）→ 旺相
    expect(chong.level).toBe('旺相')

    const he = wangshui({ branch: '寅', moving: true, month: '子', day: '丁亥' })
    expect(he.items.find((i) => i.relation === '合')!.note).toContain('合绊')
    // 子水生寅木（+2）、亥水生寅木（+2）、寅亥合（+1）→ 旺相
    expect(he.level).toBe('旺相')
  })

  it('relationsOf：冲合并存于生克（巳见亥月：冲且克；寅见亥：合且生；辰戌同土异支：比且冲）', () => {
    // 六冲（巳亥冲）与水克火并存，逐条列出而非单选；六合（寅亥合）与水生木并存；
    // 耗=爻克月/日（方向：source 克 target 为克，target 克 source 为耗），亥水克巳火只有「克」
    expect(relationsOf('亥', '巳')).toEqual(['冲', '克'])
    expect(relationsOf('亥', '寅')).toEqual(['合', '生'])
    expect(relationsOf('戌', '辰')).toEqual(['比', '冲']) // 同五行异支比扶，辰戌又冲，土土之间无生克
  })

  it('非法日干支拒绝：数字越界与非法组合（与 install.ts resolveDayIndex 同口径）', () => {
    expect(() => wangshui({ branch: '卯', month: '亥', day: 60 })).toThrow()
    expect(() => wangshui({ branch: '卯', month: '亥', day: '甲丑' })).toThrow()
  })
})

describe('整卦简断：analyzeReading 黄金卦例（装卦 × 用神 × 旺衰）', () => {
  const qianInstalled = installLines(linesOf('乾为天')) // 乾宫本宫金：子孙/妻财/父母/官鬼/兄弟/父母，世五应二

  it('乾为天静卦求财：用神九二甲寅木妻财，寅月临建、庚午日泄 → 旺相（求财章口径）', () => {
    // 用神唯一现（妻财仅九二）；寅木临月建（+2）、寅木生午火泄（−1）→ +1 旺相；
    // 庚午日属甲子旬（戌亥空），寅不空
    const analysis = analyzeReading(
      { installed: qianInstalled, moving: [] },
      { topic: '求财', month: '寅', day: '庚午' },
    )
    expect(analysis.yongshen).toMatchObject({
      liuqin: '妻财',
      yaoIndex: 1,
      yaoName: '九二',
      ganzhi: '甲寅',
      branch: '寅',
      wuxing: '木',
      moving: false,
    })
    expect(analysis.yongshen!.candidates).toEqual([1])
    expect(analysis.wangshui!.level).toBe('旺相')
    expect(analysis.summary).toContain('求财')
    expect(analysis.summary).toContain('妻财')
    expect(analysis.summary).toContain('临月建')
  })

  it('乾为天静卦疾病：官鬼九四壬午火为病症、子孙初九甲子水为医药；巳月比扶、庚戌日泄 → 平气（114章口径）', () => {
    const analysis = analyzeReading(
      { installed: qianInstalled, moving: [] },
      { topic: '疾病', month: '巳', day: '庚戌' },
    )
    expect(analysis.yongshen).toMatchObject({ liuqin: '官鬼', yaoIndex: 3, ganzhi: '壬午' })
    expect(analysis.helpers).toEqual([{ liuqin: '子孙', label: '医药解忧', yaoIndex: 0 }])
    // 巳午同五行异支比扶（+1）、午火生戌土泄于日（−1）→ 得分 0 平气；
    // 庚戌属甲辰旬（寅卯空），午不空；午不冲不合戌
    expect(analysis.wangshui!.level).toBe('平')
    expect(analysis.wangshui!.items.map((i) => i.label)).toEqual(['月比扶', '泄于日'])
    expect(analysis.summary).toContain('平气')
  })

  it('乾为天九三动问考试文书：父母两现，舍静取动 → 九三甲辰；临月建+2 与日克−2 相抵 → 平气（两现章口径）', () => {
    // 动爻 9 老阳在九三：moving=[2]。父母两现（九三甲辰、上九壬戌），动爻优先于临世之上爻；
    // 戊寅日属甲戌旬（申酉空），辰戌皆不空，动爻判定不受旬空干扰；
    // 甲辰临辰月（值 +2）、日辰寅木克辰土（日克 −2）→ 平气：临月建不抵日克
    const installed = installLines(linesOf('乾为天'))
    const analysis = analyzeReading(
      { installed, moving: [2] },
      { topic: '考试文书', month: '辰', day: '戊寅' },
    )
    expect(analysis.yongshen).toMatchObject({
      liuqin: '父母',
      yaoIndex: 2,
      ganzhi: '甲辰',
      moving: true,
    })
    expect(analysis.yongshen!.candidates).toEqual([2, 5])
    expect(analysis.summary).toContain('用神两现')
    expect(analysis.wangshui!.items.map((i) => i.label)).toEqual(['临月建', '日克'])
    expect(analysis.wangshui!.level).toBe('平')
  })

  it('乾为天出行：世爻上九壬戌为用神，父母（行李舟车）取九三甲辰；甲子日戌空注旬空（出行章口径）', () => {
    // 世爻路径不参与两现取舍（世爻唯一）；辅助爻父母两现，戌空 → 取不空之九三甲辰；
    // 戌土得巳月生（+2）、耗于子日（−1）→ 旺相而临旬空
    const analysis = analyzeReading(
      { installed: qianInstalled, moving: [] },
      { topic: '出行', month: '巳', day: '甲子' },
    )
    expect(analysis.yongshen).toMatchObject({ liuqin: '世爻', yaoIndex: 5, ganzhi: '壬戌', shi: true })
    expect(analysis.helpers[0]).toMatchObject({ liuqin: '父母', yaoIndex: 2 })
    expect(analysis.wangshui!.flags.xunkong).toBe(true)
    expect(analysis.summary).toContain('旬空')
  })

  it('天山遁求财：妻财不上卦 → yongshen/wangshui 为 null，结论提示伏神（简断边界诚实声明）', () => {
    const analysis = analyzeReading(
      { installed: installLines(linesOf('天山遁')), moving: [] },
      { topic: '求财', month: '午', day: '甲子' },
    )
    expect(analysis.yongshen).toBeNull()
    expect(analysis.wangshui).toBeNull()
    expect(analysis.summary).toContain('不上卦')
    expect(analysis.summary).toContain('伏神')
  })
})
