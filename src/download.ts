import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import chalk from "chalk";
import extract from "extract-zip";
import type {
  TemplateConfig,
  DownloadOptions,
  DownloadedTemplate,
  CacheIndex,
  CacheEntry,
} from "./types";
import { CACHE_DIR_NAME } from "./config";

// ── Cache constants ──────────────────────────────────────────────
const CACHE_DIR = path.join(os.homedir(), ".robot-cli", CACHE_DIR_NAME);
const CACHE_INDEX_PATH = path.join(CACHE_DIR, "index.json");
const CACHE_INDEX_VERSION = 2;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildDownloadUrl(repoUrl: string, branch = "main"): string {
  try {
    const url = new URL(repoUrl);
    const host = url.hostname;
    const cleanUrl = repoUrl.replace(/\/+$/, "").replace(/\.git$/, "");

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

export function getCacheKey(repoUrl: string, branch = "main"): string {
  const identity = `${repoUrl.replace(/\/+$/, "")}#${branch}`;
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
}

async function loadCacheIndex(): Promise<CacheIndex> {
  try {
    if (await fs.pathExists(CACHE_INDEX_PATH)) {
      const index = (await fs.readJson(CACHE_INDEX_PATH)) as CacheIndex;
      if (index.version === CACHE_INDEX_VERSION && index.entries && typeof index.entries === "object" && !Array.isArray(index.entries)) return index;
    }
  } catch {
    // corrupted index, reset
  }
  return { version: CACHE_INDEX_VERSION, entries: {} };
}

async function saveCacheIndex(index: CacheIndex): Promise<void> {
  await fs.ensureDir(CACHE_DIR);
  const stagingPath = `${CACHE_INDEX_PATH}.tmp-${process.pid}-${randomUUID()}`;
  await fs.writeJson(stagingPath, index, { spaces: 2 });
  await fs.move(stagingPath, CACHE_INDEX_PATH, { overwrite: true });
}

async function getCachedTemplate(
  repoUrl: string,
  branch: string,
): Promise<{ path: string; entry: CacheEntry; fresh: boolean } | null> {
  const key = getCacheKey(repoUrl, branch);
  const cachePath = path.join(CACHE_DIR, key);
  const entry = (await loadCacheIndex()).entries[key];
  if (!entry || typeof entry.repoUrl !== "string" || typeof entry.downloadedAt !== "string" || entry.repoUrl.replace(/\/+$/, "") !== repoUrl.replace(/\/+$/, "") || entry.branch !== branch) return null;
  const timestamp = Date.parse(entry.downloadedAt);
  if (!Number.isFinite(timestamp)) return null;
  try {
    const pkg = await fs.readJson(path.join(cachePath, "package.json"));
    if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) return null;
    const age = Date.now() - timestamp;
    return { path: cachePath, entry, fresh: age >= 0 && age < CACHE_MAX_AGE_MS };
  } catch { /* incomplete caches must never be returned */ }
  return null;
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) size += await getDirectorySize(fullPath);
    else if (entry.isFile()) size += (await fs.stat(fullPath)).size;
  }
  return size;
}

async function saveToCache(
  repoUrl: string,
  sourcePath: string,
  branch = "main",
  source?: string,
  revision?: string,
): Promise<void> {
  let stagingPath: string | undefined;
  try {
    const key = getCacheKey(repoUrl, branch);
    const cachePath = path.join(CACHE_DIR, key);
    const index = await loadCacheIndex();
    await fs.ensureDir(CACHE_DIR);
    stagingPath = path.join(
      CACHE_DIR,
      `${key}.tmp-${process.pid}-${randomUUID()}`,
    );
    await fs.copy(sourcePath, stagingPath);
    const size = await getDirectorySize(stagingPath);
    await fs.move(stagingPath, cachePath, { overwrite: true });
    stagingPath = undefined;

    index.entries[key] = {
      repoUrl,
      downloadedAt: new Date().toISOString(),
      branch,
      size,
      source,
      revision,
    };
    await saveCacheIndex(index);
  } catch {
    // Cache write failure is non-critical
  } finally {
    if (stagingPath) await fs.remove(stagingPath).catch(() => {});
  }
}

