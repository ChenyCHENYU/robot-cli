// lib/utils.js - 优化版本
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * 验证项目名称
 */
export function validateProjectName(name) {
  const errors = [];
  
  // 检查是否为空
  if (!name || !name.trim()) {
    errors.push('项目名称不能为空');
    return { valid: false, errors };
  }
  
  const trimmedName = name.trim();
  
  // 检查长度
  if (trimmedName.length < 1) {
    errors.push('项目名称不能为空');
  }
  
  if (trimmedName.length > 214) {
    errors.push('项目名称过长 (最大214个字符)');
  }
  
  // 检查字符规则
  if (!/^[a-z0-9\-_@.]+$/i.test(trimmedName)) {
    errors.push('项目名称只能包含字母、数字、连字符、下划线、@和点');
  }
  
  // 检查开头字符
  if (/^[._]/.test(trimmedName)) {
    errors.push('项目名称不能以点或下划线开头');
  }
  
  // 检查是否包含空格
  if (/\s/.test(trimmedName)) {
    errors.push('项目名称不能包含空格');
  }
  
  // 检查保留字
  const reservedNames = [
    'node_modules', 'favicon.ico', 'con', 'prn', 'aux', 'nul',
    'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
    'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
  ];
  
  if (reservedNames.includes(trimmedName.toLowerCase())) {
    errors.push(`"${trimmedName}" 是保留字，不能作为项目名称`);
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
  try {
    // 确保目标目录存在
    await fs.ensureDir(targetPath);
    
    // 获取源目录中的所有文件和文件夹
    const items = await fs.readdir(sourcePath);
    
    for (const item of items) {
      const sourceItemPath = path.join(sourcePath, item);
      const targetItemPath = path.join(targetPath, item);
      
      // 跳过不需要的文件
      if (shouldSkipFile(item)) {
        continue;
      }
      
      const stats = await fs.stat(sourceItemPath);
      
      if (stats.isDirectory()) {
        // 递归复制目录
        await copyTemplate(sourceItemPath, targetItemPath);
      } else {
        // 复制文件
        await fs.copy(sourceItemPath, targetItemPath);
      }
    }
  } catch (error) {
    throw new Error(`复制模板文件失败: ${error.message}`);
  }
}

/**
 * 判断是否应该跳过文件/目录
 */
function shouldSkipFile(fileName) {
  const skipPatterns = [
    '.git',
    '.DS_Store',
    'Thumbs.db',
    '.vscode',
    '.idea',
    'node_modules',
    '.cache',
    'dist',
    'build',
    '*.log',
    '.env.local',
    '.env.*.local'
  ];
  
  return skipPatterns.some(pattern => {
    if (pattern.includes('*')) {
      // 简单的通配符匹配
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(fileName);
    }
    return fileName === pattern;
  });
}

/**
 * 安装项目依赖
 */
export async function installDependencies(projectPath, spinner, packageManager) {
  const originalCwd = process.cwd();
  
  try {
    process.chdir(projectPath);
    
    // 如果没有指定包管理器，自动检测（优先bun和pnpm）
    const pm = packageManager || detectPackageManager(projectPath);
    
    if (spinner) {
      spinner.text = `使用 ${pm} 安装依赖...`;
    }
    
    // 安装依赖
    const installCommand = getInstallCommand(pm);
    
    execSync(installCommand, {
      stdio: 'pipe', // 不显示安装输出
      timeout: 300000 // 5分钟超时
    });
    
  } catch (error) {
    throw new Error(`安装依赖失败: ${error.message}`);
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * 检测包管理器 - 优先推荐bun和pnpm
 */
function detectPackageManager(projectPath) {
  // 1. 检查项目中是否有锁文件
  if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) {
    return 'bun';
  }
  
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  
  // 2. 检查全局是否安装了bun（最优先）
  try {
    execSync('bun --version', { stdio: 'ignore' });
    return 'bun';
  } catch {
    // bun 不可用
  }
  
  // 3. 检查全局是否安装了pnpm（次优先）
  try {
    execSync('pnpm --version', { stdio: 'ignore' });
    return 'pnpm';
  } catch {
    // pnpm 不可用
  }
  
  // 4. 检查yarn（兼容性）
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
    return 'yarn';
  }
  
  try {
    execSync('yarn --version', { stdio: 'ignore' });
    return 'yarn';
  } catch {
    // yarn 不可用
  }
  
  // 5. 默认使用npm（最后选择）
  return 'npm';
}

/**
 * 获取安装命令
 */
function getInstallCommand(packageManager) {
  const commands = {
    bun: 'bun install',
    pnpm: 'pnpm install',
    yarn: 'yarn install',
    npm: 'npm install'
  };
  
  return commands[packageManager] || commands.npm;
}

/**
 * 检查命令是否存在
 */
export function commandExists(command) {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 获取文件夹大小
 */
export async function getFolderSize(folderPath) {
  let size = 0;

  async function calculateSize(currentPath) {
    try {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await calculateSize(itemPath);
        } else {
          size += stats.size;
        }
      }
    } catch (error) {
      // 忽略权限错误等
    }
  }

  await calculateSize(folderPath);
  return size;
}

/**
 * 检查网络连接
 */
export async function checkNetworkConnection() {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('https://github.com', {
      method: 'HEAD',
      timeout: 5000
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 生成项目统计信息
 */
export async function generateProjectStats(projectPath) {
  try {
    const stats = {
      files: 0,
      directories: 0,
      size: 0,
      types: {}
    };

    async function analyze(currentPath) {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        if (shouldSkipFile(item)) continue;
        
        const itemPath = path.join(currentPath, item);
        const itemStats = await fs.stat(itemPath);
        
        if (itemStats.isDirectory()) {
          stats.directories++;
          await analyze(itemPath);
        } else {
          stats.files++;
          stats.size += itemStats.size;
          
          // 统计文件类型
          const ext = path.extname(item).toLowerCase();
          if (ext) {
            stats.types[ext] = (stats.types[ext] || 0) + 1;
          }
        }
      }
    }

    await analyze(projectPath);
    return stats;
  } catch (error) {
    return null;
  }
}

/**
 * 美化打印项目统计
 */
export function printProjectStats(stats) {
  if (!stats) return;
  
  console.log(chalk.blue('📊 项目统计:'));
  console.log(`   文件数量: ${chalk.cyan(stats.files)}`);
  console.log(`   目录数量: ${chalk.cyan(stats.directories)}`);
  console.log(`   总大小: ${chalk.cyan(formatFileSize(stats.size))}`);
  
  if (Object.keys(stats.types).length > 0) {
    console.log(`   文件类型: ${chalk.cyan(Object.keys(stats.types).join(', '))}`);
  }
}