import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
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
  connectionTimeoutMs: number,
  retries: number,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    // 使用 AbortController 手动管理超时，而不是 AbortSignal.timeout()
    // 关键区别：AbortSignal.timeout() 是总时限（含下载 body），会在大文件下载中途强制中断
    // 我们的方案：只对"建立连接/收到响应头"计时，一旦连接成功立即 clearTimeout
    // 这与 node-fetch 的 timeout 行为一致（活跃超时，不限制流式下载时长）
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), connectionTimeoutMs);

    try {
      const response = await fetch(downloadUrl, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Robot-CLI/3.0",
          ...extraHeaders,
        },
      });

      // 连接成功、响应头已收到 — 立即取消超时计时器
      // body 流式下载不再受任何时间限制，可以自由下载大文件
      clearTimeout(timer);

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
      clearTimeout(timer); // 异常时也确保清理计时器
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
 * 使用系统 git 执行 shallow clone (--depth=1)。
 *
 * 这是最可靠的下载方式，原因：
 * - 自动继承用户系统级 git 代理配置 (http.proxy / https.proxy)
 * - 无 HTTP 超时问题、无 ZIP 解析问题
 * - git stderr 输出含百分比进度，可实时展示
 *
 * @throws Error("GIT_NOT_FOUND") 当系统没有安装 git 时，调用方据此切换到 HTTP 兜底
 */
