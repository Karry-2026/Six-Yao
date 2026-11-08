// 四时主题 · 水墨纸色与气象（v3 2D 渲染，ADR-0001）
// 昼景为宣纸底，夜景为染墨纸；朱砂只作印与动爻，不作装饰。

export type ThemeId = 'clear' | 'rain' | 'dusk' | 'snow'

export interface ParticleConfig {
  count: number
  color: string
  speed: number
  drift: number
  size: number
  opacity: number
}

export interface ThemeConfig {
  id: ThemeId
  label: string
  isDay: boolean
  /** 纸底色 */
  paper: string
  /** 地面晕染色（纸面暗部） */
  paperDeep: string
  /** 主墨（近山、案线、爻线） */
  ink: string
  /** 淡墨（远山、晕染） */
  inkSoft: string
  /** 朱砂（印章、动爻、落款） */
  accent: string
  /** 案面木色 */
  wood: string
  woodDark: string
  /** 是否画月 */
  moon: boolean
  /** 粒子是否下落（雨/雪） */
  falls: boolean
  /** 雾带强度 0-1 */
  fog: number
  particle: ParticleConfig
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  clear: {
    id: 'clear',
    label: '晴昼',
    isDay: true,
    paper: '#ece5d3',
    paperDeep: '#ddd2ba',
    ink: '#2a2620',
    inkSoft: '#8a9382',
    accent: '#a63b2a',
    wood: '#9a7a52',
    woodDark: '#6b5236',
    moon: false,
    falls: false,
    fog: 0,
    particle: { count: 90, color: 'rgba(255,252,240,0.9)', speed: 0.05, drift: 0.22, size: 1.1, opacity: 0.35 },
  },
  rain: {
    id: 'rain',
    label: '烟雨',
    isDay: true,
    paper: '#d9d6c9',
    paperDeep: '#c4c2b5',
    ink: '#33322d',
    inkSoft: '#7d827e',
    accent: '#a63b2a',
    wood: '#84714f',
    woodDark: '#5c4d36',
    moon: false,
    falls: true,
    fog: 0.55,
    particle: { count: 260, color: 'rgba(90,96,94,0.85)', speed: 0.95, drift: 0.02, size: 1, opacity: 0.4 },
  },
  dusk: {
    id: 'dusk',
    label: '暮夜',
    isDay: false,
    paper: '#1b2230',
    paperDeep: '#131824',
    ink: '#d9d2c2',
    inkSoft: '#3d4a63',
    accent: '#c8553d',
    wood: '#7a5f42',
    woodDark: '#4e3c2a',
    moon: true,
    falls: false,
    fog: 0.18,
    particle: { count: 130, color: 'rgba(216,203,168,0.9)', speed: 0.06, drift: 0.12, size: 1.2, opacity: 0.5 },
  },
  snow: {
    id: 'snow',
    label: '雪夜',
    isDay: false,
    paper: '#252d38',
    paperDeep: '#1a212b',
    ink: '#e2ddd0',
    inkSoft: '#4a5563',
    accent: '#c8553d',
    wood: '#6d5a44',
    woodDark: '#453826',
    moon: true,
    falls: true,
    fog: 0.22,
    particle: { count: 220, color: 'rgba(232,238,242,0.95)', speed: 0.12, drift: 0.16, size: 1.6, opacity: 0.75 },
  },
}

export function resolveTheme(): ThemeId {
  const fromUrl = new URLSearchParams(location.search).get('theme')
  if (fromUrl === 'clear' || fromUrl === 'rain' || fromUrl === 'dusk' || fromUrl === 'snow') return fromUrl

  try {
    const stored = sessionStorage.getItem('sy-theme')
    if (stored === 'clear' || stored === 'rain' || stored === 'dusk' || stored === 'snow') return stored
  } catch {
    /* 隐私模式下不可用 */
  }

  let hour = new Date().getHours()
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        hour12: false,
      }).format(new Date()),
    )
  } catch {
    /* 回退本地时间 */
  }

  const daylight = hour >= 6 && hour < 18
  const theme: ThemeId = daylight ? (Math.random() < 0.5 ? 'clear' : 'rain') : Math.random() < 0.5 ? 'dusk' : 'snow'

  try {
    sessionStorage.setItem('sy-theme', theme)
  } catch {
    /* ignore */
  }
  return theme
}
