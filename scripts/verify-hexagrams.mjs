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

if (failures) {
  console.error(`${failures} 项校验失败`)
  process.exit(1)
}
console.log('ok: 64 卦数据、掷币规则、互卦与变卦推演全部通过')
