// 程序化环境音：风声底噪 + 起卦/成卦钟声。
// 不加载任何音频文件，全部用 WebAudio 合成，避免体积与授权问题。
//
// 开关语义（音乐接线阶段）：页面声音统一由「音乐」按钮接管——
// 开 = music.start() 为主声部，风声与钟磬压低音量作衬底；关 = 全部静音。

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let windGain: GainNode | null = null
let muted = readMuted()

// 衬底电平：音乐成为主声部后，风声与钟磬约为原电平的一半
const BACKING = 0.5

function readMuted(): boolean {
  try {
    return localStorage.getItem('sy-muted') !== '0'
  } catch {
    return true
  }
}

function persist(mutedNow: boolean) {
  try {
    localStorage.setItem('sy-muted', mutedNow ? '1' : '0')
  } catch {
    /* 隐私模式忽略 */
  }
}

function createContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function fadeMaster(target: number, timeConstant: number): void {
  if (ctx && masterGain) {
    masterGain.gain.setTargetAtTime(target, ctx.currentTime, timeConstant)
  }
}

function startWind() {
  if (!ctx || !masterGain || windGain) return

  const seconds = 2
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 420
  filter.Q.value = 0.6

  windGain = ctx.createGain()
  windGain.gain.value = 0.05 * BACKING // 衬底：0.025

  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.08
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.02 * BACKING
  lfo.connect(lfoGain).connect(windGain.gain)

  source.connect(filter).connect(windGain).connect(masterGain)
  source.start()
  lfo.start()
}

export const ambient = {
  get muted(): boolean {
    return muted
  },

  /** 用户第一次交互时调用；未静音则淡入风声 */
  enable() {
    createContext()
    if (!muted) {
      startWind()
      fadeMaster(1, 0.6)
    }
  },

  /** 跟随「音乐」开关：true=音乐开 → 解除静音并淡入衬底；false=静音淡出。持久化。 */
  setSound(on: boolean) {
    muted = !on
    persist(muted)
    if (!muted) {
      createContext()
      startWind()
      fadeMaster(1, 0.4)
    } else {
      fadeMaster(0, 0.2)
    }
  },

  /** 旧开关入口，现由「音乐」按钮统一接管（保持 API 兼容） */
  toggle(): boolean {
    ambient.setSound(!muted)
    return !muted
  },

  /** 起卦一记钟，成卦一声磬（衬底电平） */
  bell(kind: 'start' | 'end') {
    if (muted || !ctx || !masterGain) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = kind === 'start' ? 396 : 528
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime((kind === 'start' ? 0.16 : 0.22) * BACKING, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'start' ? 2.4 : 3.4))
    osc.connect(gain).connect(masterGain)
    osc.start(now)
    osc.stop(now + 3.6)

    // 泛音，让钟声更厚
    const harmonic = ctx.createOscillator()
    const harmonicGain = ctx.createGain()
    harmonic.type = 'sine'
    harmonic.frequency.value = (kind === 'start' ? 396 : 528) * 2.01
    harmonicGain.gain.setValueAtTime(0, now)
    harmonicGain.gain.linearRampToValueAtTime(0.05 * BACKING, now + 0.02)
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0)
    harmonic.connect(harmonicGain).connect(masterGain)
    harmonic.start(now)
    harmonic.stop(now + 2.2)
  },
}
