# Robot CLI — 路线图

> 最后更新: 2026-03-30 (v3.1.0)

---

## 已上线 (v3.x)

| 能力 | 说明 |
|------|------|
| **5 个生产就绪模板** | Robot Admin 完整版、Monorepo、MicroApp 微前端、Module Federation、uni-app，全部可一键创建 |
| **模板配置系统（v3.1 新增）** | Robot Admin 完整版支持 Full/Lite/Custom 三档配置，精准裁剪演示页面、可选功能和依赖 |
| **git clone 下载引擎** | 使用 `git clone --depth=1`，与 create-vue/degit 同方案，自动继承系统代理，实时进度条 |
| **Gitee 国内加速** | Gitee 优先克隆，GitHub 兜底，HTTP ZIP 二次兜底，三层容错 |
| **@clack/prompts 现代交互** | 4 种模板选择方式（推荐/分类/搜索/全部），确认面板，美化输出 |
| **离线缓存** | 首次下载自动缓存，网络断了也能用 |
| **环境诊断 `robot doctor`** | 检测 Node/Git/包管理器/网络，一键排查 |
| **coming-soon 防护** | 未上线的 9 个模板标记为"开发中"，选择时跳过，不会让用户踩坑 |
| **CI/CD** | GitHub Actions: PR 自动检查，tag 自动发 npm |
| **52 个单元测试** | 覆盖校验、模板查询、下载 URL 构建、模板裁剪引擎 |

---

## 模板配置系统 (v3.1)

> **核心思路**：选择 Robot Admin 完整版时，CLI 自动提供 Full / Lite / Custom 三种配置模式，裁剪规则内置于 CLI，无需在模板项目中添加任何文件。

### 三种模式

| 模式 | 说明 |
|------|------|
| **完整版（Full）** | 保留全部功能，等同于直接 clone 主分支 |
| **精简版（Lite）⭐** | 移除演示页面、仪表盘、i18n、统计、可选包、3D 背景等，保留核心业务框架 + 系统管理 |
| **自定义（Custom）** | 用户逐项选择要保留的页面模块（4 项）、功能模块（3 项）、@robot-admin 可选包（4 项） |

### 可裁剪模块一览

| 分类 | 模块 | Lite 默认裁剪 |
|------|------|:---:|
| 页面模块 | 演示页面（56 个组件示例 + 预览系统） | ✅ |
| 页面模块 | 仪表盘（ECharts 图表页面） | ✅ |
| 页面模块 | 系统管理页面（用户/角色/权限/菜单/字典） | — |
| 页面模块 | 外部页面 + 关于 | ✅ |
| 功能模块 | 国际化（i18n 多语言支持） | ✅ |
| 功能模块 | 登录页 3D 背景（Spline 动画） | ✅ |
| 功能模块 | Vercel Analytics（线上统计） | ✅ |
| 可选包 | @robot-admin/directives | ✅ |
| 可选包 | @robot-admin/file-utils | ✅ |
| 可选包 | @robot-admin/form-validate | ✅ |
| 可选包 | @robot-admin/git-standards | ✅ |

> 无论选择何种模式，`vue-command-palette` 和 `motion-v`（零使用依赖）始终被自动清理。

---

## 模板上线计划

### 已上线

| 模板 | 仓库 | 分支 |
|------|------|------|
| Robot Admin 完整版 | `Robot_Admin` | main |
| Robot Monorepo | `Robot_Admin` | monorepo |
| Robot MicroApp 微前端 | `Robot_Admin` | micro-app |
| Robot Module Federation | `Robot_Admin` | module-federation |
| Robot uni-app 完整版 | `Robot_Uniapp` | main |

### 待建仓

| 模板 | 需要创建的仓库 | 优先级 |
|------|---------------|--------|
| Robot React 完整版/精简版 | `Robot_React` | 中 |
| Robot NestJS 完整版/精简版 | `Robot_Nest` | 中 |
| Robot uni-app 精简版 | `Robot_Uniapp_Base` | 低 |
| Robot Electron | `Robot_Electron` | 低 |
| Robot NestJS 微服务 | `Robot_Nest_Micro` | 低 |

---

## 远期方向 (v4.x)

| 方向 | 说明 |
|------|------|
| **更多模板配置支持** | 将模板配置系统扩展到其他模板（Monorepo、MicroApp 等） |
| **monorepo 子包脚手架** | `robot add auth-module` 在 monorepo 中快速添加新子包 |
| **模板版本锁定** | `robot create my-app -t robot-admin@v2.0` 指定 tag |
| **私有模板注册表** | 企业内部模板源 `robot registry add https://...` |
| **插件系统** | `robot plugin add eslint-config` 一键注入配置 |
