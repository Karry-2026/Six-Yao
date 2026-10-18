import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { read, type Yao } from '../lib/hexagram'
import { ambient } from '../lib/ambient'

type ThemeId = 'clear' | 'rain' | 'dusk' | 'snow'

interface ThemeConfig {
  label: string
  daylight: boolean
  sky: [string, string, string]
  fog: string
  fogDensity: number
  ground: string
  wall: string
  roof: string
  path: string
  ambient: string
  sunColor: number
  lantern: number
  bloom: number
  exposure: number
  hemi: number
  sun: number
  env: number
  particles: {
    count: number
    color: number
    size: number
    speed: number
    drift: number
    opacity: number
    falls: boolean
  }
}

const THEMES: Record<ThemeId, ThemeConfig> = {
  clear: {
    label: '晴昼',
    daylight: true,
    sky: ['#8fb4cf', '#c3d9e6', '#eadfc8'],
    fog: '#c9d7de',
    fogDensity: 0.016,
    ground: '#6f6a5e',
    wall: '#c9bda4',
    roof: '#3d4245',
    path: '#a89e8b',
    ambient: '#cfe0ea',
    sunColor: 0xfff1d6,
    lantern: 0xd9a24a,
    bloom: 0.28,
    exposure: 1.2,
    hemi: 1.3,
    sun: 2.6,
    env: 0.9,
    particles: { count: 420, color: 0xffffff, size: 0.01, speed: 0.05, drift: 0.22, opacity: 0.3, falls: false },
  },
  rain: {
    label: '烟雨',
    daylight: true,
    sky: ['#74878f', '#9aabb1', '#c2cccb'],
    fog: '#aeb9bb',
    fogDensity: 0.03,
    ground: '#5e6466',
    wall: '#b8b3a4',
    roof: '#2f3437',
    path: '#767b7c',
    ambient: '#b9c7cc',
    sunColor: 0xdfe9ee,
    lantern: 0xd9a24a,
    bloom: 0.4,
    exposure: 1.1,
    hemi: 0.6,
    sun: 0.9,
    env: 0.65,
    particles: { count: 1600, color: 0xaebfc7, size: 0.011, speed: 0.95, drift: 0.02, opacity: 0.5, falls: true },
  },
  dusk: {
    label: '暮夜',
    daylight: false,
    sky: ['#101f2e', '#2f4457', '#8a6646'],
    fog: '#3a4a58',
    fogDensity: 0.026,
    ground: '#2b3034',
    wall: '#8f8574',
    roof: '#1b1f22',
    path: '#3c4144',
    ambient: '#6b7d8c',
    sunColor: 0xffcf94,
    lantern: 0xd4a853,
    bloom: 0.8,
    exposure: 1.1,
    hemi: 0.55,
    sun: 0.15,
    env: 0.05,
    particles: { count: 900, color: 0xd8cba8, size: 0.022, speed: 0.06, drift: 0.12, opacity: 0.6, falls: false },
  },
  snow: {
    label: '雪夜',
    daylight: false,
    sky: ['#223342', '#3f5568', '#7f95a6'],
    fog: '#5b6d7b',
    fogDensity: 0.024,
    ground: '#5f696f',
    wall: '#8d8f8a',
    roof: '#242b30',
    path: '#6c7478',
    ambient: '#8096a6',
    sunColor: 0xdbe8f2,
    lantern: 0xd4a853,
    bloom: 0.7,
    exposure: 1.05,
    hemi: 0.4,
    sun: 0.25,
    env: 0.12,
    particles: { count: 1200, color: 0xe8eef2, size: 0.03, speed: 0.12, drift: 0.16, opacity: 0.72, falls: true },
  },
}

function resolveTheme(): ThemeId {
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
  const theme: ThemeId = daylight
    ? Math.random() < 0.5
      ? 'clear'
      : 'rain'
    : Math.random() < 0.5
      ? 'dusk'
      : 'snow'

  try {
    sessionStorage.setItem('sy-theme', theme)
  } catch {
    /* ignore */
  }
  return theme
}

function qualityTier(): 'high' | 'medium' | 'low' {
  const cores = navigator.hardwareConcurrency ?? 4
  const width = window.innerWidth
  if (width < 640 || cores <= 4) return 'low'
  if (width < 1280 || cores <= 8) return 'medium'
  return 'high'
}

function makeSkyTexture([top, mid, bottom]: [string, string, string]): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, top)
  gradient.addColorStop(0.58, mid)
  gradient.addColorStop(1, bottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 2, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeGlowTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,224,170,0.95)')
  gradient.addColorStop(0.25, 'rgba(255,200,130,0.4)')
  gradient.addColorStop(1, 'rgba(255,180,90,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

function makeGroundTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  // 中性灰，靠材质 color 着色，白天/夜晚共用
  ctx.fillStyle = '#b8b4ac'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 2600; i++) {
    const shade = 150 + Math.random() * 40
    ctx.fillStyle = `rgba(${shade},${shade - 2},${shade - 8},0.45)`
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.6, 1.6)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(6, 6)
  return texture
}

function makeLeafTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  const gradient = ctx.createLinearGradient(32, 4, 32, 60)
  gradient.addColorStop(0, 'rgba(40,70,40,0)')
  gradient.addColorStop(0.35, 'rgba(52,86,48,0.95)')
  gradient.addColorStop(1, 'rgba(30,52,30,0.95)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(32, 2)
  ctx.quadraticCurveTo(54, 30, 32, 62)
  ctx.quadraticCurveTo(10, 30, 32, 2)
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeRoofTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#2a2e31'
  ctx.fillRect(0, 0, size, size)
  for (let x = 0; x < size; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(x, 0, 2, size)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(x + 2, 0, 2, size)
  }
  for (let y = 0; y < size; y += 24) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(0, y, size, 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(5, 3)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeBeyondTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 74, 4, 64, 74, 78)
  g.addColorStop(0, '#f0d7a6')
  g.addColorStop(0.35, '#a98a5e')
  g.addColorStop(1, '#2a2119')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

let disposeCurrent: (() => void) | null = null

export function boot(): void {
  performance.mark('scene:boot')
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null
  if (!canvas) return

  let webgl2 = false
  try {
    webgl2 = !!document.createElement('canvas').getContext('webgl2')
  } catch {
    webgl2 = false
  }
  if (!webgl2) {
    document.body.classList.add('no-webgl')
    return
  }

  try {
    disposeCurrent?.()
    disposeCurrent = start(canvas)
  } catch (error) {
    console.warn('[six-yao] 3D 初始化失败，回退到静态海报', error)
    document.body.classList.add('no-webgl')
    canvas.remove()
  }
}

function makeInkMaterial(theme: ThemeConfig, paper: string, ink: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInk: { value: new THREE.Color(ink) },
      uPaper: { value: new THREE.Color(paper) },
      uFog: { value: new THREE.Color(theme.fog) },
      uFogDensity: { value: theme.fogDensity },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vW = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vN;
      varying vec3 vW;
      uniform vec3 uInk;
      uniform vec3 uPaper;
      uniform vec3 uFog;
      uniform float uFogDensity;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 L = normalize(vec3(-0.35, 0.85, 0.4));
        float lam = max(dot(N, L), 0.0);
        lam = clamp(lam, 0.0, 1.0);
        float q = floor(lam * 5.0) / 4.0;
        vec3 col = mix(uInk, uPaper, q);
        float rim = 1.0 - max(dot(N, V), 0.0);
        col = mix(col, uInk, smoothstep(0.45, 0.95, rim) * 0.85);
        float wash = noise(vW.xz * 1.6 + vec2(vW.y * 1.2, 0.0));
        col *= 0.9 + 0.1 * wash;
        col *= 0.97 + 0.03 * noise(vW.xz * 30.0);
        float d = length(vW - cameraPosition);
        float fog = 1.0 - exp(-pow(d * uFogDensity, 2.0));
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
      }
    `,
    fog: false,
  })
}

function makeMountainMaterial(theme: ThemeConfig): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLow: { value: new THREE.Color(0x2f5d4a) },
      uHigh: { value: new THREE.Color(0x33566b) },
      uInk: { value: new THREE.Color(0x1b1a17) },
      uGold: { value: new THREE.Color(0xc9a227) },
      uFog: { value: new THREE.Color(theme.fog) },
      uFogDensity: { value: theme.fogDensity * 0.5 },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vW = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vN;
      varying vec3 vW;
      uniform vec3 uLow;
      uniform vec3 uHigh;
      uniform vec3 uInk;
      uniform vec3 uGold;
      uniform vec3 uFog;
      uniform float uFogDensity;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 L = normalize(vec3(-0.35, 0.85, 0.4));
        float lam = max(dot(N, L), 0.0);
        float alt = clamp((vW.y - 0.2) / 4.2, 0.0, 1.0);
        alt = smoothstep(0.05, 0.95, alt);
        vec3 col = mix(uLow, uHigh, alt);
        col = mix(col * 0.78, col, 0.35 + lam * 0.65);
        float rim = 1.0 - max(dot(N, V), 0.0);
        col = mix(col, uInk, smoothstep(0.55, 0.98, rim) * 0.6);
        float ridge = smoothstep(0.7, 0.98, lam) * smoothstep(0.3, 0.85, alt);
        col = mix(col, uGold, ridge * 0.35);
        float d = length(vW - cameraPosition);
        float fog = 1.0 - exp(-pow(d * uFogDensity, 2.0));
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
      }
    `,
    fog: false,
  })
}
function makeRidgeGeometry(width: number, height: number, seed: number): THREE.BufferGeometry {
  const segs = 56
  const positions: number[] = []
  const alts: number[] = []
  const ridgeY = (t: number) => {
    const a = Math.sin(t * 9.0 + seed) * 0.34 + Math.sin(t * 21.0 + seed * 2.0) * 0.16 + Math.sin(t * 4.2 + seed * 3.0) * 0.3
    return height * (0.62 + a * 0.34)
  }
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs
    const t1 = (i + 1) / segs
    const x0 = (t0 - 0.5) * width
    const x1 = (t1 - 0.5) * width
    const y0 = ridgeY(t0)
    const y1 = ridgeY(t1)
    positions.push(x0, 0, 0, x1, 0, 0, x1, y1, 0)
    alts.push(0, 0, y1 / height)
    positions.push(x0, 0, 0, x1, y1, 0, x0, y0, 0)
    alts.push(0, y1 / height, y0 / height)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aAlt', new THREE.Float32BufferAttribute(alts, 1))
  return geometry
}

