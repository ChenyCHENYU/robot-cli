# Robot CLI — 路线图

> 最后更新: 2026-03-29 (v3.0.5)

---

## 已上线 (v3.x)

| 能力 | 说明 |
|------|------|
| **5 个生产就绪模板** | Robot Admin 完整版、Monorepo、MicroApp 微前端、Module Federation、uni-app，全部可一键创建 |
| **git clone 下载引擎** | 使用 `git clone --depth=1`，与 create-vue/degit 同方案，自动继承系统代理，实时进度条 |
| **Gitee 国内加速** | Gitee 优先克隆，GitHub 兜底，HTTP ZIP 二次兜底，三层容错 |
| **@clack/prompts 现代交互** | 4 种模板选择方式（推荐/分类/搜索/全部），确认面板，美化输出 |
| **离线缓存** | 首次下载自动缓存，网络断了也能用 |
| **环境诊断 `robot doctor`** | 检测 Node/Git/包管理器/网络，一键排查 |
| **coming-soon 防护** | 未上线的 9 个模板标记为"开发中"，选择时跳过，不会让用户踩坑 |
| **CI/CD** | GitHub Actions: PR 自动检查，tag 自动发 npm |
| **33 个单元测试** | 覆盖校验、模板查询、下载 URL 构建 |

---

## 下阶段：后置配置系统 (v3.1)

> **核心思路**：模板下载后，根据 `robot.config.json` 提供功能开关，让用户裁剪不需要的模块。

### 你需要做什么

在每个模板仓库的**根目录**新增一个 `robot.config.json` 文件：

```json
{
  "postSetup": {
    "toggles": [
      {
        "name": "auth",
        "label": "权限管理模块",
        "default": true,
        "paths": ["src/modules/auth", "src/router/auth-routes.ts"]
      },
      {
        "name": "charts",
        "label": "图表组件 (ECharts)",
        "default": true,
        "paths": ["src/components/charts", "src/views/dashboard/charts"]
      },
      {
        "name": "i18n",
        "label": "国际化 (i18n)",
        "default": false,
        "paths": ["src/locales", "src/plugins/i18n.ts"]
      },
      {
        "name": "mock",
        "label": "Mock 数据",
        "default": false,
        "paths": ["mock/", "src/utils/mock-adapter.ts"]
      }
    ]
  }
}
```

### 字段说明

| 字段 | 类型 | 作用 |
|------|------|------|
| `name` | string | 功能标识，唯一 |
| `label` | string | 界面显示名称 |
| `default` | boolean | 默认是否开启（`true` = 用户不操作就保留）|
| `paths` | string[] | 关闭该功能时要删除的文件/目录（相对于项目根目录）|

### CLI 端行为（我来实现）

```
✔ 模板下载完成 (Robot Admin 完整版)

◆ 配置项目功能:
│  ✔ 权限管理模块 (默认保留)
│  ✔ 图表组件 (默认保留)
│  ○ 国际化 (默认关闭)
│  ○ Mock 数据 (默认关闭)
└
```

1. 检测模板里是否有 `robot.config.json`
2. 有 → 展示 toggle 列表，用户用空格切换
3. 关闭的功能 → 删除对应 `paths`
4. 删除 `robot.config.json` 本身（不留在用户项目里）
5. 没有该文件 → 跳过，行为和现在完全一样

### 每个模板的配置建议

| 模板 | 建议的 toggles |
|------|---------------|
| **robot-admin** | 权限模块、图表、国际化、Mock、主题切换、水印 |
| **robot-monorepo** | 示例子包 (`packages/demo`)、文档站 (`packages/docs`) |
| **robot-micro-app** | 示例子应用、共享状态 |
| **robot-module-federation** | 示例远程模块 |
| **robot-uniapp** | 示例页面、uView 组件演示 |

> **第一步**：先给 `Robot_Admin`（main 分支）加上 `robot.config.json`，我来实现 CLI 读取和执行逻辑。其他模板后续补。

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
| Robot Admin 精简版 | `Robot_Admin_Base` 或 `Robot_Admin` (base 分支) | 高 —— 最常被选中 |
| Robot React 完整版/精简版 | `Robot_React` | 中 |
| Robot NestJS 完整版/精简版 | `Robot_Nest` | 中 |
| Robot uni-app 精简版 | `Robot_Uniapp_Base` | 低 |
| Robot Electron | `Robot_Electron` | 低 |
| Robot NestJS 微服务 | `Robot_Nest_Micro` | 低 |

> **建议**：精简版可以直接用主仓库的 `base` 分支，和 monorepo/micro-app 保持一致的分支策略，不用新建仓库。

---

## 远期方向 (v4.x)

| 方向 | 说明 |
|------|------|
| **monorepo 子包脚手架** | `robot add auth-module` 在 monorepo 中快速添加新子包 |
| **模板版本锁定** | `robot create my-app -t robot-admin@v2.0` 指定 tag |
| **私有模板注册表** | 企业内部模板源 `robot registry add https://...` |
| **插件系统** | `robot plugin add eslint-config` 一键注入配置 |
