# 参与指南

感谢关注本项目。这是一人维护的小型开源项目，流程刻意保持轻量，但有几条底线。

## 环境要求

- Node.js 22+，npm 10+

## 快速开始

```bash
npm install
npm run dev      # 本地开发（http://localhost:4321/Six-Yao/）
npm run verify   # 64 卦数据与推演规则校验
npm run check    # astro 类型检查
npm run build    # 构建产物在 dist/
```

## 工作流约定

| 项 | 约定 |
|---|---|
| 分支 | `main` 保持可发布；功能 `feat/*`、修复 `fix/*`、文档 `docs/*`、杂务 `chore/*` |
| 提交信息 | Conventional Commits：`feat:` / `fix:` / `docs:` / `test:` / `chore:` |
| PR | 一个 PR 只做一件事，描述写清「改了什么 / 为什么 / 怎么验证」 |
| 合并 | Squash merge，保持 `main` 线性历史 |
| 版本 | SemVer：功能 → MINOR，修复 → PATCH，破坏性 → MAJOR |
| 发布 | 打 tag 并更新 [CHANGELOG](CHANGELOG.md)；重要决策写 `docs/adr/NNNN-*.md` |

## 质量门禁

CI 会在 PR 与 main 上运行 `verify` + `check` + `build`，任何一项不过就不能合并。

- 改动 `src/data/hexagrams.json` 必须保证 `npm run verify` 通过；
- 领域逻辑（起卦、装卦、推演）保持纯函数、零 DOM 依赖，配单测；
- 视觉改动请附截图或 GIF。

## 关于 AI 协作

本项目大量使用 AI 辅助开发。提交者需对提交内容负责：提交信息要让人读懂「为什么」，不接受机器刷出来的无意义描述。

## 许可

提交即表示同意代码以 [MIT](LICENSE) 发布。
