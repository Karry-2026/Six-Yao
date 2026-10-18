# 实现说明 · 六爻 v2

面向维护者：这个项目的代码怎么组织、为什么这么写、坏了好不好修。

## 1. 模块地图

```
src/
├── pages/index.astro      # 静态海报 + canvas + 延迟加载 3D
└── scripts/scene.ts       # 场景、主题、画质分档、开场镜头、降级
```

首版只有一个页面、一个场景模块。刻意不拆更多文件：现在就拆，会产生大量「只有一个调用方」的抽象。

## 2. 启动时序

```
HTML（海报、标题、按钮）        ← 首屏，无 JS 依赖
   ↓ requestIdleCallback
动态 import scene.ts             ← 独立 chunk，不阻塞首屏
   ↓
WebGL2 探测 → 失败则加 .no-webgl，海报即最终界面
   ↓
resolveTheme() → 读 URL / sessionStorage / 北京时间
   ↓
构建场景 → 渲染首帧 → body.ready → 海报淡出、canvas 淡入
   ↓
开场镜头（4s，可跳过）→ 微呼吸循环
```

关键点：**`body.ready` 只在第一帧渲染后添加**，所以不会出现「海报没了但 3D 还没画出来」的白屏。

## 3. 主题系统

四套氛围（白天：晴昼 / 烟雨；夜间：暮夜 / 雪夜）共用一套场景，差异只在 `THEMES` 配置：

```ts
interface ThemeConfig {
  sky: [string, string, string]   // 天空渐变三段色
  fog, fogDensity, ground, wall, ambient
  moon, lantern, bloom            // 光源与泛光强度
  particles: { count, color, size, speed, drift, opacity }
}
```

选择顺序（`resolveTheme()`）：

1. `?theme=dusk|rain|snow`（分享与调试用）；
2. `sessionStorage['sy-theme']`（同一会话内稳定）；
3. 北京时间：06:00–17:59 在 `clear` / `rain` 中随机；其余时间在 `dusk` / `snow` 中随机。

新增一套主题：在 `THEMES` 里加一个 key，补全字段即可，不需要改场景代码。若要新粒子形态（如落叶），在粒子更新分支里加一种 `themeId` 判断。

## 4. 画质分档

| 档位 | 判定 | 差异 |
|---|---|---|
| high | 宽 ≥ 1280 且核心数 > 8 | Bloom、DPR ≤ 1.75、全量粒子 |
| medium | 宽 ≥ 640 且核心数 > 4 | Bloom、DPR ≤ 1.5、75% 粒子 |
| low | 其余 | 无 Bloom、DPR ≤ 1.25、45% 粒子、关抗锯齿 |

分档只在启动时判断一次。后续要加「帧率过低自动降档」，在 `frame()` 里统计最近 2 秒的平均帧时间即可。

## 5. 开场镜头

- 路径：`CatmullRomCurve3`，四个控制点，从院门外推到石桌前；
- 时长 4 秒，`easeInOutCubic`；
- 终点与正式机位完全一致，结束时无跳变；
- 只播一次（`sessionStorage['sy-intro']`）；
- 点击/按键/`prefers-reduced-motion` 均可跳过。

## 6. 降级

| 触发 | 行为 |
|---|---|
| 无 WebGL2 | 加 `.no-webgl`，移除 canvas，海报即最终界面 |
| 场景初始化抛错 | 同上，并在控制台 `warn` |
| `prefers-reduced-motion` | 不播开场、不做相机漂移、不闪烁 |
| 页面隐藏 | 暂停渲染（`visibilitychange`） |

## 7. 本地开发

```bash
npm install
npm run dev        # http://localhost:4321/Six-Yao/
npm run build      # 产物在 dist/
npm run preview    # 以 /Six-Yao 前缀预览构建产物
```

注意：**所有资源路径都要带 `base`**（`import.meta.env.BASE_URL`）。本地直接开 `dist/index.html` 用 `file://` 会 404，这不是 bug。

## 8. 当前缺口（按优先级）

1. **光照与材质**：整体偏暗，墙面没有质感；需要环境光遮蔽或简单的墙面纹理；
2. **月洞门的纵深**：门后是一块平板，缺少层次；需要「门后小院」的剪影与雾；
3. **水面**：尚未实现；
4. **Bloom 参数**：目前偏弱，灯笼的光晕还可以更大；
5. **声音**：未接入（M2/M3）；
6. **起卦交互**：未接入，当前只有场景；
7. **帧率监测与自动降档**：未实现；
8. **移动端真机验证**：只在桌面 headless 跑过。

## 9. 已知取舍

- **不用 glTF 模型**：体积、加载失败、授权三重风险；程序化几何先把结构做对，再考虑局部替换；
- **不用 React/Vue**：场景只有一次性初始化 + 一个动画循环，框架没有收益；
- **不做自由镜头**：控制成本，也避免用户看到没做细节的角度。
