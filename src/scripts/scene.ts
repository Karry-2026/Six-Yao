// 2D 水墨氛围渲染：静层成画 + 炉烟/粒子/铜钱三个动态层（ADR-0001）
// 起卦流程在 ritual.ts，这里只听事件做视觉。

import { THEMES, resolveTheme, type ThemeConfig } from './ink/themes'
import { paintStatic, makeCoinSprites, ANCHORS } from './ink/paint'

interface Puff {
  x: number
  y: number
  r: number
  a: number
  seed: number
}

interface Particle {
  x: number
  y: number
  phase: number
}

interface CoinAnim {
  active: boolean
  start: number
  faces: boolean[]
}

function qualityTier(): 'high' | 'medium' | 'low' {
  const cores = navigator.hardwareConcurrency ?? 4
  if (window.innerWidth < 640 || cores <= 4) return 'low'
  if (window.innerWidth < 1280 || cores <= 8) return 'medium'
  return 'high'
}

export function boot(): void {
  performance.mark('scene:boot')
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null
  if (!canvas) return

  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    ctx = null
  }
  if (!ctx) {
    document.body.classList.add('no-canvas')
    return
  }

  try {
    start(canvas, ctx)
  } catch (error) {
    console.warn('[six-yao] 2D 初始化失败，回退纯 DOM 模式', error)
    document.body.classList.add('no-canvas')
    canvas.remove()
  }
}

