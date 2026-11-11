import { afterAll, afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import extract from "extract-zip";
import {
  buildDownloadUrl,
  downloadTemplate,
  getCacheKey,
} from "../src/download";

const { cacheHome } = vi.hoisted(() => ({ cacheHome: `${process.env.TMPDIR || process.env.TEMP || "/tmp"}/robot-download-cache-${process.pid}-${Date.now()}` }));
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, default: { ...actual.default, homedir: () => cacheHome }, homedir: () => cacheHome };
});
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});
vi.mock("extract-zip", () => ({ default: vi.fn() }));

beforeEach(async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  vi.mocked(spawn).mockImplementation(actual.spawn);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.mocked(extract).mockReset();
});
afterAll(async () => { await fs.remove(cacheHome); });

function unavailableGit() {
  vi.mocked(spawn).mockImplementation(() => {
    const child = new EventEmitter();
    Object.assign(child, { stderr: new EventEmitter(), kill: vi.fn() });
    queueMicrotask(() => child.emit("error", Object.assign(new Error("git not found"), { code: "ENOENT" })));
    return child as ReturnType<typeof spawn>;
  });
}

async function fakeExtraction(_zip: string, options: { dir: string }) {
  const directory = path.join(options.dir, "user-repo-commit-hash");
  await fs.ensureDir(directory);
  await fs.writeJson(path.join(directory, "package.json"), { name: "fixture" });
}

describe("buildDownloadUrl", () => {
  it("should build GitHub download URL (codeload CDN)", () => {
    const url = buildDownloadUrl("https://github.com/user/repo");
    expect(url).toBe(
      "https://codeload.github.com/user/repo/zip/refs/heads/main",
    );
  });

  it("should build Gitee download URL", () => {
    const url = buildDownloadUrl("https://gitee.com/user/repo");
    expect(url).toBe(
      "https://gitee.com/user/repo/repository/archive/main.zip",
    );
  });

  it("should build GitLab download URL", () => {
    const url = buildDownloadUrl("https://gitlab.com/user/repo");
    expect(url).toBe(
      "https://gitlab.com/user/repo/-/archive/main/repo-main.zip",
    );
  });

  it("should handle trailing slash", () => {
    const url = buildDownloadUrl("https://github.com/user/repo/");
    expect(url).toBe(
      "https://codeload.github.com/user/repo/zip/refs/heads/main",
    );
  });

  it("should default to GitHub pattern for unknown hosts", () => {
    const url = buildDownloadUrl("https://custom-git.example.com/user/repo");
    expect(url).toBe(
      "https://custom-git.example.com/user/repo/archive/refs/heads/main.zip",
    );
  });

  it("should support custom branch for GitHub", () => {
    const url = buildDownloadUrl(
      "https://github.com/user/repo",
      "micro-app",
    );
    expect(url).toBe(
      "https://codeload.github.com/user/repo/zip/refs/heads/micro-app",
    );
  });

  it("should support custom branch for Gitee", () => {
    const url = buildDownloadUrl("https://gitee.com/user/repo", "develop");
    expect(url).toBe(
      "https://gitee.com/user/repo/repository/archive/develop.zip",
    );
  });

  it("removes Git transport suffixes before constructing GitLab and Gitee archives", () => {
    expect(buildDownloadUrl("https://gitlab.com/user/repo.git")).toBe("https://gitlab.com/user/repo/-/archive/main/repo-main.zip");
    expect(buildDownloadUrl("https://gitee.com/user/repo.git")).toBe("https://gitee.com/user/repo/repository/archive/main.zip");
  });
});

