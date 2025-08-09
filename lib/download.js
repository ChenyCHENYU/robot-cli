// lib/download.js - 简化版，移除缓存功能
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';
import extract from 'extract-zip';

/**
 * 解析仓库URL，构建下载链接
 */
function buildDownloadUrl(repoUrl) {
  try {
    const url = new URL(repoUrl);
    const hostname = url.hostname;
    
    if (hostname === 'github.com') {
      return `${repoUrl}/archive/refs/heads/main.zip`;
    } else if (hostname === 'gitee.com') {
      return `${repoUrl}/repository/archive/master.zip`;
    } else if (hostname === 'gitlab.com') {
      const repoName = repoUrl.split('/').pop();
      return `${repoUrl}/-/archive/main/${repoName}-main.zip`;
    } else {
      return `${repoUrl}/archive/refs/heads/main.zip`;
    }
  } catch (error) {
    return `${repoUrl}/archive/refs/heads/main.zip`;
  }
}

/**
 * 尝试从多个源下载
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
    mirrors = [repoUrl];
  }
  
  for (let i = 0; i < mirrors.length; i++) {
    const currentUrl = mirrors[i];
    const isOriginal = currentUrl === repoUrl;
    const sourceName = isOriginal ? `${hostname} 官方` : `${hostname} 镜像`;
    
    try {
      if (spinner) {
        spinner.text = `🔍 连接到 ${sourceName}...`;
      }
      
      const downloadUrl = buildDownloadUrl(currentUrl);
      
      if (spinner) {
        spinner.text = `📦 从 ${sourceName} 下载模板...`;
      }
      
      const response = await fetch(downloadUrl, {
        timeout: isOriginal ? 15000 : 10000,
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
      if (i === mirrors.length - 1) {
        throw error;
      }
      
      if (spinner) {
        spinner.text = `⚠️  ${sourceName} 访问失败，尝试其他源...`;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * 下载模板 - 简化版，总是下载最新版本
 */
export async function downloadTemplate(template, options = {}) {
  const { spinner } = options;
  
  // 验证模板参数
  if (!template || !template.repoUrl) {
    throw new Error(`模板配置无效: ${JSON.stringify(template)}`);
  }

  try {
    if (spinner) {
      spinner.text = '🌐 开始下载最新模板...';
    }
    
    // 尝试从不同源下载
    const { response, sourceName } = await tryDownload(template.repoUrl, spinner);

    if (spinner) {
      spinner.text = '💾 保存下载文件...';
    }

    // 创建临时目录和文件
    const timestamp = Date.now();
    const tempZipPath = path.join(os.tmpdir(), `robot-template-${timestamp}.zip`);
    const tempExtractPath = path.join(os.tmpdir(), `robot-extract-${timestamp}`);

    // 保存下载的文件
    const buffer = await response.buffer();
    await fs.writeFile(tempZipPath, buffer);

    if (spinner) {
      spinner.text = '📂 解压模板文件...';
    }

    // 解压文件
    await extract(tempZipPath, { dir: tempExtractPath });

    if (spinner) {
      spinner.text = '🔍 查找项目结构...';
    }

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

    if (spinner) {
      spinner.text = `🎉 模板下载完成 (via ${sourceName})`;
    }

    // 清理zip文件，但保留解压的源码目录供后续使用
    await fs.remove(tempZipPath).catch(() => {});

    return sourcePath;

  } catch (error) {
    // 清理临时文件
    try {
      const tempFiles = await fs.readdir(os.tmpdir());
      const robotTempFiles = tempFiles.filter(file => 
        file.includes('robot-template-') || file.includes('robot-extract-')
      );
      
      for (const file of robotTempFiles) {
        await fs.remove(path.join(os.tmpdir(), file)).catch(() => {});
      }
    } catch (cleanupError) {
      // 忽略清理错误
    }

    let errorMessage = `模板下载失败: ${error.message}`;
    
    if (error.code === 'ENOTFOUND' || error.message.includes('网络')) {
      errorMessage += '\n\n💡 建议:\n1. 检查网络连接\n2. 如果在国内，尝试使用科学上网\n3. 稍后重试';
    }
    
    throw new Error(errorMessage);
  }
}