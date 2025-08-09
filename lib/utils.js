// lib/utils.js - 增强版本，添加详细进度展示
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
    const managers = [];
    
    try {
      execSync('bun --version', { stdio: 'ignore' });
      managers.push('bun');
    } catch {}
    
    try {
      execSync('pnpm --version', { stdio: 'ignore' });
      managers.push('pnpm');
    } catch {}
    
    try {
      execSync('yarn --version', { stdio: 'ignore' });
      managers.push('yarn');
    } catch {}
    
    try {
      execSync('npm --version', { stdio: 'ignore' });
      managers.push('npm');
    } catch {}
    
    return managers;
  } catch (error) {
    return ['npm'];
  }
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
 * 统计目录中的文件数量
 */
async function countFiles(dirPath) {
  let count = 0;
  
  async function walkDir(currentPath) {
    const items = await fs.readdir(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        // 跳过不需要的目录
        if (!['node_modules', '.git', '.DS_Store'].includes(item)) {
          await walkDir(itemPath);
        }
      } else {
        count++;
      }
    }
  }
  
  await walkDir(dirPath);
  return count;
}

/**
 * 复制模板文件 - 带详细进度展示
 */
export async function copyTemplate(sourcePath, targetPath, spinner) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`源路径不存在: ${sourcePath}`);
  }

  await fs.ensureDir(targetPath);
  
  // 1. 统计文件数量
  if (spinner) {
    spinner.text = '📊 统计文件数量...';
  }
  
  const totalFiles = await countFiles(sourcePath);
  
  if (spinner) {
    spinner.text = `📋 开始复制 ${totalFiles} 个文件...`;
  }
  
  let copiedFiles = 0;
  
  // 2. 递归复制文件，带进度更新
  async function copyWithProgress(srcDir, destDir) {
    const items = await fs.readdir(srcDir);
    
    for (const item of items) {
      const srcPath = path.join(srcDir, item);
      const destPath = path.join(destDir, item);
      const stat = await fs.stat(srcPath);
      
      if (stat.isDirectory()) {
        // 排除不需要的文件夹
        if (['node_modules', '.git', '.DS_Store', '.vscode', '.idea'].includes(item)) {
          continue;
        }
        
        await fs.ensureDir(destPath);
        await copyWithProgress(srcPath, destPath);
      } else {
        // 复制文件
        await fs.copy(srcPath, destPath);
        copiedFiles++;
        
        // 更新进度 (每10个文件或重要节点更新一次)
        if (spinner && (copiedFiles % 10 === 0 || copiedFiles === totalFiles)) {
          const percentage = Math.round((copiedFiles / totalFiles) * 100);
          spinner.text = `📋 复制中... ${copiedFiles}/${totalFiles} (${percentage}%)`;
        }
      }
    }
  }
  
  await copyWithProgress(sourcePath, targetPath);
  
  if (spinner) {
    spinner.text = `✅ 文件复制完成 (${copiedFiles} 个文件)`;
  }
}

/**
 * 安装依赖
 */
export async function installDependencies(projectPath, spinner, packageManager = 'npm') {
  const originalCwd = process.cwd();

  try {
    process.chdir(projectPath);

    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      if (spinner) {
        spinner.text = '⚠️  跳过依赖安装 (无 package.json)';
      }
      return;
    }

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
      timeout: 300000
    });

    if (spinner) {
      spinner.text = `✅ 依赖安装完成 (${packageManager})`;
    }

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