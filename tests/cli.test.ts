import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "../src/create";
import { checkForUpdates } from "../src/utils";
import { runDoctor } from "../src/doctor";
import { createProgram } from "../src/index";

vi.mock("../src/create", () => ({ createProject: vi.fn().mockResolvedValue(true) }));
vi.mock("../src/utils", () => ({ checkForUpdates: vi.fn().mockResolvedValue(null) }));
vi.mock("../src/doctor", () => ({ runDoctor: vi.fn().mockResolvedValue(undefined) }));

const stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
const stdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

function setInteractive(interactive: boolean): void {
  Object.defineProperty(process.stdin, "isTTY", { value: interactive, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: interactive, configurable: true });
}

function parser() {
  const program = createProgram().exitOverride().configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });
  for (const command of program.commands) command.exitOverride();
  return program;
}

function output(): string {
  return vi.mocked(console.log).mock.calls.map(args => args.join(" ")).join("\n");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createProject).mockResolvedValue(true);
  vi.mocked(checkForUpdates).mockResolvedValue(null);
  vi.spyOn(console, "log").mockImplementation(() => {});
  setInteractive(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (stdinTTY) Object.defineProperty(process.stdin, "isTTY", stdinTTY);
  else Reflect.deleteProperty(process.stdin, "isTTY");
  if (stdoutTTY) Object.defineProperty(process.stdout, "isTTY", stdoutTTY);
  else Reflect.deleteProperty(process.stdout, "isTTY");
});

describe("create command arguments", () => {
  it("normalizes Commander negated flags and forwards project metadata", async () => {
    await parser().parseAsync([
      "node", "robot", "create", "my-app", "--yes", "--preset", "full",
      "--package-manager", "bun", "--title", "现场作业", "--description", "作业管理",
      "--author", "Example Author", "--no-git", "--no-cache", "--advanced", "--skip-install",
    ]);
    expect(createProject).toHaveBeenCalledWith("my-app", {
      yes: true,
      preset: "full",
      packageManager: "bun",
      title: "现场作业",
      description: "作业管理",
      author: "Example Author",
      git: false,
      noCache: true,
      advanced: true,
      skipInstall: true,
    });
  });

  it("preserves default Git and cache behavior without passing a cache property", async () => {
    await parser().parseAsync(["node", "robot", "create", "my-app", "-y"]);
    expect(createProject).toHaveBeenCalledWith("my-app", { yes: true, git: true });
  });

  it.each([
    ["--preset", "tiny"],
    ["--package-manager", "deno"],
  ])("rejects unsupported %s values before creation", async (option, value) => {
    await expect(parser().parseAsync(["node", "robot", "create", "my-app", option, value]))
      .rejects.toMatchObject({ code: "commander.invalidArgument" });
    expect(createProject).not.toHaveBeenCalled();
  });
});

describe("template catalogue output", () => {
  it("lists available templates and keeps planned products out of the default output", async () => {
    await parser().parseAsync(["node", "robot", "list"]);
    expect(output()).toContain("Robot Admin");
    expect(output()).toContain("Robot H5");
    expect(output()).not.toContain("Robot React");
    expect(output()).not.toContain("Robot NestJS");
  });

  it("shows planned products only when explicitly requested", async () => {
    await parser().parseAsync(["node", "robot", "list", "--all"]);
    expect(output()).toContain("Robot React");
    expect(output()).toContain("规划中");
    expect(output()).toContain("暂不支持创建");
    expect(output()).not.toContain("-t robot-react");
  });

  it("searches available products by default and includes planning with --all", async () => {
    await parser().parseAsync(["node", "robot", "search", "react"]);
    expect(output()).toContain("未找到");
    expect(output()).not.toContain("Robot React");
    vi.mocked(console.log).mockClear();
    await parser().parseAsync(["node", "robot", "search", "react", "--all"]);
    expect(output()).toContain("Robot React");
  });

  it("does not pad the recommended list with advanced architectures", async () => {
    await parser().parseAsync(["node", "robot", "list", "--recommended"]);
    expect(output()).toContain("Robot Admin");
    expect(output()).not.toContain("Robot Monorepo");
    expect(output()).not.toContain("Robot MicroApp");
    expect(output()).not.toContain("Robot Module Federation");
  });
});

describe("doctor command arguments", () => {
  it("forwards the template and explicit cache cleanup choice", async () => {
    await parser().parseAsync(["node", "robot", "doctor", "--template", "robot-h5", "--clear-cache"]);
    expect(runDoctor).toHaveBeenCalledWith({ template: "robot-h5", clearCache: true });
  });
});

describe("optional update checks", () => {
  it.each([
    { interactive: true, flags: ["--yes"] },
    { interactive: true, flags: ["--dry-run"] },
    { interactive: false, flags: [] },
  ])("does not check for updates for $flags in interactive=$interactive", async ({ interactive, flags }) => {
    setInteractive(interactive);
    await parser().parseAsync(["node", "robot", "create", "my-app", ...flags]);
    expect(checkForUpdates).not.toHaveBeenCalled();
  });

  it("checks after a completed interactive creation", async () => {
    setInteractive(true);
    await parser().parseAsync(["node", "robot", "create", "my-app"]);
    expect(checkForUpdates).toHaveBeenCalledOnce();
  });

  it("does not check for updates when creation was cancelled", async () => {
    setInteractive(true);
    vi.mocked(createProject).mockResolvedValue(false);
    await parser().parseAsync(["node", "robot", "create", "my-app"]);
    expect(checkForUpdates).not.toHaveBeenCalled();
  });
});
