# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [3.1.1] - 2026-03-30

### Fixed

- **自定义配置选择交互修复** — 将 Custom 模式的 `multiselect` 替换为 `groupMultiselect`，按页面模块/功能模块/可选包分组显示，修复部分终端下无法交互选择的问题

## [3.1.0] - 2026-03-30

### Added

- **模板配置系统** — Robot Admin 完整版支持 Full / Lite / Custom 三档配置模式
  - **Full（完整版）**：保留全部 74 个页面和功能，等同于直接 clone 主分支
  - **Lite（精简版）⭐**：移除 56 个演示页面 + 仪表盘 + i18n + 统计 + 可选包 + 3D 背景等，保留核心业务框架 + 系统管理
  - **Custom（自定义）**：用户逐项选择要保留的页面模块（4 项）、功能模块（3 项）、@robot-admin 可选包（4 项）
- **11 个可裁剪模块**：演示页面、仪表盘、系统管理、外部页面、国际化、登录 3D、Vercel Analytics、directives、file-utils、form-validate、git-standards
- **零使用依赖自动清理**：无论选择何种模式，vue-command-palette 和 motion-v 始终被清理
- **裁剪引擎**：自动处理目录/文件删除、package.json 依赖移除、dynamicRouter.json 路由裁剪、源码修改（main.ts / plugins / vite.config 等）
- **19 个新增单元测试**：覆盖所有裁剪组、模板识别、模式选择、容错处理

### Changed

- 确认面板新增「模板配置」行，显示当前裁剪模式摘要
- Dry-run 模式新增裁剪步骤预览
- 单元测试总数从 33 增至 52
- 更新 README 为中英文双语（默认中文）
- 更新 ROADMAP，v3.1 标记为已上线

## [3.0.6] - 2026-03-29

### Fixed

- **修复推荐模板引用不存在的仓库** — 移除 `robot-nest`、`robot-react`，替换为已上线的 `robot-uniapp`
- **项目统计美化** — 从丑陋的逐行列表改为紧凑的两行面板（文件/目录/大小 + 文件类型分布）

### Changed

- **全面重写 README** — 聚焦已上线能力，移除未上线模板列表，精简到关键信息
- **重写 ROADMAP** — 聚焦后置配置系统方案（含 `robot.config.json` 规范）和模板上线计划，去掉空洞的对比分析

## [3.0.4] - 2026-03-29

### Changed (Breaking)

- **彻底重写下载策略 — `git clone --depth=1` 作为主方案**
  - 根本原因分析：HTTP ZIP 下载受到国内网络封锁、Gitee 登录拦截、Content-Type 不一致等各种干扰，是错误的技术路线
  - `git clone --depth=1` 是 create-vue / create-vite / degit / giget 等所有主流 CLI 的底层实现
  - 自动继承用户系统级 git 代理配置 (`http.proxy` / `https.proxy`)，无需 CLI 工具自己处理网络问题
  - 实时显示 git 进度条（解析 git stderr 百分比输出）
  - 无超时问题：git 自己管理连接，有数据在流就不断
  - 无 ZIP 解析问题：直接输出目录结构

- **优先顺序**：Gitee git clone（国内快）→ GitHub git clone → HTTP ZIP 兜底（仅当系统无 git 时）

- **缓存前置**：启动时先检查缓存，命中则直接用，不发起任何网络请求

## [3.0.3] - 2026-03-29

### Fixed

- **根治下载超时的真正根因** — `AbortSignal.timeout(ms)` 是总时限（含 body 流式下载），大文件（10-20MB）在国内网络 30 秒内根本下不完，必然中断
  - 改用 `AbortController` + 手动 `clearTimeout`：只对"连接建立/收到响应头"计时（30s），一旦连接成功立即取消计时器，body 流式下载不再受任何时间限制
  - 与 v1.x 的 `node-fetch` `timeout` 行为完全一致（活跃超时，而非总时限）

## [3.0.2] - 2026-03-29

### Fixed

