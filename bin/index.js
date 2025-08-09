#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 智能路径解析 - 兼容不同包管理器的安装路径
 */
function resolveLibPath() {
  // 可能的 lib 目录路径
  const possiblePaths = [
    // 1. 标准相对路径 (开发环境 + 大多数情况)
    join(__dirname, '..', 'lib'),
    
    // 2. 同级目录 (某些链接情况)
    join(__dirname, 'lib'),
    
    // 3. 向上查找 (深度嵌套情况)
    join(__dirname, '..', '..', 'lib'),
    
    // 4. 从 node_modules 查找 (npm/yarn)
    join(__dirname, '..', 'node_modules', '@agile-team', 'robot-cli', 'lib'),
    
    // 5. 全局安装的各种可能路径
    resolve(__dirname, '..', 'lib'),
    resolve(__dirname, '../../lib'),
    
    // 6. bun 特殊路径处理
    join(__dirname, '..', '..', '@agile-team', 'robot-cli', 'lib'),
  ];

  // 查找第一个存在的路径
  for (const libPath of possiblePaths) {
    if (existsSync(libPath)) {
      return libPath;
    }
  }

  // 如果都找不到，抛出详细错误
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

// 动态导入所需模块
async function loadModules() {
  try {
    const libPath = resolveLibPath();
    
    // 动态导入所有需要的模块
    const [
      { Command },
      chalk,
      boxen,
      inquirer,
      { createProject },
      { clearCache, getCacheInfo, formatSize },
      { getAllTemplates, searchTemplates, getRecommendedTemplates },
      { checkNetworkConnection }
    ] = await Promise.all([
      import('commander'),
      import('chalk'),
      import('boxen'),
      import('inquirer'),
      import(join(libPath, 'create.js')),
      import(join(libPath, 'cache.js')),
      import(join(libPath, 'templates.js')),
      import(join(libPath, 'utils.js'))
    ]);

    return {
      Command,
      chalk: chalk.default,
      boxen: boxen.default,
      inquirer: inquirer.default,
      createProject,
      clearCache,
      getCacheInfo,
      formatSize,
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
      clearCache,
      getCacheInfo,
      formatSize,
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
        '      🤖 Robot 项目脚手架工具  v1.0.3\n' +
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

    // 显示主菜单
    async function showMainMenu() {
      const title = chalk.white.bold('🚀 快速开始');
      
      console.log('  ' + title);
      console.log();
      
      // 获取统计信息
      const allTemplates = getAllTemplates();
      const templateCount = Object.keys(allTemplates).length;
      const cacheInfo = await getCacheInfo();
      
      console.log(chalk.dim(`  📦 可用模板: ${templateCount} 个`));
      console.log(chalk.dim(`  💾 缓存模板: ${cacheInfo.templates.length} 个 (${formatSize(cacheInfo.size)})`));
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
        },
        {
          cmd: 'robot cache',
          desc: '缓存管理',
          color: 'yellow'
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
      .version('1.0.3')
      .hook('preAction', () => {
        showWelcome();
      });

    // 创建项目命令
    program
      .command('create [project-name]')
      .description('创建新项目')
      .option('-t, --template <template>', '指定模板类型')
      .option('--no-cache', '强制重新下载模板')
      .option('--skip-install', '跳过依赖安装')
      .action(async (projectName, options) => {
        try {
          // 检查网络连接
          if (!options.cache) {
            console.log(chalk.blue('🌐 检查网络连接...'));
            const hasNetwork = await checkNetworkConnection();
            if (!hasNetwork) {
              console.log(chalk.red('❌ 网络连接失败，无法下载模板'));
              console.log(chalk.yellow('💡 请检查网络连接后重试'));
              process.exit(1);
            }
          }
          
          await createProject(projectName, options);
        } catch (error) {
          console.log();
          console.log(chalk.red('✗'), chalk.red.bold('创建失败'));
          
          // 根据错误类型提供不同的建议
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
            // 简单分类逻辑，根据模板名称前缀
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

    // 缓存管理
    program
      .command('cache')
      .description('缓存管理')
      .option('-c, --clear', '清除所有缓存')
      .option('-i, --info', '显示缓存信息')
      .action(async (options) => {
        try {
          if (options.clear) {
            const { confirmed } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirmed',
                message: '确认清除所有模板缓存?',
                default: false
              }
            ]);
            
            if (confirmed) {
              await clearCache();
              console.log();
              console.log(chalk.green('✓'), chalk.green.bold('缓存清除成功'));
            } else {
              console.log(chalk.yellow('❌ 取消清除'));
            }
          } else {
            // 显示缓存信息
            const cacheInfo = await getCacheInfo();
            
            console.log();
            console.log(chalk.blue('💾 缓存信息:'));
            console.log();
            
            if (!cacheInfo.exists || cacheInfo.templates.length === 0) {
              console.log(chalk.dim('  暂无缓存模板'));
            } else {
              console.log(`  缓存目录: ${chalk.dim(cacheInfo.path)}`);
              console.log(`  模板数量: ${chalk.cyan(cacheInfo.templates.length)} 个`);
              console.log(`  总大小: ${chalk.cyan(formatSize(cacheInfo.size))}`);
              console.log();
              console.log(chalk.blue('  缓存的模板:'));
              
              cacheInfo.templates.forEach(template => {
                const modifiedTime = template.modifiedTime.toLocaleDateString();
                console.log(`    ${chalk.green('●')} ${template.name}`);
                console.log(`      大小: ${formatSize(template.size)}  更新: ${modifiedTime}`);
              });
            }
            
            console.log();
            console.log(chalk.dim('  使用 robot cache --clear 清除缓存'));
          }
        } catch (error) {
          console.log(chalk.red('❌ 缓存操作失败:'), error.message);
        }
      });

    // 清除缓存命令 (向后兼容)
    program
      .command('clear-cache')
      .description('清除模板缓存')
      .action(async () => {
        try {
          await clearCache();
          console.log();
          console.log(chalk.green('✓'), chalk.green.bold('缓存清除成功'));
          console.log();
        } catch (error) {
          console.log();
          console.log(chalk.red('✗'), chalk.red.bold('清除缓存失败'));
          console.log('  ' + chalk.dim(error.message));
          console.log();
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