async function gitCloneTemplate(
  repoUrl: string,
  branch: string,
  targetDir: string,
  spinner?: import("ora").Ora,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (spinner) spinner.text = `连接中...`;

    const args = [
      "clone",
      "--depth=1",
      "--single-branch",
      "--branch",
      branch,
      repoUrl,
      targetDir,
    ];

    const proc = spawn("git", args, { stdio: ["ignore", "ignore", "pipe"] });

    proc.stderr?.on("data", (chunk: Buffer) => {
      if (!spinner) return;
      // git 进度输出格式: "Receiving objects:  45% (234/521), 2.90 MiB | 1.00 MiB/s"
      const text = chunk.toString();
      const pctMatch = text.match(/(\d+)%\s*\((\d+)\/(\d+)\)/);
      if (pctMatch) {
        const pct = parseInt(pctMatch[1]);
        const filled = Math.round(pct / 5);
        const bar = "█".repeat(filled) + "░".repeat(20 - filled);
        const speed = text.match(/([\d.]+\s*[KMG]iB\/s)/)?.[1] ?? "";
        spinner.text = `下载中 [${bar}] ${pct}%${speed ? "  " + speed : ""}`;
      } else {
        const line = text.split(/\r?\n/).find((l) => l.trim())?.trim() ?? "";
        if (line && line.length < 80) spinner.text = `克隆中... ${line}`;
      }
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      // ENOENT = git 二进制不存在
      reject(new Error(err.code === "ENOENT" ? "GIT_NOT_FOUND" : `git 启动失败: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git clone 失败 (exit ${code})`));
    });
  });
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

  // ── 缓存检查 ───────────────────────────────────────────────────
  if (!noCache) {
    const cached = await getCachedTemplate(template.repoUrl);
    if (cached) {
      if (spinner) spinner.text = "已使用缓存模板，如需更新请运行 robot cache clear";
      return cached;
    }
  }

  // ── Strategy 1: git clone --depth=1 ──────────────────────────
  // 最可靠方案：使用系统 git，自动继承代理配置
  // create-vue / create-vite / degit / giget 底层都走此路径
  // 优先顺序：Gitee（国内快）→ GitHub
  const cloneSources: Array<{ url: string; name: string }> = [];
  if (giteeUrl) cloneSources.push({ url: giteeUrl, name: "Gitee" });
  cloneSources.push({ url: template.repoUrl, name: "GitHub" });

  let noGit = false;
  const cloneErrors: string[] = [];

  for (const { url: cloneUrl, name: srcName } of cloneSources) {
    const tempDir = path.join(os.tmpdir(), `robot-git-${Date.now()}`);
    try {
      if (spinner) spinner.text = `连接 ${srcName}...`;

      await gitCloneTemplate(cloneUrl, branch, tempDir, spinner);

      // 移除 .git 历史，节省空间
      await fs.remove(path.join(tempDir, ".git")).catch(() => {});

      if (spinner) spinner.text = "验证模板完整性...";
      if (!fs.existsSync(path.join(tempDir, "package.json"))) {
        throw new Error("模板缺少 package.json");
      }

      if (!noCache) saveToCache(template.repoUrl, tempDir, branch).catch(() => {});
      if (spinner) spinner.text = `模板下载完成 (${srcName})`;
      return tempDir;
    } catch (err) {
      await fs.remove(tempDir).catch(() => {});
      const msg = (err as Error).message;
      if (msg === "GIT_NOT_FOUND") {
        noGit = true;
        break; // 没有 git，直接跳到 HTTP 兜底
      }
      cloneErrors.push(`${srcName}: ${msg}`);
      if (spinner) spinner.text = `${srcName} 克隆失败，尝试下一个源...`;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // ── Strategy 2: HTTP ZIP download (git 不可用时的兜底) ─────────
  if (noGit && spinner) spinner.text = "系统未安装 git，切换到 HTTP 下载...";

  try {
    if (spinner) spinner.text = "HTTP 下载模板中...";

    const { response, sourceName } = await tryDownload(
      template.repoUrl,
      branch,
      spinner,
      giteeUrl,
    );

    if (spinner) spinner.text = "保存文件...";

    const timestamp = Date.now();
    const tempZip = path.join(os.tmpdir(), `robot-template-${timestamp}.zip`);
    const tempExtract = path.join(os.tmpdir(), `robot-extract-${timestamp}`);

    const contentLength = response.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

    if (totalSize > 0 && response.body && spinner) {
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
        const bar = "█".repeat(filled) + "░".repeat(20 - filled);
        const sizeMB = (received / 1024 / 1024).toFixed(1);
        const totalMB = (totalSize / 1024 / 1024).toFixed(1);
        spinner.text = `下载中 [${bar}] ${pct}% ${sizeMB}/${totalMB}MB (${sourceName})`;
      }
      const buffer = Buffer.concat(chunks);
      assertZipBuffer(buffer, sourceName);
      await fs.writeFile(tempZip, buffer);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      assertZipBuffer(buffer, sourceName);
      await fs.writeFile(tempZip, buffer);
    }

    if (spinner) spinner.text = "解压模板文件...";
    await extract(tempZip, { dir: tempExtract });

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
      throw new Error(`解压后找不到项目目录，可用目录: ${extractedItems.join(", ")}`);
    }

    const sourcePath = path.join(tempExtract, projectDir);

    if (!fs.existsSync(path.join(sourcePath, "package.json"))) {
      throw new Error("模板缺少 package.json 文件");
    }

    if (!noCache) saveToCache(template.repoUrl, sourcePath, branch).catch(() => {});
    if (spinner) spinner.text = `模板下载完成 (HTTP/${sourceName})`;

    await fs.remove(tempZip).catch(() => {});
    return sourcePath;
  } catch (httpError) {
    // ── 最终兜底：使用缓存 ───────────────────────────────────────
    if (!noCache) {
      const cached = await getCachedTemplate(template.repoUrl);
      if (cached) {
        if (spinner) spinner.text = "网络不可用，使用缓存模板...";
        console.log(`\n  ${chalk.yellow("注意: 已使用缓存版本（非最新）")}`);
        return cached;
      }
    }

    // 清理临时文件
    try {
      const tmpFiles = await fs.readdir(os.tmpdir());
      for (const f of tmpFiles.filter(
        (x) => x.includes("robot-template-") || x.includes("robot-extract-") || x.includes("robot-git-"),
      )) {
        await fs.remove(path.join(os.tmpdir(), f)).catch(() => {});
      }
    } catch { /* ignore */ }

    const errMsg = (httpError as Error).message;
    const allErrors = [...cloneErrors, `HTTP: ${errMsg}`].map((e) => `  - ${e}`).join("\n");
    throw new Error(`模板下载失败，所有方式均不可用:\n${allErrors}`);
  }
}
