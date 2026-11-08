# Changelog

本项目的版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)，条目格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 计划

- v3 重构启动：放弃 3D 场景、改为 2D 水墨风（[ADR-0001](docs/adr/0001-replace-3d-with-2d-ink.md)）；补全真六爻装卦体系（[ADR-0002](docs/adr/0002-full-najia-domain.md)）。计划与进展见 [ROADMAP](docs/ROADMAP.md)。

## [2.5.0] - 2026-10-18

### Added

- 点选式起卦仪式：逐爻推进、进度指示、可中断重掷
- 占卜历史存档（localStorage，上限 30 条）
- 六十四卦卦库面板（检索：卦名 / 拼音 / 序号）

## [2.4.0] - 2026-10-18

### Changed

- 笔刷洗墙面、近岸水面与香炉炉烟的视觉迭代

## [2.3.1] - 2026-10-18

### Changed

- 移除商用字体 Mi Lan Ting 子集，替换为 OFL 授权的思源宋体（Noto Serif SC）子集

## [2.3.0] - 2026-10-18

### Added

- 水墨着色器（墙体 / 地面）与月洞门外的青绿山脊借景

## [2.2.0] - 2026-10-18

### Changed

- 中文展示字体子集化、香炉细节、卦线对比度调整

## [2.1.0] - 2026-10-18

### Changed

- 桌面起卦构图与纸面卦签结果面板

## [2.0.0] - 2026-10-18

### Added

- Astro 5 + TypeScript + three.js 全量重写：3D 庭院场景、晴昼/烟雨/暮夜/雪夜四种氛围、掷币起卦流程、本卦/互卦/变卦推演、结果解读卡、WebAudio 环境音、无 WebGL 降级
- GitHub Actions 自动部署至 GitHub Pages
- 64 卦数据校验脚本（`npm run verify`）

## [1.0.0] - 2026-10-17

### Added

- 初版单文件六爻起卦网页（内容最初于 2026-05-24 上传，10 月整理为仓库首个正式版本）

[Unreleased]: https://github.com/Karry-2026/Six-Yao/compare/v2.5.0...HEAD
[2.5.0]: https://github.com/Karry-2026/Six-Yao/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/Karry-2026/Six-Yao/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/Karry-2026/Six-Yao/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/Karry-2026/Six-Yao/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/Karry-2026/Six-Yao/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/Karry-2026/Six-Yao/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Karry-2026/Six-Yao/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Karry-2026/Six-Yao/releases/tag/v1.0.0
