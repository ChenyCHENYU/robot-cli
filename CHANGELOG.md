# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
