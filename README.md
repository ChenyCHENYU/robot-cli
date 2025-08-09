# 🤖 Robot CLI

> 现代化项目脚手架工具，专为团队协作打造

一条命令，60秒搭建完整项目。支持多种技术栈、多种架构模式，让项目创建变得简单高效。

## ✨ 核心特性

- **🎯 智能模板分类** - 推荐模板、分类浏览、关键词搜索
- **⚡ 极速项目创建** - 一条命令创建完整项目架构
- **📦 现代包管理器** - 优先推荐 bun/pnpm，智能检测最佳选择
- **🌐 智能缓存机制** - 本地缓存，避免重复下载
- **🎨 友好用户界面** - 现代化终端交互，清晰进度提示

## 🚀 快速开始

### 安装
```bash
npm install -g @cheny/robot-cli
```

### 创建项目
```bash
# 交互式创建（推荐）
robot create

# 快速创建指定模板
robot create my-vue-admin --template robot-admin

# 查看所有模板
robot list
```

## 📋 支持的模板

### 🎨 前端项目
| 技术栈 | 模板 | 描述 |
|-------|------|------|
| **Vue.js** | `robot-admin` | 后台管理系统完整版 |
| | `robot-admin-base` | 后台管理系统精简版 |
| | `robot-micro` | 微前端架构(MicroApp) |
| **React.js** | `robot-react` | React后台完整版 |

### 📱 移动端项目
| 技术栈 | 模板 | 描述 |
|-------|------|------|
| **uni-app** | `robot-uniapp` | 多端应用(小程序/H5/App) |

### 🚀 后端项目
| 技术栈 | 模板 | 描述 |
|-------|------|------|
| **NestJS** | `robot-nest` | 企业级Node.js框架 |
| **Koa3** | `robot-koa` | 轻量级Node.js框架 |

### 💻 桌面端项目
| 技术栈 | 模板 | 描述 |
|-------|------|------|
| **Electron** | `robot-electron` | 跨平台桌面应用 |
| **Tauri** | `robot-tauri` | 轻量级桌面应用 |

## 📖 命令详解

### 创建项目
```bash
# 交互式创建
robot create

# 指定模板
robot create my-project --template robot-admin

# 跳过依赖安装
robot create my-project --skip-install

# 强制重新下载
robot create my-project --no-cache
```

### 模板管理
```bash
# 查看所有模板
robot list

# 查看推荐模板
robot list --recommended

# 搜索模板
robot search vue
robot search admin
```

### 缓存管理
```bash
# 查看缓存信息
robot cache

# 清除缓存
robot cache --clear
```

## 📦 包管理器优先级

Robot CLI 智能选择最佳包管理器：

1. **bun** 🥇 - 极速安装，现代化
2. **pnpm** 🥈 - 快速安装，节省空间  
3. **yarn** ⚖️ - 兼容现有项目
4. **npm** ⚖️ - Node.js默认

## 🛠 开发指南

### 项目结构
```
robot-cli/
├── bin/index.js          # CLI入口
├── lib/
│   ├── templates.js      # 模板配置
│   ├── create.js         # 创建流程
│   ├── download.js       # 下载逻辑
│   ├── cache.js          # 缓存管理
│   └── utils.js          # 工具函数
└── test/local-test.js    # 测试脚本
```

### 添加新模板

1. 在 `lib/templates.js` 中添加配置：
```javascript
'robot-new-template': {
  name: 'Robot新模板',
  description: '模板描述',
  repo: 'ChenyCHENYU/Robot_New_Template',
  features: ['特性1', '特性2'],
  version: 'full'
}
```

2. 模板仓库要求：
- 包含 `package.json` 和 `README.md`
- 使用 `_gitignore` 而不是 `.gitignore`
- 使用 `_env.example` 而不是 `.env.example`

3. 命名规范：
- **模板key**: `robot-xxx` (如：robot-admin)
- **仓库名**: `Robot_Xxx` (如：Robot_Admin)
- **精简版**: 加 `-base` 后缀

### 本地测试
```bash
# 克隆项目
git clone https://github.com/ChenyCHENYU/robot-cli.git
cd robot-cli && npm install && npm link

# 创建测试环境
npm run test:setup

# 测试命令
robot create test-project
```

## 🔧 扩展与定制

### 基于Robot CLI二次开发

如果你想基于Robot CLI创建自己的脚手架工具：

#### 1. Fork和克隆
```bash
# Fork GitHub仓库后克隆
git clone https://github.com/YOUR_USERNAME/robot-cli.git
cd robot-cli
npm install
```

#### 2. 修改配置
```bash
# 修改package.json
{
  "name": "@yourteam/your-cli",
  "bin": {
    "your-cli": "./bin/index.js"
  }
}

# 修改bin/index.js中的程序名称
program.name('your-cli')
```

#### 3. 自定义模板源
```javascript
// lib/templates.js - 替换为你的模板仓库
export const TEMPLATE_CATEGORIES = {
  frontend: {
    name: '🎨 前端项目',
    stacks: {
      vue: {
        name: 'Vue.js',
        patterns: {
          monolith: {
            name: '单体应用',
            templates: {
              'your-admin': {
                name: '你的后台模板',
                repo: 'YOUR_ORG/Your_Admin_Template',
                // ...
              }
            }
          }
        }
      }
    }
  }
}
```

