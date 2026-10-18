import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

type ThemeId = 'dusk' | 'rain' | 'snow'

interface ThemeConfig {
  sky: [string, string, string]
  fog: string
  fogDensity: number
  ground: string
  wall: string
  ambient: string
  moon: number
  lantern: number
  bloom: number
  particles: {
    count: number
    color: number
    size: number
    speed: number
    drift: number
    opacity: number
  }
}

const THEMES: Record<ThemeId, ThemeConfig> = {
  dusk: {
    sky: ['#081320', '#1b2a36', '#33404a'],
    fog: '#16222c',
    fogDensity: 0.05,
    ground: '#161b1e',
    wall: '#262c30',
    ambient: '#3a4a55',
    moon: 0x9fb6c8,
    lantern: 0xd4a853,
    bloom: 0.55,
    particles: { count: 900, color: 0xd8cba8, size: 0.022, speed: 0.06, drift: 0.12, opacity: 0.6 },
  },
  rain: {
    sky: ['#05090d', '#101a22', '#1d2a33'],
    fog: '#0c141a',
    fogDensity: 0.075,
    ground: '#10161a',
    wall: '#1b2226',
    ambient: '#2c3a44',
    moon: 0x8aa2b4,
    lantern: 0xc98f3f,
    bloom: 0.7,
    particles: { count: 1400, color: 0x9fb6c8, size: 0.012, speed: 0.9, drift: 0.03, opacity: 0.45 },
  },
  snow: {
    sky: ['#0b1219', '#1d2a33', '#3c4a52'],
    fog: '#1a242b',
    fogDensity: 0.06,
    ground: '#1b2226',
    wall: '#2a3135',
    ambient: '#44525c',
    moon: 0xb9c9d4,
    lantern: 0xd4a853,
    bloom: 0.6,
    particles: { count: 1100, color: 0xe8eef2, size: 0.03, speed: 0.12, drift: 0.18, opacity: 0.7 },
  },
}

function resolveTheme(): ThemeId {
  const fromUrl = new URLSearchParams(location.search).get('theme')
  if (fromUrl === 'dusk' || fromUrl === 'rain' || fromUrl === 'snow') return fromUrl

  try {
    const stored = sessionStorage.getItem('sy-theme')
    if (stored === 'dusk' || stored === 'rain' || stored === 'snow') return stored
  } catch {
    /* 隐私模式下 sessionStorage 可能不可用 */
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
    /* 回退到本地时间 */
  }

  const theme: ThemeId = hour >= 6 && hour < 18 ? 'dusk' : Math.random() < 0.5 ? 'rain' : 'snow'
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
  gradient.addColorStop(0.55, mid)
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
  gradient.addColorStop(0, 'rgba(255,214,150,0.95)')
  gradient.addColorStop(0.25, 'rgba(255,196,120,0.45)')
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
  ctx.fillStyle = '#161b1e'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 2400; i++) {
    const shade = 18 + Math.random() * 14
    ctx.fillStyle = `rgba(${shade},${shade + 3},${shade + 4},0.5)`
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.4, 1.4)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(6, 6)
  return texture
}

let disposeCurrent: (() => void) | null = null

