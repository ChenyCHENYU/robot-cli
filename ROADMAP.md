# Robot CLI — 迭代分析 & 路线图

> 最后更新: 2026-03-28 (v3.0.0)

---

## 一、当前完成度评估

### 核心功能 (已实现)

| 功能 | 状态 | 说明 |
|------|------|------|
| 交互式创建流程 | 完成 | 4 种选择方式 (推荐/分类/搜索/全部) |
| 14 个内置模板 | 完成 | Vue/React/uni-app/NestJS/Electron，full/base/micro 版本 |
| 多包管理器支持 | 完成 | bun > pnpm > yarn > npm 自动检测 |
| 分支下载 | 完成 | 同仓库不同分支 = 不同架构模板 |
| 离线缓存 | 完成 | ~/.robot-cli/cache/ 自动缓存，网络异常回退 |
| 重试 + 多镜像 + Gitee 备用源 | 完成 (v2.3+v3.0) | 3 个镜像源 + Gitee 备用源，每个重试 3 次，指数退避 |
| --from 自定义仓库 | 完成 | 支持 GitHub/Gitee/GitLab |
| --dry-run 预览 | 完成 | 不实际创建，展示执行计划 |
| robot doctor 诊断 | 完成 | Node/Git/包管理器/网络/缓存 |
| 版本更新通知 | 完成 | 自动检查 npm 最新版 |
| CI/CD | 完成 | GitHub Actions PR 检查 + tag 发布 |
| 单元测试 | 完成 | 33 个测试，覆盖校验/模板/下载 |
| TypeScript | 完成 | strict 模式，完整类型 |

### 综合完成度: ~85%

> 作为 **"模板下载型"** 脚手架，核心链路已完整可用。
> v3.0 已迁移到 @clack/prompts 现代化 UI，增加下载进度条和 Gitee 备用源。
> 距离社区顶级工具 (create-vue / create-vite) 的差距主要在 **模板生成模式** 和 **后置配置系统**。

---

## 二、与社区顶级脚手架对比

### 架构模式对比

| 维度 | Robot CLI (当前) | create-vue | create-vite |
|------|-----------------|------------|-------------|
| **模板模式** | 整包下载 (zip) | 本地组合拼装 | 本地模板复制 |
| **定制粒度** | 选择完整/精简版 | 逐项 toggle (TS/Router/Pinia/ESLint...) | 选框架+变体 |
| **模板存储** | 远程 GitHub 仓库 | 内置在包里 (template/) | 内置在包里 |
| **离线可用** | 有缓存回退 | 完全离线 (模板随包分发) | 完全离线 |
| **交互库** | @clack/prompts (v3.0) | @clack/prompts | @clack/prompts |
| **UI 风格** | 现代化 confirm/select | 现代 confirm/select | 现代 confirm/select |
| **包体积** | ~22KB (gz) | ~270KB (gz, 含所有模板) | ~35KB (gz) |
| **网络依赖** | 创建时必须联网(或有缓存) | 零网络依赖 | 零网络依赖 |
| **更新机制** | 用户 npm update | 用户 npm update | 用户 npm update |
| **模板更新** | 即时 (每次从 GitHub 拉最新) | 跟随包版本发布 | 跟随包版本发布 |

### 关键差距分析

#### 1. 整包下载 vs Feature Toggle (插件/Preset 系统)

**现状**: Robot CLI 的模板是「整包下载」— 用户选一个模板，从 GitHub 下载完整 zip。

**create-vue 的做法**: 模板以 **零碎片段** 存在包里，用户回答一组 boolean 问题 (要不要 TypeScript? 要不要 Router? 要不要 Pinia? 要不要 ESLint?)，CLI 在本地 **拼装** 出最终项目。

```
create-vue 的 template 目录结构:
template/
  base/           ← 始终复制
  config/
    jsx/          ← 选了 JSX 才复制
    router/       ← 选了 Router 才复制
    pinia/        ← 选了 Pinia 才复制
    typescript/   ← 选了 TS 才复制
    vitest/       ← 选了测试才复制
    ...
```

**这个能用在 Robot CLI 吗？**

可以，但需要 **根本性的架构变更**:

- 当前: 模板存在远程 GitHub 仓库，CLI 只是下载器
- Feature Toggle: 模板必须内置到 CLI 包里，按功能拆分为片段目录

**是否值得做？** 取决于定位:

| 定位 | 适合的模式 | 理由 |
|------|-----------|------|
| **企业脚手架** (当前) | 整包下载 | 模板由团队维护，统一标准，不允许用户随意裁剪 |
| **社区通用工具** | Feature Toggle | 用户需要自由度，按需组合 |
| **混合模式** (推荐演进方向) | 整包 + 后置配置 | 下载后通过交互式问答裁剪/开关功能 |

> **建议: 不必全面转向 Feature Toggle，而是在整包下载后增加「后置配置」阶段。**
> 比如下载 robot-admin 后，询问「是否需要权限模块？是否需要图表组件？」然后删除不需要的模块。
> 这样既保持远程模板的灵活更新，又提供了定制能力。

#### 2. inquirer vs @clack/prompts (v3.0 已完成迁移)

| 维度 | inquirer (v2.x) | @clack/prompts (v3.0 当前) |
|------|---------------|---------------------------|
| UI 风格 | 传统命令行列表 | 现代化，带框线和颜色 |
| Windows 兼容 | 好 | 好 |
| 包体积 | 较大 (readline 依赖链) | 极轻 |
| 维护状态 | 成熟稳定 | 活跃 |
| API 风格 | 配置对象 | 函数式 |

**迁移成本**: 中等。已在 v3.0 完成重写所有 prompt 调用。  
**迁移收益**: 视觉效果显著提升，包体积减小。  
**状态**: ✅ 已完成 (v3.0)

