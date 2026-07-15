import { describe, it, expect } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  buildDownloadUrl,
  downloadTemplate,
  getCacheKey,
} from "../src/download";

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
      expect(await fs.pathExists(path.join(downloaded.path, "package.json"))).toBe(
        true,
      );
      await fs.remove(downloaded.cleanupPath!);
    } finally {
      await fs.remove(root);
    }
  }, 15_000);
});
