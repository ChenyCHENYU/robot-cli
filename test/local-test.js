#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试模板数据 - 统一Robot命名风格
const TEST_TEMPLATES = {
  'robot-admin': {
    name: 'Robot Admin 完整版',
    files: {
      'package.json': {
        "name": "robot-admin-template",
        "version": "1.0.0",
        "description": "Robot后台管理系统完整版",
        "scripts": {
          "dev": "vite --host",
          "build": "vite build",
          "preview": "vite preview"
        },
        "dependencies": {
          "vue": "^3.4.0",
          "vue-router": "^4.2.0",
          "pinia": "^2.1.0",
          "element-plus": "^2.4.0",
          "@element-plus/icons-vue": "^2.3.0"
        },
        "devDependencies": {
          "vite": "^5.0.0",
          "@vitejs/plugin-vue": "^4.5.0"
        }
      },
      'src/main.js': `import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)
app.use(router)
app.use(createPinia())
app.use(ElementPlus)
app.mount('#app')`,
      'src/App.vue': `<template>
  <div id="app">
    <el-container>
      <el-header>
        <h1>🤖 Robot后台管理系统完整版</h1>
        <p>基于Robot CLI创建的企业级Vue项目</p>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
// Vue3 Composition API + Element Plus
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
}
</style>`,
      'src/router/index.js': `import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router`,
      'src/views/Dashboard.vue': `<template>
  <div class="dashboard">
    <el-card>
      <h2>控制台</h2>
      <p>欢迎使用Robot后台管理系统完整版</p>
      <el-button type="primary">开始使用</el-button>
    </el-card>
  </div>
</template>

<script setup>
// Dashboard 组件
</script>`,
      'vite.config.js': `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    open: true
  }
})`,
      '_gitignore': `node_modules
dist
.DS_Store
*.log
.env.local
.env.*.local`,
      '_env.example': `VITE_APP_TITLE=Robot后台管理系统
VITE_API_URL=http://localhost:8080
VITE_APP_ENV=development`,
      'README.md': `# Robot后台管理系统完整版

基于Robot CLI创建的企业级Vue3后台管理项目

## 功能特性

- ✅ Vue3 + Composition API
- ✅ Element Plus UI组件库
- ✅ Vue Router 路由管理
- ✅ Pinia 状态管理

## 快速开始

\`\`\`bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 构建生产版本
bun run build
\`\`\`

## 仓库地址

https://github.com/ChenyCHENYU/Robot_Admin
`
    }
  },
  'robot-admin-base': {
    name: 'Robot Admin 精简版',
    files: {
      'package.json': {
        "name": "robot-admin-base",
        "version": "1.0.0",
        "description": "Robot 后台管理系统精简版",
        "scripts": {
          "dev": "vite",
          "build": "vite build"
        },
        "dependencies": {
          "vue": "^3.4.0",
          "vue-router": "^4.2.0",
          "pinia": "^2.1.0",
          "element-plus": "^2.4.0"
        },
        "devDependencies": {
          "vite": "^5.0.0",
          "@vitejs/plugin-vue": "^4.5.0"
        }
      },
      'src/main.js': `import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)
app.use(router)
app.use(createPinia())
app.use(ElementPlus)
app.mount('#app')`,
      'src/App.vue': `<template>
  <div id="app">
    <h1>⚡ Robot 后台管理系统精简版</h1>
    <p>轻量级Robot后台管理模板</p>
    <router-view />
  </div>
</template>

<script setup>
// Vue3 Composition API
</script>`,
      'vite.config.js': `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()]
})`,
      '_gitignore': `node_modules
dist
.DS_Store`,
      'README.md': `# Robot后台管理系统精简版

轻量级Robot后台管理模板

## 快速开始

\`\`\`bash
bun install
bun run dev
\`\`\`

## 仓库地址

https://github.com/ChenyCHENYU/Robot_Admin_Base
`
    }
  },
  'robot-uniapp': {
    name: 'Robot uni-app 完整版',
    files: {
      'package.json': {
        "name": "robot-uniapp",
        "version": "1.0.0",
        "description": "Robot uni-app 跨平台应用",
        "scripts": {
          "dev:h5": "uni build --watch --target h5",
          "dev:mp-weixin": "uni build --watch --target mp-weixin",
          "build:h5": "uni build --target h5",
          "build:mp-weixin": "uni build --target mp-weixin"
        },
        "dependencies": {
          "vue": "^3.4.0",
          "@dcloudio/uni-app": "^3.0.0"
        }
      },
      'src/App.vue': `<template>
  <div id="app">
    <h1>🚀 Robot uni-app 跨平台应用</h1>
    <p>一套代码，多端运行</p>
  </div>
</template>

<script setup>
// uni-app 主应用
</script>`,
      'README.md': `# Robot uni-app 跨平台应用

基于uni-app框架的跨平台移动应用

## 支持平台

- H5
- 微信小程序
- Android
- iOS

## 仓库地址

https://github.com/ChenyCHENYU/Robot_Uniapp
`
    }
  },
  'robot-nest': {
    name: 'Robot NestJS 完整版',
    files: {
      'package.json': {
        "name": "robot-nest",
        "version": "1.0.0",
        "description": "Robot NestJS 企业级后端框架",
        "scripts": {
          "start:dev": "nest start --watch",
          "start:prod": "node dist/main",
          "build": "nest build"
        },
        "dependencies": {
          "@nestjs/core": "^10.0.0",
          "@nestjs/common": "^10.0.0",
          "@nestjs/typeorm": "^10.0.0",
          "typeorm": "^0.3.0"
        }
      },
      'src/main.ts': `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log('🚀 Robot NestJS 服务启动成功: http://localhost:3000');
}
bootstrap();`,
      'src/app.module.ts': `import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}`,
      'README.md': `# Robot NestJS 企业级后端框架

基于NestJS的企业级Node.js后端应用

## 功能特性

- NestJS框架
- TypeORM数据库
- JWT认证
- Swagger文档

## 仓库地址

https://github.com/ChenyCHENYU/Robot_Nest
`
    }
  },
  'robot-electron': {
    name: 'Robot Electron 完整版',
    files: {
      'package.json': {
        "name": "robot-electron",
        "version": "1.0.0",
        "description": "Robot Electron 跨平台桌面应用",
        "main": "dist/main.js",
        "scripts": {
          "electron:dev": "concurrently \"npm run dev\" \"electron .\"",
          "electron:build": "electron-builder",
          "dev": "vite"
        },
        "dependencies": {
          "electron": "^28.0.0",
          "vue": "^3.4.0"
        }
      },
      'src/main/main.ts': `import { app, BrowserWindow } from 'electron';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);`,
      'README.md': `# Robot Electron 跨平台桌面应用

基于Electron + Vue3的跨平台桌面应用

## 支持平台

- Windows
- macOS  
- Linux

## 仓库地址

https://github.com/ChenyCHENYU/Robot_Electron
`
    }
  }
};

