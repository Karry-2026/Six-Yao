// 程序化水墨笔触：纸、山、月、地、案、炉、印、铜钱
// 全部 Canvas2D 绘制，无外部素材（ADR-0001）。

import type { ThemeConfig } from './themes'

export interface SceneDims {
  w: number
  h: number
}

/** 构图锚点（占视口比例），CSS 卦纸定位与此对齐 */
export const ANCHORS = {
  horizon: 0.42,
  tableY: 0.74,
  boardX: 0.5,
  boardY: 0.43,
} as const

/** 稳定伪随机：同一主题/尺寸下重绘不变 */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 宣纸底：色、纤维、斑点、四角晕 */
function paintPaper(ctx: CanvasRenderingContext2D, { w, h }: SceneDims, theme: ThemeConfig): void {
  ctx.fillStyle = theme.paper
  ctx.fillRect(0, 0, w, h)

  const rand = mulberry32(theme.isDay ? 1105 : 9207)
  for (let i = 0; i < 2000; i++) {
    const x = rand() * w
    const y = rand() * h
    const a = 0.015 + rand() * 0.035
    const s = 0.6 + rand() * 1.5
    ctx.fillStyle = rand() > 0.42 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 1.4})`
    ctx.fillRect(x, y, s, s)
  }
  // 长纤维
  ctx.lineWidth = 0.7
  for (let i = 0; i < 26; i++) {
    const y = rand() * h
    const x = rand() * w
    const len = 40 + rand() * 130
    ctx.strokeStyle = `rgba(0,0,0,${0.012 + rand() * 0.02})`
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y + (rand() - 0.5) * 6)
    ctx.stroke()
  }
  // 四角岁月晕
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ]
  for (const [cx, cy] of corners) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.38)
    g.addColorStop(0, theme.isDay ? 'rgba(94,80,58,0.05)' : 'rgba(0,0,0,0.14)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

/** 远山：三层淡墨，边沿晕染 */
function paintMountains(ctx: CanvasRenderingContext2D, { w, h }: SceneDims, theme: ThemeConfig): void {
  const layers = [
    { base: 0.4, amp: 0.1, alpha: 0.28, seed: 31 },
    { base: 0.415, amp: 0.075, alpha: 0.42, seed: 77 },
    { base: 0.432, amp: 0.05, alpha: 0.58, seed: 123 },
  ]
  for (const layer of layers) {
    const baseY = h * layer.base
    const amp = h * layer.amp
    const rand = mulberry32(theme.isDay ? layer.seed : layer.seed * 3 + 5)
    const n = 9
    const pts: [number, number][] = []
    for (let i = 0; i <= n; i++) {
      const x = (-0.08 + (1.24 * i) / n) * w
      const y = baseY - amp * (0.25 + 0.75 * rand())
      pts.push([x, y])
    }
    const path = new Path2D()
    path.moveTo(pts[0][0], baseY)
    path.lineTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2
      const my = (pts[i][1] + pts[i + 1][1]) / 2
      path.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
    }
    path.lineTo(pts[pts.length - 1][0], baseY)
    path.closePath()

    // 边沿晕染
    ctx.strokeStyle = withAlpha(theme.inkSoft, layer.alpha * 0.35)
    ctx.lineWidth = 10
    ctx.stroke(path)
    // 山体
    const g = ctx.createLinearGradient(0, baseY - amp, 0, baseY + h * 0.01)
    g.addColorStop(0, withAlpha(theme.inkSoft, layer.alpha))
    g.addColorStop(1, withAlpha(theme.inkSoft, 0.04))
    ctx.fillStyle = g
    ctx.fill(path)
  }
}

/** 月：夜主题独有，右上留白处 */
function paintMoon(ctx: CanvasRenderingContext2D, { w, h }: SceneDims): void {
  const x = w * 0.78
  const y = h * 0.15
  const r = Math.min(w, h) * 0.045
  const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 3.4)
  halo.addColorStop(0, 'rgba(226,214,182,0.22)')
  halo.addColorStop(1, 'rgba(226,214,182,0)')
  ctx.fillStyle = halo
  ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8)
  ctx.fillStyle = 'rgba(232,223,200,0.92)'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.05)'
  ctx.beginPath()
  ctx.arc(x - r * 0.25, y - r * 0.2, r * 0.82, 0, Math.PI * 2)
  ctx.fill()
}

/** 地：纸面暗部渐变与几道皴 */
function paintGround(ctx: CanvasRenderingContext2D, { w, h }: SceneDims, theme: ThemeConfig): void {
  const y0 = h * ANCHORS.horizon
  const g = ctx.createLinearGradient(0, y0, 0, h)
  g.addColorStop(0, withAlpha(theme.paperDeep, 0.4))
  g.addColorStop(0.5, withAlpha(theme.paperDeep, 0.9))
  g.addColorStop(1, theme.paperDeep)
  ctx.fillStyle = g
  ctx.fillRect(0, y0, w, h - y0)

  const rand = mulberry32(theme.isDay ? 55 : 56)
  ctx.lineWidth = 1
  for (let i = 0; i < 14; i++) {
    const y = y0 + rand() * (h - y0)
    const x = rand() * w * 0.7
    const len = 60 + rand() * w * 0.3
    ctx.strokeStyle = withAlpha(theme.ink, 0.028 + rand() * 0.03)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y + (rand() - 0.5) * 4)
    ctx.stroke()
  }
  // 地平线交接处一道淡墨
  const edge = ctx.createLinearGradient(0, y0 - 14, 0, y0 + 26)
  edge.addColorStop(0, 'rgba(0,0,0,0)')
  edge.addColorStop(0.6, withAlpha(theme.ink, theme.isDay ? 0.07 : 0.16))
  edge.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = edge
  ctx.fillRect(0, y0 - 14, w, 40)
}

/** 案：正面平视一方木案，墨线勾边；返回值供炉烟定位 */
function paintTable(ctx: CanvasRenderingContext2D, { w, h }: SceneDims, theme: ThemeConfig): { x: number; y: number } {
  const tw = Math.min(w * 0.54, 660)
  const th = Math.max(Math.min(h * 0.042, 40), 24)
  const x0 = (w - tw) / 2
  const y0 = h * ANCHORS.tableY

  // 地面接触阴影
  ctx.fillStyle = withAlpha(theme.ink, 0.1)
  ctx.beginPath()
  ctx.ellipse(w / 2, y0 + th * 3.4, tw * 0.62, th * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()

  // 案腿
  ctx.fillStyle = theme.woodDark
  const legW = Math.max(th * 0.3, 8)
  for (const lx of [x0 + tw * 0.06, x0 + tw * 0.9]) {
    ctx.fillRect(lx, y0 + th, legW, th * 2.1)
  }

  // 案面
  const g = ctx.createLinearGradient(0, y0, 0, y0 + th)
  g.addColorStop(0, theme.wood)
  g.addColorStop(1, theme.woodDark)
  ctx.fillStyle = g
  roundRect(ctx, x0, y0, tw, th, 3)
  ctx.fill()

  // 木纹
  const rand = mulberry32(theme.isDay ? 311 : 312)
  ctx.save()
  roundRect(ctx, x0, y0, tw, th, 3)
  ctx.clip()
  ctx.lineWidth = 0.8
  for (let i = 0; i < 34; i++) {
    const y = y0 + rand() * th
    ctx.strokeStyle = `rgba(24,16,8,${0.05 + rand() * 0.09})`
    ctx.beginPath()
    ctx.moveTo(x0, y)
    for (let x = x0; x <= x0 + tw; x += 26) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i * 2.7) * 1.6)
    }
    ctx.stroke()
  }
  ctx.restore()

  // 顶缘受光与底缘墨线
  ctx.fillStyle = 'rgba(255,244,214,0.14)'
  ctx.fillRect(x0, y0, tw, 1.5)
  ctx.strokeStyle = withAlpha(theme.ink, theme.isDay ? 0.55 : 0.75)
  ctx.lineWidth = 1.4
  roundRect(ctx, x0, y0, tw, th, 3)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x0 + 2, y0 + th)
  ctx.lineTo(x0 + tw - 2, y0 + th)
  ctx.stroke()

  return censerAnchor({ w, h }, tw, th, theme)
}

function censerAnchor({ w, h }: SceneDims, tw: number, th: number, theme: ThemeConfig): { x: number; y: number } {
  const s = Math.max(h * 0.024, 12)
  // 三足落定在案面上：足底 = 案面顶
  return { x: w / 2 - tw * 0.33, y: h * ANCHORS.tableY - s * 0.42 }
}

/** 香炉：三足青铜小炉，坐于案左 */
function paintCenser(ctx: CanvasRenderingContext2D, dims: SceneDims, theme: ThemeConfig): { x: number; y: number } {
  const anchor = censerAnchor(dims, Math.min(dims.w * 0.54, 660), Math.max(Math.min(dims.h * 0.042, 40), 24), theme)
  const s = Math.max(dims.h * 0.024, 12) // 比例尺
  const { x, y } = anchor

  ctx.save()
  ctx.translate(x, y)
  // 炉身
  const body = ctx.createLinearGradient(0, -s, 0, s * 0.2)
  body.addColorStop(0, theme.isDay ? '#7d6844' : '#5a4a30')
  body.addColorStop(1, theme.isDay ? '#4e3f28' : '#33291a')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(0, -s * 0.28, s * 0.86, s * 0.66, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillRect(-s * 0.86, -s * 0.3, s * 1.72, s * 0.3)
  // 口沿
  ctx.strokeStyle = withAlpha(theme.ink, 0.6)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(0, -s * 0.94, s * 0.9, s * 0.22, 0, 0, Math.PI * 2)
  ctx.stroke()
  // 双耳：侧贴环
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(side * s * 0.88, -s * 0.52, s * 0.16, -Math.PI * 0.5, Math.PI * 0.5)
    ctx.stroke()
  }
  // 三足
  ctx.fillStyle = theme.isDay ? '#3e3220' : '#2a2216'
  for (const dx of [-s * 0.5, 0, s * 0.5]) {
    ctx.beginPath()
    ctx.moveTo(dx - s * 0.09, 0)
    ctx.lineTo(dx + s * 0.09, 0)
    ctx.lineTo(dx + s * 0.03, s * 0.42)
    ctx.lineTo(dx - s * 0.03, s * 0.42)
    ctx.closePath()
    ctx.fill()
  }
  // 炉灰与香头
  ctx.fillStyle = 'rgba(120,110,96,0.9)'
  ctx.beginPath()
  ctx.ellipse(0, -s * 0.9, s * 0.72, s * 0.14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = theme.isDay ? '#b0511f' : '#e06a2c'
  ctx.beginPath()
  ctx.arc(s * 0.14, -s * 0.94, Math.max(s * 0.07, 1.6), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 香头发光（夜）
  if (!theme.isDay) {
    const glow = ctx.createRadialGradient(x + s * 0.14, y - s * 0.94, 0, x + s * 0.14, y - s * 0.94, s * 3)
    glow.addColorStop(0, 'rgba(224,116,54,0.2)')
    glow.addColorStop(1, 'rgba(224,116,54,0)')
    ctx.fillStyle = glow
    ctx.fillRect(x - s * 3, y - s * 4, s * 6.4, s * 6)
  }
  // 返回烟的喷口
  return { x: x + s * 0.14, y: y - s }
}

/** 落款朱印：右下角，永远在 */
function paintSeal(ctx: CanvasRenderingContext2D, { w, h }: SceneDims, theme: ThemeConfig): void {
  const size = Math.max(Math.min(Math.min(w, h) * 0.05, 44), 30)
  const x = w - size - Math.max(w * 0.035, 26)
  const y = h - size - Math.max(h * 0.06, 30)
  ctx.save()
  ctx.translate(x + size / 2, y + size / 2)
  ctx.rotate((2 * Math.PI) / 180)
  ctx.fillStyle = withAlpha(theme.accent, 0.88)
  roundRect(ctx, -size / 2, -size / 2, size, size, 3)
  ctx.fill()
  ctx.strokeStyle = 'rgba(243,234,216,0.5)'
  ctx.lineWidth = 1.2
  roundRect(ctx, -size / 2 + 3, -size / 2 + 3, size - 6, size - 6, 2)
  ctx.stroke()
  ctx.fillStyle = '#f3ead8'
  ctx.font = `600 ${Math.round(size * 0.32)}px "Noto Serif SC", "Songti SC", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('六', 0, -size * 0.19)
  ctx.fillText('爻', 0, size * 0.22)
  ctx.restore()
}

