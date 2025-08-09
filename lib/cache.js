// lib/cache.js 
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const CACHE_DIR = path.join(os.homedir(), '.robot-cli', 'cache');

/**
 * 清除缓存
 */
export async function clearCache() {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const cacheItems = await fs.readdir(CACHE_DIR);
      
      if (cacheItems.length === 0) {
        console.log(chalk.yellow('📭 缓存目录为空'));
        return;
      }

      await fs.remove(CACHE_DIR);
      await fs.ensureDir(CACHE_DIR);
      
      console.log(chalk.green(`🗑️  已清除 ${cacheItems.length} 个缓存模板:`));
      cacheItems.forEach(item => {
        console.log(chalk.gray(`   - ${item}`));
      });
    } else {
      console.log(chalk.yellow('📭 缓存目录不存在'));
    }
  } catch (error) {
    throw new Error(`清除缓存失败: ${error.message}`);
  }
}

/**
 * 获取缓存信息
 */
export async function getCacheInfo() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      return {
        exists: false,
        templates: [],
        size: 0,
        path: CACHE_DIR
      };
    }

    const templates = await fs.readdir(CACHE_DIR);
    let totalSize = 0;

    const templateInfos = await Promise.all(
      templates.map(async (template) => {
        const templatePath = path.join(CACHE_DIR, template);
        const stats = await fs.stat(templatePath);
        const size = await getFolderSize(templatePath);
        totalSize += size;

        return {
          name: template,
          modifiedTime: stats.mtime,
          size: size
        };
      })
    );

    return {
      exists: true,
      templates: templateInfos,
      size: totalSize,
      path: CACHE_DIR
    };
  } catch (error) {
    throw new Error(`获取缓存信息失败: ${error.message}`);
  }
}

/**
 * 计算文件夹大小
 */
async function getFolderSize(folderPath) {
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
 * 格式化文件大小
 */
export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}