import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

const ui = vi.hoisted(() => ({
  text: vi.fn(), select: vi.fn(), confirm: vi.fn(),
  intro: vi.fn(), outro: vi.fn(), note: vi.fn(),
  log: { step: vi.fn(), info: vi.fn(), warn: vi.fn(), success: vi.fn() },
}));
vi.mock("@clack/prompts", () => ({ ...ui, isCancel: (value: unknown) => typeof value === "symbol" }));
vi.mock("../src/download", () => ({ downloadTemplate: vi.fn() }));
vi.mock("../src/template-runtime", async (load) => {
  const actual = await load<typeof import("../src/template-runtime")>();
  return {
    ...actual,
    // The CLI supports Node 20 even when the target PC template requires Node 22+.
    assertTemplateRuntime: (template: Parameters<typeof actual.assertTemplateRuntime>[0]) => actual.assertTemplateRuntime(template, "24.0.0"),
    resolveDownloadedTemplateRuntime: (root: string, template: Parameters<typeof actual.resolveDownloadedTemplateRuntime>[1]) => actual.resolveDownloadedTemplateRuntime(root, template, "24.0.0"),
  };
});
vi.mock("../src/utils", async (load) => {
  const actual = await load<typeof import("../src/utils")>();
  return {
    ...actual,
    copyTemplate: vi.fn(actual.copyTemplate),
    detectPackageManager: () => ["bun", "pnpm", "npm"],
    getPackageManagerVersion: (manager: string) => manager === "pnpm" ? "11.8.0" : manager === "npm" ? "11.0.0" : "1.4.2",
    getGitUser: () => "Test Author",
    installDependencies: vi.fn().mockResolvedValue(true),
  };
});
import { createProject } from "../src/create";
import { downloadTemplate } from "../src/download";
import { copyTemplate, installDependencies } from "../src/utils";