export async function getCacheStats(): Promise<{
  count: number;
  totalSize: number;
}> {
  const index = await loadCacheIndex();
  const entries = Object.values(index.entries).filter((entry) => entry && typeof entry.size === "number" && Number.isFinite(entry.size) && entry.size >= 0);
  return {
    count: entries.length,
    totalSize: entries.reduce((sum, e) => sum + (e.size || 0), 0),
  };
}

export async function clearCache(): Promise<void> {
  await fs.remove(CACHE_DIR);
}

// ── Download logic ───────────────────────────────────────────────

const TIMEOUT_FAST = 30_000;
const TIMEOUT_SLOW = 60_000;
const DOWNLOAD_TOTAL_TIMEOUT_MS = 5 * 60_000;
const GIT_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;

interface DownloadSource {
  url: string;
  name: string;
  timeout: number;
  headers?: Record<string, string>;
}

function abortError(): Error {
  const error = new Error("已取消模板下载");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function errorDetail(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return detail.replace(/(https?:\/\/)[^\s/@]+@/g, "$1<credentials>@");
}

function report(message: string, spinner?: import("ora").Ora): void {
  if (spinner) spinner.text = message;
  else console.log(message);
}

function buildDownloadSources(repoUrl: string, branch: string, giteeUrl?: string): DownloadSource[] {
  const sources: DownloadSource[] = [];
  const gh = parseGitHubRepo(repoUrl);
  if (giteeUrl) sources.push({ url: buildDownloadUrl(giteeUrl, branch), name: "gitee.com", timeout: TIMEOUT_FAST });
  if (gh) {
    sources.push(
      { url: buildDownloadUrl(repoUrl, branch), name: "codeload.github.com", timeout: TIMEOUT_FAST },
      {
        url: `https://api.github.com/repos/${gh.owner}/${gh.repo}/zipball/${encodeURIComponent(branch)}`,
        name: "api.github.com",
        timeout: TIMEOUT_SLOW,
        headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      },
      { url: `${repoUrl.replace(/\/+$/, "").replace(/\.git$/, "")}/archive/refs/heads/${encodeURIComponent(branch)}.zip`, name: "github.com", timeout: TIMEOUT_SLOW },
    );
  } else {
    let name = "自定义源";
    try { name = new URL(repoUrl).hostname; } catch { /* local paths are Git-only */ }
    sources.push({ url: buildDownloadUrl(repoUrl, branch), name, timeout: TIMEOUT_SLOW });
  }
  return sources;
}

/** Timeout covers response headers and stalled body reads; all streams are closed on failure. */
async function fetchArchive(source: DownloadSource, spinner?: import("ora").Ora, signal?: AbortSignal): Promise<Buffer> {
  throwIfAborted(signal);
  const controller = new AbortController();
  const cancel = () => controller.abort(abortError());
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = () => controller.abort(new Error(`${source.name} 下载超时`));
  let idleTimer = setTimeout(timeout, source.timeout);
  const totalTimer = setTimeout(timeout, DOWNLOAD_TOTAL_TIMEOUT_MS);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  // Promise race also bounds a stalled custom fetch/stream implementation.
  function bounded<T>(operation: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(controller.signal.reason);
      if (controller.signal.aborted) { reject(controller.signal.reason); return; }
      controller.signal.addEventListener("abort", onAbort, { once: true });
      operation.then(resolve, reject).finally(() => controller.signal.removeEventListener("abort", onAbort));
    });
  }
  try {
    const response = await bounded(fetch(source.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Robot-CLI/3", ...source.headers },
    }));
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new Error(response.status === 404 ? "仓库或分支不存在 (404)" : `HTTP ${response.status}`);
    }
    if ((response.headers.get("content-type") || "").includes("text/html")) {
      void response.body?.cancel().catch(() => {});
      throw new Error("收到 HTML 而非 ZIP（可能需要认证）");
    }
    if (!response.body) throw new Error("下载响应没有内容");
    reader = response.body.getReader();
    const totalSize = Number(response.headers.get("content-length")) || 0;
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(timeout, source.timeout);
      const { done, value } = await bounded(reader.read());
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (spinner) {
        const pct = totalSize ? Math.min(100, Math.round(received / totalSize * 100)) : undefined;
        spinner.text = `下载中 ${(received / 1024 / 1024).toFixed(1)}MB${pct === undefined ? "" : ` (${pct}%)`} — ${source.name}`;
      }
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new Error("返回内容不是有效 ZIP 文件");
    }
    return buffer;
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(totalTimer);
    signal?.removeEventListener("abort", cancel);
    controller.abort();
    void reader?.cancel().catch(() => {});
  }
}

