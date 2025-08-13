#!/usr/bin/env node

// 尝试更明确的导入方式
import { readJson, writeJson, ensureDir, remove, writeFile, existsSync } from 'fs-extra';
import { join, dirname, relative } from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
\`\`\`
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
  const testDir = join(process.cwd(), 'test-env', 'demo-projects');
  await ensureDir(testDir);
  
  console.log(chalk.green('🎯 创建演示项目...\n'));
  
  for (const [templateKey, templateData] of Object.entries(TEST_TEMPLATES)) {
    const demoProject = join(testDir, `${templateKey}-demo`);
    
    console.log(chalk.green(`📁 创建 ${templateData.name}...`));
    await ensureDir(demoProject);
    
    // 创建模板文件
    for (const [filePath, content] of Object.entries(templateData.files)) {
      const fullPath = join(demoProject, filePath);
      await ensureDir(dirname(fullPath));
      
      if (typeof content === 'object') {
        await writeJson(fullPath, content, { spaces: 2 });
      } else {
        await writeFile(fullPath, content);
      }
    }
    
    console.log(chalk.gray(`  ✓ 项目位置: ${relative(process.cwd(), demoProject)}`));
  }
  
  console.log(chalk.green('\n✅ 演示项目创建完成!'));
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
}

async function cleanTestEnvironment() {
  const testDir = join(process.cwd(), 'test-env');
  
  console.log(chalk.yellow('🧹 清除测试环境...'));
  
  if (existsSync(testDir)) {
    await remove(testDir);
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
  console.log();
  
  console.log(chalk.blue('📋 可测试的模板:'));
  Object.entries(TEST_TEMPLATES).forEach(([key, template]) => {
    console.log(`  ${chalk.cyan('●')} ${template.name}`);
    console.log(chalk.dim(`    模板key: ${key}`));
    console.log();
  });
  
  console.log(chalk.green('✅ 测试环境就绪!'));
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
    process.exit(1);
  }
}

main();