// 六爻 · 背景音乐引擎：五声音阶（三分损益 / 十二平均律）+ Karplus–Strong 拨弦。
// 架构约定：DSP 全部是无副作用的纯函数（Float32Array 采样，Node 可直接测试），
// AudioContext 只做薄封装（懒创建、预渲染 Buffer、按 ctx 时钟调度）。

export type TuningMethod = 'sanfen' | 'equal'

/** 音名（度数顺序，与 pentatonic 返回数组下标对应） */
export const DEGREES = ['gong', 'shang', 'jue', 'zhi', 'yu', 'biangong', 'bianzhi'] as const

// ─────────────────────────────────────────────────────────────
// 1. 律制
// ─────────────────────────────────────────────────────────────
//
// sanfen —— 三分损益法，出处：《管子·地员篇》（“凡将起五音，先主一而三之，
// 四开以合九九……三分而益之以一，为百有八，为徵……”）。
// 以弦长起算，交替“损一”（×2/3，弦短 → 上方纯五度）与“益一”（×4/3，弦长 →
// 上方纯四度），《管子》生律次序为 宫→徵→商→羽→角（ frequencies = 1/弦长，
// 最后按任务书要求做八度归一，把所有比率收进 [1, 2) ）：
//
//   弦长   宫 1 ─损→ 徵 2/3 ─益→ 商 8/9 ─损→ 羽 16/27 ─益→ 角 64/81 ─损→ 变宫 128/243 ─益→ 变徵 512/729
//   频率比  1        3/2        9/8         27/16        81/64          243/128           729/512
//
//   即：宫 1、商 9/8、角 81/64、徵 3/2、羽 27/16；色彩音 变宫 243/128、变徵 729/512（蕤宾，
//   距宫约 612 音分，古音阶“宫商角变徵徵羽变宫”即用此律）。
//   ※ 任务书写的是“变徵 2187/512”，但 2187/512 = 3 × 729/512（高一纯五度又高一个八度，
//     不在 [1,2) 内），与同一句“八度归一”自相矛盾。经网络核对（维基百科“十二律/中国
//     五声音阶”、台湾 Encyclopedia“三分損益法”条目，2026-11 查证），经典八度归一值为
//     729/512，此处按经典推导取值。
//
// equal —— 十二平均律：f = baseHz × 2^(k/12)，五声取半音数 k = [0, 2, 4, 7, 9]
//   （宫商角徵羽）。任务书仅对 sanfen 定义色彩音，故 equal 只返回五声。
//
// 返回：按度数顺序 [宫, 商, 角, 徵, 羽, (变宫, 变徵)] 的频率数组（sanfen 7 个，equal 5 个）。
// 注意是“度数顺序”而非音高排序——变徵（729/512 ≈ 1.424）低于徵（3/2）。
export function pentatonic(baseHz: number, method: TuningMethod): number[] {
  if (!Number.isFinite(baseHz) || baseHz <= 0) {
    throw new RangeError(`baseHz 必须为正有限数，收到 ${baseHz}`)
  }
  if (method === 'sanfen') {
    // 三分损益频率比（全部是分母为 2 的幂的二进分数，双精度可精确表示）
    const ratios = [1, 9 / 8, 81 / 64, 3 / 2, 27 / 16, 243 / 128, 729 / 512]
    return ratios.map((r) => baseHz * r)
  }
  if (method === 'equal') {
    const semitones = [0, 2, 4, 7, 9]
    return semitones.map((k) => baseHz * 2 ** (k / 12))
  }
  throw new Error(`未知律制：${method as string}`)
}