describe("project creation", () => {
  let root: string;
  let source: string;
  const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  const outputTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  beforeEach(async () => {
    vi.clearAllMocks();
    process.exitCode = 0;
    root = await fs.mkdtemp(path.join(os.tmpdir(), "robot-create-"));
    source = path.join(root, "template");
    await fs.outputJson(path.join(source, "package.json"), {
      name: "template", version: "2.7.0", author: "Original Author", repository: "https://example.invalid/original",
      packageManager: "bun@1.4.2", engines: { node: ">=22.18.0", bun: ">=1.4.2" },
      scripts: { dev: "vite", build: "vite build", "type-build": "tsc --noEmit" },
    });
    await fs.outputFile(path.join(source, "envs/.env"), "VITE_APP_TITLE=ROBOT ADMIN\n");
    await fs.outputFile(path.join(source, ".vscode/mcp.json"), '{"servers":{}}');
    await fs.outputFile(path.join(source, "README.md"), "# Original template\n\nTemplate documentation.\n");
    vi.spyOn(process, "cwd").mockReturnValue(root);
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    vi.mocked(downloadTemplate).mockResolvedValue({ path: source, source: "Fixture", fromCache: true, revision: "1234567890abcdef1234567890abcdef12345678" });
    vi.mocked(installDependencies).mockResolvedValue(true);
    const actualUtils = await vi.importActual<typeof import("../src/utils")>("../src/utils");
    vi.mocked(copyTemplate).mockImplementation(actualUtils.copyTemplate);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (ttyDescriptor) Object.defineProperty(process.stdin, "isTTY", ttyDescriptor);
    else delete (process.stdin as { isTTY?: boolean }).isTTY;
    if (outputTtyDescriptor) Object.defineProperty(process.stdout, "isTTY", outputTtyDescriptor);
    else delete (process.stdout as { isTTY?: boolean }).isTTY;
    process.exitCode = 0;
    await fs.remove(root);
  });

  it("previews a complete plan without downloads, prompts or project writes", async () => {
    expect(await createProject("my-app", { yes: true, dryRun: true, skipInstall: true, title: "设备平台" })).toBe(false);
    expect(downloadTemplate).not.toHaveBeenCalled();
    expect(ui.confirm).not.toHaveBeenCalled();
    expect(ui.text).not.toHaveBeenCalled();
    expect(await fs.pathExists(path.join(root, "my-app"))).toBe(false);
    expect(ui.note.mock.calls.flat().join("\n")).toContain("设备平台");
    expect(ui.outro).toHaveBeenCalledWith(expect.stringContaining("未下载模板或写入项目"));
  });

  it("creates usable files, retains team configuration and separates title from description", async () => {
    expect(await createProject("my-app", {
      yes: true, preset: "full", skipInstall: true, git: false,
      title: "设备管理平台", description: "设备业务项目", noCache: true,
    })).toBe(true);
    const project = path.join(root, "my-app");
    expect(await fs.readJson(path.join(project, "package.json"))).toMatchObject({ name: "my-app", description: "设备业务项目" });
    expect((await fs.readJson(path.join(project, "package.json"))).repository).toBeUndefined();
    expect(await fs.readFile(path.join(project, "envs/.env"), "utf8")).toContain('VITE_APP_TITLE="设备管理平台"');
    expect(await fs.pathExists(path.join(project, ".vscode/mcp.json"))).toBe(true);
    expect(await fs.pathExists(path.join(project, ".git"))).toBe(false);
    expect(await fs.readJson(path.join(project, ".robot-cli/project.json"))).toMatchObject({
      projectName: "my-app", title: "设备管理平台", template: { id: "robot-admin", version: "2.7.0", revision: "1234567890abcdef1234567890abcdef12345678" },
    });
    expect(await fs.readFile(path.join(project, "ROBOT_PROJECT.md"), "utf8")).toContain("bun run type-build");
    expect(await fs.readFile(path.join(project, "README.md"), "utf8")).toContain("Template documentation");
    expect(downloadTemplate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ noCache: true }));
    expect(installDependencies).not.toHaveBeenCalled();
  });

  it("rejects an unknown template before asking questions or downloading", async () => {
    await expect(createProject("my-app", { yes: true, template: "typo" })).rejects.toThrow("不存在");
    expect(downloadTemplate).not.toHaveBeenCalled();
    expect(ui.text).not.toHaveBeenCalled();
  });

  it("does not hang when a non-interactive invocation omits --yes", async () => {
    await expect(createProject("my-app", { template: "robot-admin" })).rejects.toThrow("--yes");
    expect(ui.select).not.toHaveBeenCalled();
  });

  it("never overwrites an existing project with --yes", async () => {
    await fs.outputFile(path.join(root, "my-app/keep.txt"), "original");
    await expect(createProject("my-app", { yes: true, preset: "full", skipInstall: true })).rejects.toThrow("不会覆盖");
    expect(await fs.readFile(path.join(root, "my-app/keep.txt"), "utf8")).toBe("original");
    expect(downloadTemplate).not.toHaveBeenCalled();
  });

  it("can replace a valid long project name without exceeding filesystem backup-name limits", async () => {
    const name = "a".repeat(214);
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    await fs.outputFile(path.join(root, name, "keep.txt"), "original");
    ui.select.mockResolvedValue("quick");
    ui.confirm.mockResolvedValue(true);
    expect(await createProject(name, {
      template: "robot-admin", preset: "full", skipInstall: true, git: false, title: "Test",
    })).toBe(true);
    expect(await fs.pathExists(path.join(root, name, "package.json"))).toBe(true);
    expect((await fs.readdir(root)).some((entry) => entry.includes("robot-backup"))).toBe(false);
  });

  it("does not wait for hidden prompts when output is redirected", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    await expect(createProject("my-app", { template: "robot-admin" })).rejects.toThrow("无法交互");
    expect(ui.select).not.toHaveBeenCalled();
  });

  it("removes a failed new project without touching its source template", async () => {
    await fs.outputFile(path.join(source, "_gitignore"), "node_modules");
    await fs.outputFile(path.join(source, ".gitignore"), "dist");
    await expect(createProject("my-app", { yes: true, preset: "full", skipInstall: true, git: false })).rejects.toThrow();
    expect(await fs.pathExists(path.join(root, "my-app"))).toBe(false);
    expect(await fs.pathExists(source)).toBe(true);
  });

  it("restores the original directory after an approved replacement fails", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    await fs.outputFile(path.join(root, "my-app/keep.txt"), "original");
    await fs.outputFile(path.join(source, "_gitignore"), "node_modules");
    await fs.outputFile(path.join(source, ".gitignore"), "dist");
    ui.select.mockResolvedValue("quick");
    ui.confirm.mockResolvedValue(true);
    await expect(createProject("my-app", {
      template: "robot-admin", preset: "full", skipInstall: true, git: false, title: "Test",
    })).rejects.toThrow();
    expect(await fs.readFile(path.join(root, "my-app/keep.txt"), "utf8")).toBe("original");
    expect((await fs.readdir(root)).some((name) => name.includes("robot-backup"))).toBe(false);
  });

  it("preserves a generated project and reports failure when dependency installation fails", async () => {
    vi.mocked(installDependencies).mockResolvedValue(false);
    expect(await createProject("my-app", { yes: true, preset: "full", git: false })).toBe(false);
    expect(await fs.pathExists(path.join(root, "my-app/package.json"))).toBe(true);
    expect(process.exitCode).toBe(1);
    expect(ui.note.mock.calls.flat().join("\n")).toContain("安装失败，项目文件已保留");
  });

  it("retains the original directory backup when replacement files succeed but installation fails", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    await fs.outputFile(path.join(root, "my-app/keep.txt"), "original");
    ui.select.mockResolvedValue("quick");
    ui.confirm.mockResolvedValue(true);
    vi.mocked(installDependencies).mockResolvedValue(false);
    expect(await createProject("my-app", {
      template: "robot-admin", preset: "full", git: false, title: "Test",
    })).toBe(false);
    expect(await fs.pathExists(path.join(root, "my-app/package.json"))).toBe(true);
    const backup = (await fs.readdir(root)).find((name) => name.includes("robot-backup"));
    expect(backup).toBeDefined();
    expect(await fs.readFile(path.join(root, backup!, "keep.txt"), "utf8")).toBe("original");
    expect(ui.log.warn.mock.calls.flat().join("\n")).toContain(backup);
  });

  it("checks the downloaded runtime before modifying an existing directory", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    await fs.outputFile(path.join(root, "my-app/keep.txt"), "original");
    const pkg = await fs.readJson(path.join(source, "package.json"));
    pkg.engines.node = ">=99";
    await fs.writeJson(path.join(source, "package.json"), pkg);
    ui.select.mockResolvedValue("quick");
    ui.confirm.mockResolvedValue(true);
    await expect(createProject("my-app", { template: "robot-admin", preset: "full", skipInstall: true, title: "Test" })).rejects.toThrow("Node.js");
    expect(await fs.readFile(path.join(root, "my-app/keep.txt"), "utf8")).toBe("original");
  });

  it("cancels at the final confirmation without downloading or writing", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    ui.select.mockResolvedValue("quick");
    ui.confirm.mockResolvedValue(false);
    expect(await createProject("my-app", { template: "robot-admin", preset: "full", skipInstall: true, title: "Test" })).toBe(false);
    expect(downloadTemplate).not.toHaveBeenCalled();
    expect(await fs.pathExists(path.join(root, "my-app"))).toBe(false);
  });

  it("preserves a directory created by another process while the template downloads", async () => {
    vi.mocked(downloadTemplate).mockImplementationOnce(async () => {
      await fs.outputFile(path.join(root, "my-app/keep.txt"), "created concurrently");
      return { path: source };
    });
    await expect(createProject("my-app", { yes: true, preset: "full", skipInstall: true, git: false })).rejects.toThrow();
    expect(await fs.readFile(path.join(root, "my-app/keep.txt"), "utf8")).toBe("created concurrently");
    expect(await fs.pathExists(path.join(root, "my-app/package.json"))).toBe(false);
  });

  it("restores an approved replacement when cancellation arrives during copying", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    await fs.outputFile(path.join(root, "my-app/keep.txt"), "original");
    ui.select.mockResolvedValue("quick");
    ui.confirm.mockResolvedValue(true);
    const actual = await vi.importActual<typeof import("../src/utils")>("../src/utils");
    vi.mocked(copyTemplate).mockImplementationOnce(async (...args) => {
      await actual.copyTemplate(...args);
      process.emit("SIGINT");
    });
    expect(await createProject("my-app", {
      template: "robot-admin", preset: "full", skipInstall: true, git: false, title: "Test",
    })).toBe(false);
    expect(await fs.readFile(path.join(root, "my-app/keep.txt"), "utf8")).toBe("original");
    expect(await fs.pathExists(path.join(root, "my-app/package.json"))).toBe(false);
    expect(installDependencies).not.toHaveBeenCalled();
  });

  it("uses a custom repository's real start script and package manager", async () => {
    const pkg = await fs.readJson(path.join(source, "package.json"));
    pkg.scripts = { start: "node server.mjs", test: "node --test" };
    pkg.packageManager = "npm@11.0.0";
    await fs.writeJson(path.join(source, "package.json"), pkg);
    expect(await createProject("my-app", {
      yes: true, from: "https://example.invalid/org/template", skipInstall: true, git: false,
    })).toBe(true);
    const guide = await fs.readFile(path.join(root, "my-app/ROBOT_PROJECT.md"), "utf8");
    expect(guide).toContain("npm run start");
    expect(guide).toContain("npm run test");
    expect(guide).not.toContain("run dev");
    expect(guide).not.toContain("run build");
    expect(ui.note.mock.calls.flat().join("\n")).toContain("npm run start");
  });

  it("does not invent startup or check commands when the downloaded package has none", async () => {
    const pkg = await fs.readJson(path.join(source, "package.json"));
    delete pkg.scripts;
    await fs.writeJson(path.join(source, "package.json"), pkg);
    expect(await createProject("my-app", { yes: true, preset: "full", skipInstall: true, git: false, author: "" })).toBe(true);
    const guide = await fs.readFile(path.join(root, "my-app/ROBOT_PROJECT.md"), "utf8");
    expect(guide).not.toContain("bun run");
    expect(guide).toContain("未声明 dev/start");
    expect((await fs.readJson(path.join(root, "my-app/package.json"))).author).toBeUndefined();
  });
});
