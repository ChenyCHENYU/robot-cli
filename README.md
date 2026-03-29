<div align="center">

# Robot CLI

**一条命令，搭建标准化工程项目**

[![npm](https://img.shields.io/npm/v/@agile-team/robot-cli?color=cb3837&label=npm)](https://www.npmjs.com/package/@agile-team/robot-cli)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-43853d)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**中文** | [English](#english)

</div>

---

## 为什么用 Robot CLI

- **5 个生产就绪模板**：Vue 全栈 (Admin / Monorepo / 微前端 / 模块联邦) + uni-app 多端，更多模板持续上线
- **模板配置系统**：Robot Admin 支持 Full / Lite / Custom 三档配置，按需裁剪演示页面和可选功能
- **秒级下载**：`git clone --depth=1` 引擎，和 create-vue / degit 同方案，自动走系统代理
- **国内友好**：Gitee 优先 → GitHub 兜底 → HTTP ZIP 二次兜底，三层容错
- **现代交互**：基于 @clack/prompts，4 种选模板方式，实时进度条，确认面板
- **离线可用**：首次下载自动缓存，断网也能创建项目
- **零配置**：自动检测 bun/pnpm/yarn/npm，自动初始化 Git，开箱即用

---

## 快速开始

```bash
# 零安装体验（推荐）
npx @agile-team/robot-cli create my-project
# 或
bunx @agile-team/robot-cli create my-project

# 全局安装后使用
npm i -g @agile-team/robot-cli
robot create
```

---

## 模板配置系统

选择 **Robot Admin 完整版** 时，CLI 会自动询问模板配置模式：

```
◆  选择模板配置:
│  ○ 完整版（Full）- 包含所有演示页面和功能模块
│  ● 精简版（Lite）- 移除演示页面，保留核心业务框架  ⭐ 推荐
│  ○ 自定义（Custom）- 自行选择要保留的模块
```

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| **Full** | 保留全部 74 个页面、所有功能和依赖 | 学习参考、功能演示 |
| **Lite** ⭐ | 移除 56 个演示页面 + 仪表盘 + i18n + 3D 背景等，保留核心业务框架 + 系统管理 | 实际项目开发 |
| **Custom** | 逐项选择要保留的页面模块、功能模块、可选包 | 定制化需求 |

> 裁剪在模板下载后自动执行，其他模板不受影响，现有 CLI 功能完全不变。

---

## 可用模板

### 已上线

| 模板 | 架构 | 技术栈 | 仓库分支 |
|------|------|--------|---------|
| **Robot Admin** 完整版 | 单体应用 | Vue 3 + Naive UI + Pinia + 权限 + 图表 + 50+ 示例 | `main` |
| **Robot Monorepo** | Monorepo | bun workspace + 多包管理 + 共享组件 | `monorepo` |
| **Robot MicroApp** | 微前端 | MicroApp + 主子应用 + 路由共享 | `micro-app` |
| **Robot Module Federation** | 模块联邦 | Vite Module Federation + 远程模块 | `module-federation` |
| **Robot uni-app** 完整版 | 多端应用 | uni-app + uView UI + 多端发布 | `main` |

> 前 4 个模板共用仓库 [ChenyCHENYU/Robot_Admin](https://github.com/ChenyCHENYU/Robot_Admin)，不同架构通过分支区分。

### 开发中

Robot Admin 精简版 · React 全家桶 · NestJS 后端 · Electron 桌面端 — 即将上线，敬请期待。

---

## 命令

### `robot create [name]`

交互式创建项目，全流程引导。

```bash
robot create                              # 交互式
robot create my-app -t robot-admin        # 指定模板
robot create my-app --from https://github.com/org/repo  # 自定义仓库
robot create my-app --dry-run             # 预览，不实际创建
robot create my-app --skip-install        # 跳过依赖安装
robot create my-app --no-cache            # 强制重新下载
```

### `robot list`

```bash
robot list           # 查看所有模板
robot list -r        # 只看推荐模板
```

### `robot search <keyword>`

```bash
robot search vue     # 搜 Vue 相关
robot search 微前端  # 搜中文关键词
```

### `robot doctor`

```bash
robot doctor                # 环境诊断（Node/Git/包管理器/网络）
robot doctor --clear-cache  # 清理模板缓存
```

---

## 下载机制

Robot CLI 使用三层容错策略：

```
1. git clone --depth=1 (Gitee)     ← 国内最快
2. git clone --depth=1 (GitHub)    ← 自动继承系统代理
3. HTTP ZIP 下载 (codeload CDN)    ← git 不可用时兜底
```

- 实时显示 git 克隆进度条（百分比 + 速度）
- 首次下载自动缓存到 `~/.robot-cli/cache/`
- 断网时使用缓存版本

---

## 项目结构

```
robot-cli/
├── bin/robot.js                    # CLI 入口
├── src/
│   ├── index.ts                    # Commander 命令注册 + Banner
│   ├── create.ts                   # 交互式创建流程
│   ├── download.ts                 # 下载引擎（git clone + HTTP 兜底）
│   ├── templates.ts                # 模板查询
│   ├── doctor.ts                   # 环境诊断
│   ├── utils.ts                    # 工具函数
│   ├── types.ts                    # 类型定义
│   ├── trimmer/
│   │   └── index.ts                # 模板配置裁剪引擎
│   └── config/
│       ├── templates.config.ts     # 模板注册表（所有模板定义在这里）
│       └── cli.config.ts           # CLI 配置（推荐列表、启动命令等）
├── tests/                          # Vitest 单元测试（52 个）
├── tsup.config.ts                  # 构建配置（ESM, node20）
└── .github/workflows/              # CI: PR 检查 + tag 发布
```

---

## 二次开发

### 本地开发

```bash
git clone https://github.com/ChenyCHENYU/robot-cli.git
cd robot-cli
bun install
bun run dev    # watch 构建
bun link       # 全局链接
robot create   # 测试
```

### 添加模板

编辑 [src/config/templates.config.ts](src/config/templates.config.ts)：

```ts
"your-template": {
  name: "模板名称",
  description: "模板描述",
  repoUrl: "https://github.com/org/repo",
  branch: "main",
  features: ["特性1", "特性2"],
  version: "full",
}
```

模板仓库要求：根目录有 `package.json`。

### 构建 & 测试

```bash
bun run build      # tsup 构建
bun run test       # Vitest 测试
bun run typecheck  # TypeScript 类型检查
bun run lint       # oxlint 代码检查
```

### 技术栈

TypeScript 5.7+ · tsup 8 · Vitest 3 · @clack/prompts · Commander · Node ≥ 20

---

## FAQ

**模板下载失败？**

```bash
robot doctor   # 先诊断环境
# 确保系统已安装 git 且网络可用
```

**`command not found: robot`？**

```bash
npx @agile-team/robot-cli create   # 免安装使用
# 或重新全局安装
npm i -g @agile-team/robot-cli
```

**如何选架构？**

| 场景 | 推荐模板 |
|------|---------|
| 中小后台项目 | `robot-admin` |
| 大型项目、多包共享 | `robot-monorepo` |
| 多团队协作、独立部署 | `robot-micro-app` |
| 运行时模块共享 | `robot-module-federation` |
| 小程序/H5/App 多端 | `robot-uniapp` |

---

## 链接

- [npm](https://www.npmjs.com/package/@agile-team/robot-cli)
- [GitHub](https://github.com/ChenyCHENYU/robot-cli)
- [模板仓库 Robot_Admin](https://github.com/ChenyCHENYU/Robot_Admin)
- [路线图](ROADMAP.md)
- [更新日志](CHANGELOG.md)

---

<a name="english"></a>

<div align="center">

# Robot CLI

**One command to scaffold production-ready projects**

[![npm](https://img.shields.io/npm/v/@agile-team/robot-cli?color=cb3837&label=npm)](https://www.npmjs.com/package/@agile-team/robot-cli)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-43853d)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[中文](#) | **English**

</div>

---

## Why Robot CLI

- **5 production-ready templates**: Vue full-stack (Admin / Monorepo / Micro-frontend / Module Federation) + uni-app cross-platform
- **Template configuration system**: Robot Admin supports Full / Lite / Custom modes — trim demo pages and optional features on demand
- **Instant download**: `git clone --depth=1` engine, same approach as create-vue / degit, inherits system proxy
- **China-friendly**: Gitee first → GitHub fallback → HTTP ZIP fallback, triple fault-tolerance
- **Modern UX**: @clack/prompts, 4 template selection modes, real-time progress, confirmation panels
- **Offline support**: Auto-cached after first download, works without internet
- **Zero config**: Auto-detects bun/pnpm/yarn/npm, auto-inits Git, works out of the box

---

## Quick Start

```bash
# Zero-install (recommended)
npx @agile-team/robot-cli create my-project
# or
bunx @agile-team/robot-cli create my-project

# Global install
npm i -g @agile-team/robot-cli
robot create
```

---

## Template Configuration

When selecting **Robot Admin Full**, the CLI offers three configuration modes:

```
◆  Select template configuration:
│  ○ Full — Keep all demo pages and features
│  ● Lite — Remove demos, keep core business framework  ⭐ Recommended
│  ○ Custom — Choose modules to keep
```

| Mode | Description | Use Case |
|------|-------------|----------|
| **Full** | All 74 pages, all features and deps | Learning, demos |
| **Lite** ⭐ | Remove 56 demo pages + dashboard + i18n + 3D login + more, keep core + sys-manage | Real projects |
| **Custom** | Pick individual page modules, features, optional packages | Custom needs |

> Trimming runs automatically after download. Other templates are not affected.

---

## Available Templates

| Template | Architecture | Stack | Branch |
|----------|-------------|-------|--------|
| **Robot Admin** Full | Monolith | Vue 3 + Naive UI + Pinia + Auth + Charts + 50+ demos | `main` |
| **Robot Monorepo** | Monorepo | bun workspace + multi-package | `monorepo` |
| **Robot MicroApp** | Micro-frontend | MicroApp + sub-apps + shared routing | `micro-app` |
| **Robot Module Federation** | Module Federation | Vite Module Federation + remote modules | `module-federation` |
| **Robot uni-app** Full | Cross-platform | uni-app + uView UI + multi-target | `main` |

---

## Commands

### `robot create [name]`

```bash
robot create                              # Interactive
robot create my-app -t robot-admin        # Specify template
robot create my-app --from https://github.com/org/repo  # Custom repo
robot create my-app --dry-run             # Preview only
robot create my-app --skip-install        # Skip deps install
robot create my-app --no-cache            # Force re-download
```

### `robot list` / `robot search <keyword>` / `robot doctor`

```bash
robot list              # List all templates
robot list -r           # Recommended only
robot search vue        # Search by keyword
robot doctor            # Environment diagnostic
robot doctor --clear-cache  # Clear template cache
```

---

## Download Strategy

```
1. git clone --depth=1 (Gitee)     ← Fastest in China
2. git clone --depth=1 (GitHub)    ← Inherits system proxy
3. HTTP ZIP (codeload CDN)         ← Fallback when git unavailable
```

---

## Development

```bash
git clone https://github.com/ChenyCHENYU/robot-cli.git
cd robot-cli
bun install
bun run dev        # Watch build
bun run build      # Production build
bun run test       # 52 unit tests
bun run typecheck  # TypeScript check
bun run lint       # oxlint
```

**Tech Stack**: TypeScript 5.7+ · tsup 8 · Vitest 3 · @clack/prompts · Commander · Node ≥ 20

---

## Links

- [npm](https://www.npmjs.com/package/@agile-team/robot-cli)
- [GitHub](https://github.com/ChenyCHENYU/robot-cli)
- [Template Repo](https://github.com/ChenyCHENYU/Robot_Admin)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)

## License

MIT
