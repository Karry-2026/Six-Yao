// 起卦流程：掷币状态机 + 卦纸（SVG）渲染
// 独立于渲染后端：无 Canvas 也能完整走通（body.no-canvas 降级路径）。

import { read, isYang, isMoving, type Yao } from '../lib/hexagram'
import { showReading, closeReading, writeHexParam } from '../lib/reading-view'
import { ambient } from '../lib/ambient'
import { music } from '../lib/music'

const TOSS_MS = 850
const ORDINAL = ['一', '二', '三', '四', '五', '六']

const ritualState = { active: false, index: 0, values: [] as Yao[], busy: false }

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/** value(6-9) → 三枚铜钱阴阳面（true=背=阳），只决定谁显示为字面 */
function facesForValue(value: number): boolean[] {
  const heads = value - 6
  const faces = [heads >= 1, heads >= 2, heads >= 3]
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[faces[i], faces[j]] = [faces[j], faces[i]]
  }
  return faces
}

function buildBoard(): SVGGElement[] {
  const root = document.getElementById('boardRows') as SVGGElement | null
  if (!root) return []
  root.innerHTML = ''
  const rows: SVGGElement[] = []
  for (let j = 0; j < 6; j++) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('transform', `translate(0, ${13 + j * 21})`)
    root.appendChild(g)
    rows.push(g)
  }
  return rows
}

let boardRows: SVGGElement[] = []

/** 在卦纸上亮出一条爻（index 0 = 初爻，画在下起第 6 行） */
function revealLine(index: number, yang: boolean, moving: boolean): void {
  const row = boardRows[5 - index]
  if (!row) return
  document.getElementById('board')?.classList.add('writing')
  row.innerHTML = ''
  const bar = (x: number, width: number) => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('x', String(x))
    rect.setAttribute('y', '0')
    rect.setAttribute('width', String(width))
    rect.setAttribute('height', '9')
    rect.setAttribute('rx', '1.5')
    rect.classList.add('bar')
    if (moving) rect.classList.add('moving')
    row.appendChild(rect)
  }
  if (yang) {
    bar(9, 110)
  } else {
    bar(9, 48)
    bar(71, 48)
  }
  requestAnimationFrame(() => {
    for (const rect of row.querySelectorAll('rect')) rect.classList.add('shown')
  })
}

function updateRitualUI(): void {
  const ritualBtn = document.getElementById('ritualBtn')
  const progressEl = document.getElementById('ritualProgress')
  if (ritualBtn) {
    if (!ritualState.active) ritualBtn.textContent = '抽 取 一 卦'
    else if (ritualState.index >= 6) ritualBtn.textContent = '再 占 一 卦'
    else ritualBtn.textContent = `第 ${ORDINAL[ritualState.index]} 爻 · 掷 币`
  }
  if (progressEl) {
    progressEl.textContent = ritualState.active
      ? Array.from({ length: 6 }, (_, i) => (i < ritualState.index ? '●' : '○')).join(' ')
      : ''
  }
}

function beginRitual(): void {
  boardRows = buildBoard()
  document.getElementById('board')?.classList.remove('writing')
  closeReading()
  window.dispatchEvent(new CustomEvent('sy:reset'))
  ritualState.active = true
  ritualState.index = 0
  ritualState.values = []
  ritualState.busy = false
  ambient.enable()
  ambient.bell('start')
  // 「音乐」开关在开位（含刷新后回来）时，在用户手势内补启播放；静音时是 no-op
  music.start()
  updateRitualUI()
}

async function tossOne(forced?: boolean[]): Promise<void> {
  if (!ritualState.active || ritualState.busy) return
  ritualState.busy = true
  const faces = forced ?? [Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5]
  window.dispatchEvent(new CustomEvent('sy:toss', { detail: faces }))
  await sleep(TOSS_MS)
  const value = (6 + faces.filter(Boolean).length) as Yao
  ritualState.values.push(value)
  revealLine(ritualState.index, value === 7 || value === 9, value === 6 || value === 9)
  ritualState.index++
  updateRitualUI()
  if (ritualState.index >= 6) finishRitual()
  else {
    await sleep(240)
    ritualState.busy = false
  }
}

function finishRitual(): void {
  const reading = read(ritualState.values)
  showReading(reading)
  writeHexParam(reading.values) // 掷毕：六位爻值写入地址栏（replaceState，可复制分享）
  ambient.bell('end')
  ritualState.active = false
  ritualState.busy = false
  updateRitualUI()
  window.dispatchEvent(new CustomEvent('ritual:complete', { detail: { values: [...ritualState.values] } }))
}

/** ?hex=六位爻值 → Yao[]（自下而上）；每位须为 6-9，否则返回 null */
function parseHexParam(raw: string | null): Yao[] | null {
  if (!raw || !/^[6-9]{6}$/.test(raw)) return null
  return Array.from(raw, (ch) => Number(ch) as Yao)
}

/** 分享链接落地：六爻一次性亮出（跳过逐次掷币动画），直接开卡。
 *  只做展示——不派发 ritual:complete，因此不写入占卜记录；地址栏保持原样。 */
function showSharedReading(values: Yao[]): void {
  ritualState.active = false
  ritualState.busy = false
  ritualState.index = 6
  ritualState.values = [...values]
  for (let i = 0; i < 6; i++) revealLine(i, isYang(values[i]), isMoving(values[i]))
  showReading(read(values), '分享链接')
}

export function bootRitual(): void {
  performance.mark('ritual:boot')
  boardRows = buildBoard()

  document.getElementById('ritualBtn')?.addEventListener('click', () => {
    if (!ritualState.active) beginRitual()
    void tossOne()
  })
  document.getElementById('againBtn')?.addEventListener('click', () => beginRitual())
  // 海报 CTA：海报之后只作为无 Canvas 降级入口
  document.getElementById('begin')?.addEventListener('click', () => beginRitual())

  // 交互入口就绪：海报退场，卦纸与按钮可用
  document.body.classList.add('ready')
  updateRitualUI()

  // 分享链接：?hex=六位爻值 → 跳过逐次动画直接亮卦开卡（优先于 QA 自动掷币）
  const sharedValues = parseHexParam(new URLSearchParams(location.search).get('hex'))
  if (sharedValues) {
    showSharedReading(sharedValues)
    return
  }

  // QA：?ritual=1 自动掷满六爻；?values=7,8,... 固定结果
  if (new URLSearchParams(location.search).get('ritual') === '1') {
    window.setTimeout(async () => {
      beginRitual()
      const forcedRaw = new URLSearchParams(location.search).get('values')
      const forcedValues = forcedRaw
        ? forcedRaw
            .split(',')
            .map((v) => Number(v.trim()))
            .filter((v) => v >= 6 && v <= 9)
        : []
      for (let i = 0; i < 6; i++) {
        const forced = forcedValues.length === 6 ? facesForValue(forcedValues[i]) : undefined
        ritualState.busy = false
        await tossOne(forced)
        await sleep(1100)
      }
    }, 900)
  }
}
