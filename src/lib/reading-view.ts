import type { Reading } from './hexagram'
import type { Hexagram } from './hexagram'

const POSITIONS = ['初', '二', '三', '四', '五', '上']

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

export function showReading(reading: Reading, source = '') {
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
  setText('resultSource', source)
  renderGlyph(reading.primary, reading.moving)
  document.getElementById('result')?.classList.add('open')
}

export function showHexDetail(hex: Hexagram) {
  setText('resultNumber', String(hex.number))
  setText('resultName', hex.name)
  setText('resultSeal', hex.name.slice(-1))
  setText('resultPinyin', hex.pinyin)
  setText('resultJudgment', hex.judgment)
  setText('resultInterp', hex.interpretation)
  setText('resultImage', hex.image ?? '')
  setText('resultHexes', `第 ${hex.number} 卦 · ${hex.name}`)
  setText('resultMoving', `吉凶：${hex.fortune}`)
  setText('resultSource', '卦库')
  renderGlyph(hex.lines)
  document.getElementById('result')?.classList.add('open')
}

export function closeReading() {
  document.getElementById('result')?.classList.remove('open')
}
