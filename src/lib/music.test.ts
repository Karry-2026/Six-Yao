import { describe, expect, it } from 'vitest'
import { composePhrase, generatePluck, music, pentatonic } from './music'

/** 线性同余随机源：测试可复现（Numerical Recipes 参数） */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** 与 MusicPlayer 构造器同构的音池搭建（五声 × 2 八度 + 色彩音高八度） */
function buildPool(base: number) {
  const scale = pentatonic(base, 'sanfen')
  const core: number[] = []
  for (let oct = 0; oct < 2; oct++) {
    for (let i = 0; i < 5; i++) core.push(scale[i] * 2 ** oct)
  }
  core.sort((a, b) => a - b)
  const color = scale.slice(5).map((f) => f * 2).sort((a, b) => a - b)
  return { scale, core, color, pool: [...core, ...color] }
}

describe('pentatonic · sanfen（三分损益）', () => {
  const base = 220
  const s = pentatonic(base, 'sanfen')

  it('返回 7 个音：五声正音 + 变宫/变徵两个色彩音', () => {
    expect(s).toHaveLength(7)
  })

  it('徵/宫 = 1.5 ± 1e-9', () => {
    expect(Math.abs(s[3] / s[0] - 1.5)).toBeLessThanOrEqual(1e-9)
  })

  it('角/宫 = 81/64', () => {
    expect(Math.abs(s[2] / s[0] - 81 / 64)).toBeLessThanOrEqual(1e-9)
  })

  it('羽/宫 = 27/16', () => {
    expect(Math.abs(s[4] / s[0] - 27 / 16)).toBeLessThanOrEqual(1e-9)
  })

  it('商/宫 = 9/8，变宫/宫 = 243/128', () => {
    expect(Math.abs(s[1] / s[0] - 9 / 8)).toBeLessThanOrEqual(1e-9)
    expect(Math.abs(s[5] / s[0] - 243 / 128)).toBeLessThanOrEqual(1e-9)
  })

  it('变徵/宫 = 729/512（八度归一后的蕤宾；任务书 2187/512 = 3× 此值，高一纯五度+八度）', () => {
    expect(Math.abs(s[6] / s[0] - 729 / 512)).toBeLessThanOrEqual(1e-9)
  })

  it('八度归一：所有比率都落在 [1, 2) 内', () => {
    for (const f of s) {
      const ratio = f / s[0]
      expect(ratio).toBeGreaterThanOrEqual(1)
      expect(ratio).toBeLessThan(2)
    }
  })

  it('宫音即 baseHz', () => {
    expect(s[0]).toBe(base)
  })

  it('非法输入抛 RangeError', () => {
    expect(() => pentatonic(0, 'sanfen')).toThrow(RangeError)
    expect(() => pentatonic(-440, 'equal')).toThrow(RangeError)
  })
})

describe('pentatonic · equal（十二平均律）', () => {
  const base = 220
  const e = pentatonic(base, 'equal')

  it('返回 5 个音（五声，不含色彩音）', () => {
    expect(e).toHaveLength(5)
  })

  it('徵/宫 = 2^(7/12) ± 1e-9', () => {
    expect(Math.abs(e[3] / e[0] - 2 ** (7 / 12))).toBeLessThanOrEqual(1e-9)
  })

  it('商/宫 = 2^(2/12)，角/宫 = 2^(4/12)，羽/宫 = 2^(9/12)', () => {
    expect(Math.abs(e[1] / e[0] - 2 ** (2 / 12))).toBeLessThanOrEqual(1e-9)
    expect(Math.abs(e[2] / e[0] - 2 ** (4 / 12))).toBeLessThanOrEqual(1e-9)
    expect(Math.abs(e[4] / e[0] - 2 ** (9 / 12))).toBeLessThanOrEqual(1e-9)
  })

  it('宫音即 baseHz', () => {
    expect(e[0]).toBe(base)
  })
})

