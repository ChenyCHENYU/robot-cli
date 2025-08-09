#!/usr/bin/env node

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 获取包版本号
 */
function getPackageVersion() {
  try {
    const possiblePaths = [
      join(__dirname, '..', 'package.json'),
      join(__dirname, 'package.json'),
      join(__dirname, '..', '..', 'package.json')
    ];
    
    for (const packagePath of possiblePaths) {
      if (existsSync(packagePath)) {
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
        return packageJson.version || '1.0.0';
      }
    }
    
    return '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
}

const PACKAGE_VERSION = getPackageVersion();

/**
 * 智能路径解析
 */
function resolveLibPath() {
  const possiblePaths = [
    join(__dirname, '..', 'lib'),
    join(__dirname, 'lib'),
    join(__dirname, '..', '..', 'lib'),
    join(__dirname, '..', 'node_modules', '@agile-team', 'robot-cli', 'lib'),
    resolve(__dirname, '..', 'lib'),
    resolve(__dirname, '../../lib'),
    join(__dirname, '..', '..', '@agile-team', 'robot-cli', 'lib'),
  ];

  for (const libPath of possiblePaths) {
    if (existsSync(libPath)) {
      return libPath;
    }
  }

  throw new Error(`
无法找到 lib 目录，已尝试以下路径:
${possiblePaths.map(p => `  - ${p}`).join('\n')}

当前执行路径: ${__dirname}
工作目录: ${process.cwd()}

可能的解决方案:
1. 重新安装: npm uninstall -g @agile-team/robot-cli && npm install -g @agile-team/robot-cli
2. 使用 npx: npx @agile-team/robot-cli
3. 检查包完整性: npm list -g @agile-team/robot-cli
  `);
}

// 动态导入所需模块 - 移除缓存相关模块
async function loadModules() {
  try {
    const libPath = resolveLibPath();
    
    const createUrl = pathToFileURL(join(libPath, 'create.js')).href;
    const templatesUrl = pathToFileURL(join(libPath, 'templates.js')).href;
    const utilsUrl = pathToFileURL(join(libPath, 'utils.js')).href;
    
    const [
      { Command },
      chalk,
      boxen,
      inquirer,
      { createProject },
      { getAllTemplates, searchTemplates, getRecommendedTemplates },
      { checkNetworkConnection }
    ] = await Promise.all([
      import('commander'),
      import('chalk'),
      import('boxen'),
      import('inquirer'),
      import(createUrl),
      import(templatesUrl),
      import(utilsUrl)
    ]);

    return {
      Command,
      chalk: chalk.default,
      boxen: boxen.default,
      inquirer: inquirer.default,
      createProject,
      getAllTemplates,
      searchTemplates,
      getRecommendedTemplates,
      checkNetworkConnection
    };
  } catch (error) {
    console.error(`
❌ 模块加载失败: ${error.message}

🔧 诊断信息:
  当前文件: ${__filename}
  执行目录: ${__dirname}
  工作目录: ${process.cwd()}
  Node版本: ${process.version}

💡 解决方案:
  1. 完全重装: npm uninstall -g @agile-team/robot-cli && npm install -g @agile-team/robot-cli
  2. 使用npx: npx @agile-team/robot-cli
  3. 联系支持: https://github.com/ChenyCHENYU/robot-cli/issues
    `);
    process.exit(1);
  }
}

// 主程序
async function main() {
  try {
    const modules = await loadModules();
    const { 
      Command, 
      chalk, 
      boxen, 
      inquirer,
      createProject,
      getAllTemplates,
      searchTemplates,
      getRecommendedTemplates,
      checkNetworkConnection
    } = modules;

    const program = new Command();

    // 现代化欢迎信息
    function showWelcome() {
      console.clear();
      
      const logoLines = [
        '   ██████╗  ██████╗ ██████╗  ██████╗ ████████╗',
        '   ██╔══██╗██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝',
        '   ██████╔╝██║   ██║██████╔╝██║   ██║   ██║   ',
        '   ██╔══██╗██║   ██║██╔══██╗██║   ██║   ██║   ',
        '   ██║  ██║╚██████╔╝██████╔╝╚██████╔╝   ██║   ',
        '   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═════╝    ╚═╝   '
      ];
      
      const logo = logoLines.map(line => chalk.cyan(line)).join('\n');
      
      const titleBox = boxen(
        logo + '\n\n' +
        `      🤖 Robot 项目脚手架工具  v${PACKAGE_VERSION}\n` +
        '         兼容 npm/yarn/pnpm/bun',
        {
          padding: { top: 1, bottom: 1, left: 2, right: 2 },
          borderStyle: 'round',
          borderColor: 'cyan',
          backgroundColor: 'blackBright'
        }
      );
      
      console.log();
      console.log(titleBox);
      console.log();
    }

    // 显示主菜单 - 移除缓存信息
    async function showMainMenu() {
      const title = chalk.white.bold('🚀 快速开始');
      
      console.log('  ' + title);
      console.log();
      
      const allTemplates = getAllTemplates();
      const templateCount = Object.keys(allTemplates).length;
      
      console.log(chalk.dim(`  📦 可用模板: ${templateCount} 个`));
      console.log(chalk.dim(`  🌐 总是下载最新版本`));
      console.log();
      
      const commands = [
        {
          cmd: 'robot create',
          desc: '交互式创建项目',
          color: 'cyan'
        },
        {
          cmd: 'robot create <name>',
          desc: '快速创建项目',
          color: 'green'
        },
        {
          cmd: 'robot list',
          desc: '查看所有可用模板',
          color: 'blue'
        },
        {
          cmd: 'robot search <keyword>',
          desc: '搜索模板',
          color: 'magenta'
        }
      ];
      
      commands.forEach(({ cmd, desc, color }) => {
        console.log('  ' + chalk[color](cmd.padEnd(24)) + chalk.dim(desc));
      });
      
      console.log();
      console.log(chalk.dim('  示例:'));
      console.log(chalk.dim('    robot create my-vue-admin'));
      console.log(chalk.dim('    robot search vue'));
      console.log(chalk.dim('    robot create my-app --template robot-admin'));
      console.log();
    }

    program
      .name('robot')
      .description('🤖 Robot 项目脚手架工具 - @agile-team/robot-cli')
      .version(PACKAGE_VERSION)
      .hook('preAction', () => {
        showWelcome();
      });

    // 创建项目命令 - 移除缓存相关选项
    program
      .command('create [project-name]')
      .description('创建新项目')
      .option('-t, --template <template>', '指定模板类型')
      .option('--skip-install', '跳过依赖安装')
      .action(async (projectName, options) => {
        try {
          // 检查网络连接
          console.log(chalk.blue('🌐 检查网络连接...'));
          const hasNetwork = await checkNetworkConnection();
          if (!hasNetwork) {
            console.log(chalk.red('❌ 网络连接失败，无法下载模板'));
            console.log(chalk.yellow('💡 请检查网络连接后重试'));
            process.exit(1);
          }
          
          await createProject(projectName, options);
        } catch (error) {
          console.log();
          console.log(chalk.red('✗'), chalk.red.bold('创建失败'));
          
          if (error.message.includes('网络')) {
            console.log('  ' + chalk.dim('网络相关问题，请检查网络连接'));
          } else if (error.message.includes('权限')) {
            console.log('  ' + chalk.dim('权限问题，请检查文件夹权限'));
          } else {
            console.log('  ' + chalk.dim(error.message));
          }
          
          console.log();
          console.log(chalk.blue('💡 获取帮助:'));
          console.log(chalk.dim('   robot --help'));
          console.log(chalk.dim('   https://github.com/ChenyCHENYU/robot-cli/issues'));
          console.log();
          process.exit(1);
        }
      });

    // 列出所有模板
    program
      .command('list')
      .alias('ls')
      .description('列出所有可用模板')
      .option('-r, --recommended', '只显示推荐模板')
      .option('-c, --category <category>', '按分类筛选')
      .action(async (options) => {
        try {
          let templates;
          let title;
          
          if (options.recommended) {
            templates = getRecommendedTemplates();
            title = '🎯 推荐模板';
          } else {
            templates = getAllTemplates();
            title = '📋 所有可用模板';
          }
          
          console.log();
          console.log(chalk.blue(title));
          console.log(chalk.dim(`共 ${Object.keys(templates).length} 个模板\n`));
          
          // 按分类显示
          const categories = {};
          Object.entries(templates).forEach(([key, template]) => {
            const category = key.split('-')[0];
            if (!categories[category]) {
              categories[category] = [];
            }
            categories[category].push({ key, ...template });
          });
          
          Object.entries(categories).forEach(([category, templates]) => {
            console.log(chalk.cyan(`${category.toUpperCase()} 相关:`));
            templates.forEach(template => {
              console.log(`  ${chalk.green('●')} ${chalk.bold(template.name)}`);
              console.log(`    ${chalk.dim(template.description)}`);
              console.log(`    ${chalk.dim('功能: ' + template.features.join(', '))}`);
              console.log(`    ${chalk.dim('使用: robot create my-app --template ' + template.key)}`);
              console.log();
            });
          });
          
        } catch (error) {
          console.log(chalk.red('❌ 获取模板列表失败:'), error.message);
        }
      });

    // 搜索模板
    program
      .command('search <keyword>')
      .description('搜索模板')
      .action(async (keyword) => {
        try {
          const results = searchTemplates(keyword);
          
          console.log();
          if (Object.keys(results).length === 0) {
            console.log(chalk.yellow('🔍 没有找到匹配的模板'));
            console.log();
            console.log(chalk.blue('💡 建议:'));
            console.log(chalk.dim('   • 尝试其他关键词'));
            console.log(chalk.dim('   • 使用 robot list 查看所有模板'));
            console.log(chalk.dim('   • 使用 robot list --recommended 查看推荐模板'));
          } else {
            console.log(chalk.green(`🔍 找到 ${Object.keys(results).length} 个匹配的模板:`));
            console.log();
            
            Object.entries(results).forEach(([key, template]) => {
              console.log(`${chalk.green('●')} ${chalk.bold(template.name)}`);
              console.log(`  ${chalk.dim(template.description)}`);
              console.log(`  ${chalk.dim('功能: ' + template.features.join(', '))}`);
              console.log(`  ${chalk.cyan('robot create my-app --template ' + key)}`);
              console.log();
            });
          }
        } catch (error) {
          console.log(chalk.red('❌ 搜索失败:'), error.message);
        }
      });

    // 如果没有参数，显示主菜单
    if (process.argv.length === 2) {
      showWelcome();
      await showMainMenu();
      process.exit(0);
    }

    // 全局错误处理
    process.on('uncaughtException', (error) => {
      console.log();
      console.log(chalk.red('💥 程序发生未预期的错误:'));
      console.log(chalk.dim(error.message));
      console.log();
      console.log(chalk.blue('💡 建议:'));
      console.log(chalk.dim('   • 重启终端重试'));
      console.log(chalk.dim('   • 检查网络连接'));
      console.log(chalk.dim('   • 重新安装: npm install -g @agile-team/robot-cli'));
      console.log(chalk.dim('   • 联系技术支持: https://github.com/ChenyCHENYU/robot-cli/issues'));
      console.log();
      process.exit(1);
    });

    process.on('unhandledRejection', (error) => {
      console.log();
      console.log(chalk.red('💥 程序发生未处理的异步错误:'));
      console.log(chalk.dim(error.message));
      console.log();
      process.exit(1);
    });

    program.parse();

  } catch (error) {
    console.error('启动失败:', error.message);
    process.exit(1);
  }
}

// 启动程序
main();