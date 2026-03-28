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

/**
 * Parse GitHub repoUrl → { owner, repo }
 * e.g. "https://github.com/ChenyCHENYU/Robot_Admin" → { owner: "ChenyCHENYU", repo: "Robot_Admin" }
 */
function parseGitHubRepo(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.replace(/^\/|\/$/g, "").split("/");
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    return null;
  } catch {
    return null;
  }
}

export function buildDownloadUrl(repoUrl: string, branch = "main"): string {
  try {
    const url = new URL(repoUrl);
    const host = url.hostname;
    const cleanUrl = repoUrl.replace(/\/+$/, "");

    // GitHub: 使用 codeload.github.com 直连 CDN (跳过 github.com 的 302 重定向)
    if (host === "github.com") {
      const gh = parseGitHubRepo(cleanUrl);
      if (gh) return `https://codeload.github.com/${gh.owner}/${gh.repo}/zip/refs/heads/${branch}`;
      return `${cleanUrl}/archive/refs/heads/${branch}.zip`;
    }
    if (host === "codeload.github.com") return `${cleanUrl}/zip/refs/heads/${branch}`;
    if (host === "api.github.com") return cleanUrl; // already a full API URL
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
const TIMEOUT_FAST = 30_000;     // 30s — 快速源 (Gitee / codeload CDN)
const TIMEOUT_SLOW = 60_000;     // 60s — 慢速源 (API / 镜像)
/** 每个源的最大重试次数 */
const MAX_RETRIES = 2;

interface DownloadSource {
  url: string;       // 仓库基础 URL 或完整下载 URL
  name: string;      // 展示名称
  timeout: number;   // 超时时间
  headers?: Record<string, string>;  // 额外请求头
  isDirect?: boolean; // 是否已经是完整下载 URL
}

interface DownloadResult {
  response: Response;
  sourceName: string;
}

/**
 * 构建下载源列表 — 按成功率排序
 *
 * 策略参考 giget (unjs/giget, 306k+ 项目使用):
 * 1. Gitee 备用源 (国内首选，速度最快)
 * 2. codeload.github.com (GitHub 专用下载 CDN，跳过 302)
 * 3. api.github.com REST API (GitHub 官方 API，参考 giget)
 * 4. github.com 原始链接 (最后兜底)
 */
function buildDownloadSources(repoUrl: string, branch: string, giteeUrl?: string): DownloadSource[] {
  const sources: DownloadSource[] = [];
  const gh = parseGitHubRepo(repoUrl);

  // 1. Gitee 备用源 — 对国内用户最快
  if (giteeUrl) {
    sources.push({
      url: giteeUrl,
      name: "gitee.com",
      timeout: TIMEOUT_FAST,
    });
  }

  if (gh) {
    // 2. codeload.github.com — GitHub 专用下载 CDN (跳过 github.com 的 302 重定向)
    sources.push({
      url: `https://codeload.github.com/${gh.owner}/${gh.repo}/zip/refs/heads/${branch}`,
      name: "codeload.github.com",
      timeout: TIMEOUT_FAST,
      isDirect: true,
    });

    // 3. api.github.com — GitHub REST API (giget 使用的方式)
    sources.push({
      url: `https://api.github.com/repos/${gh.owner}/${gh.repo}/zipball/${branch}`,
      name: "api.github.com",
      timeout: TIMEOUT_SLOW,
      isDirect: true,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    // 4. github.com 原始链接 (兜底)
    sources.push({
      url: repoUrl,
      name: "github.com",
      timeout: TIMEOUT_SLOW,
    });
  } else {
    // 非 GitHub 仓库，只用原始 URL
    sources.push({
      url: repoUrl,
      name: new URL(repoUrl).hostname,
      timeout: TIMEOUT_SLOW,
    });
  }

  return sources;
}

async function fetchWithRetry(
  downloadUrl: string,
  timeout: number,
  retries: number,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(downloadUrl, {
        signal: AbortSignal.timeout(timeout),
        redirect: "follow",
        headers: {
          "User-Agent": "Robot-CLI/3.0",
          ...extraHeaders,
        },
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error(`仓库不存在 (404)`);
        throw new Error(`HTTP ${response.status}`);
      }

      // 拒绝 HTML 响应 — 通常是登录页、CAPTCHA 或跳转页，不是 ZIP 文件
      const ct = response.headers.get("content-type") ?? "";
      if (ct.includes("text/html")) {
        throw new Error(`收到 HTML 响应而非 ZIP 文件（该源可能需要认证）`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // 404 不重试
      if (lastError.message.includes("404")) throw lastError;

      if (attempt < retries) {
        // 指数退避: 1s, 2s
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError!;
}

async function tryDownload(
  repoUrl: string,
  branch = "main",
  spinner?: import("ora").Ora,
  giteeUrl?: string,
): Promise<DownloadResult> {
  const sources = buildDownloadSources(repoUrl, branch, giteeUrl);
  const errors: string[] = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];

    try {
      if (spinner) spinner.text = `连接 ${source.name} ...`;

      const downloadUrl = source.isDirect
        ? source.url
        : buildDownloadUrl(source.url, branch);

      if (spinner) spinner.text = `从 ${source.name} 下载模板...`;

      const response = await fetchWithRetry(
        downloadUrl,
        source.timeout,
        MAX_RETRIES,
        source.headers,
      );

      if (spinner) {
        const len = response.headers.get("content-length");
        const sizeInfo = len ? `${(parseInt(len) / 1024 / 1024).toFixed(1)}MB ` : "";
        spinner.text = `下载中 ${sizeInfo}(${source.name})`;
      }

      return { response, sourceName: source.name };
    } catch (error) {
      const errMsg = (error as Error).message || String(error);
      errors.push(`${source.name}: ${errMsg}`);

      if (i < sources.length - 1 && spinner) {
        spinner.text = `${source.name} 不可用，切换到 ${sources[i + 1].name}...`;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  throw new Error(
    `所有下载源均不可用:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
  );
}

/**
 * 校验 buffer 是否以 ZIP 魔术字节 PK (50 4B) 开头。
 * 若不是则说明下载到的是错误页面（HTML/JSON 等），直接抛出含内容预览的错误。
 */
function assertZipBuffer(buffer: Buffer, sourceName: string): void {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    // 取前 100 字节做预览，过滤不可打印字符
    const preview = buffer
      .slice(0, 100)
      .toString("utf8")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]/g, "·")
      .replace(/\s+/g, " ")
      .slice(0, 80);
    throw new Error(
      `${sourceName} 返回的不是有效 ZIP 文件 (内容: "${preview}")`,
    );
  }
}

/**
 * Download template — always fetches latest, caches for offline fallback.
 */
export async function downloadTemplate(
  template: Pick<TemplateConfig, "repoUrl" | "branch" | "giteeUrl">,
  options: DownloadOptions = {},
): Promise<string> {
  const { spinner, noCache, giteeUrl: optGiteeUrl } = options;
  const branch = template.branch || "main";
  const giteeUrl = optGiteeUrl || template.giteeUrl;

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
      giteeUrl,
    );

    // ── Download with progress bar ─────────────────────────────
    if (spinner) spinner.text = "保存下载文件...";

    const timestamp = Date.now();
    const tempZip = path.join(os.tmpdir(), `robot-template-${timestamp}.zip`);
    const tempExtract = path.join(os.tmpdir(), `robot-extract-${timestamp}`);

    const contentLength = response.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

    if (totalSize > 0 && response.body && spinner) {
      // Stream download with progress bar
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;

        const pct = Math.round((received / totalSize) * 100);
        const filled = Math.round(pct / 5);
        const bar = "\u2588".repeat(filled) + "\u2591".repeat(20 - filled);
        const sizeMB = (received / 1024 / 1024).toFixed(1);
        const totalMB = (totalSize / 1024 / 1024).toFixed(1);
        spinner.text = `下载中 [${bar}] ${pct}% ${sizeMB}MB/${totalMB}MB (${sourceName})`;
      }

      const buffer = Buffer.concat(chunks);
      assertZipBuffer(buffer, sourceName);
      await fs.writeFile(tempZip, buffer);
    } else {
      // Fallback: no content-length, download without progress
      const buffer = Buffer.from(await response.arrayBuffer());
      assertZipBuffer(buffer, sourceName);
      await fs.writeFile(tempZip, buffer);
    }

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