describe('generatePluck · Karplus–Strong 拨弦', () => {
  it('缓冲长度 = seconds × sampleRate', () => {
    expect(generatePluck(220, 44100, 2)).toHaveLength(2 * 44100)
    expect(generatePluck(440, 48000, 0.5)).toHaveLength(Math.round(0.5 * 48000))
    expect(generatePluck(110, 22050, 3)).toHaveLength(3 * 22050)
  })

  it('样本全部有限', () => {
    const data = generatePluck(330, 44100, 1)
    expect(data.length).toBeGreaterThan(0)
    for (const v of data) expect(Number.isFinite(v)).toBe(true)
  })

  it('非全零：峰值超过 0.1（有实际声响）', () => {
    const data = generatePluck(293.66, 44100, 1)
    let peak = 0
    for (const v of data) peak = Math.max(peak, Math.abs(v))
    expect(peak).toBeGreaterThan(0.1)
  })

  it('自然衰减：末段能量比起音段低 40dB 以上', () => {
    const data = generatePluck(220, 44100, 2)
    const head = data.subarray(0, 4410) // 前 0.1s
    const tail = data.subarray(data.length - 4410) // 后 0.1s
    const energy = (x: Float32Array) => {
      let sum = 0
      for (const v of x) sum += v * v
      return sum
    }
    expect(energy(tail) * 1e4).toBeLessThan(energy(head))
  })

  it('非法输入抛 RangeError', () => {
    expect(() => generatePluck(0, 44100, 1)).toThrow(RangeError)
    expect(() => generatePluck(220, 0, 1)).toThrow(RangeError)
    expect(() => generatePluck(220, 44100, -1)).toThrow(RangeError)
  })
})

describe('composePhrase · 生成式编配', () => {
  const { core, color, pool } = buildPool(220)

  it('主音 3–6 个，事件全部来自音池、时值落在句长内', () => {
    const rand = lcg(42)
    for (let i = 0; i < 200; i++) {
      const phrase = composePhrase(core, color, 0, rand)
      const mains = phrase.events.filter((e) => e.gain === 0.5)
      expect(mains.length).toBeGreaterThanOrEqual(3)
      expect(mains.length).toBeLessThanOrEqual(6)
      for (const ev of phrase.events) {
        expect(pool).toContain(ev.freq)
        expect(ev.offset).toBeGreaterThanOrEqual(0)
        expect(ev.offset).toBeLessThanOrEqual(phrase.duration)
        expect(ev.gain).toBeGreaterThan(0)
        expect(ev.gain).toBeLessThanOrEqual(0.5)
      }
      expect(phrase.duration).toBeGreaterThan(0)
    }
  })

  it('句间留白 2–6 秒', () => {
    const rand = lcg(7)
    for (let i = 0; i < 200; i++) {
      const gap = composePhrase(core, color, 0, rand).gap
      expect(gap).toBeGreaterThanOrEqual(2)
      expect(gap).toBeLessThan(6)
    }
  })

  it('随机游走位置始终留在音池下标范围内，且跨句连续', () => {
    const rand = lcg(99)
    let pos = 0
    for (let i = 0; i < 200; i++) {
      const phrase = composePhrase(core, color, pos, rand)
      expect(phrase.pos).toBeGreaterThanOrEqual(0)
      expect(phrase.pos).toBeLessThanOrEqual(core.length - 1)
      pos = phrase.pos
    }
  })

  it('同种子可复现（确定性）', () => {
    const a = composePhrase(core, color, 2, lcg(2026))
    const b = composePhrase(core, color, 2, lcg(2026))
    expect(a).toEqual(b)
  })

  it('equal 律制（无色彩音）同样可用', () => {
    const equalCore = [...pentatonic(220, 'equal'), ...pentatonic(440, 'equal')].sort(
      (a, b) => a - b,
    )
    const phrase = composePhrase(equalCore, [], 0, lcg(1))
    for (const ev of phrase.events) expect(equalCore).toContain(ev.freq)
    expect(phrase.pos).toBeLessThanOrEqual(equalCore.length - 1)
  })
})

describe('music 单例（默认静音、不自动播）', () => {
  it('模块可在 Node 纯导入——不依赖浏览器全局', () => {
    expect(typeof music.start).toBe('function')
    expect(typeof music.stop).toBe('function')
    expect(typeof music.toggle).toBe('function')
  })

  it('默认静音且未在播放', () => {
    expect(music.muted).toBe(true)
    expect(music.isPlaying).toBe(false)
  })

  it('静音下 start() 是 no-op，stop() 幂等安全', () => {
    music.start()
    expect(music.isPlaying).toBe(false) // 默认静音 → 绝不自动出声
    music.stop()
    expect(music.isPlaying).toBe(false)
  })
})