export function boot(): void {
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

function start(canvas: HTMLCanvasElement): () => void {
  const themeId = resolveTheme()
  const theme = THEMES[themeId]
  const tier = qualityTier()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', powerPreference: 'high-performance' })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === 'high' ? 1.75 : tier === 'medium' ? 1.5 : 1.25))

  const scene = new THREE.Scene()
  scene.background = makeSkyTexture(theme.sky)
  scene.fog = new THREE.FogExp2(new THREE.Color(theme.fog), theme.fogDensity)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120)
  const FINAL_POS = new THREE.Vector3(0, 1.42, 3.4)
  const LOOK_AT = new THREE.Vector3(0, 1.38, -2.4)
  camera.position.copy(FINAL_POS)
  camera.lookAt(LOOK_AT)

  // ---------- 地面 ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: theme.ground, map: makeGroundTexture(), roughness: 0.95, metalness: 0 }),
  )
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
  const wall = new THREE.Mesh(
    new THREE.ExtrudeGeometry(wallShape, { depth: 0.22, bevelEnabled: false, curveSegments: 48 }),
    new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 1, metalness: 0 }),
  )
  wall.position.set(0, 0, -3.6)
  scene.add(wall)

  // 洞口后方的纵深：远处一小片暖光，配合雾气读作「门后有院」
  const beyond = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 4.4),
    new THREE.MeshBasicMaterial({ color: 0x3a2a1a }),
  )
  beyond.position.set(0, 2, -10)
  scene.add(beyond)
  const beyondLight = new THREE.PointLight(0xc98f3f, 3.5, 14, 2)
  beyondLight.position.set(0, 2.2, -7)
  scene.add(beyondLight)

  // 檐口与屋顶
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x14181b, roughness: 1 })
  const eave = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.18, 1.5), roofMaterial)
  eave.position.set(0, 3.68, -3.6)
  scene.add(eave)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.16, 1.9), roofMaterial)
  roof.position.set(0, 3.9, -2.9)
  roof.rotation.x = -0.28
  scene.add(roof)

  // 两侧院墙，形成夹道透视
  const sideWallMaterial = new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 1 })
  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 7.4), sideWallMaterial)
    sideWall.position.set(side * 5.55, 1.8, -0.3)
    scene.add(sideWall)
  }

  // 石径
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x232a2d, roughness: 0.9, metalness: 0 }),
  )
  path.rotation.x = -Math.PI / 2
  path.position.set(0, 0.012, 0.4)
  scene.add(path)

  // 墙脚接触阴影
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 1.1),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  )
  contactShadow.rotation.x = -Math.PI / 2
  contactShadow.position.set(0, 0.02, -3.45)
  scene.add(contactShadow)

  // ---------- 灯笼 ----------
  const glowTexture = makeGlowTexture()
  const lanternMaterial = new THREE.MeshStandardMaterial({
    color: theme.lantern,
    emissive: theme.lantern,
    emissiveIntensity: 2.2,
    roughness: 0.5,
  })
  const lanterns: THREE.Mesh[] = []
  const glows: THREE.Sprite[] = []
  for (const [x, y, z] of [
    [-2.2, 2.35, -2.9],
    [2.2, 2.05, -2.7],
  ] as const) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), lanternMaterial)
    lantern.position.set(x, y, z)
    scene.add(lantern)
    lanterns.push(lantern)

    const light = new THREE.PointLight(theme.lantern, 7, 8, 2)
    light.position.set(x, y, z)
    scene.add(light)

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture, color: theme.lantern, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }),
    )
    glow.position.set(x, y, z)
    glow.scale.set(1.5, 1.5, 1)
    scene.add(glow)
    glows.push(glow)

    // 灯笼吊绳，挂到檐口
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.0035, 3.6 - y, 4),
      new THREE.MeshBasicMaterial({ color: 0x22282c }),
    )
    string.position.set(x, (3.6 + y) / 2, z)
    scene.add(string)
  }

  // 月
  const moonGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x9fb6c8,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  moonGlow.position.set(-4.2, 6.4, -14)
  moonGlow.scale.set(3.4, 3.4, 1)
  scene.add(moonGlow)

  // ---------- 竹影 ----------
  const bambooCount = tier === 'low' ? 28 : 46
  const bambooGeometry = new THREE.CylinderGeometry(0.012, 0.022, 3.6, 5)
  const bambooMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2621, roughness: 1 })
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

  // ---------- 粒子（主题决定雨/雪/香火） ----------
  const particleCount = Math.round(theme.particles.count * (tier === 'low' ? 0.45 : tier === 'medium' ? 0.75 : 1))
  const positions = new Float32Array(particleCount * 3)
  const phases = new Float32Array(particleCount)
  const spread = 7
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread
    positions[i * 3 + 1] = themeId === 'rain' ? Math.random() * 4.2 : Math.random() * 3.6
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
      blending: themeId === 'rain' ? THREE.NormalBlending : THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  )
  scene.add(particles)

  // ---------- 光 ----------
  scene.add(new THREE.HemisphereLight(new THREE.Color(theme.ambient), 0x080b0d, 0.6))
  const moonLight = new THREE.DirectionalLight(theme.moon, 0.55)
  moonLight.position.set(-4, 7, 3)
  scene.add(moonLight)

  // ---------- 后处理 ----------
  let composer: EffectComposer | null = null
  if (tier !== 'low') {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), theme.bloom, 0.45, 0.82)
    composer.addPass(bloom)
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
    new THREE.Vector3(0.4, 1.75, 9.2),
    new THREE.Vector3(0.25, 1.7, 6.4),
    new THREE.Vector3(0.1, 1.55, 4.6),
    FINAL_POS,
  ])
  let introActive = !introSeen && !reduceMotion
  let introStart = 0
  const introLook = new THREE.Vector3(0, 2.1, -3.6)
  if (introActive) {
    try {
      sessionStorage.setItem('sy-intro', '1')
    } catch {
      /* ignore */
    }
  }

  const cancelIntro = () => {
    if (!introActive) return
    introActive = false
    camera.position.copy(FINAL_POS)
    camera.lookAt(LOOK_AT)
  }
  window.addEventListener('pointerdown', cancelIntro, { once: true })
  window.addEventListener('keydown', cancelIntro, { once: true })

  // ---------- 循环 ----------
  const clock = new THREE.Clock()
  let raf = 0
  let paused = false

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
      if (themeId === 'rain') {
        array[idx] -= theme.particles.speed * 0.016
        if (array[idx] < 0) array[idx] = 4.2
      } else {
        array[idx] += theme.particles.speed * 0.016
        if (array[idx] > 3.8) array[idx] = 0
        array[i * 3] += Math.sin(t * 0.6 + phases[i]) * theme.particles.drift * 0.002
      }
    }
    attr.needsUpdate = true

    lanternMaterial.emissiveIntensity = 2.1 + Math.sin(t * 1.3) * 0.3
    for (const glow of glows) {
      const s = 1.45 + Math.sin(t * 1.3) * 0.06
      glow.scale.set(s, s, 1)
    }

    if (composer) composer.render()
    else renderer.render(scene, camera)

    if (!document.body.classList.contains('ready')) document.body.classList.add('ready')
  }

  document.addEventListener('visibilitychange', () => {
    paused = document.hidden
  })

  frame()

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
  }
}
