import { isFullInstall, type Hexagram, type Reading } from './hexagram'
import { install, installLines, type InstalledHexagramBase } from './domain/install'
import { ganzhiIndexOfDate } from './domain/ganzhi'

const POSITIONS = ['初', '二', '三', '四', '五', '上']

// ─────────────────────────────────────────────────────────────
// 装卦表：结果卡「动爻」行下方的紧凑六行表（自上爻到初爻）
// 列：爻位 | 六亲·干支 | 六兽 | 世应 | 旬空
// ─────────────────────────────────────────────────────────────
// 分层口径（与 hexagram.ts Reading.installed 注释一致）：
// - 起卦场景（有日期）：完整装卦（isFullInstall），五列全出——六兽与旬空随起卦日而起；
//   调用方未随日起装时按今日日干支补装（起卦即当下；分享/历史回放亦以浏览当日为参照，
//   原始起卦日未随记录存储）。若调用方日后传入真实 dateGanzhi，优先原样使用。
// - 卦库浏览（无日期）：卦画层面装卦（installLines），六兽/旬空两列留空，仅出纳甲六亲世应。
// - 世爻应爻以「世」「应」小字标记，动爻整行朱砂色（样式见 index.astro #resultInstall）。

const INSTALL_HEADS = ['爻位', '六亲·干支', '六兽', '世应', '旬空'] as const

