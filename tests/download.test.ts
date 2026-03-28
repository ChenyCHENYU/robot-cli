import { describe, it, expect } from "vitest";
import { buildDownloadUrl, getCacheKey } from "../src/download";

describe("buildDownloadUrl", () => {
  it("should build GitHub download URL", () => {
    const url = buildDownloadUrl("https://github.com/user/repo");
    expect(url).toBe(
      "https://github.com/user/repo/archive/refs/heads/main.zip",
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
      "https://github.com/user/repo/archive/refs/heads/main.zip",
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
      "https://github.com/user/repo/archive/refs/heads/micro-app.zip",
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
});