function start(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const theme: ThemeConfig = THEMES[resolveTheme()]
  const tier = qualityTier()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const dprCap = tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
  const particleScale = tier === 'low' ? 0.45 : tier === 'medium' ? 0.75 : 1

  // 静层：只在主题/尺寸变化时重绘
  const staticLayer = document.createElement('canvas')
  const staticCtx = staticLayer.getContext('2d')!
  let dims = { w: 0, h: 0 }
  let smokeSource = { x: 0, y: 0 }

  const repaint = () => {
    dims = { w: window.innerWidth, h: window.innerHeight }
    for (const [layer, c] of [
      [canvas, ctx],
      [staticLayer, staticCtx],
    ] as const) {
      c!.canvas.width = Math.round(dims.w * dpr)
      c!.canvas.height = Math.round(dims.h * dpr)
    }
    staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    smokeSource = paintStatic(staticCtx, dims, theme)
  }

  let resizeTimer = 0
  const onResize = () => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      repaint()
      initParticles()
    }, 120)
  }

  // ---------- 动态元素 ----------
  const puffs: Puff[] = []
  let nextPuffAt = 0

  const particles: Particle[] = []
  const initParticles = () => {
    particles.length = 0
    const count = Math.round(theme.particle.count * particleScale)
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * dims.w,
        y: theme.falls ? Math.random() * dims.h : dims.h * (0.1 + Math.random() * 0.75),
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  const coinSprites = makeCoinSprites(Math.min(dpr, 2))
  const coinAnim: CoinAnim = { active: false, start: 0, faces: [false, false, false] }

  const coinLayout = () => {
    const cy = dims.h * ANCHORS.tableY + 4
    const scale = Math.max(Math.min(dims.w / 900, 1.15), 0.5)
    const size = (coinSprites.size / dpr) * scale
    const gap = size * 1.12
    return { cy, scale, size, gap }
  }

  window.addEventListener('sy:toss', (event) => {
    const faces = (event as CustomEvent<boolean[]>).detail
    if (!Array.isArray(faces)) return
    coinAnim.faces = faces
    coinAnim.start = performance.now()
    coinAnim.active = true
  })
  window.addEventListener('sy:reset', () => {
    coinAnim.active = false
    puffs.length = 0
  })

  // ---------- 主循环 ----------
  const clock = new MiniClock()
  let raf = 0
  let paused = document.hidden

  const drawCoin = (now: number) => {
    const { cy, scale, size, gap } = coinLayout()
    const cx = dims.w / 2 - gap
    const p = coinAnim.active ? Math.min((now - coinAnim.start) / 760, 1) : 1
    for (let i = 0; i < 3; i++) {
      const sprite = coinAnim.faces[i] ? coinSprites.back : coinSprites.front
      const drop = coinAnim.active ? (1 - Math.pow(1 - p, 3)) : 1
      const flip = coinAnim.active && p < 1 ? Math.abs(Math.cos(p * Math.PI * 5 + i)) : 1
      const x = cx + i * gap - size / 2
      const y = cy - size - (1 - drop) * 130 * scale
      ctx.save()
      ctx.globalAlpha = 0.24 + 0.76 * drop
      ctx.translate(x + size / 2, y + size / 2)
      ctx.scale(1, Math.max(flip, 0.12))
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size)
      ctx.restore()
    }
  }

  const drawSmoke = (t: number, now: number) => {
    if (!reduceMotion && now >= nextPuffAt && puffs.length < 22) {
      puffs.push({
        x: smokeSource.x + (Math.random() - 0.5) * 3,
        y: smokeSource.y,
        r: Math.max(dims.h * 0.005, 2.4),
        a: 1,
        seed: Math.random() * Math.PI * 2,
      })
      nextPuffAt = now + (theme.isDay ? 300 : 340) + Math.random() * 160
    }
    const col = theme.isDay ? '82,74,62' : '196,190,176'
    for (let i = puffs.length - 1; i >= 0; i--) {
      const puff = puffs[i]
      puff.y -= 0.5 + Math.sin(t * 0.9 + puff.seed) * 0.16
      puff.x += Math.sin(t * 0.7 + puff.seed) * 0.34
      puff.r += 0.075
      puff.a -= 0.0042
      if (puff.a <= 0) {
        puffs.splice(i, 1)
        continue
      }
      ctx.fillStyle = `rgba(${col},${(puff.a * 0.075).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(puff.x, puff.y, puff.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawParticles = (t: number) => {
    ctx.fillStyle = theme.particle.color
    ctx.strokeStyle = theme.particle.color
    for (const p of particles) {
      if (theme.falls) {
        if (theme.id === 'rain') {
          // 雨丝
          ctx.lineWidth = 1
          ctx.globalAlpha = theme.particle.opacity * 0.7
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - 1.2, p.y + 11)
          ctx.stroke()
        } else {
          // 雪
          ctx.globalAlpha = theme.particle.opacity
          ctx.beginPath()
          ctx.arc(p.x, p.y, theme.particle.size, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        ctx.globalAlpha = theme.particle.opacity * (0.5 + 0.5 * Math.sin(t * 0.8 + p.phase))
        ctx.beginPath()
        ctx.arc(p.x, p.y, theme.particle.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  const stepParticles = (t: number) => {
    const sp = theme.particle.speed
    for (const p of particles) {
      if (theme.falls) {
        p.y += sp
        p.x -= theme.id === 'rain' ? sp * 0.08 : Math.sin(p.y * 0.01) * 0.3
        if (p.y > dims.h) {
          p.y = -8
          p.x = Math.random() * dims.w
        }
      } else {
        p.y -= sp * 0.5
        p.x += Math.sin(t + p.phase) * theme.particle.drift * 0.05
        if (p.y < dims.h * 0.05) {
          p.y = dims.h * 0.85
          p.x = Math.random() * dims.w
        }
      }
    }
  }

  function frame() {
    raf = requestAnimationFrame(frame)
    if (paused) return
    const t = clock.getElapsedTime()
    const now = performance.now()

    ctx.drawImage(staticLayer, 0, 0, dims.w, dims.h)
    if (theme.fog > 0) drawFog(t)
    if (!reduceMotion) {
      stepParticles(t)
      drawParticles(t)
      drawSmoke(t, now)
    }
    drawCoin(now)

    if (!document.body.classList.contains('scene-live')) {
      document.body.classList.add('scene-live')
      performance.mark('scene:first-frame')
    }
  }

  // 雨/雾横带：垂直羽化 + 缓慢漂移
  const drawFog = (t: number) => {
    const strength = 0.05 + theme.fog * 0.05
    const col = theme.isDay ? '232,226,210' : '150,160,175'
    for (const [yFrac, heightFrac, speed] of [
      [0.36, 0.05, 0.6],
      [0.43, 0.08, -0.4],
    ] as const) {
      const y = dims.h * yFrac
      const hgt = dims.h * heightFrac
      const shift = Math.sin(t * 0.05 * speed) * dims.w * 0.04
      ctx.save()
      ctx.translate(shift, 0)
      const g = ctx.createLinearGradient(0, y - hgt / 2, 0, y + hgt / 2)
      g.addColorStop(0, `rgba(${col},0)`)
      g.addColorStop(0.5, `rgba(${col},${strength})`)
      g.addColorStop(1, `rgba(${col},0)`)
      ctx.fillStyle = g
      ctx.fillRect(-dims.w * 0.1, y - hgt / 2, dims.w * 1.2, hgt)
      ctx.restore()
    }
  }

  document.addEventListener('visibilitychange', () => {
    paused = document.hidden
  })
  window.addEventListener('resize', onResize)

  repaint()
  initParticles()
  frame()
}

/** 极简时钟 */
class MiniClock {
  private start = performance.now()
  getElapsedTime(): number {
    return (performance.now() - this.start) / 1000
  }
}