function makeRidgeMaterial(theme: ThemeConfig): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLow: { value: new THREE.Color(0x3a6b52) },
      uHigh: { value: new THREE.Color(0x4a6f86) },
      uGold: { value: new THREE.Color(0xd8b24a) },
      uFog: { value: new THREE.Color(theme.fog) },
      uFogDensity: { value: theme.fogDensity * 0.55 },
    },
    vertexShader: `
      attribute float aAlt;
      varying float vAlt;
      varying vec3 vW;
      void main() {
        vAlt = aAlt;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vW = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying float vAlt;
      varying vec3 vW;
      uniform vec3 uLow;
      uniform vec3 uHigh;
      uniform vec3 uGold;
      uniform vec3 uFog;
      uniform float uFogDensity;
      void main() {
        float alt = smoothstep(0.05, 0.95, vAlt);
        vec3 col = mix(uLow, uHigh, alt);
        col = mix(col * 0.82, col, 0.45 + alt * 0.55);
        col = mix(col, uGold, smoothstep(0.88, 1.0, vAlt) * 0.5);
        float d = length(vW - cameraPosition);
        float fog = 1.0 - exp(-pow(d * uFogDensity, 2.0));
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
      }
    `,
    transparent: true,
    fog: false,
  })
}
function start(canvas: HTMLCanvasElement): () => void {
  const themeId = resolveTheme()
  const theme = THEMES[themeId]
  const tier = qualityTier()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: tier !== 'low',
    powerPreference: 'high-performance',
  })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = theme.exposure
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const targetPixelRatio = Math.min(window.devicePixelRatio || 1, tier === 'high' ? 2 : tier === 'medium' ? 1.6 : 1.2)
  renderer.setPixelRatio(Math.min(targetPixelRatio, 1))

  const scene = new THREE.Scene()
  scene.background = makeSkyTexture(theme.sky)
  scene.fog = new THREE.FogExp2(new THREE.Color(theme.fog), theme.fogDensity)

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 160)
  const FINAL_POS = new THREE.Vector3(0, 1.95, 5.75)
  const LOOK_AT = new THREE.Vector3(0, 1.05, 1.5)
  camera.position.copy(FINAL_POS)
  camera.lookAt(LOOK_AT)

  // ---------- 地面 ----------
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: theme.ground,
    map: makeGroundTexture(),
    roughness: 0.95,
    metalness: 0,
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), groundMaterial)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // ---------- 墙体（真实开洞） ----------
  const wallShape = new THREE.Shape()
  wallShape.moveTo(-5.5, 0)
  wallShape.lineTo(5.5, 0)
  wallShape.lineTo(5.5, 3.6)
  wallShape.lineTo(-5.5, 3.6)
  wallShape.lineTo(-5.5, 0)
  const hole = new THREE.Path()
  hole.absarc(0, 1.85, 1.12, 0, Math.PI * 2, true)
  wallShape.holes.push(hole)
  const wallMaterial = makeInkMaterial(theme, theme.wall, theme.daylight ? '#2a2620' : '#141210')
  const wall = new THREE.Mesh(
    new THREE.ExtrudeGeometry(wallShape, { depth: 0.22, bevelEnabled: false, curveSegments: 48 }),
    wallMaterial,
  )
  wall.position.set(0, 0, -3.6)
  scene.add(wall)

  // 墙基与压顶
  const plinthMaterial = new THREE.MeshStandardMaterial({ color: theme.daylight ? '#8d8578' : '#3a3a37', roughness: 0.95 })
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.46, 0.42), plinthMaterial)
  plinth.position.set(0, 0.23, -3.62)
  scene.add(plinth)
  const cap = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.16, 0.5), plinthMaterial)
  cap.position.set(0, 3.68, -3.62)
  scene.add(cap)

  // 窗棂
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4136, roughness: 0.75 })
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.9 })
  for (const cx of [-3.45, 3.45]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.24, 0.06), panelMaterial)
    panel.position.set(cx, 2.0, -3.47)
    scene.add(panel)
    for (let i = 0; i < 4; i++) {
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.25, 0.1), woodMaterial)
      vBar.position.set(cx - 0.42 + i * 0.28, 2.0, -3.44)
      scene.add(vBar)
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.035, 0.1), woodMaterial)
      hBar.position.set(cx, 1.52 + i * 0.32, -3.44)
      scene.add(hBar)
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.07, 0.14), woodMaterial)
    top.position.set(cx, 2.62, -3.44)
    scene.add(top)
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.09, 0.14), woodMaterial)
    bottom.position.set(cx, 1.4, -3.44)
    scene.add(bottom)
  }

  // 石径（逐块石板）
  // 院中散石与矮丛
  const rockMaterial = new THREE.MeshStandardMaterial({ color: theme.daylight ? '#7d776a' : '#3a3a35', roughness: 1 })
  for (const [x, z, s] of [[-3.4, -1.2, 0.34], [-2.6, 0.4, 0.22], [3.3, -1.6, 0.3], [2.7, 0.8, 0.2]] as const) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMaterial)
    rock.position.set(x, s * 0.5, z)
    rock.rotation.set(Math.random(), Math.random(), Math.random())
    rock.scale.set(1, 0.7, 0.9)
    scene.add(rock)
  }
  const shrubMaterial = new THREE.MeshStandardMaterial({ color: 0x24301f, roughness: 1 })
  for (const [x, z, s] of [[-4.1, -2.2, 0.42], [4.0, -2.4, 0.38]] as const) {
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), shrubMaterial)
    shrub.position.set(x, s * 0.8, z)
    shrub.scale.set(1, 0.8, 1)
    scene.add(shrub)
  }

  // 门后：三层青绿山脊剪影（近深远浅，海拔分色 + 山脊金线）
  const ridgeSpecs: [number, number, number, number][] = [
    [-0.4, -8.5, 15, 1.9],
    [0.8, -12.0, 22, 2.6],
    [-1.2, -17.0, 32, 3.6],
  ]
  for (const [x, z, w, h] of ridgeSpecs) {
    const ridge = new THREE.Mesh(makeRidgeGeometry(w, h, Math.abs(z)), makeRidgeMaterial(theme))
    ridge.position.set(x, 0.35, z)
    scene.add(ridge)
  }

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 13),
    new THREE.MeshBasicMaterial({ color: theme.daylight ? 0xd4e2e6 : 0x2c3d4a, transparent: true, opacity: 0.16 }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(0, 0.01, -10.5)
  scene.add(water)

  const beyondLight = new THREE.PointLight(0xffe3b0, theme.daylight ? 5 : 4.5, 26, 2)
  beyondLight.position.set(0, 3.4, -13)
  scene.add(beyondLight)

  // 檐口与屋顶
  const roofMaterial = new THREE.MeshStandardMaterial({ color: theme.roof, roughness: 0.9 })
  const eave = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.18, 1.5), roofMaterial)
  eave.position.set(0, 3.68, -3.6)
  scene.add(eave)
  const roofTexture = makeRoofTexture()
  const roofMaterial2 = new THREE.MeshStandardMaterial({ color: theme.roof, map: roofTexture, roughness: 0.85 })
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(11.9, 3.0), roofMaterial2)
  roof.position.set(0, 4.28, -4.34)
  roof.rotation.x = -0.62
  scene.add(roof)

  const ridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(12.0, 0.24, 0.34),
    new THREE.MeshStandardMaterial({ color: theme.roof, roughness: 0.8 }),
  )
  ridgeBeam.position.set(0, 5.0, -5.55)
  scene.add(ridgeBeam)



  // 两侧院墙
  const sideWallMaterial = makeInkMaterial(theme, theme.wall, theme.daylight ? '#2a2620' : '#141210')
  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 7.4), sideWallMaterial)
    sideWall.position.set(side * 5.55, 1.8, -0.3)
    scene.add(sideWall)
  }

  // 石径
  const pathMaterial = new THREE.MeshStandardMaterial({ color: theme.path, roughness: 0.9, metalness: 0 })
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 8), pathMaterial)
  path.rotation.x = -Math.PI / 2
  path.position.set(0, 0.012, 0.4)
  scene.add(path)

  // 墙脚阴影
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 1.1),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: theme.daylight ? 0.18 : 0.32, depthWrite: false }),
  )
  contactShadow.rotation.x = -Math.PI / 2
  contactShadow.position.set(0, 0.02, -3.45)
  scene.add(contactShadow)

  // ---------- CC0 PBR 贴图（Poly Haven，见 docs/ASSETS.md） ----------
  const textureLoader = new THREE.TextureLoader()
  const base = import.meta.env.BASE_URL.endsWith('/' ) ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  const loadMap = (path: string, srgb: boolean, repeatX: number, repeatY: number) => {
    const texture = textureLoader.load(`${base}textures/${path}`)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    return texture
  }



  pathMaterial.map = loadMap('stone_floor/stone_floor_diff_1k.webp', true, 2, 5)
  pathMaterial.normalMap = loadMap('stone_floor/stone_floor_nor_gl_1k.webp', false, 2, 5)
  pathMaterial.roughnessMap = loadMap('stone_floor/stone_floor_rough_1k.webp', false, 2, 5)
  pathMaterial.color.set(theme.daylight ? '#e2dccd' : '#7a7a74')
  pathMaterial.needsUpdate = true

  // 石桌在贴图段之后才声明，延后一拍再贴材质，避免 TDZ
  window.setTimeout(() => {
    altarMaterial.map = loadMap('stone_floor/stone_floor_diff_1k.webp', true, 2, 1.4)
    altarMaterial.normalMap = loadMap('stone_floor/stone_floor_nor_gl_1k.webp', false, 2, 1.4)
    altarMaterial.roughnessMap = loadMap('stone_floor/stone_floor_rough_1k.webp', false, 2, 1.4)
    altarMaterial.color.set(theme.daylight ? '#b9ae98' : '#8a8478')
    altarMaterial.needsUpdate = true
    performance.mark('textures:assigned')
  }, 0)

  // ---------- 石阶 ----------
  const stepMaterial = new THREE.MeshStandardMaterial({ color: theme.path, roughness: 0.9 })
  for (let i = 0; i < 2; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(3.0 + i * 0.4, 0.09, 0.32), stepMaterial)
    step.position.set(0, 0.045 + i * 0.09, -3.2 + i * 0.32)
    scene.add(step)
  }

  // ---------- 筒瓦：沿坡向的圆瓦垄 ----------
  const slopeDir = new THREE.Vector3(0, 1.26, -2.6).normalize()
  const tileQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), slopeDir)
  const tileGeometry = new THREE.CylinderGeometry(0.072, 0.072, 2.92, 9, 1, false)
  const tileMaterial = new THREE.MeshStandardMaterial({ color: theme.roof, roughness: 0.78 })
  const tileCount = 64
  const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, tileCount)
  const tileDummy = new THREE.Object3D()
  for (let i = 0; i < tileCount; i++) {
    tileDummy.position.set(-5.72 + (i * 11.44) / (tileCount - 1), 4.36, -4.25)
    tileDummy.quaternion.copy(tileQuat)
    tileDummy.updateMatrix()
    tiles.setMatrixAt(i, tileDummy.matrix)
  }
  scene.add(tiles)

  // ---------- 石桌 · 铜钱 · 卦爻 ----------
  const altarMaterial = new THREE.MeshStandardMaterial({ color: theme.daylight ? '#8b8170' : '#3c372f', roughness: 0.92 })
  const tableWood = new THREE.MeshStandardMaterial({ color: 0x3d3024, roughness: 0.78 })
  const altar = new THREE.Group()
  const tableTop = new THREE.Mesh(new RoundedBoxGeometry(1.98, 0.1, 1.28, 3, 0.018), altarMaterial)
  tableTop.position.y = 0.65
  altar.add(tableTop)
  const apron = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.16, 1.16), tableWood)
  apron.position.y = 0.52
  altar.add(apron)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.13), tableWood)
      leg.position.set(sx * 0.8, 0.22, sz * 0.47)
      altar.add(leg)
    }
  }
  for (const sz of [-1, 1]) {
    const stretcher = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.07, 0.08), tableWood)
    stretcher.position.set(0, 0.14, sz * 0.47)
    altar.add(stretcher)
  }
  altar.position.set(0, 0, 2.45)
  scene.add(altar)

  const tableLight = new THREE.PointLight(0xffd9a0, theme.daylight ? 3.2 : 6.5, 5.5, 2)
  tableLight.position.set(0, 1.55, 2.45)
  scene.add(tableLight)
  const ALTAR_TOP = 0.7

  const coinBaseMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.8, roughness: 0.35, emissive: 0x1a1206 })
  const coins: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.028, 24), coinBaseMaterial.clone())
    coin.rotation.y = Math.random() * Math.PI
    coin.visible = false
    scene.add(coin)
    coins.push(coin)
  }

  const censerMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4a2e, metalness: 0.7, roughness: 0.45 })
  const censer = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.09, 20), censerMaterial)
  censer.position.set(-0.72, ALTAR_TOP + 0.045, 2.78)
  scene.add(censer)
  const censerRim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24), censerMaterial)
  censerRim.rotation.x = Math.PI / 2
  censerRim.position.set(-0.72, ALTAR_TOP + 0.09, 2.78)
  scene.add(censerRim)
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd4642a }))
  ember.position.set(-0.72, ALTAR_TOP + 0.085, 2.78)
  scene.add(ember)
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), censerMaterial)
    const angle = (i / 3) * Math.PI * 2
    leg.position.set(-0.72 + Math.cos(angle) * 0.07, ALTAR_TOP + 0.005, 2.78 + Math.sin(angle) * 0.07)
    scene.add(leg)
  }
  const emberLight = new THREE.PointLight(0xff8a3d, 1.6, 1.1, 2)
  emberLight.position.set(-0.72, ALTAR_TOP + 0.12, 2.78)
  scene.add(emberLight)

  const lineGroup = new THREE.Group()
  lineGroup.position.set(0, ALTAR_TOP + 0.06, 2.4)
  scene.add(lineGroup)
  const lineSlots: THREE.Group[] = []
  const buildSlots = () => {
    for (const slot of lineSlots) lineGroup.remove(slot)
    lineSlots.length = 0
    for (let i = 0; i < 6; i++) {
      const slot = new THREE.Group()
      slot.position.z = 0.23 - i * 0.092
      lineGroup.add(slot)
      lineSlots.push(slot)
    }
  }
  buildSlots()

  // ---------- 灯笼 ----------
  const glowTexture = makeGlowTexture()
  const lanternMaterial = new THREE.MeshStandardMaterial({
    color: theme.lantern,
    emissive: theme.lantern,
    emissiveIntensity: theme.daylight ? 0.6 : 2.2,
    roughness: 0.5,
  })
  const glows: THREE.Sprite[] = []
  for (const [x, y, z] of [
    [-2.2, 2.35, -2.9],
    [2.2, 2.05, -2.7],
  ] as const) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), lanternMaterial)
    lantern.position.set(x, y, z)
    scene.add(lantern)

    if (!theme.daylight) {
      const light = new THREE.PointLight(theme.lantern, 7, 8, 2)
      light.position.set(x, y, z)
      scene.add(light)

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: theme.lantern,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.85,
        }),
      )
      glow.position.set(x, y, z)
      glow.scale.set(1.5, 1.5, 1)
      scene.add(glow)
      glows.push(glow)
    }

    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.0035, 3.6 - y, 4),
      new THREE.MeshBasicMaterial({ color: theme.roof }),
    )
    string.position.set(x, (3.6 + y) / 2, z)
    scene.add(string)
  }

  // ---------- 竹影 ----------
  const bambooCount = tier === 'low' ? 26 : 44
  const bambooGeometry = new THREE.CylinderGeometry(0.012, 0.022, 3.6, 5)
  const bambooMaterial = new THREE.MeshStandardMaterial({ color: 0x24301f, roughness: 1 })
  const bamboo = new THREE.InstancedMesh(bambooGeometry, bambooMaterial, bambooCount)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < bambooCount; i++) {
    const side = i % 2 === 0 ? -1 : 1
    dummy.position.set(side * (2.4 + Math.random() * 1.5), 1.8, -4.8 + Math.random() * 5.4)
    dummy.rotation.z = (Math.random() - 0.5) * 0.16
    dummy.rotation.y = Math.random() * Math.PI
    dummy.scale.setScalar(0.8 + Math.random() * 0.5)
    dummy.updateMatrix()
    bamboo.setMatrixAt(i, dummy.matrix)
  }
  scene.add(bamboo)

  // 竹叶
  const leafTexture = makeLeafTexture()
  const leafGeometry = new THREE.PlaneGeometry(0.2, 0.62)
  const leafMaterial = new THREE.MeshStandardMaterial({
    map: leafTexture,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.9,
  })
  const leafCount = tier === 'low' ? 140 : 260
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafCount)
  const leafDummy = new THREE.Object3D()
  for (let i = 0; i < leafCount; i++) {
    const side = i % 2 === 0 ? -1 : 1
    leafDummy.position.set(
      side * (2.2 + Math.random() * 1.9),
      1.6 + Math.random() * 2.1,
      -4.8 + Math.random() * 5.4,
    )
    leafDummy.rotation.set(
      (Math.random() - 0.5) * 1.2,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.9,
    )
    const s = 0.7 + Math.random() * 0.8
    leafDummy.scale.set(s, s, s)
    leafDummy.updateMatrix()
    leaves.setMatrixAt(i, leafDummy.matrix)
  }
  scene.add(leaves)

  // ---------- 粒子 ----------
  const particleCount = Math.round(
    theme.particles.count * (tier === 'low' ? 0.4 : tier === 'medium' ? 0.75 : 1),
  )
  const positions = new Float32Array(particleCount * 3)
  const phases = new Float32Array(particleCount)
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 7
    positions[i * 3 + 1] = theme.particles.falls ? Math.random() * 4.4 : Math.random() * 3.6
    positions[i * 3 + 2] = -4.2 + Math.random() * 6
    phases[i] = Math.random() * Math.PI * 2
  }
  const particleGeometry = new THREE.BufferGeometry()
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: theme.particles.color,
      size: theme.particles.size,
      transparent: true,
      opacity: theme.particles.opacity,
      depthWrite: false,
      blending: theme.daylight ? THREE.NormalBlending : THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  )
  scene.add(particles)

  // ---------- 光 ----------
  scene.add(new THREE.HemisphereLight(new THREE.Color(theme.ambient), 0x14181a, theme.hemi))
  const sunLight = new THREE.DirectionalLight(theme.sunColor, theme.sun)
  sunLight.position.set(-4, 8, 4)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(2048, 2048)
  sunLight.shadow.camera.left = -9
  sunLight.shadow.camera.right = 9
  sunLight.shadow.camera.top = 9
  sunLight.shadow.camera.bottom = -9
  sunLight.shadow.camera.near = 0.5
  sunLight.shadow.camera.far = 40
  sunLight.shadow.bias = -0.0004
  scene.add(sunLight)

  // ---------- 环境贴图（CC0 HDRI，仅中高档异步加载） ----------
  if (tier !== 'low' && theme.env > 0) {
    const pmrem = new THREE.PMREMGenerator(renderer)
    const loadEnv = () => new RGBELoader()
      .loadAsync(`${base}env/courtyard_1k.hdr`)
      .then((texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping
        scene.environment = pmrem.fromEquirectangular(texture).texture
        scene.environmentIntensity = theme.env
        performance.mark('env:loaded')
        texture.dispose()
      })
      .catch((error) => console.warn('[six-yao] 环境贴图加载失败，使用灯光兜底', error))
      .finally(() => pmrem.dispose())
    window.setTimeout(loadEnv, 1600)
  }

  // ---------- 后处理 ----------
  let composer: EffectComposer | null = null
  if (tier !== 'low') {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), theme.bloom, 0.35, 0.92))
  }

  // ---------- 开场镜头 ----------
  const introSeen = (() => {
    try {
      return sessionStorage.getItem('sy-intro') === '1'
    } catch {
      return false
    }
  })()
  const introDuration = 4
  const introCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.3, 2.7, 12.2),
    new THREE.Vector3(0.7, 2.45, 9.2),
    new THREE.Vector3(0.3, 2.15, 7.0),
    FINAL_POS,
  ])
  const skipIntro = new URLSearchParams(location.search).get('intro') === '0'
  let introActive = !introSeen && !reduceMotion && !skipIntro
  const introLook = new THREE.Vector3(0, 2.1, -3.6)
  if (introActive) {
    try {
      sessionStorage.setItem('sy-intro', '1')
    } catch {
      /* ignore */
    }
  }

  let introK = 0
  const cancelIntro = () => {
    if (!introActive) return
    introActive = false
    camera.position.copy(FINAL_POS)
    camera.lookAt(LOOK_AT)
  }
  window.addEventListener('pointerdown', cancelIntro, { once: true })
  window.addEventListener('keydown', cancelIntro, { once: true })

  // 所有实体参与投影与接收
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if ((mesh as THREE.Mesh).isMesh) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })
  ground.receiveShadow = true
  contactShadow.castShadow = false
  contactShadow.receiveShadow = false

  // ---------- 循环 ----------
  const clock = new THREE.Clock()
  let raf = 0
  let paused = false
  const coinAnim = { active: false, start: 0, faces: [false, false, false] }

  function resize() {
    const width = window.innerWidth
    const height = window.innerHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    composer?.setSize(width, height)
  }
  window.addEventListener('resize', resize)
  resize()

  function frame() {
    raf = requestAnimationFrame(frame)
    if (paused) return

    const t = clock.getElapsedTime()

    if (introActive) {
      const k = Math.min(t / introDuration, 1)
      introK = k
      const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      camera.position.copy(introCurve.getPoint(eased))
      const look = new THREE.Vector3().lerpVectors(introLook, LOOK_AT, Math.min(k * 1.6, 1))
      camera.lookAt(look)
      if (k >= 1) introActive = false
    } else if (!reduceMotion) {
      camera.position.x = FINAL_POS.x + Math.sin(t * 0.22) * 0.045
      camera.position.y = FINAL_POS.y + Math.sin(t * 0.17) * 0.018
      camera.lookAt(LOOK_AT)
    }

    const attr = particleGeometry.getAttribute('position') as THREE.BufferAttribute
    const array = attr.array as Float32Array
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3 + 1
      if (theme.particles.falls) {
        array[idx] -= theme.particles.speed * 0.016
        if (array[idx] < 0) array[idx] = 4.4
      } else {
        array[idx] += theme.particles.speed * 0.016
        if (array[idx] > 3.8) array[idx] = 0
        array[i * 3] += Math.sin(t * 0.6 + phases[i]) * theme.particles.drift * 0.002
      }
    }
    attr.needsUpdate = true

    if (!theme.daylight) {
      lanternMaterial.emissiveIntensity = 2.1 + Math.sin(t * 1.3) * 0.3
      for (const glow of glows) {
        const s = 1.45 + Math.sin(t * 1.3) * 0.06
        glow.scale.set(s, s, 1)
      }
    }

    if (coinAnim.active) {
      const p = Math.min((performance.now() - coinAnim.start) / 900, 1)
      const e = 1 - Math.pow(1 - p, 3)
      coins.forEach((coin, i) => {
        coin.position.set(-0.36 + i * 0.36, THREE.MathUtils.lerp(ALTAR_TOP + 1.25, ALTAR_TOP + 0.035, e), 2.9)
        coin.rotation.y = p * 6 + i * 1.7
      })
      if (p >= 1) {
        coinAnim.active = false
        coins.forEach((coin, i) => {
          const material = coin.material as THREE.MeshStandardMaterial
          material.color.set(coinAnim.faces[i] ? 0xe8c46a : 0x6a5636)
          material.emissive.set(coinAnim.faces[i] ? 0x3a2a0a : 0x14100a)
        })
      }
    }

    if (composer) composer.render()
    else renderer.render(scene, camera)

    if (!document.body.classList.contains('ready')) {
      document.body.classList.add('ready')
      performance.mark('scene:first-frame')
    }
  }

  // ---------- 起卦流程 ----------
  const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
  const ritualBtn = document.getElementById('ritualBtn')
  const resultCard = document.getElementById('result')

  const revealLine = (index: number, yang: boolean, moving: boolean) => {
    const slot = lineSlots[index]
    const material = new THREE.MeshBasicMaterial({ color: moving ? 0xb8432f : 0x1f1c18 })
    const bars: THREE.Mesh[] = []
    if (yang) {
      bars.push(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.04), material))
    } else {
      for (const dx of [-0.27, 0.27]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.012, 0.04), material)
        bar.position.x = dx
        bars.push(bar)
      }
    }
    bars.forEach((bar) => slot.add(bar))
    const t0 = performance.now()
    const step = () => {
      const p = Math.min((performance.now() - t0) / 420, 1)
      bars.forEach((bar) => { bar.scale.x = 0.82 + 0.18 * p })
      if (p < 1) requestAnimationFrame(step)
    }
    step()
  }

  const facesForValue = (value: number) => {
    const heads = value - 6
    const faces = [heads >= 1, heads >= 2, heads >= 3]
    return faces.sort(() => Math.random() - 0.5)
  }

  const tossRound = (forced?: boolean[]) =>
    new Promise<boolean[]>((resolve) => {
      const faces = forced ?? [Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5]
      coinAnim.faces = faces
      coinAnim.start = performance.now()
      coinAnim.active = true
      coins.forEach((coin, i) => {
        coin.visible = true
        coin.position.set(-0.36 + i * 0.36, ALTAR_TOP + 1.25, 2.9)
      })
      window.setTimeout(() => resolve(faces), 950)
    })

  let ritualBusy = false
  const startRitual = async () => {
    if (ritualBusy) return
    ritualBusy = true
    buildSlots()
    coins.forEach((coin) => { coin.visible = false })
    resultCard?.classList.remove('open')
    if (ritualBtn) ritualBtn.style.display = 'none'

    ambient.enable()
    ambient.bell('start')

    const forcedRaw = new URLSearchParams(location.search).get('values')
    const forcedValues = forcedRaw
      ? forcedRaw.split(',').map((v) => Number(v.trim())).filter((v) => v >= 6 && v <= 9)
      : []
    const useForced = forcedValues.length === 6

    const values: Yao[] = []
    for (let i = 0; i < 6; i++) {
      const faces = await tossRound(useForced ? facesForValue(forcedValues[i]) : undefined)
      const heads = faces.filter(Boolean).length
      const value = (6 + heads) as Yao
      values.push(value)
      revealLine(i, value === 7 || value === 9, value === 6 || value === 9)
      await sleep(560)
    }


    const reading = read(values)
    const numberEl = document.getElementById('resultNumber')
    const nameEl = document.getElementById('resultName')
    const pinyinEl = document.getElementById('resultPinyin')
    const judgmentEl = document.getElementById('resultJudgment')
    const interpEl = document.getElementById('resultInterp')
    if (numberEl) numberEl.textContent = String(reading.primaryHex.number)
    if (nameEl) nameEl.textContent = reading.primaryHex.name
    const sealEl = document.getElementById('resultSeal')
    if (sealEl) sealEl.textContent = reading.primaryHex.name.slice(-1)
    if (pinyinEl) pinyinEl.textContent = reading.primaryHex.pinyin
    if (judgmentEl) judgmentEl.textContent = reading.primaryHex.judgment
    if (interpEl) interpEl.textContent = reading.primaryHex.interpretation

    const positions = ['初', '二', '三', '四', '五', '上']
    const yaoLabel = (index: number, yang: boolean) => {
      if (index === 0) return yang ? '初九' : '初六'
      if (index === 5) return yang ? '上九' : '上六'
      return (yang ? '九' : '六') + positions[index]
    }
    const glyphEl = document.getElementById('resultGlyph')
    if (glyphEl) {
      glyphEl.innerHTML = ''
      for (let i = 5; i >= 0; i--) {
        const row = document.createElement('div')
        row.className = 'glyph-row' + (reading.moving.includes(i) ? ' moving' : '')
        const bars = reading.primary[i] === 1 ? 1 : 2
        for (let b = 0; b < bars; b++) {
          const bar = document.createElement('div')
          bar.className = 'glyph-bar'
          row.appendChild(bar)
        }
        glyphEl.appendChild(row)
      }
    }

    const hexesEl = document.getElementById('resultHexes')
    const movingEl = document.getElementById('resultMoving')
    if (hexesEl) {
      hexesEl.textContent = `本卦 ${reading.primaryHex.name} · 互卦 ${reading.mutualHex.name}` +
        (reading.changedHex ? ` · 变卦 ${reading.changedHex.name}` : '')
    }
    if (movingEl) {
      movingEl.textContent = reading.moving.length
        ? `动爻：${reading.moving.map((index) => yaoLabel(index, reading.primary[index] === 1)).join('、')}`
        : '静卦 · 无动爻'
    }

    ambient.bell('end')
    resultCard?.classList.add('open')
    ritualBusy = false
  }

  ritualBtn?.addEventListener('click', () => { void startRitual() })
  document.getElementById('againBtn')?.addEventListener('click', () => { void startRitual() })

  if (new URLSearchParams(location.search).get('ritual') === '1') {
    window.setTimeout(() => { void startRitual() }, 1200)
  }

  document.addEventListener('visibilitychange', () => {
    paused = document.hidden
  })

  frame()

  window.setTimeout(() => {
    renderer.setPixelRatio(targetPixelRatio)
    resize()
  }, 1500)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    composer?.dispose()
    renderer.dispose()
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose?.()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) material.forEach((m) => m.dispose())
      else material?.dispose?.()
    })
    void introK
  }
}
