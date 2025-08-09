// lib/download.js - 修复版本
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';
import extract from 'extract-zip';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 缓存目录
const CACHE_DIR = path.join(os.homedir(), '.robot-cli', 'cache');

/**
 * 下载模板
 * @param {Object} template - 模板配置
 * @param {Object} options - 选项
 * @returns {string} - 模板路径
 */
export async function downloadTemplate(template, options = {}) {
  const { useCache = true, spinner } = options;
  
  // 验证模板参数
  if (!template) {
    throw new Error('模板参数不能为空');
  }
  
  if (!template.key && !template.repo) {
    throw new Error(`模板配置无效: ${JSON.stringify(template)}`);
  }
  
  // 获取缓存键值，优先使用 key，其次使用 repo 的最后部分
  const cacheKey = template.key || template.repo?.split('/').pop() || 'unknown-template';
  const cachePath = path.join(CACHE_DIR, cacheKey);

  // 检查缓存
  if (useCache && fs.existsSync(cachePath)) {
    if (spinner) {
      spinner.text = '📂 使用缓存模板...';
    }
    
    // 验证缓存完整性
    const packageJsonPath = path.join(cachePath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return cachePath;
    } else {
      // 缓存损坏，删除重新下载
      if (spinner) {
        spinner.text = '🔄 缓存损坏，重新下载...';
      }
      await fs.remove(cachePath);
    }
  }

  // 如果是本地测试模板，直接返回缓存路径
  if (template.localTest || !template.repo) {
    if (fs.existsSync(cachePath)) {
      return cachePath;
    } else {
      throw new Error([
        '本地测试模板不存在',
        '',
        chalk.red.bold('问题描述:'),
        `  测试模板路径不存在: ${cachePath}`,
        '',
        chalk.green.bold('解决方案:'),
        '  1. 运行测试环境设置: npm run test:setup',
        '  2. 或创建测试缓存: npm run test',
        '  3. 检查模板是否正确创建',
        '',
        chalk.blue.bold('可用命令:'),
        '  npm run test:setup --setup  # 创建完整测试环境',
        '  npm run test:clean          # 清理测试环境'
      ].join('\n'));
    }
  }

  // 下载远程模板
  if (spinner) {
    spinner.text = '📥 从 ' + template.repo + ' 下载最新模板...';
  }

  try {
    const downloadUrl = 'https://github.com/' + template.repo + '/archive/refs/heads/main.zip';
    const tempZipPath = path.join(os.tmpdir(), cacheKey + '-' + Date.now() + '.zip');
    const tempExtractPath = path.join(os.tmpdir(), cacheKey + '-extract-' + Date.now());

    // 检查网络连接
    if (spinner) {
      spinner.text = '🌐 检查网络连接...';
    }

    // 下载zip文件
    const response = await fetch(downloadUrl, {
      timeout: 30000, // 30秒超时
      headers: {
        'User-Agent': 'Robot-CLI/1.0.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (spinner) {
      spinner.text = '📦 下载中...';
    }

    const buffer = await response.buffer();
    await fs.writeFile(tempZipPath, buffer);

    if (spinner) {
      spinner.text = '📂 解压模板文件...';
    }

    // 解压文件
    await extract(tempZipPath, { dir: tempExtractPath });

    // 找到解压后的项目目录 (通常是 reponame-main/)
    const extractedItems = await fs.readdir(tempExtractPath);
    const projectDir = extractedItems.find(item => 
      item.endsWith('-main') || item.endsWith('-master')
    );

    if (!projectDir) {
      throw new Error(`解压后找不到项目目录，可用目录: ${extractedItems.join(', ')}`);
    }

    const sourcePath = path.join(tempExtractPath, projectDir);

    // 验证模板完整性
    const packageJsonPath = path.join(sourcePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`模板缺少 package.json 文件`);
    }

    // 确保缓存目录存在
    await fs.ensureDir(CACHE_DIR);

    // 移动到缓存目录
    if (fs.existsSync(cachePath)) {
      await fs.remove(cachePath);
    }
    await fs.move(sourcePath, cachePath);

    // 清理临时文件
    await fs.remove(tempZipPath).catch(() => {});
    await fs.remove(tempExtractPath).catch(() => {});

    return cachePath;

  } catch (error) {
    // 清理可能的临时文件
    try {
      const tempFiles = await fs.readdir(os.tmpdir());
      const robotTempFiles = tempFiles.filter(file => 
        file.includes(cacheKey) && (file.endsWith('.zip') || file.includes('extract'))
      );
      
      for (const file of robotTempFiles) {
        await fs.remove(path.join(os.tmpdir(), file)).catch(() => {});
      }
    } catch (cleanupError) {
      // 忽略清理错误
    }

    // 网络相关错误处理
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`网络连接失败: 无法连接到 GitHub\n请检查网络连接或稍后重试`);
    }

    if (error.code === 'ETIMEDOUT' || error.type === 'request-timeout') {
      throw new Error(`下载超时: 模板文件较大或网络较慢\n请稍后重试或使用 --no-cache 选项`);
    }

    // 重新抛出错误，保持原始错误信息
    throw new Error(`模板下载失败: ${error.message}`);
  }
}

/**
 * 清除所有缓存
 */
export async function clearCache() {
  if (fs.existsSync(CACHE_DIR)) {
    await fs.remove(CACHE_DIR);
  }
  await fs.ensureDir(CACHE_DIR);
}