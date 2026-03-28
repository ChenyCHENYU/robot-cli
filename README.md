# 🤖 Robot CLI

> **现代化工程脚手架** — 一条命令，60 秒搭建标准化项目

[![npm version](https://img.shields.io/npm/v/@agile-team/robot-cli)](https://www.npmjs.com/package/@agile-team/robot-cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## 目录

- [快速开始](#-快速开始)
- [模板一览](#-模板一览)
- [命令详解](#-命令详解)
- [进阶用法](#-进阶用法)
- [项目结构](#-项目结构)
- [二次开发指南](#-二次开发指南)
- [常见问题](#-常见问题)

---

## 🚀 快速开始

### 安装

```bash
# 推荐 bun（极速）
bun add -g @agile-team/robot-cli

# 或 npm
npm install -g @agile-team/robot-cli
```

### 30 秒上手

```bash
# 交互式创建（推荐，会引导你选模板、填信息）
robot create

# 直接指定模板 + 项目名
robot create my-project -t robot-admin

# 零安装体验
bunx @agile-team/robot-cli create my-project
# 或
npx @agile-team/robot-cli create my-project
```

---

## 📋 模板一览

### 🎨 前端项目（Vue.js）

| 模板 Key | 名称 | 架构模式 | 说明 |
|---------|------|---------|------|
| `robot-admin` | Robot Admin 完整版 | 单体应用 | 50+ 完整示例、权限管理、图表组件、Naive UI |
| `robot-admin-base` | Robot Admin 精简版 | 单体应用 | 基础架构、核心功能、快速启动 |
| `robot-monorepo` | Robot Monorepo | Monorepo | bun workspace 多包管理架构 |
| `robot-micro-app` | Robot MicroApp | 微前端 | 基于 MicroApp 的微前端方案 |
| `robot-module-federation` | Robot Module Federation | 模块联邦 | 基于 Vite Module Federation |

> **前端模板源码仓库**：[ChenyCHENYU/Robot_Admin](https://github.com/ChenyCHENYU/Robot_Admin)
> 不同架构通过分支区分：`main`（全量）、`monorepo`、`micro-app`、`module-federation`

### 🎨 前端项目（React.js）

| 模板 Key | 名称 | 说明 |
|---------|------|------|
| `robot-react` | Robot React 完整版 | Ant Design + 完整功能演示 |
| `robot-react-base` | Robot React 精简版 | 基础 React + 核心功能 |

### 📱 移动端项目

| 模板 Key | 名称 | 说明 |
|---------|------|------|
| `robot-uniapp` | Robot uni-app 完整版 | 多端适配（小程序/H5/App）+ 完整示例 |
| `robot-uniapp-base` | Robot uni-app 精简版 | 基础框架 + 核心功能 |

### 🚀 后端项目

| 模板 Key | 名称 | 说明 |
|---------|------|------|
| `robot-nest` | Robot NestJS 完整版 | TypeORM + JWT + Swagger + Redis |
| `robot-nest-base` | Robot NestJS 精简版 | 基础 NestJS + 核心模块 |
| `robot-nest-micro` | Robot NestJS 微服务 | gRPC + 服务发现 |

### 💻 桌面端项目

| 模板 Key | 名称 | 说明 |
|---------|------|------|
| `robot-electron` | Robot Electron 完整版 | Vue3 + Electron + 自动更新 |
| `robot-electron-base` | Robot Electron 精简版 | 基础 Electron + Vue 框架 |

---

## 📖 命令详解

### `robot create [project-name]` — 创建项目

```bash
# 交互式（最常用）
robot create

# 指定项目名 + 模板
robot create my-app -t robot-admin

# 从自定义 Git 仓库创建
robot create my-app --from https://github.com/your-org/your-template

# 预览模式（不实际创建，只展示将要执行的操作）
robot create my-app -t robot-admin --dry-run

# 跳过依赖安装
robot create my-app -t robot-admin --skip-install

# 强制不使用缓存
robot create my-app -t robot-admin --no-cache
```

| 参数 | 说明 |
|------|------|
| `-t, --template <name>` | 指定模板 key（见上方模板一览） |
| `--from <url>` | 从任意 Git 仓库 URL 创建 |
| `--dry-run` | 预览模式，不实际执行 |
| `--skip-install` | 跳过依赖安装 |
| `--no-cache` | 不使用本地缓存 |

### `robot list` — 查看模板列表

```bash
robot list              # 所有模板
robot list -r           # 只看推荐模板
```

### `robot search <keyword>` — 搜索模板

```bash
robot search vue        # 搜 Vue 相关
robot search 微前端     # 搜关键词
robot search admin      # 搜后台管理
```

### `robot doctor` — 环境诊断

```bash
robot doctor            # 检查 Node、Git、包管理器、网络
robot doctor --clear-cache  # 清理模板缓存
```

---

## 🔧 进阶用法

### 包管理器优先级

创建项目时会自动检测已安装的包管理器，推荐顺序：

| 优先级 | 包管理器 | 说明 |
|--------|---------|------|
| 🥇 | **bun** | 极速安装，现代化 |
| 🥈 | **pnpm** | 快速安装，节省磁盘 |
| 🥉 | **yarn** | 兼容性好 |
| 4️⃣ | **npm** | Node.js 内置 |

### 离线缓存

首次下载的模板会自动缓存到 `~/.robot-cli/cache/`。当网络不可用时自动回退到缓存版本。

```bash
# 查看缓存状态
robot doctor

# 清理缓存
robot doctor --clear-cache

# 单次跳过缓存（强制下载最新）
robot create my-app -t robot-admin --no-cache
```

### 从自定义 Git 仓库创建

不限于内置模板，可以从任意公开 Git 仓库创建：

```bash
robot create my-app --from https://github.com/your-org/your-template
robot create my-app --from https://gitee.com/your-org/your-template
```

---

## 🗂 项目结构

```
robot-cli/
├── bin/robot.js            # CLI 入口（thin shim）
├── src/                    # TypeScript 源码
│   ├── config/             # 配置层（模板定义 & CLI 配置）
│   │   ├── index.ts        # 配置统一导出
│   │   ├── templates.config.ts  # 模板注册表
│   │   └── cli.config.ts   # CLI 品牌 & 运行时配置
│   ├── index.ts            # 主入口 & Commander 命令注册
│   ├── create.ts           # 交互式创建流程
│   ├── download.ts         # 模板下载 & 缓存管理
│   ├── templates.ts        # 模板查询 & 远程注册
│   ├── doctor.ts           # 环境诊断
│   ├── utils.ts            # 工具函数
│   └── types.ts            # 类型定义
├── tests/                  # Vitest 单元测试
│   ├── validate.test.ts
│   ├── templates.test.ts
│   └── download.test.ts
├── dist/                   # tsup 构建输出（ESM）
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .github/workflows/      # CI/CD
│   ├── ci.yml              # PR → lint + typecheck + build + test
│   └── release.yml         # tag → publish npm
├── package.json
├── CHANGELOG.md
└── README.md
```

---

## 🛠 二次开发指南

### 1. 克隆 & 启动

```bash
git clone https://github.com/ChenyCHENYU/robot-cli.git
cd robot-cli
bun install          # 安装依赖（或 npm install）
bun run build        # 构建
bun run test         # 运行测试
```

### 2. 本地开发

```bash
bun run dev          # watch 模式构建
bun link             # 全局链接到本地 CLI

# 另一个终端测试
robot create test-app
```

### 3. 添加新模板

编辑 `src/config/templates.config.ts`，在对应分类下新增：

```ts
"robot-your-template": {
  name: "你的模板名称",
  description: "模板描述",
  repoUrl: "https://github.com/your-org/your-repo",
  branch: "main",               // 可选，默认 main
  features: ["特性1", "特性2"],
  version: "full",               // full | base | micro
}
```

**模板仓库规范**：
- 必须包含 `package.json`
- 使用 `_gitignore` 代替 `.gitignore`（npm publish 会忽略 `.gitignore`）
- 使用 `_env.example` 代替 `.env.example`

### 4. 修改 CLI 品牌

```ts
// package.json
{
  "name": "@your-team/your-cli",
  "bin": { "your-cli": "bin/robot.js" }
}

// src/index.ts — 修改 banner、程序名
program.name('your-cli')
```

### 5. 构建 & 发布

```bash
bun run lint         # 代码检查
bun run typecheck    # 类型检查
bun run build        # 构建
bun run test         # 测试

# 发布
npm publish --access public
```

### 技术栈

| 类别 | 工具 |
|------|------|
| 语言 | TypeScript 5.7+ (strict) |
| 构建 | tsup 8 (ESM, target node20) |
| 测试 | Vitest 3 |
| 检查 | oxlint |
| 运行时 | Node.js >= 20 |
| 包管理 | bun (主) / npm (兼容) |

---

## ❓ 常见问题

**Q: 提示 `command not found: robot`**
```bash
bun add -g @agile-team/robot-cli   # 重新全局安装
# 或
npx @agile-team/robot-cli create   # 免安装使用
```

**Q: 模板下载失败 / 超时**
```bash
robot doctor                        # 先诊断网络
robot create my-app --no-cache      # 跳过缓存重试
```

**Q: 如何使用私有仓库模板？**
目前仅支持公开仓库。私有仓库支持计划中。

**Q: Monorepo / 微前端 / 模块联邦有什么区别？**
| 架构 | 适用场景 | 模板 Key |
|------|---------|---------|
| 单体应用 | 中小项目，快速启动 | `robot-admin` |
| Monorepo | 大型项目，多包共享 | `robot-monorepo` |
| MicroApp 微前端 | 多团队协作，独立部署 | `robot-micro-app` |
| Module Federation | 运行时共享模块 | `robot-module-federation` |

---

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

## 📜 许可证

MIT License

## 🔗 链接

- [GitHub](https://github.com/ChenyCHENYU/robot-cli)
- [npm](https://www.npmjs.com/package/@agile-team/robot-cli)
- [Issues](https://github.com/ChenyCHENYU/robot-cli/issues)
- [前端模板仓库](https://github.com/ChenyCHENYU/Robot_Admin)

---

```bash
# 立即体验
bunx @agile-team/robot-cli create my-awesome-project
```