import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import chalk from "chalk";
import extract from "extract-zip";
import type { TemplateConfig, DownloadOptions, CacheIndex } from "./types";
import { CACHE_DIR_NAME } from "./config";

// ── Cache constants ──────────────────────────────────────────────
const CACHE_DIR = path.join(os.homedir(), ".robot-cli", CACHE_DIR_NAME);
const CACHE_INDEX_PATH = path.join(CACHE_DIR, "index.json");

// ── URL Builders ─────────────────────────────────────────────────

export function buildDownloadUrl(repoUrl: string, branch = "main"): string {
  try {
    const url = new URL(repoUrl);
    const host = url.hostname;
    const cleanUrl = repoUrl.replace(/\/+$/, "");

    if (host === "github.com") return `${cleanUrl}/archive/refs/heads/${branch}.zip`;
    if (host === "gitee.com")
      return `${cleanUrl}/repository/archive/${branch}.zip`;
    if (host === "gitlab.com") {
      const name = cleanUrl.split("/").pop();
      return `${cleanUrl}/-/archive/${branch}/${name}-${branch}.zip`;
    }
    return `${cleanUrl}/archive/refs/heads/${branch}.zip`;
  } catch {
    return `${repoUrl}/archive/refs/heads/${branch}.zip`;
  }
}

// ── Cache helpers ────────────────────────────────────────────────