#### 3. 远程模板 vs 内置模板

| 维度 | 远程模板 (Robot CLI) | 内置模板 (create-vue) |
|------|-------|--------|
| 模板更新 | 即时 (模板仓库推代码即生效) | 跟随 CLI 版本发布 |
| 离线体验 | 需缓存 | 完全离线 |
| 首次速度 | 慢 (需下载) | 快 (本地复制) |
| 维护模式 | 模板和 CLI 独立维护 | 同步维护 |

**Robot CLI 的远程模板模式是一个合理的选择**:
- 14 个模板如果全部内置，CLI 包会膨胀到 50MB+
- 模板独立迭代，不需要每次改模板都发 CLI 版本
- 适合企业场景：模板仓库有独立的 CI/CD

---

## 三、迭代优化建议 (按优先级排序)

### P0 — 近期 (v2.4 ~ v2.5)

#### 1. 后置配置系统 (Post-download Configuration)

在模板下载后，根据模板类型提供可选裁剪:

```
✔ 下载完成: Robot Admin 完整版

配置项目功能:
  ◻ 权限管理模块 (默认开启)
  ◻ 图表组件 (ECharts)
  ◻ 国际化 (i18n)
  ◻ Mock 数据模块
  ◻ 单元测试配置
```

实现方式: 每个模板仓库根目录增加 `robot.config.json`:
```json
{
  "toggles": [
    { "name": "auth", "label": "权限管理模块", "default": true, "remove": ["src/modules/auth/"] },
    { "name": "charts", "label": "图表组件", "default": true, "remove": ["src/components/charts/"] },
    { "name": "i18n", "label": "国际化", "default": false, "remove": ["src/locales/", "src/plugins/i18n.ts"] }
  ]
}
```

**工作量**: ~2-3 天  
**收益**: 让整包下载模式也具备定制能力，这是 Robot CLI 最独特的差异化方向

#### 2. 模板健康检查

`robot doctor` 增加对所有模板仓库的可达性检测:

```
[OK] robot-admin       github.com/ChenyCHENYU/Robot_Admin (main)
[OK] robot-monorepo    github.com/ChenyCHENYU/Robot_Admin (monorepo)
[NO] robot-nest-micro  github.com/ChenyCHENYU/Robot_Nest_Micro (404)
```

#### 3. 下载进度条 (✅ v3.0 已完成)

已实现基于 content-length 的流式下载进度条:

```
下载中 [████████░░░░░░░░░░░░] 40% 1.0MB/2.6MB (github.com)
```

### P1 — 中期 (v3.x)

#### 4. 迁移到 @clack/prompts (✅ 已在 v3.0 完成)

已替换 inquirer，获得现代化交互 UI。使用 `p.select`、`p.text`、`p.confirm`、`p.note`、`p.intro`/`p.outro` 等。

同时实现:
- Gitee 备用源 (国内用户 GitHub 不可达时自动切换)
- 下载进度条 (基于 content-length 流式显示)
- Banner 框框展示 (双线框 UI)

#### 5. monorepo 子包创建

```bash
robot add auth-module      # 在 monorepo 中添加新子包
robot add shared-utils     # 添加共享工具包
```

#### 6. 模板版本管理

支持指定模板仓库的 tag/commit:

```bash
robot create my-app -t robot-admin@v2.0.0    # 指定版本
robot create my-app -t robot-admin@abc1234    # 指定 commit
```

### P2 — 长期 (v3.x+)

#### 7. 插件系统

```bash
robot plugin add eslint-config     # 安装 ESLint 配置插件
robot plugin add husky-hooks       # 安装 Git Hooks 插件
```

#### 8. 私有模板注册表

```bash
robot registry add https://your-company.com/templates.json
robot create my-app -t @company/admin-template
```

#### 9. GUI 模式

```bash
robot create --gui    # 打开浏览器可视化界面
```

使用 vite 启动临时本地服务，Web 界面选模板和配置。

---

## 四、技术债务

| 项目 | 严重度 | 说明 |
|------|--------|------|
| `config as unknown as ProjectConfig` | 已修复 (v3.0) | configureProject 重写后不再需要不安全类型转换 |
| `loadRemoteRegistry()` 未使用 | 低 | 已实现但从未调用，可删除或接入 |
| inquirer 类型补丁 | 已修复 (v3.0) | 已移除 inquirer，使用 @clack/prompts |
| 无集成测试 | 中 | 只有单元测试，缺少真实下载+创建的 E2E 测试 |
| 无覆盖率报告 | 低 | 可加 vitest --coverage |

---

## 五、项目定位总结

Robot CLI 是一个 **企业级多技术栈模板脚手架**，其核心价值是:

1. **统一团队规范** — 14 个模板覆盖前后端移动桌面，确保新项目都从标准化起点出发
2. **远程模板即时更新** — 模板仓库推代码即生效，无需跟着发 CLI 版本
3. **多架构支持** — 同一仓库通过分支区分单体/Monorepo/微前端/模块联邦
4. **弱网容错** — 多镜像 + 重试 + 缓存回退

与 create-vue / create-vite 的本质区别是:

| | Robot CLI | create-vue / create-vite |
|---|---|---|
| **目标用户** | 企业团队 | 社区开发者 |
| **模板粒度** | 完整项目模板 | 最小化骨架 + 按需拼装 |
| **核心能力** | 下载 + 缓存 + 多仓库 | 本地组合 + 代码生成 |
| **扩展方向** | 后置配置裁剪 | Feature Toggle |

**不需要也不应该完全模仿 create-vue**，而是走自己的「远程模板 + 后置配置」路线。