// ─────────────────────────────────────────────────────────────
// 2. 音色：Karplus–Strong 拨弦（纯函数）
// ─────────────────────────────────────────────────────────────
// Kevin Karplus & Alex Strong, "Digital Synthesis of Plucked-String and Drum
// Timbres", Computer Music Journal 7(2): 43–55, 1983（经网络核对，UCSC 有原文 PDF）。
//   ① 激励：长度 N = round(sampleRate / freq) 的环形延迟线填满一段白噪声（拨弦），
//      并减去均值去直流——直流残留会让音头“嗡”住不散；
//   ② 反馈：每个输出样本读出线头后，写回 decay × (y[n−N] + y[n−N+1]) / 2 ——
//      延迟线低通反馈：相邻样本平均每绕一圈削掉一层高频，配合 decay < 1 自然衰减。
// 包络约每秒衰减 60/seconds dB（构造上保证缓冲末尾 ≈ −60dB），因此任意 seconds
// 都以静音收尾，AudioBufferSource 停止时不会炸出一声“咔”。
// 返回长度恰为 round(seconds × sampleRate) 的单声道 Float32Array。
export function generatePluck(freq: number, sampleRate: number, seconds: number): Float32Array {
  if (!Number.isFinite(freq) || freq <= 0) {
    throw new RangeError(`freq 必须为正有限数，收到 ${freq}`)
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`sampleRate 必须为正有限数，收到 ${sampleRate}`)
  }
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new RangeError(`seconds 必须为正有限数，收到 ${seconds}`)
  }
  const length = Math.max(1, Math.round(seconds * sampleRate))
  // 延迟线长度；频率高于奈奎斯特频率时钳到 N=2
  const N = Math.max(2, Math.round(sampleRate / Math.min(freq, sampleRate / 2)))
  const out = new Float32Array(length)
  const line = new Float32Array(N)

  // ① 白噪声激励 + 去直流
  let mean = 0
  for (let i = 0; i < N; i++) {
    const v = Math.random() * 2 - 1
    line[i] = v
    mean += v
  }
  mean /= N
  for (let i = 0; i < N; i++) line[i] -= mean

  // ② 每绕延迟线一圈（约 1/freq 秒）幅度乘一次 decay；圈数 ≈ seconds × freq，
  //    取 decay = 0.001^(1/圈数) 使整段恰衰减 60dB
  const cycles = Math.max(1, seconds * freq)
  const decay = 0.001 ** (1 / cycles)

  let p = 0
  for (let n = 0; n < length; n++) {
    const cur = line[p]
    out[n] = cur
    line[p] = decay * 0.5 * (cur + line[p + 1 === N ? 0 : p + 1])
    p = p + 1 === N ? 0 : p + 1
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// 3. 生成式编配（纯函数）：稀疏拨弦短句
// ─────────────────────────────────────────────────────────────
// 每句 3–6 个主音，在五声音池内随机游走（±1 度为主、偶发 ±2，越界反弹），
// 步长按 60–66 BPM 的一拍（偶发半拍），偶发色彩音、双音（纯五度/八度和音，
// 错开 0–30ms 的拨弦感）与句尾八度呼应；句间留白 2–6 秒。
// rand 可注入（测试用种子随机源复现）；游走位置 pos 跨句保持连续。

export interface PhraseEvent {
  /** 相对句首的偏移秒数 */
  offset: number
  /** 音池中的频率（预渲染过 Buffer） */
  freq: number
  /** 事件增益，(0, 1] */
  gain: number
}

export interface Phrase {
  events: PhraseEvent[]
  /** 乐句时值：最后一个主音 onset + 一拍；句间留白从此刻起算 */
  duration: number
  /** 句间留白秒数，[2, 6) */
  gap: number
  /** 游走位置（core 数组下标），供下一句延续 */
  pos: number
}

const FIFTH = 3 / 2
const MAIN_GAIN = 0.5
const DOUBLE_GAIN = 0.32
const ECHO_GAIN = 0.28
const DOUBLE_PROB = 0.25
const COLOR_PROB = 0.12
const ECHO_PROB = 0.35

/** 在音池里挑一个 f×multiplier 的音（浮点须与音池逐位相等才命中），都不在池里则返回 null */
function pickInPool(pool: number[], freq: number, multipliers: number[]): number | null {
  for (const m of multipliers) {
    const cand = freq * m
    if (pool.includes(cand)) return cand
  }
  return null
}

export function composePhrase(
  core: number[],
  color: number[],
  pos: number,
  rand: () => number = Math.random,
): Phrase {
  if (core.length === 0) throw new Error('core 音池不能为空')
  const pool = color.length > 0 ? [...core, ...color] : core
  const start = Math.min(Math.max(Math.round(pos), 0), core.length - 1)
  const bpm = 60 + rand() * 6 // 60–66 BPM 感
  const beat = 60 / bpm
  const noteCount = 3 + Math.floor(rand() * 4) // 3–6 音短句

  const events: PhraseEvent[] = []
  let t = 0
  let cur = start
  let lastFreq = core[cur]
  for (let i = 0; i < noteCount; i++) {
    // 随机游走：±1 为主，偶发 ±2；越界反弹
    const r = rand()
    let step = r < 0.15 ? -2 : r < 0.5 ? -1 : r < 0.85 ? 1 : 2
    if (cur + step < 0 || cur + step >= core.length) step = -step
    cur = Math.min(Math.max(cur + step, 0), core.length - 1)

    let freq = core[cur]
    // 偶发色彩音（sanfen 的变宫/变徵，抬高八度作点缀）
    if (color.length > 0 && rand() < COLOR_PROB) {
      freq = color[Math.floor(rand() * color.length)]
    }
    lastFreq = freq
    events.push({ offset: t, freq, gain: MAIN_GAIN })

    // 偶发双音：和音取纯五度 → 高八度 → 低八度（取音池里存在的那个）
    if (rand() < DOUBLE_PROB) {
      const harmony = pickInPool(pool, freq, [FIFTH, 2, 0.5])
      if (harmony !== null && harmony !== freq) {
        events.push({ offset: t + rand() * 0.03, freq: harmony, gain: DOUBLE_GAIN })
      }
    }

    // 步进：整拍为主，偶发半拍
    t += beat * (rand() < 0.25 ? 0.5 : 1)
  }

  // 句尾八度呼应
  if (rand() < ECHO_PROB) {
    const echo = pickInPool(pool, lastFreq, [2, 0.5])
    if (echo !== null && echo !== lastFreq) {
      events.push({ offset: t + beat * (0.5 + rand() * 0.5), freq: echo, gain: ECHO_GAIN })
    }
  }

  return { events, duration: t + beat, gap: 2 + rand() * 4, pos: cur }
}

// ─────────────────────────────────────────────────────────────
// 4. MusicPlayer：AudioContext 薄封装
// ─────────────────────────────────────────────────────────────
// · AudioContext 懒创建：首次 start()（必须在用户手势调用栈里）才 new 并 resume；
// · 启动时把音池各音的拨弦采样一次性预渲染成 AudioBuffer（DSP 用上面的纯函数，
//   12 个音 × 5s × 48kHz mono ≈ 11.5MB，渲染耗时约几十毫秒，在手势回调里可接受）；
// · 编配：composePhrase 产出短句，400ms 轮询 + 1.2s lookahead 按 ctx 时钟精确排播；
// · 页面 hidden 时 suspend、可见时按播放状态恢复。

export interface MusicPlayerOptions {
  /** 宫音基准频率，默认 220（A3，古琴中正音区） */
  baseHz?: number
  /** 律制，默认 'sanfen' */
  method?: TuningMethod
  /** master gain，默认 0.22 */
  masterLevel?: number
  /** 核心音跨越的八度数（音池 = 五声 × octaves），默认 2 */
  octaves?: number
  /** 随机源，默认 Math.random */
  rng?: () => number
  /** AudioContext 工厂，默认 () => new AudioContext() */
  ctxFactory?: () => AudioContext
}

const PLUCK_SECONDS = 5 // 单音采样时长：包络约 −12dB/s，5s 处 −60dB 收尾
const LOOKAHEAD = 1.2 // 调度前视秒数
const TICK_MS = 400 // 调度器轮询间隔

export class MusicPlayer {
  readonly masterLevel: number
  private readonly rng: () => number
  private readonly ctxFactory: () => AudioContext
  /** 游走音池：五声核心音（升序，跨 octaves 个八度）与色彩音（高八度） */
  private readonly core: number[]
  private readonly color: number[]

  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private readonly buffers = new Map<number, AudioBuffer>()
  private readonly sources = new Set<AudioBufferSourceNode>()
  private timer: ReturnType<typeof setInterval> | null = null
  private nextPhraseAt = 0
  private walkPos = 0 // 故意从宫音（音池最低音）起步
  private visibilityBound = false
  private playing = false

  constructor(options: MusicPlayerOptions = {}) {
    const {
      baseHz = 220,
      method = 'sanfen',
      masterLevel = 0.22,
      octaves = 2,
      rng = Math.random,
      ctxFactory = () => new AudioContext(),
    } = options
    this.masterLevel = masterLevel
    this.rng = rng
    this.ctxFactory = ctxFactory

    const scale = pentatonic(baseHz, method)
    this.core = []
    for (let oct = 0; oct < octaves; oct++) {
      for (let i = 0; i < 5; i++) this.core.push(scale[i] * 2 ** oct)
    }
    this.core.sort((a, b) => a - b)
    this.color = []
    for (let i = 5; i < scale.length; i++) this.color.push(scale[i] * 2)
    this.color.sort((a, b) => a - b)
  }

  get isPlaying(): boolean {
    return this.playing
  }

  /** 开始播放。首次调用必须在用户手势（click/tap/keydown）的调用栈里。幂等。 */
  async start(): Promise<void> {
    if (this.playing) return
    const ctx = this.ensureContext()
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        /* 手势外 resume 被拒绝时保持 suspended，用户下次手势再试 */
      }
    }
    this.prerender()
    const now = ctx.currentTime
    this.master!.gain.cancelScheduledValues(now)
    this.master!.gain.setValueAtTime(0.0001, now)
    this.master!.gain.exponentialRampToValueAtTime(this.masterLevel, now + 1.2) // 淡入
    this.nextPhraseAt = now + 0.2
    this.bindVisibility()
    if (this.timer === null) this.timer = setInterval(() => this.tick(), TICK_MS)
    this.playing = true
    this.tick() // 立即排第一句
  }

  /** 停止：清调度器、master 淡出 0.35s、掐掉已排的源。可重复调用。 */
  stop(): void {
    this.playing = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(0, now + 0.35)
    for (const src of this.sources) {
      try {
        src.stop(now + 0.4)
      } catch {
        /* 已停止的源忽略 */
      }
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = this.ctxFactory()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** 预渲染音池各音的拨弦 Buffer（每音只渲染一次） */
  private prerender(): void {
    const ctx = this.ctx!
    for (const freq of [...this.core, ...this.color]) {
      if (this.buffers.has(freq)) continue
      const buffer = ctx.createBuffer(1, Math.round(PLUCK_SECONDS * ctx.sampleRate), ctx.sampleRate)
      buffer.getChannelData(0).set(generatePluck(freq, ctx.sampleRate, PLUCK_SECONDS))
      this.buffers.set(freq, buffer)
    }
  }

  /** 把一个事件排到 ctx 时间轴上 */
  private scheduleNote(ev: PhraseEvent, when: number): void {
    const ctx = this.ctx!
    let buffer = this.buffers.get(ev.freq)
    if (!buffer) {
      // 兜底：音池外频率现渲染（正常编配不会走到）
      buffer = ctx.createBuffer(1, Math.round(PLUCK_SECONDS * ctx.sampleRate), ctx.sampleRate)
      buffer.getChannelData(0).set(generatePluck(ev.freq, ctx.sampleRate, PLUCK_SECONDS))
      this.buffers.set(ev.freq, buffer)
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(ev.gain, when + 0.004) // 4ms 起音，防采样头咔哒
    src.connect(gain).connect(this.master!)
    src.onended = () => this.sources.delete(src)
    this.sources.add(src)
    src.start(when)
  }

  /** 调度器：把未来 LOOKAHEAD 秒内的句子排满 */
  private tick(): void {
    const ctx = this.ctx
    if (!ctx || !this.playing) return
    const horizon = ctx.currentTime + LOOKAHEAD
    for (let guard = 0; guard < 8 && this.nextPhraseAt < horizon; guard++) {
      const phrase = composePhrase(this.core, this.color, this.walkPos, this.rng)
      this.walkPos = phrase.pos
      for (const ev of phrase.events) {
        this.scheduleNote(ev, this.nextPhraseAt + ev.offset)
      }
      this.nextPhraseAt += phrase.duration + phrase.gap
    }
  }

  /** 页面 hidden → suspend；可见 → 正在播放才 resume */
  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return
    this.visibilityBound = true
    document.addEventListener('visibilitychange', () => {
      const ctx = this.ctx
      if (!ctx) return
      if (document.hidden) {
        void ctx.suspend().catch(() => {})
      } else if (this.playing) {
        void ctx.resume().catch(() => {})
      }
    })
  }
}

// ─────────────────────────────────────────────────────────────
// 5. 单例 music —— 默认静音、绝不自动播（沿用 src/lib/ambient.ts 的约定）
// ─────────────────────────────────────────────────────────────
// 与 ambient 一致：localStorage 持久化静音开关，读不到/异常时视为静音；
// 模块导入与页面加载不产生任何声音，必须由用户手势触发 start()/toggle()。
// 键名独立为 'sy-music-muted'，不与 ambient 的 'sy-muted' 抢同一个值；
// 声音按钮等 UI 接线由后续阶段负责。

const MUTED_KEY = 'sy-music-muted'

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) !== '0'
  } catch {
    return true // 无 localStorage（隐私模式 / Node 环境）→ 默认静音
  }
}

function persistMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  } catch {
    /* 隐私模式下忽略 */
  }
}

const player = new MusicPlayer()
let muted = readMuted()

export const music = {
  /** 是否静音（默认 true） */
  get muted(): boolean {
    return muted
  },
  get isPlaying(): boolean {
    return player.isPlaying
  },
  /** 开播；静音时是 no-op（绝不自动出声）。首次请在用户手势里调用。 */
  start(): void {
    if (muted) return
    void player.start()
  },
  stop(): void {
    player.stop()
  },
  /** 切换静音并持久化；返回切换后的“开声”状态。toggle 由用户手势触发，满足 resume 前提。 */
  toggle(): boolean {
    muted = !muted
    persistMuted(muted)
    if (muted) {
      player.stop()
    } else {
      void player.start()
    }
    return !muted
  },
}