#### 4. 定制交互界面
```javascript
// lib/create.js - 修改欢迎信息和Logo
function showWelcome() {
  const logoLines = [
    '   ██    ██  ██████  ██    ██ ██████  ',
    '    ██  ██  ██    ██ ██    ██ ██   ██ ',
    '     ████   ██    ██ ██    ██ ██████  ',
    '      ██    ██    ██ ██    ██ ██   ██ ',
    '      ██     ██████   ██████  ██   ██ '
  ];
  // 自定义你的Logo和标题
}
```

#### 5. 发布自己的CLI
```bash
# 更新版本
npm version 1.0.0

# 发布到npm
npm publish --access public

# 全局安装测试
npm install -g @yourteam/your-cli
your-cli create my-project
```

### 企业内部定制方案

#### 私有npm源
```bash
# 发布到企业私有npm
npm publish --registry=https://your-company-npm.com

# 用户安装
npm install -g @yourcompany/cli --registry=https://your-company-npm.com
```

#### 模板源配置
```javascript
// 支持配置文件 ~/.your-cli-config.json
{
  "templateSource": "https://your-git-server.com",
  "defaultOrg": "YOUR_COMPANY",
  "defaultBranch": "main"
}
```

#### 批量模板管理
```javascript
// lib/templates.js - 支持动态加载模板列表
export async function loadTemplatesFromAPI() {
  const response = await fetch('https://your-api.com/templates');
  return response.json();
}
```

### 插件化扩展

#### 添加自定义命令
```javascript
// lib/plugins/deploy.js
export function addDeployCommand(program) {
  program
    .command('deploy')
    .description('部署项目到服务器')
    .action(async () => {
      // 你的部署逻辑
    });
}

// bin/index.js
import { addDeployCommand } from '../lib/plugins/deploy.js';
addDeployCommand(program);
```

#### 添加自定义生成器
```javascript
// lib/generators/component.js
export async function generateComponent(name, options) {
  // 生成组件文件的逻辑
}

// 使用
your-cli generate component MyComponent
```

### 配置文件支持

#### 项目级配置
```json
// robot.config.json
{
  "defaultTemplate": "your-admin",
  "packageManager": "pnpm",
  "gitInit": true,
  "plugins": ["@yourteam/cli-plugin-deploy"]
}
```

#### 全局配置
```json
// ~/.robot-cli/config.json
{
  "templateSource": "github",
  "defaultOrg": "YourOrg",
  "cache": {
    "enabled": true,
    "ttl": 86400000
  }
}
```

### 高级定制示例

#### 1. 多源模板支持
```javascript
// 支持从多个源获取模板
const TEMPLATE_SOURCES = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com',
  gitee: 'https://gitee.com',
  custom: process.env.CUSTOM_TEMPLATE_SOURCE
};
```

#### 2. 模板预处理
```javascript
// 模板下载后的预处理钩子
export async function preprocessTemplate(templatePath, options) {
  // 替换模板中的占位符
  // 执行自定义脚本
  // 添加企业标准配置
}
```

#### 3. 集成CI/CD
```javascript
// 创建项目后自动设置CI/CD
export async function setupCICD(projectPath, options) {
  if (options.cicd) {
    await generateGitlabCI(projectPath);
    await generateDockerfile(projectPath);
  }
}
```

### 维护指南

#### 版本管理策略
```bash
# 语义化版本
major.minor.patch

# 发布流程
npm run test
npm run build
npm version patch
npm publish
git push --tags
```

#### 模板同步
```bash
# 定期同步模板仓库
npm run sync-templates

# 检查模板有效性
npm run validate-templates
```

#### 监控和分析
```javascript
// 添加使用统计
import analytics from './lib/analytics.js';

analytics.track('template_used', {
  template: template.key,
  version: packageJson.version
});
```

## 🔧 常见问题

**Q: 提示 "command not found"？**  
A: 全局安装CLI：`npm install -g @cheny/robot-cli`

**Q: 模板下载失败？**  
A: 检查网络连接，尝试清除缓存：`robot cache --clear`

**Q: 如何添加自定义模板？**  
A: 创建模板仓库 → 添加配置 → 测试功能

**Q: 支持私有仓库吗？**  
A: 目前仅支持公开GitHub仓库

## 🎉 快速体验

```bash
# 安装并创建项目
npm install -g @cheny/robot-cli
robot create my-awesome-project

# 启动开发服务器
cd my-awesome-project && bun install && bun run dev
```

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

## 📜 许可证

MIT License

## 🔗 相关链接

- [GitHub仓库](https://github.com/ChenyCHENYU/robot-cli)
- [npm包](https://www.npmjs.com/package/@cheny/robot-cli)  
- [问题反馈](https://github.com/ChenyCHENYU/robot-cli/issues)

---

**让项目创建变得简单高效，专注于业务逻辑的实现！** 🚀

```bash
npx @cheny/robot-cli create my-project
```