/** 静层总绘制：一帧成画，只在主题/尺寸变化时重绘；返回炉烟喷口位置 */
export function paintStatic(
  ctx: CanvasRenderingContext2D,
  dims: SceneDims,
  theme: ThemeConfig,
): { x: number; y: number } {
  paintPaper(ctx, dims, theme)
  paintMountains(ctx, dims, theme)
  if (theme.moon) paintMoon(ctx, dims)
  paintGround(ctx, dims, theme)
  const smokeSource = paintTable(ctx, dims, theme)
  paintCenser(ctx, dims, theme)
  paintSeal(ctx, dims, theme)
  return smokeSource
}

/** 铜钱精灵：字面（阴）与背面（阳） */
export function makeCoinSprites(scale = 2): { front: HTMLCanvasElement; back: HTMLCanvasElement; size: number } {
  const size = Math.round(52 * scale)
  const make = (front: boolean) => {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    const r = size * 0.46
    const cx = size / 2
    // 铜体
    const g = ctx.createRadialGradient(cx - r * 0.3, cx - r * 0.3, r * 0.2, cx, cx, r)
    g.addColorStop(0, '#d3b273')
    g.addColorStop(0.7, '#a98a4e')
    g.addColorStop(1, '#7c6134')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cx, r, 0, Math.PI * 2)
    ctx.fill()
    // 外缘
    ctx.strokeStyle = '#5f4a26'
    ctx.lineWidth = size * 0.035
    ctx.stroke()
    if (front) {
      // 内缘细环
      ctx.strokeStyle = 'rgba(92,69,34,0.55)'
      ctx.lineWidth = size * 0.012
      ctx.beginPath()
      ctx.arc(cx, cx, r * 0.8, 0, Math.PI * 2)
      ctx.stroke()
      // 四字
      ctx.fillStyle = 'rgba(74,55,26,0.8)'
      ctx.font = `600 ${Math.round(size * 0.16)}px "Noto Serif SC", "Songti SC", serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const chars = ['乾', '隆', '通', '宝']
      const off = r * 0.5
      ctx.fillText(chars[0], cx, cx - off)
      ctx.fillText(chars[1], cx + off, cx)
      ctx.fillText(chars[2], cx, cx + off)
      ctx.fillText(chars[3], cx - off, cx)
    } else {
      // 背面：两道铸痕
      ctx.strokeStyle = 'rgba(74,55,26,0.3)'
      ctx.lineWidth = size * 0.014
      for (const dy of [-r * 0.38, r * 0.38]) {
        ctx.beginPath()
        ctx.arc(cx, cx + dy, r * 0.34, Math.PI * 0.15, Math.PI * 0.85)
        ctx.stroke()
      }
    }
    // 方孔
    const hole = size * 0.16
    ctx.fillStyle = 'rgba(20,14,6,0.78)'
    ctx.fillRect(cx - hole / 2, cx - hole / 2, hole, hole)
    ctx.strokeStyle = '#4a3a1e'
    ctx.lineWidth = size * 0.014
    ctx.strokeRect(cx - hole / 2, cx - hole / 2, hole, hole)
    return c
  }
  return { front: make(true), back: make(false), size }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}
