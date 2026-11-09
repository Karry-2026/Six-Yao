/**
 * 由 src/data/hexagrams.json + 京房纳甲领域层（src/lib/domain/najia.ts、
 * src/lib/domain/install.ts）生成 src/data/install.json：六十四卦装卦全表。
 *
 * 每卦输出：卦号、卦名、卦画、卦宫、宫名、本宫五行、卦位（本宫/一世…五世/
 * 游魂/归魂）、世应爻位（0 基）、逐爻纳甲干支、爻支五行、六亲与爻题。
 *
 * 规则出处见 src/lib/domain/najia.ts / install.ts / ganzhi.ts 文件头注释
 * （卜筮全书·纳甲歌、卜筮正宗·纳甲装卦歌与安世应诀、六亲生克口诀）。
 *
 * 运行：node scripts/generate-install-table.mjs
 * （Node ≥ 23.6 原生 type-stripping 直接执行 TS 依赖，无需构建。）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { installLines } from '../src/lib/domain/install.ts'

const here = dirname(fileURLToPath(import.meta.url))
const hexagramsPath = join(here, '..', 'src', 'data', 'hexagrams.json')
const outputPath = join(here, '..', 'src', 'data', 'install.json')

const hexagrams = JSON.parse(readFileSync(hexagramsPath, 'utf8'))
if (!Array.isArray(hexagrams) || hexagrams.length !== 64) {
  throw new Error(`hexagrams.json 应含 64 卦，实际 ${hexagrams?.length}`)
}

const rows = hexagrams.map((hex) => {
  const installed = installLines(hex.lines)
  if (installed.lines.join('') !== hex.lines.join('')) {
    throw new Error(`卦画回写不一致: ${hex.name}`)
  }
  return {
    number: hex.number,
    name: hex.name,
    lines: hex.lines,
    palace: installed.palace,
    palaceName: installed.palaceName,
    palaceWuxing: installed.palaceWuxing,
    rank: installed.rank,
    shi: installed.shi,
    ying: installed.ying,
    yaos: installed.yaos.map((yao) => ({
      index: yao.index,
      name: yao.name,
      yang: yao.yang,
      ganzhi: yao.ganzhi,
      wuxing: yao.wuxing,
      liuqin: yao.liuqin,
      shi: yao.shi,
      ying: yao.ying,
    })),
  }
})

const payload = JSON.stringify(rows, null, 1) + '\n'
writeFileSync(outputPath, payload, 'utf8')
console.log(`已生成 ${outputPath}（${rows.length} 卦全表）`)
