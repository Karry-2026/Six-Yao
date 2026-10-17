# 技术方案 · 六爻 v2

| 项目 | 内容 |
|---|---|
| 版本 | v2.0 |
| 状态 | 草案（待评审） |
| 关联 | [PRD](PRD.md) |

---

## 1. 选型

| 层 | 选择 | 理由 |
|---|---|---|
| 站点框架 | **Astro** | 内容型站点；默认零 JS；64 卦可构建成静态页（SEO）；需要交互的局部再水合 |
| 语言 | **TypeScript** | 卦象推演是纯逻辑，类型能挡住大半低级错误 |
| 样式 | **原生 CSS + 设计 token** | 页面规模不需要 Tailwind；token 便于深色模式与主题切换 |
| 测试 | **Vitest**（单测）+ **Playwright**（端到端）+ **axe**（无障碍） | 覆盖算法、关键路径、可访问性 |
| CI/CD | **GitHub Actions** → GitHub Pages | 免费、与仓库同源、构建可复现 |
| 数据 | **JSON + 构建期校验** | 数据与代码分离；非法数据在构建时失败，而不是上线后才发现 |

**为什么不上 React/Vue**：这个项目没有复杂状态，框架带来的是体积和依赖，不是能力。Astro 的岛屿架构允许在「起卦动画」这一处用少量脚本，其余保持静态。

## 2. 目录结构

```
Six-Yao/
├── src/
│   ├── pages/
│   │   ├── index.astro          # 起卦页
│   │   ├── gua/[id].astro       # 64 个静态详情页
│   │   ├── library.astro        # 卦库检索
│   │   └── history.astro        # 本地记录
│   ├── components/              # 铜钱、卦象、卡片、导航
│   ├── lib/
│   │   ├── rng.ts               # 随机源（crypto）
│   │   ├── yarrow.ts            # 掷币 → 爻
│   │   ├── hexagram.ts          # 本卦/互卦/变卦推演
│   │   ├── share.ts             # 分享链接编解码
│   │   └── storage.ts           # localStorage 封装
│   ├── data/hexagrams.json      # 六十四卦数据
│   └── styles/tokens.css        # 颜色、字号、间距、动效
├── tests/
│   ├── unit/                    # 算法与数据
│   └── e2e/                     # 关键路径
├── scripts/validate-data.ts     # 构建期数据校验
├── docs/                        # 本目录
└── .github/workflows/ci.yml
```

## 3. 数据模型

```ts
interface Hexagram {
  id: number            // 1..64，通行本卦序
  name: string          // 乾为天
  pinyin: string
  upper: Trigram        // 上卦
  lower: Trigram        // 下卦
  lines: (0 | 1)[]      // 自下而上六爻，1=阳 0=阴
  judgment: string      // 卦辞
  image: string         // 象辞
  interpretation: string // 白话解读
  fortune: '大吉' | '吉' | '中吉' | '小吉' | '凶'
  fortuneLevel: 1 | 2 | 3 | 4 | 5
  interpretationSource: 'ai-assisted' | 'human'
  reviewed: boolean      // 是否人工校对
}
```

校验规则（构建期执行，失败即中断构建）：

1. `id` 唯一且覆盖 1–64；
2. `lines` 长度 6，且与 `upper`/`lower` 的三爻拼接一致；
3. 64 条卦象两两不重复（按 `lines`）；
4. 所有 `judgment`/`image` 非空；
5. `reviewed: false` 的条目在页面上显示「待校对」标记。

## 4. 核心算法

### 4.1 掷币

```ts
// 每爻：3 枚铜钱，各 50%
function tossLine(rng: () => number): 6 | 7 | 8 | 9 {
  const coins = [rng(), rng(), rng()].map(v => (v < 0.5 ? 1 : 0))
  return 6 + coins[0] + coins[1] + coins[2]   // 6..9
}
```

- `rng` 注入，便于测试时替换为固定序列；
- 生产实现使用 `crypto.getRandomValues`，取 32 位无符号数除以 2^32。

### 4.2 推演

| 步骤 | 规则 |
|---|---|
| 本卦 | 六爻直接组成 |
| 互卦 | 取 2、3、4 爻为下卦，3、4、5 爻为上卦 |
| 变卦 | 老阳（9）变阴、老阴（6）变阳，其余不变 |
| 动爻 | 值为 6 或 9 的爻 |

> 这三个规则是**最容易写错**的地方，必须有覆盖全部 64 卦的测试。

### 4.3 分享链接

```
#gua=<id>&lines=<6 位数字，每爻 6/7/8/9>
```

- 解码时严格校验：长度 6、字符集 `[6789]`、`id` 与 `lines` 推演一致；
- 不合法则回退到首页并提示，**不抛异常、不渲染未校验内容**；
- 不包含时间、设备、身份信息。

## 5. 状态与存储

| 数据 | 位置 | 说明 |
|---|---|---|
| 当前卦 | URL | 刷新/分享可还原 |
| 历史记录 | `localStorage` | 最多 50 条，可清空 |
| 主题偏好 | `localStorage` | `auto` / `light` / `dark` |
| 无 | 服务器 | 本项目没有后端 |

## 6. 构建与部署

```
push → GitHub Actions
  ├─ lint (eslint + prettier check)
  ├─ typecheck (tsc --noEmit)
  ├─ unit test (vitest run)
  ├─ data validate (scripts/validate-data.ts)
  ├─ build (astro build)
  ├─ e2e (playwright, 针对 build 产物)
  └─ deploy → GitHub Pages
```

- 部署只在 `main` 分支且全部通过后执行；
- 产物不可变：一次发布对应一个 tag；
- 回滚：重新部署上一个 tag 的构建产物（或 revert 提交）。

## 7. 测试策略

| 层级 | 覆盖 | 工具 |
|---|---|---|
| 单元 | 掷币分布、爻性判定、互卦、变卦、分享编解码、数据校验 | Vitest |
| 统计 | 10 万次掷币的 1:3:3:1 卡方检验（允许误差） | Vitest |
| 端到端 | 起卦全流程、手动录入、分享链接还原、历史记录、卦库检索 | Playwright |
| 无障碍 | 键盘走查、axe 自动扫描、对比度 | axe-core |
| 手动 | iOS Safari、Android Chrome、桌面三浏览器 | 发布检查清单 |

**不测**：动画的像素级外观（成本高、收益低）。

## 8. 安全与隐私

- 纯静态，无后端、无数据库、无账号；
- 分享参数白名单校验，渲染一律走文本节点，禁止 `innerHTML` 拼接用户输入；
- 不引入第三方分析脚本；如需统计，用不依赖 cookie 的方案并写入文档；
- 不收集任何个人信息；免责声明与 AI 参与说明常驻页面。

## 9. 可访问性与性能预算

- 所有交互元素可聚焦、可键盘触发，焦点样式清晰；
- 颜色对比度 ≥ 4.5:1（正文）；
- `prefers-reduced-motion: reduce` 时关闭动画；
- 首屏 JS ≤ 50 KB gzip；字体 `font-display: swap`，只加载实际用到的字重；
- 每卦详情页静态生成，`<title>` 与 `description` 唯一。

## 10. 与 v1 的关系

- v1 保留在 tag `v1.0.0`，可随时对照；
- v2 不复制 v1 的 HTML，重写组件与样式，但继承其视觉语言（米白、墨绿、宋体标题）；
- 迁移时以 v1 的 64 卦文本为**待校对素材**，不直接视为正确。
