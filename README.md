# 六爻 · 易经六十四卦

一个 2D 水墨风格的在线起卦工具：铺开卦纸，掷六次铜钱，逐爻成卦、装卦解读。

**在线体验：<https://karry-2026.github.io/Six-Yao/>**

> **🚧 v3 推进中**：2D 水墨已上线，真六爻装卦（纳甲/世应/六亲/六兽/旬空/用神旺衰简断）已实装，五声音律背景音乐已加入。方向与进展见 [开发计划](docs/ROADMAP.md) 与 [决策记录](docs/adr/)。线上站点随 main 自动部署。

![庭院与起卦](docs/preview.png)

## 功能

- **2D 水墨场景**：Canvas2D 程序化水墨——宣纸、远山、木案、香炉、落款朱印，无外部素材
- **四种氛围**：晴昼 / 烟雨 / 暮夜 / 雪夜，按北京时间自动切换，`?theme=` 可指定
- **起卦流程**：三枚铜钱落案 → 六爻逐一落在卦纸上 → 本卦、互卦、变卦推演
- **结果解读**：卦名、卦辞、白话解读、动爻标注（初九…上六）
- **真六爻装卦解读**：纳甲、世应、六亲、六兽、旬空与用神旺衰简断（[ADR-0002](docs/adr/0002-full-najia-domain.md)），结果卡分层呈现卦象图 → 装卦表 → 断语 → 卦爻辞 → 白话
- **环境音**：WebAudio 合成的风声与钟磬，默认静音，可随时开关
- **五声音律背景音乐**：WebAudio 合成的五声音阶拨弦，律制支持三分损益/十二平均律，默认静音，右上角可开关
- **降级**：无 Canvas 的设备回退纯 DOM 模式，起卦功能完整

## 技术栈

| 层 | 选择 |
|---|---|
| 站点框架 | Astro 5（静态生成） |
| 渲染 | Canvas2D + SVG，程序化水墨（[ADR-0001](docs/adr/0001-replace-3d-with-2d-ink.md)） |
| 语言 | TypeScript |
| 部署 | GitHub Actions → GitHub Pages |
| 素材 | 无外部素材，全部程序化生成 |

## 本地开发

```bash
npm install
npm run dev      # http://localhost:4321/Six-Yao/
npm run build    # 产物在 dist/
npm run preview  # 以 /Six-Yao 前缀预览构建产物
npm run verify   # 64 卦数据、掷币规则、互卦/变卦推演校验
```

## 目录

```
src/
├── pages/index.astro     # 海报、界面、卦纸、结果卡
├── scripts/scene.ts      # 2D 水墨氛围（炉烟、粒子、铜钱）
├── scripts/ritual.ts     # 起卦流程与卦纸渲染
├── scripts/ink/          # 四时主题与水墨笔触
├── lib/hexagram.ts       # 掷币与卦象推演
├── lib/ambient.ts        # WebAudio 环境音
├── data/hexagrams.json   # 六十四卦数据
docs/                     # PRD、架构、路线图、决策记录与素材清单
scripts/verify-hexagrams.mjs
.github/workflows/        # ci.yml 门禁 + deploy.yml 部署
```

## 文档

- [开发计划（v3）](docs/ROADMAP.md)
- [决策记录 ADR](docs/adr/)（2D 转向、装卦体系）
- [产品需求](docs/PRD.md)
- [技术方案](docs/ARCHITECTURE.md)
- [实现说明](docs/IMPLEMENTATION.md)
- [素材清单与许可](docs/ASSETS.md)
- [托管容量预算](docs/HOSTING.md)
- v2 存档：[视觉与交互规范](docs/archive/ART-DIRECTION.md) · [视觉与 3D 设计](docs/archive/DESIGN.md)

## 许可

代码以 [MIT](LICENSE) 发布；外部素材均为 CC0，来源记录在 `docs/ASSETS.md`。

## 免责声明

本工具依据中国传统《周易》六爻占法编写，仅供文化研究与娱乐参考。卦象解读基于传统易学理论，不构成任何专业建议。
