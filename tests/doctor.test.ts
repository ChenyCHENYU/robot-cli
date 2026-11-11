import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import os from "node:os";
import { checkNetworkConnection } from "../src/utils";
import { clearCache, getCacheStats } from "../src/download";
import { getAllTemplates } from "../src/templates";
import { runDoctor } from "../src/doctor";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, execFileSync: vi.fn() };
});
vi.mock("../src/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils")>();
  return { ...actual, checkNetworkConnection: vi.fn() };
});
vi.mock("../src/download", () => ({
  getCacheStats: vi.fn(),
  clearCache: vi.fn(),
}));
vi.mock("ora", () => ({
  default: () => ({ start: () => ({ stop: vi.fn() }) }),
}));

let tools: Record<string, string>;
let output: string[];
let oldExitCode: typeof process.exitCode;
const text = () => stripVTControlCharacters(output.join("\n"));

beforeEach(() => {
  oldExitCode = process.exitCode;
  process.exitCode = undefined;
  tools = {
    node: "v24.0.0",
    git: "git version 2.49.0",
    bun: "1.4.2",
    pnpm: "11.8.0",
    npm: "11.0.0",
  };
  output = [];
  vi.spyOn(console, "log").mockImplementation((...parts) => {
    output.push(parts.join(" "));
  });
  vi.mocked(execFileSync).mockImplementation(((tool: string) => {
    if (!tools[tool]) throw new Error("not installed");
    return tools[tool];
  }) as typeof execFileSync);
  vi.mocked(checkNetworkConnection).mockResolvedValue(true);
  vi.mocked(getCacheStats).mockResolvedValue({ count: 2, totalSize: 4096 });
  vi.mocked(clearCache).mockResolvedValue(undefined);
});
afterEach(() => {
  process.exitCode = oldExitCode;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("template-aware doctor", () => {
  it("uses actual registered PC/H5 requirements in generic guidance", async () => {
    await runDoctor();
    const templates = getAllTemplates();
    expect(text()).toContain(templates["robot-admin"]!.runtime!.node!);
    expect(text()).toContain(templates["robot-h5"]!.runtime!.node!);
    expect(text()).toContain("bun");
    expect(text()).toContain("pnpm");
    expect(text()).toContain("robot doctor --template robot-admin");
    expect(text()).toContain("robot doctor --template robot-h5");
    expect(process.exitCode).toBeUndefined();
  });

  it("does not treat missing optional npm, pnpm, yarn or Git as PC environment errors", async () => {
    tools = { node: "24.0.0", bun: "1.4.2" };
    await runDoctor({ template: "robot-admin" });
    expect(process.exitCode).toBeUndefined();
    expect(text()).toContain("目标模板的工具检查通过");
    expect(text()).toContain(
      "robot create my-app --template robot-admin --no-git",
    );
    expect(text()).not.toContain("[NO]");
    expect(text()).toContain("Git（可选）");
  });

  it("fails PC requirements on old Node and old Bun and provides actionable commands", async () => {
    tools.node = "20.19.0";
    tools.bun = "1.3.14";
    await runDoctor({ template: "robot-admin" });
    expect(process.exitCode).toBe(1);
    expect(text()).toContain("[NO]");
    expect(text()).toContain("bun（必需）");
    expect(text()).toContain("npm install -g bun@1.4.2");
    expect(text()).toContain("node --version");
    expect(text()).toContain("robot doctor --template robot-admin");
  });

  it("checks H5 against pnpm rather than accepting a healthy Bun installation", async () => {
    delete tools.pnpm;
    await runDoctor({ template: "robot-h5" });
    expect(process.exitCode).toBe(1);
    expect(text()).toContain("pnpm（必需）");
    expect(text()).toContain("npm install -g pnpm@11.8.0");
  });

  it("does not call a newer incompatible pnpm version healthy", async () => {
    tools.pnpm = "12.0.0";
    await runDoctor({ template: "robot-h5" });
    expect(process.exitCode).toBe(1);
    expect(text()).toContain("12.0.0");
    expect(text()).toContain("^11.8.0");
  });

  it("reports unreachable services and cache limits as warnings without claiming downloads passed", async () => {
    vi.mocked(checkNetworkConnection).mockRejectedValue(new Error("offline"));
    await runDoctor({ template: "robot-admin" });
    expect(process.exitCode).toBeUndefined();
    expect(text()).toContain("[!!]");
    expect(text()).toContain("不保证包含当前模板");
    expect(text()).toContain("仅已有匹配缓存可能可用");
    expect(text()).toContain("Gitee 备用源");
  });

  it("clears only CLI cache when explicitly requested and reports its resulting state", async () => {
    vi.mocked(getCacheStats).mockResolvedValue({ count: 0, totalSize: 0 });
    vi.mocked(checkNetworkConnection).mockResolvedValue(false);
    await runDoctor({ template: "robot-h5", clearCache: true });
    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(text()).toContain("已清理 CLI 模板缓存");
    expect(text()).toContain("当前没有模板缓存");
    expect(vi.mocked(clearCache).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getCacheStats).mock.invocationCallOrder[0]!,
    );
  });

  it("keeps cache read failures visible and returns failure if explicitly requested clearing fails", async () => {
    vi.mocked(clearCache).mockRejectedValue(new Error("permission denied"));
    vi.mocked(getCacheStats).mockRejectedValue(new Error("unreadable"));
    await runDoctor({ template: "robot-admin", clearCache: true });
    expect(process.exitCode).toBe(1);
    expect(text()).toContain("permission denied");
    expect(text()).toContain("unreadable");
  });

  it("rejects unknown and planned templates without running probes", async () => {
    await runDoctor({ template: "missing-template" });
    expect(process.exitCode).toBe(1);
    expect(text()).toContain("robot list");
    expect(execFileSync).not.toHaveBeenCalled();
    expect(checkNetworkConnection).not.toHaveBeenCalled();
    await runDoctor({ template: "robot-react" });
    expect(text()).toContain("尚未开放");
  });

  it("probes only tool versions and prevents Corepack from downloading missing tools", async () => {
    await runDoctor({ template: "robot-admin" });
    expect(clearCache).not.toHaveBeenCalled();
    for (const [, args, options] of vi.mocked(execFileSync).mock.calls) {
      expect(args).toEqual(["--version"]);
      expect(options).toMatchObject({
        timeout: 5000,
        cwd: os.tmpdir(),
        env: {
          COREPACK_ENABLE_NETWORK: "0",
          COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
        },
      });
    }
  });
});
