// lib/utils.js - 增强版本
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import fetch from 'node-fetch';

/**
 * 检测当前使用的包管理器
 */
export function detectPackageManager() {
  try {
    // 检查各种包管理器的可用性
    const managers = [];
    
    // 检查 bun
    try {
      execSync('bun --version', { stdio: 'ignore' });
      managers.push('bun');
    } catch {}
    
    // 检查 pnpm
    try {
      execSync('pnpm --version', { stdio: 'ignore' });
      managers.push('pnpm');
    } catch {}
    
    // 检查 yarn
    try {
      execSync('yarn --version', { stdio: 'ignore' });
      managers.push('yarn');
    } catch {}
    
    // npm 通常总是可用的
    try {
      execSync('npm --version', { stdio: 'ignore' });
      managers.push('npm');
    } catch {}
    
    return managers;
  } catch (error) {
    return ['npm']; // 默认返回 npm
  }
}

/**
 * 获取当前CLI的安装信息
 */
export function getInstallationInfo() {
  try {
    const packagePath = process.env.npm_config_global 
      ? path.join(process.env.npm_config_global, 'node_modules', '@agile-team', 'robot-cli')
      : null;
      
    return {
      binPath: process.argv[1],
      packagePath,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  } catch (error) {
    return {
      binPath: process.argv[1],
      packagePath: null,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }
}

/**
 * 诊断安装问题
 */
export function diagnoseInstallation() {
  const info = getInstallationInfo();
  const managers = detectPackageManager();
  
  console.log(chalk.blue('🔍 安装诊断信息:'));
  console.log();
  console.log(`  执行文件: ${chalk.cyan(info.binPath)}`);
  console.log(`  Node版本: ${chalk.cyan(info.nodeVersion)}`);
  console.log(`  系统平台: ${chalk.cyan(info.platform)} (${info.arch})`);
  console.log(`  可用包管理器: ${chalk.cyan(managers.join(', '))}`);
  
  if (info.packagePath) {
    console.log(`  包路径: ${chalk.cyan(info.packagePath)}`);
  }
  
  console.log();
  console.log(chalk.blue('💡 推荐的安装方式:'));
  
  if (managers.includes('bun')) {
    console.log(chalk.green('  bun install -g @agile-team/robot-cli'));
  }
  if (managers.includes('pnpm')) {
    console.log(chalk.green('  pnpm install -g @agile-team/robot-cli'));
  }
  if (managers.includes('yarn')) {
    console.log(chalk.green('  yarn global add @agile-team/robot-cli'));
  }
  if (managers.includes('npm')) {
    console.log(chalk.green('  npm install -g @agile-team/robot-cli'));
  }
  
  console.log();
  console.log(chalk.yellow('⚠️  建议只使用一种包管理器来避免冲突'));
}

/**
 * 验证项目名称
 */
export function validateProjectName(name) {
  const errors = [];

  if (!name || typeof name !== 'string') {
    errors.push('项目名称不能为空');
    return { valid: false, errors };
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    errors.push('项目名称不能为空');
  }

  if (trimmedName.length > 214) {
    errors.push('项目名称不能超过214个字符');
  }

  if (trimmedName.toLowerCase() !== trimmedName) {
    errors.push('项目名称只能包含小写字母');
  }

  if (/^[._]/.test(trimmedName)) {
    errors.push('项目名称不能以 "." 或 "_" 开头');
  }

  if (!/^[a-z0-9._-]+$/.test(trimmedName)) {
    errors.push('项目名称只能包含字母、数字、点、下划线和短横线');
  }

  const reservedNames = [
    'node_modules', 'favicon.ico', '.git', '.env', 'package.json',
    'npm', 'yarn', 'pnpm', 'bun', 'robot'
  ];

  if (reservedNames.includes(trimmedName)) {
    errors.push(`"${trimmedName}" 是保留名称，请使用其他名称`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 复制模板文件
 */
export async function copyTemplate(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`源路径不存在: ${sourcePath}`);
  }

  await fs.ensureDir(targetPath);
  await fs.copy(sourcePath, targetPath, {
    filter: (src) => {
      const basename = path.basename(src);
      // 排除不需要的文件
      return ![
        '.git',
        'node_modules',
        '.DS_Store',
        'Thumbs.db',
        '.vscode',
        '.idea'
      ].includes(basename);
    }
  });
}

/**
 * 安装依赖
 */
export async function installDependencies(projectPath, spinner, packageManager = 'npm') {
  const originalCwd = process.cwd();

  try {
    process.chdir(projectPath);

    // 检查 package.json 是否存在
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      if (spinner) {
        spinner.text = '⚠️  跳过依赖安装 (无 package.json)';
      }
      return;
    }

    // 根据包管理器选择安装命令
    const installCommands = {
      bun: 'bun install',
      pnpm: 'pnpm install',
      yarn: 'yarn install',
      npm: 'npm install'
    };

    const command = installCommands[packageManager] || 'npm install';

    if (spinner) {
      spinner.text = `📦 使用 ${packageManager} 安装依赖...`;
    }

    execSync(command, { 
      stdio: 'ignore',
      timeout: 300000 // 5分钟超时
    });

  } catch (error) {
    if (spinner) {
      spinner.text = `⚠️  依赖安装失败，请手动安装`;
    }
    console.log();
    console.log(chalk.yellow('⚠️  自动安装依赖失败'));
    console.log(chalk.dim(`   错误: ${error.message}`));
    console.log();
    console.log(chalk.blue('💡 请手动安装:'));
    console.log(chalk.cyan(`   cd ${path.basename(projectPath)}`));
    console.log(chalk.cyan(`   ${packageManager} install`));
    console.log();
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * 检查网络连接
 */
export async function checkNetworkConnection() {
  try {
    const response = await fetch('https://api.github.com', {
      method: 'HEAD',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    // 尝试备用检查
    try {
      const response = await fetch('https://www.npmjs.com', {
        method: 'HEAD',
        timeout: 5000
      });
      return response.ok;
    } catch (backupError) {
      return false;
    }
  }
}

/**
 * 生成项目统计
 */
export async function generateProjectStats(projectPath) {
  try {
    const stats = {
      files: 0,
      directories: 0,
      size: 0,
      fileTypes: {}
    };

    async function walkDir(dirPath) {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          // 跳过 node_modules 等目录
          if (!['node_modules', '.git', '.DS_Store'].includes(item)) {
            stats.directories++;
            await walkDir(itemPath);
          }
        } else {
          stats.files++;
          stats.size += stat.size;

          const ext = path.extname(item).toLowerCase();
          if (ext) {
            stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
          }
        }
      }
    }

    await walkDir(projectPath);
    return stats;
  } catch (error) {
    return null;
  }
}

/**
 * 打印项目统计
 */
export function printProjectStats(stats) {
  if (!stats) return;

  console.log(chalk.blue('📊 项目统计:'));
  console.log(`   文件数量: ${chalk.cyan(stats.files)} 个`);
  console.log(`   目录数量: ${chalk.cyan(stats.directories)} 个`);
  console.log(`   项目大小: ${chalk.cyan(formatBytes(stats.size))}`);

  const topTypes = Object.entries(stats.fileTypes)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  if (topTypes.length > 0) {
    console.log('   主要文件类型:');
    topTypes.forEach(([ext, count]) => {
      console.log(`     ${ext}: ${chalk.cyan(count)} 个`);
    });
  }
}

/**
 * 格式化字节大小
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}