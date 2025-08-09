// lib/download.js - 真正简化版，解决实际问题
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
 * 解析仓库URL，构建下载链接
 */
function buildDownloadUrl(repoUrl) {
  try {
    const url = new URL(repoUrl);
    const hostname = url.hostname;
    const pathname = url.pathname;
    
    if (hostname === 'github.com') {
      // GitHub: https://github.com/user/repo -> /user/repo/archive/refs/heads/main.zip
      return `${repoUrl}/archive/refs/heads/main.zip`;
    } else if (hostname === 'gitee.com') {
      // Gitee: https://gitee.com/user/repo -> /user/repo/repository/archive/master.zip
      return `${repoUrl}/repository/archive/master.zip`;
    } else if (hostname === 'gitlab.com') {
      // GitLab: https://gitlab.com/user/repo -> /user/repo/-/archive/main/repo-main.zip
      const repoName = pathname.split('/').pop();
      return `${repoUrl}/-/archive/main/${repoName}-main.zip`;
    } else {
      // 其他平台，默认使用 GitHub 格式
      return `${repoUrl}/archive/refs/heads/main.zip`;
    }
  } catch (error) {
    // URL 解析失败，返回原始URL + 默认后缀
    return `${repoUrl}/archive/refs/heads/main.zip`;
  }
}

/**
 * 尝试下载 - 支持多平台
 */
async function tryDownload(repoUrl, spinner) {
  const url = new URL(repoUrl);
  const hostname = url.hostname;
  
  // 根据平台选择镜像源
  let mirrors = [];
  
  if (hostname === 'github.com') {
    mirrors = [
      repoUrl,                              // 官方源
      `https://ghproxy.com/${repoUrl}`      // GitHub 代理
    ];
  } else {
    // 其他平台直接使用原始URL
    mirrors = [repoUrl];
  }
  
  for (let i = 0; i < mirrors.length; i++) {
    const currentUrl = mirrors[i];
    const isOriginal = currentUrl === repoUrl;
    const sourceName = isOriginal ? `${hostname} 官方` : `${hostname} 镜像`;
    
    try {
      if (spinner) {
        spinner.text = `📦 尝试从 ${sourceName} 下载...`;
      }
      
      const downloadUrl = buildDownloadUrl(currentUrl);
      
      const response = await fetch(downloadUrl, {
        timeout: isOriginal ? 15000 : 10000, // 官方源给更多时间
        headers: {
          'User-Agent': 'Robot-CLI/1.0.0'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`仓库不存在: ${repoUrl}`);
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      if (spinner) {
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const sizeInMB = (parseInt(contentLength) / 1024 / 1024).toFixed(1);
          spinner.text = `📦 下载中... (${sizeInMB}MB from ${sourceName})`;
        } else {
          spinner.text = `📦 下载中... (from ${sourceName})`;
        }
      }
      
      return { response, sourceName };
      
    } catch (error) {
      // 如果是最后一个源，抛出错误
      if (i === mirrors.length - 1) {
        throw error;
      }
      
      // 否则继续尝试下一个源
      if (spinner) {
        spinner.text = `⚠️  ${sourceName} 访问失败，尝试其他源...`;
      }
      
      // 等待1秒再试下一个
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * 下载模板 - 简化版
 */
export async function downloadTemplate(template, options = {}) {
  const { useCache = true, spinner } = options;
  
  // 验证模板参数
  if (!template) {
    throw new Error('模板参数不能为空');
  }
  
  if (!template.key && !template.repoUrl) {
    throw new Error(`模板配置无效: ${JSON.stringify(template)}`);
  }
  
  // 获取缓存键值
  const cacheKey = template.key || template.repoUrl?.split('/').pop() || 'unknown-template';
  const cachePath = path.join(CACHE_DIR, cacheKey);

  // 检查缓存
  if (useCache && fs.existsSync(cachePath)) {
    if (spinner) {
      spinner.text = '📂 使用缓存模板...';
    }
    
    // 验证缓存完整性
    const packageJsonPath = path.join(cachePath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      if (spinner) {
        spinner.text = '✅ 缓存模板验证通过';
      }
      return cachePath;
    } else {
      // 缓存损坏，删除重新下载
      if (spinner) {
        spinner.text = '🔄 缓存损坏，重新下载...';
      }
      await fs.remove(cachePath);
    }
  }

  // 如果是本地测试模板
  if (template.localTest || !template.repoUrl) {
    if (fs.existsSync(cachePath)) {
      return cachePath;
    } else {
      throw new Error(`本地测试模板不存在: ${cachePath}`);
    }
  }

  // 下载远程模板
  try {
    // 尝试从不同源下载
    const { response, sourceName } = await tryDownload(template.repoUrl, spinner);

    // 保存到临时文件
    const tempZipPath = path.join(os.tmpdir(), cacheKey + '-' + Date.now() + '.zip');
    const tempExtractPath = path.join(os.tmpdir(), cacheKey + '-extract-' + Date.now());

    const buffer = await response.buffer();
    await fs.writeFile(tempZipPath, buffer);

    if (spinner) {
      spinner.text = '📂 解压模板文件...';
    }

    // 解压文件
    await extract(tempZipPath, { dir: tempExtractPath });

    // 查找项目目录
    const extractedItems = await fs.readdir(tempExtractPath);
    const projectDir = extractedItems.find(item => 
      item.endsWith('-main') || 
      item.endsWith('-master') || 
      item === template.repoUrl.split('/').pop()
    );

    if (!projectDir) {
      throw new Error(`解压后找不到项目目录，可用目录: ${extractedItems.join(', ')}`);
    }

    const sourcePath = path.join(tempExtractPath, projectDir);

    // 验证模板完整性
    if (spinner) {
      spinner.text = '✅ 验证模板完整性...';
    }

    const packageJsonPath = path.join(sourcePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`模板缺少 package.json 文件`);
    }

    // 保存到缓存
    if (spinner) {
      spinner.text = '💾 保存到缓存...';
    }

    await fs.ensureDir(CACHE_DIR);
    if (fs.existsSync(cachePath)) {
      await fs.remove(cachePath);
    }
    await fs.move(sourcePath, cachePath);

    // 清理临时文件
    await fs.remove(tempZipPath).catch(() => {});
    await fs.remove(tempExtractPath).catch(() => {});

    if (spinner) {
      spinner.text = `🎉 模板下载完成 (via ${sourceName})`;
    }

    return cachePath;

  } catch (error) {
    // 清理临时文件
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

    // 简单的错误处理
    let errorMessage = `模板下载失败: ${error.message}`;
    
    if (error.code === 'ENOTFOUND' || error.message.includes('网络')) {
      errorMessage += '\n\n💡 建议:\n1. 检查网络连接\n2. 如果在国内，尝试使用科学上网\n3. 稍后重试';
    }
    
    throw new Error(errorMessage);
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