export function getCacheKey(repoUrl: string): string {
  let hash = 0;
  for (let i = 0; i < repoUrl.length; i++) {
    hash = ((hash << 5) - hash + repoUrl.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

async function loadCacheIndex(): Promise<CacheIndex> {
  try {
    if (await fs.pathExists(CACHE_INDEX_PATH)) {
      return await fs.readJson(CACHE_INDEX_PATH);
    }
  } catch {
    // corrupted index, reset
  }
  return { version: 1, entries: {} };
}

async function saveCacheIndex(index: CacheIndex): Promise<void> {
  await fs.ensureDir(CACHE_DIR);
  await fs.writeJson(CACHE_INDEX_PATH, index, { spaces: 2 });
}

async function getCachedTemplate(repoUrl: string): Promise<string | null> {
  const key = getCacheKey(repoUrl);
  const cachePath = path.join(CACHE_DIR, key);
  if (await fs.pathExists(cachePath)) {
    const pkgPath = path.join(cachePath, "package.json");
    if (await fs.pathExists(pkgPath)) return cachePath;
  }
  return null;
}

async function saveToCache(repoUrl: string, sourcePath: string, branch = "main"): Promise<void> {
  try {
    const key = getCacheKey(repoUrl);
    const cachePath = path.join(CACHE_DIR, key);
    await fs.ensureDir(CACHE_DIR);
    await fs.remove(cachePath).catch(() => {});
    await fs.copy(sourcePath, cachePath);

    const index = await loadCacheIndex();
    const stat = await fs.stat(sourcePath);
    index.entries[key] = {
      repoUrl,
      downloadedAt: new Date().toISOString(),
      branch,
      size: stat.size,
    };
    await saveCacheIndex(index);
  } catch {
    // Cache write failure is non-critical
  }
}

export async function getCacheStats(): Promise<{
  count: number;
  totalSize: number;
}> {
  const index = await loadCacheIndex();
  const entries = Object.values(index.entries);
  return {
    count: entries.length,
    totalSize: entries.reduce((sum, e) => sum + (e.size || 0), 0),
  };
}

export async function clearCache(): Promise<void> {
  await fs.remove(CACHE_DIR);
}

// ── Download logic ───────────────────────────────────────────────

/** 单次下载超时 (ms) */
const TIMEOUT_PRIMARY = 120_000; // 2 min — 中国网络访问 GitHub 需要较长时间
const TIMEOUT_MIRROR = 60_000;   // 1 min
/** 每个源的最大重试次数 */
const MAX_RETRIES = 3;

interface DownloadResult {
  response: Response;
  sourceName: string;
}

/** GitHub 镜像列表 — 按可用性排序 */
function getGitHubMirrors(repoUrl: string): string[] {
  return [
    repoUrl,                                        // 1. 原始 GitHub
    repoUrl.replace("github.com", "hub.gitmirror.com"),  // 2. gitmirror
    `https://ghproxy.net/${repoUrl}`,               // 3. ghproxy.net
  ];
}

async function fetchWithRetry(
  downloadUrl: string,
  timeout: number,
  retries: number,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(downloadUrl, {
        signal: AbortSignal.timeout(timeout),
        headers: { "User-Agent": "Robot-CLI" },
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error(`仓库不存在 (404)`);
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // 404 不重试
      if (lastError.message.includes("404")) throw lastError;

      if (attempt < retries) {
        // 指数退避: 2s, 4s
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  throw lastError!;
}

async function tryDownload(
  repoUrl: string,
  branch = "main",
  spinner?: import("ora").Ora,
): Promise<DownloadResult> {
  const url = new URL(repoUrl);
  const host = url.hostname;

  const mirrors = host === "github.com" ? getGitHubMirrors(repoUrl) : [repoUrl];

  for (let i = 0; i < mirrors.length; i++) {
    const current = mirrors[i];
    const isOriginal = i === 0;

    let sourceName: string;
    try {
      sourceName = isOriginal ? host : new URL(current.replace(/^(https?:\/\/[^/]+)\/.*/, "$1")).hostname;
    } catch {
      sourceName = `镜像 ${i}`;
    }

    try {
      if (spinner) spinner.text = `连接 ${sourceName} ...`;

      const downloadUrl = current.endsWith(".zip")
        ? current
        : buildDownloadUrl(current, branch);

      const timeout = isOriginal ? TIMEOUT_PRIMARY : TIMEOUT_MIRROR;

      if (spinner) spinner.text = `从 ${sourceName} 下载模板 (最多重试${MAX_RETRIES}次)...`;

      const response = await fetchWithRetry(downloadUrl, timeout, MAX_RETRIES);

      if (spinner) {
        const len = response.headers.get("content-length");
        const sizeInfo = len ? `${(parseInt(len) / 1024 / 1024).toFixed(1)}MB ` : "";
        spinner.text = `下载中 ${sizeInfo}(${sourceName})`;
      }

      return { response, sourceName };
    } catch (error) {
      if (i === mirrors.length - 1) throw error;
      if (spinner) spinner.text = `${sourceName} 不可用，切换下一个源...`;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error("所有下载源均不可用");
}

/**
 * Download template — always fetches latest, caches for offline fallback.
 */
export async function downloadTemplate(
  template: Pick<TemplateConfig, "repoUrl" | "branch">,
  options: DownloadOptions = {},
): Promise<string> {
  const { spinner, noCache } = options;
  const branch = template.branch || "main";

  if (!template?.repoUrl) {
    throw new Error(`模板配置无效: ${JSON.stringify(template)}`);
  }

  // ── Try network download ───────────────────────────────────────
  try {
    if (spinner) spinner.text = "开始下载最新模板...";

    const { response, sourceName } = await tryDownload(
      template.repoUrl,
      branch,
      spinner,
    );

    if (spinner) spinner.text = "保存下载文件...";

    const timestamp = Date.now();
    const tempZip = path.join(os.tmpdir(), `robot-template-${timestamp}.zip`);
    const tempExtract = path.join(os.tmpdir(), `robot-extract-${timestamp}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(tempZip, buffer);

    if (spinner) spinner.text = "解压模板文件...";
    await extract(tempZip, { dir: tempExtract });

    if (spinner) spinner.text = "查找项目结构...";
    const extractedItems = await fs.readdir(tempExtract);
    const repoName = template.repoUrl.split("/").pop() || "";
    const projectDir = extractedItems.find(
      (item) =>
        item === `${repoName}-${branch}` ||
        item.endsWith(`-${branch}`) ||
        item.endsWith("-main") ||
        item.endsWith("-master") ||
        item === repoName,
    );

    if (!projectDir) {
      throw new Error(
        `解压后找不到项目目录，可用目录: ${extractedItems.join(", ")}`,
      );
    }

    const sourcePath = path.join(tempExtract, projectDir);

    if (spinner) spinner.text = "验证模板完整性...";
    if (!fs.existsSync(path.join(sourcePath, "package.json"))) {
      throw new Error("模板缺少 package.json 文件");
    }

    // Save to cache (async, non-blocking)
    if (!noCache) {
      saveToCache(template.repoUrl, sourcePath, branch).catch(() => {});
    }

    if (spinner) spinner.text = `模板下载完成 (via ${sourceName})`;

    await fs.remove(tempZip).catch(() => {});
    return sourcePath;
  } catch (downloadError) {
    // ── Fallback to cache ──────────────────────────────────────
    if (!noCache) {
      const cached = await getCachedTemplate(template.repoUrl);
      if (cached) {
        if (spinner) spinner.text = "网络不可用，使用缓存模板...";
        console.log();
        console.log(`  ${chalk.yellow("  注意: 使用缓存版本（非最新）")}`);
        return cached;
      }
    }

    // Clean up temp files
    try {
      const tmpFiles = await fs.readdir(os.tmpdir());
      for (const f of tmpFiles.filter(
        (x) => x.includes("robot-template-") || x.includes("robot-extract-"),
      )) {
        await fs.remove(path.join(os.tmpdir(), f)).catch(() => {});
      }
    } catch {
      // ignore
    }

    const errMsg = (downloadError as Error).message;
    const isTimeout = errMsg.includes("aborted") || errMsg.includes("timeout") || (downloadError as Error).name === "TimeoutError";
    let msg = `模板下载失败: ${errMsg}`;

    if (isTimeout) {
      msg += "\n\n  建议:\n  1. 当前网络连接较慢，请稍后重试\n  2. 如果在国内，尝试使用代理或科学上网\n  3. 使用 robot doctor 检查网络连接";
    } else if ((downloadError as NodeJS.ErrnoException).code === "ENOTFOUND") {
      msg += "\n\n  建议:\n  1. 检查网络连接是否正常\n  2. 如果在国内，尝试使用代理\n  3. 稍后重试";
    }
    throw new Error(msg);
  }
}