- **根治 ZIP 下载内容校验问题** — 新增两层防护:
  1. `Content-Type` 检测: 若服务器返回 `text/html`（登录页/CAPTCHA/跳转页）立即报错，`tryDownload` 自动切换到下一个源（codeload CDN → GitHub API → github.com）
  2. ZIP 魔术字节校验 (`PK 50 4B`): 写入磁盘前检查 buffer 头部，若不是合法 ZIP 抛出含内容预览的可读错误，而非让 `extract-zip` 报 `end of central directory record signature not found`

## [3.0.1] - 2026-03-28

### Fixed

- **下载策略全面重写** — 参考 giget (unjs/giget, 306k+ 项目使用) 的下载方式:
  - Gitee 备用源提升为首选 (国内用户最快)
  - 使用 `codeload.github.com` 直连 CDN 替代 `github.com/archive/` (跳过 302 重定向)
  - 使用 `api.github.com` REST API 作为二级备选 (与 giget 一致)
  - `github.com` 原始链接降为最后兜底
- **移除不稳定第三方镜像** — 移除 `hub.gitmirror.com` 和 `ghproxy.net` (不可控第三方代理)
- **超时优化** — 快速源 (Gitee/codeload) 30s, 慢速源 (API/github.com) 60s, 不再需要 120s
- **重试缩减** — 每源 2 次重试 (原 3 次), 退避时间 1s/2s (原 2s/4s), 快速失败切换下一源
- **错误信息增强** — 失败时列出每个源的具体错误原因

## [3.0.0] - 2026-03-28

### ⚠️ BREAKING CHANGES

- 交互界面从 `inquirer` 全面迁移至 `@clack/prompts`，视觉体验完全不同
- 移除 `inquirer` 和 `@types/inquirer` 依赖

### Added

- **@clack/prompts 现代化 UI**：使用 `p.select`、`p.text`、`p.confirm`、`p.note`、`p.intro`/`p.outro` 等，交互体验对齐 create-vue
- **Banner 框框展示**：双线框 `╔══╗` 样式包裹 ROBOT CLI 标题，信息分区更清晰
- **下载进度条**：基于 `content-length` 的流式进度条 `[████████░░░░] 40% 1.0MB/2.6MB`
- **Gitee 备用源**：模板配置新增 `giteeUrl` 字段，GitHub 不可达时自动切换 Gitee 下载
  - robot-admin / monorepo / micro-app / module-federation → `gitee.com/ycyplus163/Robot_Admin`
  - robot-uniapp → `gitee.com/ycyplus163/Robot_uniApp`
- **取消操作支持**：所有交互步骤支持 Ctrl+C 优雅退出 (`p.isCancel`)

### Changed

- 主菜单、模板选择、项目配置、确认创建等全部替换为 @clack/prompts 组件
- 项目创建完成信息使用 `p.note` 卡片式展示
- 分类浏览流程简化：自动跳过只有单一选项的层级
- 项目配置不再需要最后的"确认配置"步骤（逐项确认更自然）
- 构建产物从 ~63KB 减小至 ~59KB

### Removed

- `inquirer` 依赖及其 `@types/inquirer` 类型定义
- `getVersionLabel()` 辅助函数（改为内联 `VERSION_LABELS` 查找）

## [2.3.0] - 2026-03-28

### Fixed (Root-Cause)

- **下载超时**：超时时间从 15s → 120s（主站）/ 60s（镜像），适配中国网络环境
- **下载无重试**：新增 `fetchWithRetry()`，每个源最多重试 3 次，指数退避（2s→4s）
- **镜像失效**：从 1 个已失效的 `ghproxy.com` → 3 个源（`github.com` + `gitmirror` + `ghproxy.net`）
- **双重报错**：下载失败后内外两层 catch 都打印错误 → 内层 return 终止，只输出一次
- **Windows emoji 乱码**：全面移除所有源文件中的 emoji，分类名 / spinner.text / doctor 输出全部改为纯文本 + chalk 着色

### Changed