async function setupTestEnvironment() {
  console.log(chalk.blue('🧪 Robot CLI 本地测试环境设置\n'));
  
  const { setupType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'setupType',
      message: '请选择测试环境设置:',
      choices: [
        { name: '🚀 创建完整测试环境 (推荐)', value: 'full' },
        { name: '📁 仅创建模板缓存', value: 'templates' },
        { name: '🎯 创建示例项目', value: 'demo' },
        { name: '🧹 清除测试环境', value: 'clean' }
      ]
    }
  ]);

  switch (setupType) {
    case 'full':
      await createFullTestEnvironment();
      break;
    case 'templates':
      await createTestTemplates();
      break;
    case 'demo':
      await createDemoProject();
      break;
    case 'clean':
      await cleanTestEnvironment();
      break;
  }
}

async function createFullTestEnvironment() {
  const testDir = path.join(process.cwd(), 'test-env');
  
  console.log(chalk.green('📁 创建测试目录...'));
  await fs.ensureDir(testDir);
  
  // 创建模拟的缓存目录和模板
  await createTestTemplates();
  
  // 创建演示项目
  await createDemoProject();
  
  console.log(chalk.green('✅ 测试环境创建完成!\n'));
  console.log(chalk.blue('测试目录结构:'));
  console.log(chalk.gray(`${testDir}/`));
  console.log(chalk.gray(`├── demo-projects/    (演示项目)`));
  console.log(chalk.gray(`└── ~/.robot-cli/     (模拟缓存)`));
  console.log();
  console.log(chalk.yellow('💡 现在你可以运行测试命令:'));
  console.log(chalk.cyan('   npm run dev:create my-test-project'));
  console.log(chalk.cyan('   npm run dev:list'));
  console.log(chalk.cyan('   npm run dev:cache'));
}

