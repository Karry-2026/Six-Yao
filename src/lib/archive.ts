import { read } from './hexagram'
import type { Hexagram } from './hexagram'
import { showReading, showHexDetail, closeReading } from './reading-view'

const KEY = 'sy-history-v1'
const MAX = 30

export type Record = {
  t: number
  values: number[]
}

export function loadRecords(): Record[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((r): r is Record =>
      r && typeof r.t === 'number' && Array.isArray(r.values) && r.values.length === 6,
    )
  } catch {
    return []
  }
}

export function saveRecord(record: Record) {
  const list = loadRecords()
  list.unshift(record)
  if (list.length > MAX) list.length = MAX
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function clearRecords() {
  localStorage.removeItem(KEY)
}

function fmtTime(t: number) {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function renderHistory(onSelect: (record: Record) => void) {
  const list = document.getElementById('historyList')
  const empty = document.getElementById('historyEmpty')
  const actions = document.getElementById('historyActions')
  if (!list || !empty) return
  const records = loadRecords()
  list.innerHTML = ''
  if (records.length === 0) {
    empty.style.display = 'block'
    if (actions) actions.style.display = 'none'
    return
  }
  empty.style.display = 'none'
  if (actions) actions.style.display = ''
  for (const record of records) {
    const reading = read(record.values as never)
    const hex = reading.primaryHex
    const li = document.createElement('li')
    li.className = 'history-item'
    li.innerHTML =
      `<span class="history-time">${fmtTime(record.t)}</span>` +
      `<span class="history-name">${hex.name}</span>` +
      `<span class="history-fortune">${reading.moving.length ? `动 ${reading.moving.length}` : '静卦'}</span>`
    li.addEventListener('click', () => {
      showReading(reading, `记录 · ${fmtTime(record.t)}`)
      onSelect(record)
    })
    list.appendChild(li)
  }
}

export function renderBrowse(hexagrams: Hexagram[], filter: string, onSelect: (hex: Hexagram) => void) {
  const grid = document.getElementById('browseGrid')
  if (!grid) return
  const q = filter.trim().toLowerCase()
  grid.innerHTML = ''
  for (const hex of hexagrams) {
    if (q && !(hex.name.includes(q) || hex.pinyin.toLowerCase().includes(q) || String(hex.number) === q)) continue
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'browse-item'
    item.innerHTML =
      `<span class="b-num">${hex.number}</span>` +
      `<span class="b-name">${hex.name}</span>` +
      `<span class="b-sub">${hex.pinyin}</span>`
    item.addEventListener('click', () => {
      showHexDetail(hex)
      onSelect(hex)
    })
    grid.appendChild(item)
  }
}

export function bindPanels(options: { hexagrams: Hexagram[]; onOpenReading?: () => void }) {
  const historyPanel = document.getElementById('historyPanel')
  const browsePanel = document.getElementById('browsePanel')
  const historyBtn = document.getElementById('historyBtn')
  const browseBtn = document.getElementById('browseBtn')
  const search = document.getElementById('searchHex') as HTMLInputElement | null

  const closeAll = () => {
    historyPanel?.classList.remove('open')
    browsePanel?.classList.remove('open')
  }

  historyBtn?.addEventListener('click', () => {
    const willOpen = !historyPanel?.classList.contains('open')
    closeAll()
    if (willOpen) {
      renderHistory(() => undefined)
      historyPanel?.classList.add('open')
    }
  })

  browseBtn?.addEventListener('click', () => {
    const willOpen = !browsePanel?.classList.contains('open')
    closeAll()
    if (willOpen) {
      if (search) search.value = ''
      renderBrowse(options.hexagrams, '', () => closeAll())
      browsePanel?.classList.add('open')
    }
  })

  search?.addEventListener('input', () => {
    renderBrowse(options.hexagrams, search.value, () => closeAll())
  })

  document.getElementById('closeHistory')?.addEventListener('click', () => closeAll())
  document.getElementById('closeBrowse')?.addEventListener('click', () => closeAll())
  document.getElementById('clearHistory')?.addEventListener('click', () => {
    if (!confirm('确定清除全部占卜记录？')) return
    clearRecords()
    renderHistory(() => undefined)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAll()
      closeReading()
    }
  })

  // 结果卡里的「再占一卦」也关闭面板
  document.getElementById('againBtn')?.addEventListener('click', () => closeAll())
}
