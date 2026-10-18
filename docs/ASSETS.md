# 外部素材清单

原则：**只使用许可证明确、可商用、可再分发**的素材；每一份都要记录来源，否则不用。

## 环境

| 文件 | 来源 | 许可证 | 大小 | MD5 | 用途 | 状态 |
|---|---|---|---|---|---|---|
| `public/env/courtyard_1k.hdr` | [Poly Haven · Courtyard](https://polyhaven.com/a/courtyard) | CC0 | 1,716,791 B | `c9f92690f97deab491c5f97dd652cee2` | IBL / 反射 | ✅ 启用（中高档） |

## 贴图

| 文件 | 来源 | 许可证 | 大小 | MD5 |
|---|---|---|---|---|
| `plastered_wall_02_diff_1k.jpg` | [Poly Haven · Plastered Wall 02](https://polyhaven.com/a/plastered_wall_02) | CC0 | 436,395 B | `3CA0D02E87AD5C6EB21EFA4B05B7748E` |
| `plastered_wall_02_nor_gl_1k.jpg` | 同上 | CC0 | 960,241 B | `5419137DD937F95A849B884258FB8BB5` |
| `plastered_wall_02_rough_1k.jpg` | 同上 | CC0 | 173,930 B | `2D4A4A40491EB5A115C086BB65ABA32C` |
| `stone_floor_diff_1k.jpg` | [Poly Haven · Stone Floor](https://polyhaven.com/a/stone_floor) | CC0 | 911,345 B | `6DFF94D7C1DA0FD034BA714C249EC72F` |
| `stone_floor_nor_gl_1k.jpg` | 同上 | CC0 | 1,045,705 B | `B75AE5B7F4864BE36360C54CDD78BD66` |
| `stone_floor_rough_1k.jpg` | 同上 | CC0 | 469,683 B | `5D9B4005D84895FBC536089DE3CD2480` |

用途：墙面 / 地面 / 石径。瓦片、竹叶、天空、门后纵深均为程序化生成，无外部素材。

## 体积

- 素材合计约 **5.7 MB**（HDRI 1.7 MB + 贴图 4.0 MB）
- 构建产物约 **6.1 MB**，在 8 MB 预算内（见 `HOSTING.md`）
- 下一轮优化：贴图转 KTX2，预计降到 1.2 MB 以内

## 选材标准

1. 必须 CC0 或等价公共领域许可；CC-BY 需署名，本项目暂不采用；
2. 单文件 ≤ 2 MB，优先 1K；
3. 不引外部 CDN，文件随仓库打包；
4. 不使用的素材不进 `public/`；
5. 每新增一份，更新本表。

## 明确不用的

- 来源不明的「公开素材包」；
- AI 生成但授权不清的贴图；
- 从其他网站扒下来的模型或图片；
- 需登录/付费才能下载且许可证不允许再分发的素材。

## 更新记录

- 2026-10-18：六张贴图转换为 WebP（albedo/法线 1024，粗糙度 512），贴图总体积 4.0 MB → **1.0 MB**；原始 JPG 移到 `assets/textures/`，不进入部署包；构建产物 6.0 MB → **3.2 MB**。
