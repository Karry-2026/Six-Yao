// 程序化环境音：风声底噪 + 起卦/成卦钟声。
// 不加载任何音频文件，全部用 WebAudio 合成，避免体积与授权问题。

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let windGain: GainNode | null = null
let muted = readMuted()

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
  windGain.gain.value = 0.05

  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.08
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.02
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
      masterGain?.gain.setTargetAtTime(1, ctx!.currentTime, 0.6)
    }
  },

  toggle(): boolean {
    createContext()
    muted = !muted
    persist(muted)
    if (!muted) {
      startWind()
      masterGain?.gain.setTargetAtTime(1, ctx!.currentTime, 0.4)
    } else {
      masterGain?.gain.setTargetAtTime(0, ctx!.currentTime, 0.2)
    }
    return !muted
  },

  /** 起卦一记钟，成卦一声磬 */
  bell(kind: 'start' | 'end') {
    if (muted || !ctx || !masterGain) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = kind === 'start' ? 396 : 528
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(kind === 'start' ? 0.16 : 0.22, now + 0.02)
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
    harmonicGain.gain.linearRampToValueAtTime(0.05, now + 0.02)
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0)
    harmonic.connect(harmonicGain).connect(masterGain)
    harmonic.start(now)
    harmonic.stop(now + 2.2)
  },
}
