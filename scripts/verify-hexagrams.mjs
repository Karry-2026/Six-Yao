import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'hexagrams.json'), 'utf8'))

let failures = 0
const check = (condition, message) => {
  if (!condition) {
    failures++
    console.error('FAIL', message)
  }
}

check(data.length === 64, `卦数应为 64，实际 ${data.length}`)
check(new Set(data.map((h) => h.lines.join(''))).size === 64, '六爻组合应两两不重复')
check(new Set(data.map((h) => h.number)).size === 64, '卦序应唯一')

const byKey = new Map(data.map((h) => [h.lines.join(''), h]))
const lookup = (lines) => byKey.get(lines.join(''))

const toss = (faces) => 6 + faces.filter(Boolean).length
check(toss([true, true, true]) === 9, '三阳应为老阳 9')
check(toss([false, false, false]) === 6, '三阴应为老阴 6')
check(toss([true, true, false]) === 8, '两阳一阴应为少阴 8')
check(toss([true, false, false]) === 7, '一阳两阴应为少阳 7')

const mutual = (lines) => [lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]]
const changed = (lines, moving) => lines.map((l, i) => (moving.includes(i) ? 1 - l : l))

const qian = [1, 1, 1, 1, 1, 1]
const kun = [0, 0, 0, 0, 0, 0]
check(lookup(qian)?.name === '乾为天', '全阳应查得乾为天')
check(lookup(kun)?.name === '坤为地', '全阴应查得坤为地')
check(lookup(mutual(qian))?.name === '乾为天', '乾的互卦应为乾')
check(lookup(changed(qian, [0, 1, 2, 3, 4, 5]))?.name === '坤为地', '乾六爻全动应变为坤')

const tun = lookup([1, 0, 0, 0, 1, 0])
check(tun?.name === '水雷屯', `水雷屯查表失败: ${tun?.name}`)

for (let i = 0; i < 500; i++) {
  const values = Array.from({ length: 6 }, () => 6 + Math.floor(Math.random() * 4))
  const lines = values.map((v) => (v === 7 || v === 9 ? 1 : 0))
  const moving = values.map((v, idx) => (v === 6 || v === 9 ? idx : -1)).filter((idx) => idx >= 0)
  if (!lookup(lines)) { failures++; console.error('FAIL 随机卦查表失败', lines.join('')); break }
  if (!lookup(mutual(lines))) { failures++; console.error('FAIL 互卦查表失败'); break }
  if (moving.length && !lookup(changed(lines, moving))) { failures++; console.error('FAIL 变卦查表失败'); break }
}

// ─────────────────────────────────────────────────────────────────────────────
// 装卦全表（src/data/install.json）校验。
//
// 本节刻意不 import src/lib/domain 领域代码，以下对照表均为独立誊录的文献值，
// 用于交叉验证领域层与生成脚本：
//
// 八宫归属全表（每宫序：本宫/一世/二世/三世/四世/五世/游魂/归魂）：
//   出处① 命格宇宙《卦：六十四卦、本卦变卦、八宫归属与六冲六合》
//   （mingge.org/compendium/liuyao/gua，注明典据《卜筮正宗》《增删卜易》）；
//   出处② 京房八宫变卦规则（一世至五世逐爻变、游魂变第四爻、归魂内卦复本宫，
//   国易堂《京氏易学特色之一：八宫卦序说》）。
// 卦宫五行（乾兑金、坎水、艮坤土、震巽木、离火）：出处① 同上表所注五行，
//   并与《卜筮全书·纳甲歌》句首卦名五行（乾金坎水艮土震木巽木离火坤土兑金）互证。
// 纳甲表：出处①《卜筮正宗·纳甲装卦歌（从下装起）》（quanxue.cn 第07章，逐卦六爻干支）；
//   出处②《卜筮全书·纳甲歌》（识典古籍）。
// 世应规则：出处①《卜筮正宗·安世应诀》「八卦之首世六当，以下初爻轮上扬。
//   游魂八宫四爻立，归魂八卦三爻详」（quanxue.cn 第07章）；应爻恒与世爻相隔三位。
// 六亲（同我兄弟/生我父母/我生子孙/克我官鬼/我克妻财）：玄机阁《六十四卦纳甲
//   与世应全表》规则原文与六爻通行口诀互证。
// 地支五行：寅卯木、巳午火、申酉金、亥子水、辰戌丑未土（六爻装卦以地支定五行）。
// ─────────────────────────────────────────────────────────────────────────────

