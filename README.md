# Robot CLI

从 Robot 的 PC 管理后台和移动 H5 模板创建项目，选择用途、设置产品名称，再按实际运行要求初始化。

[![npm](https://img.shields.io/npm/v/@agile-team/robot-cli?color=cb3837&label=npm)](https://www.npmjs.com/package/@agile-team/robot-cli)
[![Node](https://img.shields.io/badge/CLI_Node-20.12%2B%20%7C%2022%2B-43853d)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **3.3.0** 更新：三步创建向导、精简模板入口、真实多选、项目启动指引、模板运行复验，以及可重复的终端与安装包验收。详细变更见 [更新日志](CHANGELOG.md)。

## 快速开始

```bash
npx @agile-team/robot-cli create my-project
# 或使用 Bun
bunx @agile-team/robot-cli create my-project

# 全局安装
npm i -g @agile-team/robot-cli
robot create
```

CLI 本身支持 Node.js 20.12+（20.x）或 22+，建议使用 Node.js 24。交互依赖使用的 `util.styleText` 从 [Node 20.12](https://nodejs.org/en/blog/release/v20.12.0) 提供；项目模板还有各自的版本和包管理器要求：

| 项目 | 当前运行要求 | 用途 |
| --- | --- | --- |
| Robot Admin | Node.js ≥22.18.0、Bun ≥1.4.2 | PC 管理后台 |
| Robot H5（Beta） | Node.js `^22.13.0 \|\| ^24.0.0`、pnpm 11.8.0 | 移动浏览器、企业 WebView |

注册表提供创建前提示；下载后会读取模板的 manifest 或 `package.json` 复验实际要求。Node 不兼容时在写入项目之前停止；包管理器缺失或版本不符时先生成文件，提示补齐环境后安装。

## 三步创建

1. **选择项目与用途**：先选 PC 管理后台或移动 H5；需要 Monorepo、MicroApp、模块联邦时进入“更多架构”。PC 主分支再选择精简示例、完整演示或自定义预设。
2. **设置产品与初始化方式**：填写产品名称，选择默认初始化、先生成文件或调整安装与 Git 设置。产品名称用于应用标题，与包名、项目描述分别维护。
3. **核对并创建**：查看目录、预设、运行要求、包管理器、来源和接入提示。完成页显示 Git 提交与依赖安装的实际结果，并给出启动命令。

默认尝试初始化 Git `main` 分支并安装依赖。首次提交未完成会提示检查 Git 身份；依赖安装失败会保留项目文件并返回失败状态，覆盖已有目录时还会保留旧目录备份并显示路径，便于恢复或重试。

## PC 预设

仅 `robot-admin` 主分支支持裁剪：

| 预设 | 行为 |
| --- | --- |
| `lite` · 精简示例 | 移除组件演示与预览、分析仪表盘、外部页面与关于、登录页 3D 背景、Vercel 统计；保留认证、布局、系统管理、国际化、共享工具和行业样例 |
| `full` · 完整演示 | 保留模板全部示例与功能 |
| `custom` · 自定义 | 交互选择保留上述页面与可选功能；国际化和共享运行时始终保留 |

Lite 是减少展示内容的起点，仍包含行业样例，接入业务时需继续配置接口与菜单。裁剪同步页面与菜单入口，仅删除没有剩余源码引用的演示依赖；发现无法安全处理的模板结构时停止，并提示选择 Full 或保留对应模块。

## 可选模板

| 模板 key | 入口 | 来源分支 |
| --- | --- | --- |
| `robot-admin` | 默认 · PC 管理后台 | `Robot_Admin/main` |
| `robot-h5` | 默认 · 移动 H5 / 企业 WebView（Beta） | `Robot_H5/main` |
| `robot-monorepo` | 更多架构 · Bun Workspaces | `Robot_Admin/monorepo` |
| `robot-micro-app` | 更多架构 · MicroApp 主子应用 | `Robot_Admin/micro-app` |
| `robot-module-federation` | 更多架构 · 模块联邦 | `Robot_Admin/module-federation` |

高级架构沿用各分支自己的启动与部署约定，暂不支持 PC 主分支的 Lite/Custom 裁剪。直接使用 `-t` 也可选择对应入口。

Robot H5 当前包含 wl-mbase 企业集成环境。创建后先核对 `project.config.json`、`build/environments.json` 中的后端地址、宿主模式和部署路径；构建环境由 `dev / sit / uat / pre / main` 分支决定。独立 H5 需按模板文档调整这些配置，宿主 SDK、正式接口和真机能力仍需实际接入验证。UniApp 暂未注册为内置模板。

## 命令与参数

```bash
robot create my-admin --yes                         # 默认 PC 精简预设，无交互
robot create my-admin --yes --preset full --no-git   # 完整演示，不初始化 Git
robot create mobile-app -t robot-h5 --yes --title "现场作业"
robot create my-app --yes --dry-run                  # 预览，不下载或写入项目
robot create my-app --yes --skip-install             # 只生成文件，稍后安装
robot create my-app --yes --no-cache                 # 绕过缓存，重新下载
robot create --advanced                             # 直接浏览更多架构
robot create my-app --from https://github.com/org/repo
```

| 参数 | 说明 |
| --- | --- |
| `-t, --template <key>` | 指定内置模板，未知或未上线的模板立即报错 |
| `-y, --yes` | 使用默认值创建，必须提供项目目录；默认 PC 预设为 `lite` |
| `--preset <lite\|full\|custom>` | PC 主分支用途预设；Custom 需要交互，不能与 `--yes` 同用 |
| `--title <title>` | 应用展示名称，默认与项目目录相同 |
| `--description <text>` / `--author <name>` | 项目描述与作者 |
| `--package-manager <name>` | 为允许选择的模板指定 bun、pnpm、yarn 或 npm；模板要求优先 |
| `--no-git` / `--skip-install` | 分别跳过 Git 初始化、依赖安装 |
| `--dry-run` | 预览创建计划；远端契约在正式下载后校验 |
| `--no-cache` | 不读取或写入模板缓存 |
| `--advanced` | 在交互创建时直接显示完整的可用架构列表 |
| `--from <url>` | 使用自定义 Git 仓库，与 `--template` 互斥 |

自动化或重定向输入时使用 `--yes`。已有目录不会被 `--yes` 覆盖；交互创建会先确认并备份，文件生成失败后恢复原目录。下载期间若另一个进程创建了目标目录，CLI 会停止，不合并或删除该目录。

自定义仓库使用通用项目初始化，并读取 `package.json` 的运行要求；不会自动执行仓库里的模板初始化脚本。启动方式与业务接入以原仓库 README 为准。

```bash
robot list                 # 可用模板
robot list -r              # 默认推荐起点
robot list --all           # 额外查看尚未上线的规划
robot search h5            # 按名称、技术或功能搜索可用模板
robot search react --all   # 搜索范围包含规划
robot doctor               # CLI 环境诊断
robot doctor -t robot-admin # 按 PC 模板检查 Node 与 Bun 要求
robot doctor -t robot-h5    # 按 H5 模板检查 Node 与 pnpm 要求
robot doctor --clear-cache # 清理模板缓存
```

`doctor` 可按指定模板检查 Node 和必需包管理器，并给出下一步命令；Git 与其他包管理器缺失作为可选信息显示。下载后的真实契约仍由创建流程复验。

## 生成后从哪里继续

原模板 README 保留，另外生成：

- **`ROBOT_PROJECT.md`**：当前预设、运行要求、启动与检查命令，以及 PC/H5 的首次接入事项。
- **`.robot-cli/project.json`**：模板来源、分支、包版本、创建时间、运行要求和缓存来源记录。Git 下载会记录解析出的 commit；无法可靠识别 commit 的归档下载明确标为未提供。

这些记录帮助确认项目来自哪里、如何继续开发；文件生成和依赖安装完成不代表正式接口、宿主或部署已经验收。H5 自带初始化器生成的 `.jhlc/project.json` 仍按模板自身约定保留。

## 下载与缓存

有镜像配置时先尝试 Gitee Git 克隆，再尝试原仓库；Git 失败后使用 HTTP ZIP 下载并切换可用源。Git 继承系统代理配置；HTTP 响应、内容、解压与项目根目录都会验证，失败信息保留来源与原因。

模板缓存位于 `~/.robot-cli/cache/`：

- **24 小时内**复用缓存，展示下载时间与来源。
- **缓存过期**先联网刷新；所有下载方式失败时可降级使用旧缓存，并明确提示。
- **`--no-cache`** 强制联网下载；`robot doctor --clear-cache` 清理缓存。

Git 克隆和 HTTP 下载均有超时处理，下载中按 Ctrl+C 会终止任务并清理本次临时数据。缓存命中不保证上游最新；需要最新内容时使用 `--no-cache`。

## 本地开发与验证

```bash
git clone https://github.com/ChenyCHENYU/robot-cli.git
cd robot-cli
bun install --frozen-lockfile
bun run build
node bin/robot.js create my-app --yes --dry-run

bun run dev        # 监听构建
bun run check      # lint、typecheck、单元与命令回归
bun run build      # 发布产物构建
bun run smoke:terminal # 真实终端交互回归（macOS / Linux，需要 Python 3）
bun run test:package   # 打包后在独立目录安装生产依赖，检查 Node/Bun 入口

# 模板真实生成验收（需要联网安装依赖）
bun run smoke:robot-admin -- --preset all
bun run smoke:robot-h5
```

模板注册位于 [src/config/templates.config.ts](src/config/templates.config.ts)。通用模板需要根目录有效的 `package.json`；需要专用初始化时，显式注册 manifest 身份和无 shell 的 Node 脚本入口。当前 H5 使用 manifest，其他模板主要读取 `package.json`，尚未统一全部模板协议。

CI 检查 Node 20/22/24 下的 CLI，并在 Node 24 检查真实终端交互。模板定时/手动冒烟覆盖 PC Full/Lite 与 H5 的独立安装和构建；高级架构及移动真机仍需各自验收。

## 发布

```bash
bun run check
bun run smoke:terminal
bun run test:package
bun run release:dry-run
bun run release:patch     # 确定发版时再执行；也可选择 minor / major
bun run release:publish   # 本地登录 npm 后发布
git push origin main
git push origin vX.Y.Z    # 仅推送本次 tag
```

维护者使用 Bun 在本地发布。`prepublishOnly` 执行检查，`prepack` 构建 `dist`；GitHub Actions 负责 CI，不持有 npm 凭据。发布前更新版本、README 和 CHANGELOG，并验证打包后的安装入口；仅推送本次版本标签。

[GitHub](https://github.com/ChenyCHENYU/robot-cli) · [Robot Admin](https://github.com/ChenyCHENYU/Robot_Admin) · [Robot H5](https://github.com/ChenyCHENYU/Robot_H5) · [路线图](ROADMAP.md) · [更新日志](CHANGELOG.md)

MIT
