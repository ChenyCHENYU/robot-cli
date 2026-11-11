import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { copyTemplate, detectPackageManager, getPackageManagerVersion, installDependencies } from "../src/utils";

vi.mock("node:child_process", () => ({ execSync: vi.fn(), spawn: vi.fn() }));

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "robot-utils-"));
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.remove(root);
});

describe("package-manager probes", () => {
  it("checks installed versions outside the current project's package-manager policy", () => {
    vi.mocked(execSync).mockReturnValue("11.8.0\n");
    expect(getPackageManagerVersion("pnpm")).toBe("11.8.0");
    expect(execSync).toHaveBeenCalledWith("pnpm --version", expect.objectContaining({
      cwd: os.tmpdir(),
      env: expect.objectContaining({ COREPACK_ENABLE_NETWORK: "0", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" }),
    }));
  });

  it("uses the same bounded version probe for detection", () => {
    vi.mocked(execSync).mockImplementation((command) => {
      if (command === "pnpm --version") return "11.8.0\n";
      throw new Error("not installed");
    });
    expect(detectPackageManager()).toEqual(["pnpm"]);
    expect(execSync).toHaveBeenCalledTimes(4);
  });
});

describe("template copying", () => {
  it("preserves a relative directory symlink without following it recursively", async () => {
    const source = path.join(root, "template");
    const destination = path.join(root, "project");
    await fs.outputFile(path.join(source, "shared/file.ts"), "export default 1");
    await fs.symlink("shared", path.join(source, "shared-link"), "dir");
    await fs.outputFile(path.join(source, ".DS_Store"), "local metadata");
    await copyTemplate(source, destination);
    expect((await fs.lstat(path.join(destination, "shared-link"))).isSymbolicLink()).toBe(true);
    expect(await fs.readlink(path.join(destination, "shared-link"))).toBe("shared");
    expect(await fs.readFile(path.join(destination, "shared-link/file.ts"), "utf8")).toBe("export default 1");
    expect(await fs.pathExists(path.join(destination, ".DS_Store"))).toBe(false);
  });

  it("rejects a symlink that points outside the template", async () => {
    const source = path.join(root, "template");
    const outside = path.join(root, "outside");
    const destination = path.join(root, "project");
    await fs.ensureDir(source);
    await fs.outputFile(path.join(outside, "private.txt"), "keep private");
    await fs.symlink("../outside", path.join(source, "external"), "dir");
    await expect(copyTemplate(source, destination)).rejects.toThrow("仓库外部");
    expect(await fs.pathExists(path.join(destination, "external"))).toBe(false);
    expect(await fs.readFile(path.join(outside, "private.txt"), "utf8")).toBe("keep private");
  });

  it("does not overwrite a file that already exists at the copy destination", async () => {
    const source = path.join(root, "template");
    const destination = path.join(root, "project");
    await fs.outputFile(path.join(source, "file.txt"), "template");
    await fs.outputFile(path.join(destination, "file.txt"), "user file");
    await expect(copyTemplate(source, destination)).rejects.toThrow();
    expect(await fs.readFile(path.join(destination, "file.txt"), "utf8")).toBe("user file");
  });
});

describe("dependency installation", () => {
  it("keeps installation logs attached and waits for process closure after an error", async () => {
    await fs.outputJson(path.join(root, "package.json"), { name: "fixture" });
    const child = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);
    let settled = false;
    const result = installDependencies(root, undefined, "bun").then((value) => {
      settled = true;
      return value;
    });
    expect(spawn).toHaveBeenCalledWith("bun", ["install"], expect.objectContaining({ cwd: root, stdio: "inherit", timeout: 300_000 }));
    child.emit("error", new Error("spawn failed"));
    await Promise.resolve();
    expect(settled).toBe(false);
    child.emit("close", 1, null);
    expect(await result).toBe(false);
  });

  it("does not start a package manager after cancellation", async () => {
    await fs.outputJson(path.join(root, "package.json"), { name: "fixture" });
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    expect(await installDependencies(root, undefined, "bun", controller.signal)).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });
});