const PALACE_TABLE = {
  乾: { wuxing: '金', names: ['乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有'] },
  坎: { wuxing: '水', names: ['坎为水', '水泽节', '水雷屯', '水火既济', '泽火革', '雷火丰', '地火明夷', '地水师'] },
  艮: { wuxing: '土', names: ['艮为山', '山火贲', '山天大畜', '山泽损', '火泽睽', '天泽履', '风泽中孚', '风山渐'] },
  震: { wuxing: '木', names: ['震为雷', '雷地豫', '雷水解', '雷风恒', '地风升', '水风井', '泽风大过', '泽雷随'] },
  巽: { wuxing: '木', names: ['巽为风', '风天小畜', '风火家人', '风雷益', '天雷无妄', '火雷噬嗑', '山雷颐', '山风蛊'] },
  离: { wuxing: '火', names: ['离为火', '火山旅', '火风鼎', '火水未济', '山水蒙', '风水涣', '天水讼', '天火同人'] },
  坤: { wuxing: '土', names: ['坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比'] },
  兑: { wuxing: '金', names: ['兑为泽', '泽水困', '泽地萃', '泽山咸', '水山蹇', '地山谦', '雷山小过', '雷泽归妹'] },
}
const RANK_ORDER = ['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂']
const SHI_BY_RANK = { 本宫: 5, 一世: 0, 二世: 1, 三世: 2, 四世: 3, 五世: 4, 游魂: 3, 归魂: 2 }

const NAJIA = {
  乾: { inner: ['甲子', '甲寅', '甲辰'], outer: ['壬午', '壬申', '壬戌'] },
  坎: { inner: ['戊寅', '戊辰', '戊午'], outer: ['戊申', '戊戌', '戊子'] },
  艮: { inner: ['丙辰', '丙午', '丙申'], outer: ['丙戌', '丙子', '丙寅'] },
  震: { inner: ['庚子', '庚寅', '庚辰'], outer: ['庚午', '庚申', '庚戌'] },
  巽: { inner: ['辛丑', '辛亥', '辛酉'], outer: ['辛未', '辛巳', '辛卯'] },
  离: { inner: ['己卯', '己丑', '己亥'], outer: ['己酉', '己未', '己巳'] },
  坤: { inner: ['乙未', '乙巳', '乙卯'], outer: ['癸丑', '癸亥', '癸酉'] },
  兑: { inner: ['丁巳', '丁卯', '丁丑'], outer: ['丁亥', '丁酉', '丁未'] },
}
const TRIGRAM_NAMES = { 111: '乾', 110: '兑', 101: '离', 100: '震', '011': '巽', '010': '坎', '001': '艮', '000': '坤' }

const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('')
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('')
const GANZHI60 = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12])
const BRANCH_WUXING = { 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 亥: '水', 子: '水', 辰: '土', 戌: '土', 丑: '土', 未: '土' }
const GENERATES = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const OVERCOMES = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }
const liuqin = (palaceWuxing, yaoWuxing) => {
  if (palaceWuxing === yaoWuxing) return '兄弟'
  if (GENERATES[palaceWuxing] === yaoWuxing) return '子孙'
  if (GENERATES[yaoWuxing] === palaceWuxing) return '父母'
  if (OVERCOMES[palaceWuxing] === yaoWuxing) return '妻财'
  if (OVERCOMES[yaoWuxing] === palaceWuxing) return '官鬼'
  return null
}
const YAO_TITLES = {
  yang: ['初九', '九二', '九三', '九四', '九五', '上九'],
  yin: ['初六', '六二', '六三', '六四', '六五', '上六'],
}

