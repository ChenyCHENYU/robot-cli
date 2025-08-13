#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试模板数据 - 用于创建本地演示项目
const TEST_TEMPLATES = {
  'robot-admin': {
    name: 'Robot Admin 完整版',
    description: 'Vue3 + Element Plus + 完整功能',
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
`
    }
  },
  'robot-nest': {
    name: 'Robot NestJS 完整版',
    description: 'NestJS + TypeORM + 企业级后端',
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
`
    }
  },
  'robot-react': {
    name: 'Robot React 完整版',
    description: 'React + Ant Design + 完整功能',
    files: {
      'package.json': {
        "name": "robot-react",
        "version": "1.0.0",
        "description": "Robot React 管理系统",
        "scripts": {
          "start": "vite",
          "build": "vite build"
        },
        "dependencies": {
          "react": "^18.2.0",
          "react-dom": "^18.2.0",
          "react-router-dom": "^6.8.0",
          "antd": "^5.12.0"
        },
        "devDependencies": {
          "vite": "^5.0.0",
          "@vitejs/plugin-react": "^4.2.0"
        }
      },
      'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`,
      'src/App.tsx': `import React from 'react'
import { Layout, Button } from 'antd'

const { Header, Content } = Layout

function App() {
  return (
    <Layout>
      <Header style={{ background: '#fff' }}>
        <h1>🤖 Robot React 管理系统</h1>
      </Header>
      <Content style={{ padding: '20px' }}>
        <p>基于Robot CLI创建的React项目</p>
        <Button type="primary">开始使用</Button>
      </Content>
    </Layout>
  )
}

export default App`,
      'README.md': `# Robot React 管理系统

基于Robot CLI创建的React项目

## 功能特性

- React 18
- Ant Design
- React Router
- Vite
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
        { name: '🎯 创建演示项目 (测试项目结构)', value: 'demo' },
        { name: '📋 显示可用模板 (测试模板配置)', value: 'templates' },
        { name: '🧹 清除测试环境', value: 'clean' }
      ]
    }
  ]);

  switch (setupType) {
    case 'demo':
      await createDemoProjects();
      break;
    case 'templates':
      await showAvailableTemplates();
      break;
    case 'clean':
      await cleanTestEnvironment();
      break;
  }
}

async function createDemoProjects() {
  const testDir = path.join(process.cwd(), 'test-env', 'demo-projects');
  await fs.ensureDir(testDir);
  
  console.log(chalk.green('🎯 创建演示项目...\n'));
  
  const { selectedTemplates } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedTemplates',
      message: '选择要创建的演示项目:',
      choices: Object.entries(TEST_TEMPLATES).map(([key, template]) => ({
        name: `${template.name} - ${template.description}`,
        value: key,
        checked: key === 'robot-admin' // 默认选中admin
      }))
    }
  ]);

  if (selectedTemplates.length === 0) {
    console.log(chalk.yellow('❌ 未选择任何模板'));
    return;
  }
  
  for (const templateKey of selectedTemplates) {
    const templateData = TEST_TEMPLATES[templateKey];
    const demoProject = path.join(testDir, `${templateKey}-demo`);
    
    console.log(chalk.green(`📁 创建 ${templateData.name}...`));
    await fs.ensureDir(demoProject);
    
    // 创建模板文件
    for (const [filePath, content] of Object.entries(templateData.files)) {
      const fullPath = path.join(demoProject, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      
      if (typeof content === 'object') {
        await fs.writeJson(fullPath, content, { spaces: 2 });
      } else {
        await fs.writeFile(fullPath, content);
      }
    }
    
    console.log(chalk.gray(`  ✓ 项目位置: ${path.relative(process.cwd(), demoProject)}`));
  }
  
  console.log(chalk.green('\n✅ 演示项目创建完成!'));
  console.log();
  console.log(chalk.yellow('💡 你可以进入演示项目测试:'));
  selectedTemplates.forEach(templateKey => {
    const demoPath = path.relative(process.cwd(), path.join(testDir, `${templateKey}-demo`));
    console.log(chalk.cyan(`   cd ${demoPath}`));
    console.log(chalk.cyan('   bun install && bun run dev'));
    console.log();
  });
}

async function showAvailableTemplates() {
  console.log(chalk.blue('📋 Robot CLI 可用模板列表\n'));
  
  console.log(chalk.green('内置测试模板:'));
  Object.entries(TEST_TEMPLATES).forEach(([key, template]) => {
    console.log(`  ${chalk.cyan('●')} ${chalk.bold(template.name)}`);
    console.log(`    ${chalk.dim('key: ' + key)}`);
    console.log(`    ${chalk.dim('描述: ' + template.description)}`);
    console.log(`    ${chalk.dim('文件数: ' + Object.keys(template.files).length + ' 个')}`);
    console.log();
  });
  
  console.log(chalk.blue('💡 这些模板用于本地测试，实际使用时会从GitHub下载最新版本'));
  console.log();
  console.log(chalk.yellow('🚀 测试命令:'));
  console.log(chalk.cyan('   npm run dev:create my-test-project'));
  console.log(chalk.cyan('   npm run dev:list'));
  console.log(chalk.cyan('   npm run dev:search robot'));
  console.log();
}

async function cleanTestEnvironment() {
  const testDir = path.join(process.cwd(), 'test-env');
  
  console.log(chalk.yellow('🧹 清除测试环境...'));
  
  if (fs.existsSync(testDir)) {
    await fs.remove(testDir);
    console.log(chalk.gray('  ✓ 删除测试目录'));
  } else {
    console.log(chalk.gray('  ✓ 测试目录不存在'));
  }
  
  console.log(chalk.green('✅ 测试环境清除完成!'));
}

async function runQuickTest() {
  console.log(chalk.blue('🚀 Robot CLI 快速测试指南\n'));
  
  console.log(chalk.green('🎯 测试环境说明:'));
  console.log(chalk.dim('Robot CLI 现在总是下载最新模板，无需缓存管理'));
  console.log(chalk.dim('测试时可以创建本地演示项目来验证项目结构'));
  console.log();
  
  console.log(chalk.blue('📋 可测试的模板:'));
  Object.entries(TEST_TEMPLATES).forEach(([key, template]) => {
    console.log(`  ${chalk.cyan('●')} ${template.name}`);
    console.log(chalk.dim(`    模板key: ${key}`));
    console.log(chalk.dim(`    描述: ${template.description}`));
    console.log();
  });
  
  console.log(chalk.green('✅ 测试环境就绪!'));
  console.log();
  console.log(chalk.blue('💡 运行以下命令测试CLI功能:'));
  console.log(chalk.cyan('   npm run dev:create my-test-project    # 交互式创建项目'));
  console.log(chalk.cyan('   npm run dev:list                      # 查看所有模板'));
  console.log(chalk.cyan('   npm run dev:search robot              # 搜索Robot相关模板'));
  console.log(chalk.cyan('   npm run dev:create demo -t robot-admin # 快速创建指定模板'));
  console.log();
  console.log(chalk.blue('🧪 测试建议:'));
  console.log(chalk.dim('   1. 先运行 npm run dev:list 查看模板列表'));
  console.log(chalk.dim('   2. 运行 npm run dev:create test-project 体验交互流程'));
  console.log(chalk.dim('   3. 运行 npm run dev:search robot 测试搜索功能'));
  console.log(chalk.dim('   4. 使用 --setup 参数创建本地演示项目'));
  console.log();
  console.log(chalk.yellow('注意: 测试时会从GitHub下载真实模板，确保网络连接正常'));
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