/** 起卦场景的日干支：起卦即当下，取今日日干支序（0 = 甲子） */
function todayGanzhiIndex(): number {
  const now = new Date()
  return ganzhiIndexOfDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * 结果卡可用的装卦结果：
 * - 调用方已随日起装（含 xunkongBranches 判别）→ 原样使用，尊重真实起卦日；
 * - 否则按今日日干支补装六兽与旬空；
 * - 爻值异常（脏记录等）时退回已有装卦或卦画层装卦，保证结果卡不因脏数据崩溃。
 */
function resolveInstalled(reading: Reading): InstalledHexagramBase {
  if (reading.installed && isFullInstall(reading.installed)) return reading.installed
  try {
    return install(reading.values, todayGanzhiIndex())
  } catch {
    return reading.installed ?? installLines(reading.primary)
  }
}

/** 紧凑装卦表：自上爻到初爻六行；动爻整行朱砂，世应/旬空以小字标记 */
function renderInstallTable(installed: InstalledHexagramBase, moving: readonly number[]): void {
  const host = document.getElementById('resultInstall')
  if (!host) return
  // fullYaos：随日起装的逐爻行（含六兽/旬空）；卦画层装卦为 null，对应两列留空
  const fullYaos = isFullInstall(installed) ? installed.yaos : null
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const label of INSTALL_HEADS) {
    const th = document.createElement('th')
    th.setAttribute('scope', 'col')
    th.textContent = label
    headRow.appendChild(th)
  }
  thead.appendChild(headRow)
  table.appendChild(thead)
  const tbody = document.createElement('tbody')
  for (let i = 5; i >= 0; i--) {
    const yao = installed.yaos[i]
    const fullYao = fullYaos ? fullYaos[i] : null
    const tr = document.createElement('tr')
    if (moving.includes(i)) tr.className = 'inst-moving'
    const cells = [
      POSITIONS[i],
      `${yao.liuqin} ${yao.ganzhi}`,
      fullYao ? fullYao.liushou : '',
      yao.shi ? '世' : yao.ying ? '应' : '',
      fullYao?.xunkong ? '空' : '',
    ]
    for (let c = 0; c < cells.length; c++) {
      const td = document.createElement('td')
      td.textContent = cells[c]
      if (c >= 3 && cells[c]) td.className = 'inst-mark' // 世应/旬空小字
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  host.innerHTML = ''
  host.appendChild(table)
}

export function yaoLabel(index: number, yang: boolean): string {
  if (index === 0) return yang ? '初九' : '初六'
  if (index === 5) return yang ? '上九' : '上六'
  return (yang ? '九' : '六') + POSITIONS[index]
}

function renderGlyph(lines: number[], moving: number[] = []) {
  const glyphEl = document.getElementById('resultGlyph')
  if (!glyphEl) return
  glyphEl.innerHTML = ''
  for (let i = 5; i >= 0; i--) {
    const row = document.createElement('div')
    row.className = 'glyph-row' + (moving.includes(i) ? ' moving' : '')
    const bars = lines[i] === 1 ? 1 : 2
    for (let b = 0; b < bars; b++) {
      const bar = document.createElement('div')
      bar.className = 'glyph-bar'
      row.appendChild(bar)
    }
    glyphEl.appendChild(row)
  }
}

function setText(id: string, text: string) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

// ─────────────────────────────────────────────────────────────
// 分享链接：?hex=六位爻值（每位 6-9，自下而上）
// ─────────────────────────────────────────────────────────────
// currentHexParam 记录结果卡当前展示卦的爻值串（复制链接用，随展示内容更新）；
// 地址栏只在掷毕后写入（replaceState）、结果卡关闭时清掉，其他展示路径不动地址栏。

let currentHexParam: string | null = null

/** 掷毕后把六位爻值写入地址栏（replaceState，不新增历史记录） */
export function writeHexParam(values: readonly number[]): void {
  const param = values.join('')
  const url = new URL(location.href)
  if (url.searchParams.get('hex') === param) return
  url.searchParams.set('hex', param)
  history.replaceState(null, '', url)
}

/** 结果卡关闭时同步清掉 ?hex（replaceState） */
function clearHexParam(): void {
  const url = new URL(location.href)
  if (!url.searchParams.has('hex')) return
  url.searchParams.delete('hex')
  history.replaceState(null, '', url)
}

/** clipboard API 不可用 / 被拒时的降级：隐藏文本域 + execCommand */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

async function copyShareLink(button: HTMLButtonElement): Promise<void> {
  const param = currentHexParam
  if (!param) return
  // 干净分享串：只带 hex，主题交给对方自己的昼夜默认
  const url = new URL(location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('hex', param)
  const link = url.toString()
  const restore = button.textContent
  const flash = (label: string) => {
    button.textContent = label
    window.setTimeout(() => {
      button.textContent = restore
    }, 1600)
  }
  try {
    if (!navigator.clipboard) throw new Error('clipboard API 不可用')
    await navigator.clipboard.writeText(link)
    flash('已 复 制')
  } catch {
    if (legacyCopy(link)) {
      flash('已 复 制')
    } else {
      // 降级提示：弹出链接供手动复制
      window.prompt('复制失败，请手动复制链接：', link)
    }
  }
}

/** 绑定结果卡里的「复 制 链 接」按钮（页面装配时调用一次） */
export function initShareLink(): void {
  document.getElementById('copyLinkBtn')?.addEventListener('click', (event) => {
    void copyShareLink(event.currentTarget as HTMLButtonElement)
  })
}

export function showReading(reading: Reading, source = '') {
  currentHexParam = reading.values.join('')
  const hex = reading.primaryHex
  setText('resultNumber', String(hex.number))
  setText('resultName', hex.name)
  setText('resultSeal', hex.name.slice(-1))
  setText('resultPinyin', hex.pinyin)
  setText('resultJudgment', hex.judgment)
  setText('resultInterp', hex.interpretation)
  setText('resultImage', hex.image ?? '')
  setText('resultHexes',
    `本卦 ${hex.name} · 互卦 ${reading.mutualHex.name}` +
    (reading.changedHex ? ` · 变卦 ${reading.changedHex.name}` : ''),
  )
  setText('resultMoving', reading.moving.length
    ? `动爻：${reading.moving.map((i) => yaoLabel(i, reading.primary[i] === 1)).join('、')}`
    : '静卦 · 无动爻',
  )
  renderInstallTable(resolveInstalled(reading), reading.moving)
  setText('resultSource', source)
  renderGlyph(reading.primary, reading.moving)
  document.getElementById('result')?.classList.add('open')
}

export function showHexDetail(hex: Hexagram) {
  // 卦库详情没有掷币爻值，按静卦编码（阳 7 / 阴 8）供复制链接
  currentHexParam = hex.lines.map((line) => (line === 1 ? 7 : 8)).join('')
  setText('resultNumber', String(hex.number))
  setText('resultName', hex.name)
  setText('resultSeal', hex.name.slice(-1))
  setText('resultPinyin', hex.pinyin)
  setText('resultJudgment', hex.judgment)
  setText('resultInterp', hex.interpretation)
  setText('resultImage', hex.image ?? '')
  setText('resultHexes', `第 ${hex.number} 卦 · ${hex.name}`)
  setText('resultMoving', `吉凶：${hex.fortune}`)
  // 卦库浏览无起卦日期：卦画层面装卦，六兽/旬空两列留空
  renderInstallTable(installLines(hex.lines), [])
  setText('resultSource', '卦库')
  renderGlyph(hex.lines)
  document.getElementById('result')?.classList.add('open')
}

export function closeReading() {
  const card = document.getElementById('result')
  if (!card?.classList.contains('open')) return
  card.classList.remove('open')
  currentHexParam = null
  clearHexParam()
}