const installData = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'install.json'), 'utf8'))

check(Array.isArray(installData) && installData.length === 64, `install.json 卦数应为 64，实际 ${installData?.length}`)
check(new Set(installData.map((r) => r.name)).size === 64, 'install.json 卦名应两两不重复')

const installByName = new Map(installData.map((r) => [r.name, r]))
for (const hex of data) {
  const row = installByName.get(hex.name)
  if (!row) { failures++; console.error('FAIL install.json 缺卦', hex.name); continue }
  check(row.number === hex.number, `${hex.name} 卦号应与 hexagrams.json 一致`)
  check(row.lines.join('') === hex.lines.join(''), `${hex.name} 卦画应与 hexagrams.json 一致`)

  // 宫位：与独立誊录的八宫归属表比对
  const palaceEntry = Object.entries(PALACE_TABLE).find(([, v]) => v.names.includes(hex.name))
  if (!palaceEntry) { failures++; console.error('FAIL 八宫对照表缺卦', hex.name); continue }
  const [palaceName, palaceInfo] = palaceEntry
  const rank = RANK_ORDER[palaceInfo.names.indexOf(hex.name)]
  check(row.palace === palaceName, `${hex.name} 卦宫应为${palaceName}宫，实际${row.palace}`)
  check(row.palaceName === `${palaceName}宫`, `${hex.name} palaceName 应为 ${palaceName}宫`)
  check(row.palaceWuxing === palaceInfo.wuxing, `${hex.name} 宫五行应为${palaceInfo.wuxing}，实际${row.palaceWuxing}`)
  check(row.rank === rank, `${hex.name} 卦位应为${rank}，实际${row.rank}`)

  // 世应：安世应诀 + 应爻隔三位 + 逐爻标记一致
  const expectedShi = SHI_BY_RANK[rank]
  const expectedYing = (expectedShi + 3) % 6
  check(row.shi === expectedShi, `${hex.name} 世爻应在第${expectedShi + 1}爻，实际第${row.shi + 1}爻`)
  check(row.ying === expectedYing, `${hex.name} 应爻应在第${expectedYing + 1}爻，实际第${row.ying + 1}爻`)
  check(row.yaos.filter((y) => y.shi).length === 1 && row.yaos[expectedShi].shi, `${hex.name} 恰一爻标世且位置正确`)
  check(row.yaos.filter((y) => y.ying).length === 1 && row.yaos[expectedYing].ying, `${hex.name} 恰一爻标应且位置正确`)

  // 逐爻：爻题、纳甲、五行、六亲
  const inner = NAJIA[TRIGRAM_NAMES[hex.lines.slice(0, 3).join('')]]
  const outer = NAJIA[TRIGRAM_NAMES[hex.lines.slice(3, 6).join('')]]
  const expectedGanzhi = [...inner.inner, ...outer.outer]
  row.yaos.forEach((yao, i) => {
    check(yao.index === i, `${hex.name} 第${i + 1}爻 index 应为 ${i}`)
    const expectedTitle = hex.lines[i] === 1 ? YAO_TITLES.yang[i] : YAO_TITLES.yin[i]
    check(yao.name === expectedTitle, `${hex.name} 第${i + 1}爻爻题应为${expectedTitle}，实际${yao.name}`)
    check(yao.yang === (hex.lines[i] === 1), `${hex.name} 第${i + 1}爻 yang 标记应与卦画一致`)
    // 干支均在六十甲子内（且为合法干支组合）
    check(GANZHI60.includes(yao.ganzhi), `${hex.name} 第${i + 1}爻干支 ${yao.ganzhi} 不在六十甲子内`)
    check(yao.ganzhi === expectedGanzhi[i], `${hex.name} 第${i + 1}爻纳甲应为${expectedGanzhi[i]}，实际${yao.ganzhi}`)
    const expectedWuxing = BRANCH_WUXING[yao.ganzhi[1]]
    check(yao.wuxing === expectedWuxing, `${hex.name} 第${i + 1}爻五行应为${expectedWuxing}，实际${yao.wuxing}`)
    const expectedLiuqin = liuqin(palaceInfo.wuxing, expectedWuxing)
    check(yao.liuqin === expectedLiuqin, `${hex.name} 第${i + 1}爻六亲应为${expectedLiuqin}（宫${palaceInfo.wuxing}爻${expectedWuxing}），实际${yao.liuqin}`)
  })
}