async function validateProject(sourcePath: string): Promise<void> {
  try {
    const pkg = await fs.readJson(path.join(sourcePath, "package.json"));
    if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) throw new Error("invalid package");
  } catch {
    throw new Error("模板缺少有效的 package.json");
  }
}

async function readGitRevision(cwd: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", ["rev-parse", "HEAD"], {
      cwd, encoding: "utf8", timeout: 5_000, killSignal: "SIGKILL", signal, windowsHide: true,
    }, (error, stdout) => {
      const revision = stdout?.trim();
      if (error || !/^[a-f0-9]{40,64}$/i.test(revision || "")) {
        reject(new Error(`无法确认下载模板的 Git 提交: ${error?.message || "无有效 HEAD"}`));
      } else resolve(revision);
    });
  });
}

async function downloadArchive(
  repoUrl: string,
  branch: string,
  giteeUrl: string | undefined,
  spinner?: import("ora").Ora,
  signal?: AbortSignal,
): Promise<DownloadedTemplate> {
  const errors: string[] = [];
  for (const source of buildDownloadSources(repoUrl, branch, giteeUrl)) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      throwIfAborted(signal);
      let tempRoot: string | undefined;
      try {
        report(`下载模板：${source.name}${attempt > 1 ? `（重试 ${attempt - 1}）` : ""}`, spinner);
        const buffer = await fetchArchive(source, spinner, signal);
        tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "robot-http-"));
        const tempZip = path.join(tempRoot, "template.zip");
        const tempExtract = path.join(tempRoot, "extract");
        await fs.writeFile(tempZip, buffer);
        await extract(tempZip, { dir: tempExtract });
        throwIfAborted(signal);
        const items = await fs.readdir(tempExtract, { withFileTypes: true });
        const directories = items.filter((item) => item.isDirectory());
        // GitHub API ZIPs use commit hashes; never infer their root from a branch name.
        const sourcePath = await fs.pathExists(path.join(tempExtract, "package.json"))
          ? tempExtract
          : directories.length === 1 ? path.join(tempExtract, directories[0].name) : "";
        if (!sourcePath) throw new Error("ZIP 中没有唯一的项目根目录");
        await validateProject(sourcePath);
        await fs.remove(tempZip);
        return { path: sourcePath, cleanupPath: tempRoot, source: `HTTP/${source.name}`, fromCache: false };
      } catch (error) {
        if (tempRoot) await fs.remove(tempRoot).catch(() => {});
        throwIfAborted(signal);
        const detail = errorDetail(error);
        errors.push(`${source.name}（尝试 ${attempt}）: ${detail}`);
        // Invalid archive/auth/404 errors need a different source, not an identical retry.
        if (/404|HTML|ZIP|package\.json|401|403/.test(detail)) break;
      }
    }
  }
  throw new Error(`所有 HTTP 下载源均不可用:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
}

/** Git clones have a bounded lifetime and preserve useful stderr diagnostics. */
async function gitCloneTemplate(repoUrl: string, branch: string, targetDir: string, spinner?: import("ora").Ora, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const proc = spawn("git", ["clone", "--depth=1", "--single-branch", "--branch", branch, "--", repoUrl, targetDir], {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    let stderr = "";
    let stopped: Error | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const killTree = (signal: NodeJS.Signals) => {
      if (process.platform === "win32" && proc.pid) {
        const killer = spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
        killer.once("error", () => { proc.kill(signal); });
      } else if (proc.pid) {
        try { process.kill(-proc.pid, signal); } catch { proc.kill(signal); }
      } else proc.kill(signal);
    };
    const stop = (error: Error) => {
      if (stopped) return;
      stopped = error;
      killTree("SIGTERM");
      killTimer = setTimeout(() => killTree("SIGKILL"), 2_000);
      killTimer.unref();
    };
    const cancel = () => stop(abortError());
    const timer = setTimeout(() => stop(new Error("git clone 超时（120 秒）")), GIT_TIMEOUT_MS);
    signal?.addEventListener("abort", cancel, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      signal?.removeEventListener("abort", cancel);
    };
    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr = (stderr + text).slice(-8_192);
      if (spinner) {
        const pct = text.match(/(\d+)%\s*\((\d+)\/(\d+)\)/)?.[1];
        if (pct) spinner.text = `Git 下载中 ${pct}%`;
      }
    });
    proc.on("error", (error: NodeJS.ErrnoException) => {
      cleanup();
      reject(stopped || new Error(error.code === "ENOENT" ? "GIT_NOT_FOUND" : `git 启动失败: ${error.message}`));
    });
    proc.on("close", (code) => {
      cleanup();
      if (stopped) reject(stopped);
      else if (code === 0) resolve();
      else reject(new Error(`git clone 失败 (exit ${code}): ${errorDetail(stderr.trim() || "无错误详情")}`));
    });
    // An AbortSignal can change while the child is being created.
    if (signal?.aborted) cancel();
  });
}

/** Fresh cache for 24 hours; stale cache is an explicit offline fallback. */
export async function downloadTemplate(
  template: Pick<TemplateConfig, "repoUrl" | "branch" | "giteeUrl">,
  options: DownloadOptions = {},
): Promise<DownloadedTemplate> {
  const { spinner, noCache, signal } = options;
  throwIfAborted(signal);
  if (!template?.repoUrl) throw new Error("模板缺少仓库地址");
  const branch = template.branch || "main";
  const giteeUrl = options.giteeUrl || template.giteeUrl;
  const cached = noCache ? null : await getCachedTemplate(template.repoUrl, branch);
  const useCache = (offline: boolean): DownloadedTemplate => {
    throwIfAborted(signal);
    if (!cached) throw new Error("缓存不存在");
    const source = cached.entry.source || cached.entry.repoUrl;
    const message = `${offline ? "网络下载失败，使用过期缓存" : "使用24小时内缓存"}：${cached.entry.downloadedAt} · ${source}。使用 --no-cache 强制重新下载`;
    if (offline) console.log(`\n  ${chalk.yellow(message)}`);
    else report(message, spinner);
    return { path: cached.path, source, fromCache: true, cachedAt: cached.entry.downloadedAt, revision: cached.entry.revision };
  };
  if (cached?.fresh) return useCache(false);
  const cloneSources = [
    ...(giteeUrl ? [{ url: giteeUrl, name: "Gitee" }] : []),
    { url: template.repoUrl, name: "Git" },
  ];
  const errors: string[] = [];
  for (const source of cloneSources) {
    throwIfAborted(signal);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-git-"));
    try {
      report(`下载模板：${source.name} · ${branch}`, spinner);
      await gitCloneTemplate(source.url, branch, tempDir, spinner, signal);
      const revision = await readGitRevision(tempDir, signal);
      await fs.remove(path.join(tempDir, ".git"));
      await validateProject(tempDir);
      throwIfAborted(signal);
      const sourceName = errorDetail(`${source.name}: ${source.url}`);
      if (!noCache) await saveToCache(template.repoUrl, tempDir, branch, sourceName, revision);
      throwIfAborted(signal);
      return { path: tempDir, cleanupPath: tempDir, source: sourceName, fromCache: false, revision };
    } catch (error) {
      await fs.remove(tempDir).catch(() => {});
      throwIfAborted(signal);
      const detail = errorDetail(error);
      errors.push(`${source.name}: ${detail}`);
      if (detail === "GIT_NOT_FOUND") break;
    }
  }
  try {
    const result = await downloadArchive(template.repoUrl, branch, giteeUrl, spinner, signal);
    try {
      if (!noCache) await saveToCache(template.repoUrl, result.path, branch, result.source);
      throwIfAborted(signal);
    } catch (error) {
      if (result.cleanupPath) await fs.remove(result.cleanupPath).catch(() => {});
      throw error;
    }
    return result;
  } catch (error) {
    throwIfAborted(signal);
    if (cached) return useCache(true);
    errors.push(errorDetail(error));
    throw new Error(`模板下载失败，所有方式均不可用:\n${errors.map((detail) => `  - ${detail}`).join("\n")}`);
  }
}