async function createTestTemplates() {
  const cacheDir = path.join(os.homedir(), '.robot-cli', 'cache');
  
  console.log(chalk.green('💾 创建模拟缓存模板...'));
  await fs.ensureDir(cacheDir);
  
  for (const [templateKey, templateData] of Object.entries(TEST_TEMPLATES)) {
    const templateDir = path.join(cacheDir, templateKey);
    await fs.ensureDir(templateDir);
    
    // 创建模板文件
    for (const [filePath, content] of Object.entries(templateData.files)) {
      const fullPath = path.join(templateDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      
      if (typeof content === 'object') {
        await fs.writeJson(fullPath, content, { spaces: 2 });
      } else {
        await fs.writeFile(fullPath, content);
      }
    }
    
    console.log(chalk.gray(`  ✓ ${templateData.name} (${templateKey})`));
  }
  
  console.log(chalk.green('\n✅ 模拟模板创建完成!'));
  console.log(chalk.blue(`缓存位置: ${cacheDir}`));
  console.log(chalk.dim(`包含 ${Object.keys(TEST_TEMPLATES).length} 个测试模板`));
  console.log();
  console.log(chalk.yellow('📋 可用的测试模板:'));
  Object.entries(TEST_TEMPLATES).forEach(([key, template]) => {
    console.log(chalk.cyan(`  • ${key} - ${template.name}`));
  });
}

async function createDemoProject() {
  const testDir = path.join(process.cwd(), 'test-env', 'demo-projects');
  await fs.ensureDir(testDir);
  
  console.log(chalk.green('🎯 创建演示项目...'));
  
  // 创建一个Robot管理后台的演示项目
  const demoProject = path.join(testDir, 'robot-admin-demo');
  await fs.ensureDir(demoProject);
  
  const templateData = TEST_TEMPLATES['robot-admin'];
  for (const [filePath, content] of Object.entries(templateData.files)) {
    const fullPath = path.join(demoProject, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    
    if (typeof content === 'object') {
      await fs.writeJson(fullPath, content, { spaces: 2 });
    } else {
      await fs.writeFile(fullPath, content);
    }
  }
  
  console.log(chalk.green('✅ 演示项目创建完成!'));
  console.log(chalk.blue(`项目位置: ${demoProject}`));
  console.log();
  console.log(chalk.yellow('💡 你可以进入演示项目测试:'));
  console.log(chalk.cyan(`   cd ${path.relative(process.cwd(), demoProject)}`));
  console.log(chalk.cyan('   bun install'));
  console.log(chalk.cyan('   bun run dev'));
}

async function cleanTestEnvironment() {
  const testDir = path.join(process.cwd(), 'test-env');
  const cacheDir = path.join(os.homedir(), '.robot-cli');
  
  console.log(chalk.yellow('🧹 清除测试环境...'));
  
  if (fs.existsSync(testDir)) {
    await fs.remove(testDir);
    console.log(chalk.gray('  ✓ 删除测试目录'));
  }
  
  if (fs.existsSync(cacheDir)) {
    await fs.remove(cacheDir);
    console.log(chalk.gray('  ✓ 删除缓存目录'));
  }
  
  console.log(chalk.green('✅ 测试环境清除完成!'));
}

async function runQuickTest() {
  console.log(chalk.blue('🚀 快速测试 Robot CLI 功能\n'));
  
  // 检查缓存
  const cacheDir = path.join(os.homedir(), '.robot-cli', 'cache');
  const hasCache = fs.existsSync(cacheDir);
  
  if (!hasCache) {
    console.log(chalk.yellow('⚠️  没有发现测试缓存'));
    const { createCache } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createCache',
        message: '是否创建测试缓存?',
        default: true
      }
    ]);
    
    if (createCache) {
      await createTestTemplates();
    } else {
      console.log(chalk.red('❌ 取消测试'));
      return;
    }
  }
  
  // 显示测试状态
  console.log(chalk.green('🎯 测试环境状态检查...\n'));
  
  // 统计缓存模板
  const cacheItems = await fs.readdir(cacheDir);
  console.log(chalk.blue('📋 缓存的测试模板:'));
  
  Object.entries(TEST_TEMPLATES).forEach(([key, template], index) => {
    const cached = cacheItems.includes(key);
    const status = cached ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${status} ${template.name}`);
    console.log(chalk.dim(`    模板key: ${key}`));
    console.log(chalk.dim(`    仓库地址: ChenyCHENYU/Robot_${key.split('-')[1] || 'Unknown'}`));
    console.log();
  });
  
  console.log(chalk.green('✅ 测试环境就绪!'));
  console.log();
  console.log(chalk.blue('💡 运行以下命令测试CLI功能:'));
  console.log(chalk.cyan('   npm run dev:create my-test-project    # 交互式创建'));
  console.log(chalk.cyan('   npm run dev:list                      # 查看所有模板'));
  console.log(chalk.cyan('   npm run dev:search robot              # 搜索Robot相关模板'));
  console.log(chalk.cyan('   npm run dev:create demo -t robot-admin # 快速创建指定模板'));
  console.log(chalk.cyan('   npm run dev:cache                     # 查看缓存信息'));
  console.log();
  console.log(chalk.blue('🧪 测试建议:'));
  console.log(chalk.dim('   1. 先运行 npm run dev:list 查看模板列表'));
  console.log(chalk.dim('   2. 运行 npm run dev:create test-project 体验交互流程'));
  console.log(chalk.dim('   3. 运行 npm run dev:search robot 测试搜索功能'));
  console.log(chalk.dim('   4. 运行 npm run dev:cache 查看缓存状态'));
}

// 主程序
async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--setup')) {
      await setupTestEnvironment();
    } else if (args.includes('--clean')) {
      await cleanTestEnvironment();
    } else {
      await runQuickTest();
    }
  } catch (error) {
    console.error(chalk.red('❌ 测试脚本执行失败:'), error.message);
    console.log();
    console.log(chalk.blue('💡 解决建议:'));
    console.log(chalk.dim('   • 检查文件权限'));
    console.log(chalk.dim('   • 确保目录可写'));
    console.log(chalk.dim('   • 重新运行测试脚本'));
    console.log();
    process.exit(1);
  }
}

main();