// 抽查已知卦（期望值逐一誊录自上述文献来源，与 install.json 独立比对）
const GOLDEN = [
  { name: '乾为天', expect: ['甲子水子孙', '甲寅木妻财', '甲辰土父母', '壬午火官鬼', '壬申金兄弟', '壬戌土父母'] },
  { name: '坤为地', expect: ['乙未土兄弟', '乙巳火父母', '乙卯木官鬼', '癸丑土兄弟', '癸亥水妻财', '癸酉金子孙'] },
  { name: '水火既济', expect: ['己卯木子孙', '己丑土官鬼', '己亥水兄弟', '戊申金父母', '戊戌土官鬼', '戊子水兄弟'] },
  { name: '火天大有', expect: ['甲子水子孙', '甲寅木妻财', '甲辰土父母', '己酉金兄弟', '己未土父母', '己巳火官鬼'] },
  { name: '天风姤', expect: ['辛丑土父母', '辛亥水子孙', '辛酉金兄弟', '壬午火官鬼', '壬申金兄弟', '壬戌土父母'] },
  { name: '泽水困', expect: ['戊寅木妻财', '戊辰土父母', '戊午火官鬼', '丁亥水子孙', '丁酉金兄弟', '丁未土父母'] },
  // 坤宫属土：土克水为妻财、木克土为官鬼、火生土为父母、土生金为子孙
  { name: '地天泰', expect: ['甲子水妻财', '甲寅木官鬼', '甲辰土兄弟', '癸丑土兄弟', '癸亥水妻财', '癸酉金子孙'] },
  { name: '雷天大壮', expect: ['甲子水妻财', '甲寅木官鬼', '甲辰土兄弟', '庚午火父母', '庚申金子孙', '庚戌土兄弟'] },
  { name: '泽火革', expect: ['己卯木子孙', '己丑土官鬼', '己亥水兄弟', '丁亥水兄弟', '丁酉金父母', '丁未土官鬼'] },
  { name: '山水蒙', expect: ['戊寅木父母', '戊辰土子孙', '戊午火兄弟', '丙戌土子孙', '丙子水官鬼', '丙寅木父母'] },
  { name: '山雷颐', expect: ['庚子水父母', '庚寅木兄弟', '庚辰土妻财', '丙戌土妻财', '丙子水父母', '丙寅木兄弟'] },
  { name: '雷泽归妹', expect: ['丁巳火官鬼', '丁卯木妻财', '丁丑土父母', '庚午火官鬼', '庚申金兄弟', '庚戌土父母'] },
]
for (const { name, expect } of GOLDEN) {
  const row = installByName.get(name)
  if (!row) { failures++; console.error('FAIL 抽查卦缺装卦数据', name); continue }
  const actual = row.yaos.map((y) => `${y.ganzhi}${y.wuxing}${y.liuqin}`)
  check(actual.join(',') === expect.join(','), `${name} 抽查不符:\n  期望 ${expect.join(' ')}\n  实际 ${actual.join(' ')}`)
}
check(GOLDEN.length >= 8, `抽查已知卦应至少 8 个，实际 ${GOLDEN.length}`)

if (failures) {
  console.error(`${failures} 项校验失败`)
  process.exit(1)
}
console.log(`ok: 64 卦数据、掷币规则、互卦与变卦推演全部通过`)
console.log(`ok: 装卦全表校验通过（宫位/世应/纳甲/五行/六亲/六十甲子，抽查已知卦 ${GOLDEN.length} 例）`)
