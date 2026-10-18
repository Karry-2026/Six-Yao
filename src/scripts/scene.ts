import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

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
    exposure: 1.05,
    hemi: 0.45,
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
    exposure: 1.05,
    hemi: 0.3,
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

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: tier !== 'low',
    powerPreference: 'high-performance',
  })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = theme.exposure
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, tier === 'high' ? 1.75 : tier === 'medium' ? 1.5 : 1.15),
  )

  const scene = new THREE.Scene()
  scene.background = makeSkyTexture(theme.sky)
  scene.fog = new THREE.FogExp2(new THREE.Color(theme.fog), theme.fogDensity)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160)
  const FINAL_POS = new THREE.Vector3(0, 1.42, 3.4)
  const LOOK_AT = new THREE.Vector3(0, 1.38, -2.4)
  camera.position.copy(FINAL_POS)
  camera.lookAt(LOOK_AT)

  // ---------- 地面 ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshStandardMaterial({
      color: theme.ground,
      map: makeGroundTexture(),
      roughness: 0.95,
      metalness: 0,
    }),
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
    new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 0.95, metalness: 0 }),
  )
  wall.position.set(0, 0, -3.6)
  scene.add(wall)

  // 门后的纵深
  const beyond = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 4.4),
    new THREE.MeshBasicMaterial({ color: theme.daylight ? 0x8a7f6a : 0x3a2a1a }),
  )
  beyond.position.set(0, 2, -10)
  scene.add(beyond)

  // 檐口与屋顶
  const roofMaterial = new THREE.MeshStandardMaterial({ color: theme.roof, roughness: 0.9 })
  const eave = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.18, 1.5), roofMaterial)
  eave.position.set(0, 3.68, -3.6)
  scene.add(eave)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.16, 1.9), roofMaterial)
  roof.position.set(0, 3.9, -2.9)
  roof.rotation.x = -0.28
  scene.add(roof)

  // 两侧院墙
  const sideWallMaterial = new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 0.95 })
  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 7.4), sideWallMaterial)
    sideWall.position.set(side * 5.55, 1.8, -0.3)
    scene.add(sideWall)
  }

  // 石径
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 8),
    new THREE.MeshStandardMaterial({ color: theme.path, roughness: 0.9, metalness: 0 }),
  )
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
    new RGBELoader()
      .loadAsync(`${import.meta.env.BASE_URL}env/courtyard_1k.hdr`)
      .then((texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping
        scene.environment = pmrem.fromEquirectangular(texture).texture
        scene.environmentIntensity = theme.env
        texture.dispose()
      })
      .catch((error) => console.warn('[six-yao] 环境贴图加载失败，使用灯光兜底', error))
      .finally(() => pmrem.dispose())
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
    new THREE.Vector3(0.4, 1.75, 9.2),
    new THREE.Vector3(0.25, 1.7, 6.4),
    new THREE.Vector3(0.1, 1.55, 4.6),
    FINAL_POS,
  ])
  let introActive = !introSeen && !reduceMotion
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
    void introK
  }
}