describe("getCacheKey", () => {
  it("should return a string", () => {
    const key = getCacheKey("https://github.com/user/repo");
    expect(typeof key).toBe("string");
  });

  it("should return consistent keys for same input", () => {
    const key1 = getCacheKey("https://github.com/user/repo");
    const key2 = getCacheKey("https://github.com/user/repo");
    expect(key1).toBe(key2);
  });

  it("should return different keys for different inputs", () => {
    const key1 = getCacheKey("https://github.com/user/repo1");
    const key2 = getCacheKey("https://github.com/user/repo2");
    expect(key1).not.toBe(key2);
  });

  it("should isolate branches of the same repository", () => {
    const main = getCacheKey("https://github.com/user/repo", "main");
    const monorepo = getCacheKey(
      "https://github.com/user/repo",
      "monorepo",
    );
    expect(main).not.toBe(monorepo);
  });

  it("should normalize a trailing slash", () => {
    const withoutSlash = getCacheKey("https://github.com/user/repo", "main");
    const withSlash = getCacheKey("https://github.com/user/repo/", "main");
    expect(withoutSlash).toBe(withSlash);
  });
});

describe("downloadTemplate", () => {
  it("rejects cancellation before creating processes or returning cached data", async () => {
    const controller = new AbortController();
    controller.abort();
    const before = vi.mocked(spawn).mock.calls.length;
    await expect(downloadTemplate({ repoUrl: "https://github.com/user/repo" }, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.mocked(spawn).mock.calls).toHaveLength(before);
  });

  it("switches sources after invalid ZIP content and accepts API commit-hash roots", async () => {
    unavailableGit();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("invalid archive"))
      .mockResolvedValueOnce(new Response(Buffer.from([0x50, 0x4b, 3, 4])));
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(extract).mockImplementation(fakeExtraction);
    const downloaded = await downloadTemplate({ repoUrl: "https://github.com/user/repo", giteeUrl: "https://gitee.com/user/repo" }, { noCache: true });
    try {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toContain("gitee.com");
      expect(fetchMock.mock.calls[1][0]).toContain("codeload.github.com");
      expect(downloaded.source).toBe("HTTP/codeload.github.com");
      expect(await fs.pathExists(path.join(downloaded.path, "package.json"))).toBe(true);
    } finally { await fs.remove(downloaded.cleanupPath!); }
  });

  it("switches sources when extraction fails after a successful HTTP response", async () => {
    unavailableGit();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(Buffer.from([0x50, 0x4b, 3, 4]))));
    vi.mocked(extract).mockRejectedValueOnce(new Error("invalid ZIP central directory")).mockImplementation(fakeExtraction);
    const downloaded = await downloadTemplate({ repoUrl: "https://github.com/user/repo" }, { noCache: true });
    try {
      expect(downloaded.source).toBe("HTTP/api.github.com");
      expect(vi.mocked(extract)).toHaveBeenCalledTimes(2);
    } finally { await fs.remove(downloaded.cleanupPath!); }
  });

  it("cancels a stalled body without retrying or falling back to another source", async () => {
    unavailableGit();
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => new Response(new ReadableStream({ pull: () => new Promise(() => {}) })));
    vi.stubGlobal("fetch", fetchMock);
    const downloading = downloadTemplate({ repoUrl: "https://github.com/user/repo" }, { noCache: true, signal: controller.signal });
    const rejection = expect(downloading).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("terminates an active Git clone on cancellation without attempting HTTP", async () => {
    const child = new EventEmitter();
    const kill = vi.fn(() => {
      queueMicrotask(() => child.emit("close", null));
      return true;
    });
    Object.assign(child, { stderr: new EventEmitter(), kill });
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const downloading = downloadTemplate({ repoUrl: "https://github.com/user/repo" }, { noCache: true, signal: controller.signal });
    const rejection = expect(downloading).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(vi.mocked(spawn).mock.results.at(-1)?.value).toBe(child));
    controller.abort();
    await rejection;
    expect(kill).toHaveBeenCalledWith("SIGTERM");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.skipIf(process.platform === "win32")("cancels Git together with helpers that retain its stderr pipe", async () => {
    const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "robot-git-cancel-"));
    const marker = path.join(fixture, "started");
    const git = path.join(fixture, "git");
    await fs.writeFile(git, `#!/usr/bin/env node\nconst { spawn } = require('node:child_process');\nconst fs = require('node:fs');\nspawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: ['ignore', 'ignore', 'inherit']});\nfs.writeFileSync(${JSON.stringify(marker)}, 'yes');\nsetInterval(() => {}, 1000);\n`, { mode: 0o755 });
    vi.stubEnv("PATH", `${fixture}${path.delimiter}${process.env.PATH}`);
    const controller = new AbortController();
    const pending = downloadTemplate({ repoUrl: "https://example.invalid/repo" }, { noCache: true, signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    try {
      await vi.waitFor(async () => expect(await fs.pathExists(marker)).toBe(true));
      controller.abort();
      await rejected;
    } finally {
      controller.abort();
      vi.unstubAllEnvs();
      await fs.remove(fixture);
    }
  }, 10_000);

  it("bounds a stalled HTTP body with a timeout", async () => {
    unavailableGit();
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(new ReadableStream({ pull: () => new Promise(() => {}) })));
    vi.stubGlobal("fetch", fetchMock);
    const downloading = downloadTemplate({ repoUrl: "https://custom.example/repo" }, { noCache: true });
    const rejection = expect(downloading).rejects.toThrow(/下载超时/);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(60_000);
    await rejection;
  });

  it("marks a fresh clone as process-owned temporary data", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "robot-download-test-"));
    const repository = path.join(root, "repository");
    await fs.ensureDir(repository);
    await fs.writeJson(path.join(repository, "package.json"), {
      name: "fixture-template",
      version: "1.0.0",
    });

    execFileSync("git", ["init", "--initial-branch=main"], {
      cwd: repository,
      stdio: "ignore",
    });
    execFileSync("git", ["add", "."], { cwd: repository, stdio: "ignore" });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Robot CLI Test",
        "-c",
        "user.email=robot-cli@example.invalid",
        "commit",
        "-m",
        "fixture",
      ],
      { cwd: repository, stdio: "ignore" },
    );

    try {
      const downloaded = await downloadTemplate(
        { repoUrl: repository, branch: "main" },
        { noCache: true },
      );
      expect(downloaded.cleanupPath).toBe(downloaded.path);
      expect(downloaded.revision).toBe(execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim());
      expect(await fs.pathExists(path.join(downloaded.path, "package.json"))).toBe(
        true,
      );
      await fs.remove(downloaded.cleanupPath!);
    } finally {
      await fs.remove(root);
    }
  }, 15_000);

  it("refreshes expired caches and returns cache provenance for a fresh hit", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "robot-cache-test-"));
    const repository = path.join(root, "repository");
    await fs.ensureDir(repository);
    await fs.writeJson(path.join(repository, "package.json"), { name: "cached-v1" });
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: repository, stdio: "ignore" });
    function commit() {
      execFileSync("git", ["add", "."], { cwd: repository, stdio: "ignore" });
      execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"], { cwd: repository, stdio: "ignore" });
    }
    commit();
    try {
      const first = await downloadTemplate({ repoUrl: repository });
      await fs.remove(first.cleanupPath!);
      const cached = await downloadTemplate({ repoUrl: repository });
      expect(cached.fromCache).toBe(true);
      expect(cached.cleanupPath).toBeUndefined();
      expect(cached.source).toContain(repository);
      expect(cached.cachedAt).toBeDefined();
      expect(cached.revision).toMatch(/^[a-f0-9]{40}$/);
      const indexPath = path.join(cacheHome, ".robot-cli", "cache", "index.json");
      const index = await fs.readJson(indexPath);
      index.entries[getCacheKey(repository)].downloadedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      await fs.writeJson(indexPath, index);
      await fs.writeJson(path.join(repository, "package.json"), { name: "cached-v2" });
      commit();
      const refreshed = await downloadTemplate({ repoUrl: repository });
      expect(refreshed.fromCache).toBe(false);
      expect((await fs.readJson(path.join(refreshed.path, "package.json"))).name).toBe("cached-v2");
      await fs.remove(refreshed.cleanupPath!);
      const offlineIndex = await fs.readJson(indexPath);
      offlineIndex.entries[getCacheKey(repository)].downloadedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      await fs.writeJson(indexPath, offlineIndex);
      unavailableGit();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      const offline = await downloadTemplate({ repoUrl: repository });
      expect(offline.fromCache).toBe(true);
      expect((await fs.readJson(path.join(offline.path, "package.json"))).name).toBe("cached-v2");
    } finally { await fs.remove(root); }
  });
});