- Banner 从 `gradient-string` 多行 Unicode 框线 → `chalk.bold.cyan` 极简纯文本（参考 create-vue）
- 移除 `gradient-string` 依赖（减小包体积）
- doctor 诊断图标从 emoji → ASCII `[OK]` / `[!!]` / `[NO]`
- package.json description 移除 emoji 前缀

## [2.2.0] - 2026-03-28

### ⚠️ BREAKING CHANGES

- 完全迁移至 TypeScript，输出从 `lib/` 变更为 `dist/`
- CLI 入口变更为 `bin/robot.js`
- 最低要求 Node.js >= 20

### Added

- **TypeScript 重写**：全量迁移至 TypeScript 5.7+，严格模式，完整类型覆盖
- **tsup 构建**：使用 tsup 8 构建，单文件 ESM 输出，目标 Node 20+
- **Vitest 测试**：使用 Vitest 3 单元测试（验证名称校验、模板搜索、下载 URL 构建等）
- **GitHub Actions CI**：PR 自动运行 lint + typecheck + build + test（Node 20/22 矩阵）
- **GitHub Actions Release**：tag 推送自动发布 npm + 创建 GitHub Release
- **离线缓存**：首次下载的模板缓存至 `~/.robot-cli/cache/`，网络异常时自动回退到缓存
- **`robot doctor` 命令**：诊断 Node.js、Git、包管理器、网络连接、缓存状态
- **`robot doctor --clear-cache`**：清理模板缓存
- **`robot create --from <url>`**：从自定义 Git 仓库 / zip URL 创建项目
- **`robot create --no-cache`**：跳过缓存，强制下载最新模板
- **远程模板注册表**：支持从远程 JSON 加载额外模板，与内置模板合并
- **`getCategoryForTemplate()`**：根据模板 key 查找所属分类
- **`getCacheStats()` / `clearCache()`**：缓存管理 API

### Changed

- 项目结构迁移：`lib/*.js` → `src/*.ts` → `dist/index.js`
- 构建工具：无 → tsup 8 (ESM bundle)
- 测试框架：手动测试 → Vitest 3
- 代码检查：oxlint (保留)
- 类型系统：无 → TypeScript strict

---

## [1.2.0] - 2026-03-28

### Added

- `--dry-run` 模式：预览项目创建过程，不实际执行任何操作
- CLI 版本更新检查：在主菜单显示时自动检查最新版本
- `getGitUser()` 工具函数：自动读取 Git 用户名作为默认作者
- `checkForUpdates()` 工具函数：轻量级 npm 版本检查
- oxlint 代码检查配置
- CHANGELOG.md 变更日志

### Fixed

- **`process.chdir()` 反模式**：`installDependencies()` 和 `initializeGitRepository()` 不再使用 `process.chdir()`，改用 `execSync(cmd, { cwd })` 选项，消除全局状态污染风险
- **`response.buffer()` 废弃 API**：替换为 `Buffer.from(await response.arrayBuffer())`，兼容 Node 20+ 内置 `fetch`
- **`tarao` 拼写错误**：修正为 `taro`（京东 Taro 跨端框架）
- **默认作者硬编码**：改为自动读取 `git config user.name`
- **`selectFromAll()` 硬编码分类**：改为基于 `TEMPLATE_CATEGORIES` 动态构建，新增模板无需修改展示逻辑
- **`fetch` timeout 用法**：从 `node-fetch` 的 `{ timeout }` 迁移到原生 `AbortSignal.timeout()`

### Changed

- 移除 `node-fetch` 依赖，使用 Node 20+ 内置 `fetch`（减少运行时依赖）
- 简化 `bin/index.js` 中的 `resolveLibPath()`，从 7 个候选路径精简为 2 个
- 移除 `bin/index.js` 中未使用的 `resolve` 导入

## [1.1.12] - Previous

### Features

- 多技术栈模板支持（Vue/React/uni-app/NestJS/Koa/Electron/Tauri）
- 智能包管理器检测，优先推荐 bun
- 四种模板选择方式：推荐/分类/搜索/全部
- 多级返回导航
- GitHub 镜像回退下载
- 文件复制进度展示
