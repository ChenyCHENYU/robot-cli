import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { Command, Option } from "commander";
import { downloadTemplate } from "../src/download";
import { getAllTemplates } from "../src/templates";
import { copyTemplate } from "../src/utils";
import { getPresetSelection, executeTrimming } from "../src/trimmer";
import {
  isVersionSupported,
  resolveDownloadedTemplateRuntime,
} from "../src/template-runtime";
import type { SelectedTemplate } from "../src/types";

type Preset = "full" | "lite";
interface Options {
  preset: Preset | "all";
  local?: string;
  report?: string;
  keepTemp?: boolean;
}
interface CaseResult {
  preset: Preset;
  status: "running" | "passed" | "failed";
  projectPath: string;
  install: string;
  checks: string[];
  durationMs?: number;
  error?: string;
}

const options = new Command()
  .name("smoke-robot-admin")
  .description(
    "在隔离目录验证 PC 模板：全新安装依赖、类型检查及生产构建。默认下载最新模板。",
  )
  .addOption(
    new Option("--preset <preset>", "验证 full、lite 或两者")
      .choices(["full", "lite", "all"])
      .default("all"),
  )
  .option(
    "--local <path>",
    "从本地 Git 仓库的已提交 HEAD 创建快照；不复制 node_modules 或未提交文件",
  )
  .option("--report <file>", "写出来源、模板版本、安装与构建结果 JSON")
  .option("--keep-temp", "保留临时目录以便排查")
  .parse(process.argv)
  .opts<Options>();

const root = await fs.mkdtemp(path.join(os.tmpdir(), "robot-admin-smoke-"));
const subprocessEnv: NodeJS.ProcessEnv = {
  ...process.env,
  BUN_INSTALL_CACHE_DIR: path.join(root, "bun-cache"),
};
for (const key of [
  "CI_COMMIT_REF_NAME",
  "CI_COMMIT_BRANCH",
  "BRANCH_NAME",
  "GITHUB_HEAD_REF",
  "GITHUB_REF_NAME",
  "BUILD_SOURCEBRANCHNAME",
  "GIT_LOCAL_BRANCH",
  "GIT_BRANCH",
  "CI_COMMIT_SHA",
  "GIT_COMMIT",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "USE_LOCAL_PACKAGES",
  "USE_LOCAL_COMPONENTS",
  "USE_LOCAL_MACH_TABLE",
  "USE_LOCAL_PACKAGE_NAMES",
  "NODE_PATH",
])
  delete subprocessEnv[key];

function run(
  executable: string,
  args: string[],
  cwd: string,
  stream = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      executable,
      args,
      {
        cwd,
        env: subprocessEnv,
        timeout: 10 * 60_000,
        windowsHide: true,
        maxBuffer: 30 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `${executable} ${args.join(" ")} 失败：${String(
                stderr || stdout || error.message,
              )
                .trim()
                .slice(-16_384)}`,
            ),
          );
        } else resolve(String(stdout).trim());
      },
    );
    if (stream) {
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
    }
  });
}

const report: {
  schemaVersion: number;
  startedAt: string;
  source?: object;
  template?: object;
  isolatedCache: string;
  cases: CaseResult[];
  status: string;
  error?: string;
  finishedAt?: string;
} = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  isolatedCache: subprocessEnv.BUN_INSTALL_CACHE_DIR!,
  cases: [],
  status: "running",
};
let cleanupPath: string | undefined;
try {
  const config = getAllTemplates()["robot-admin"];
  if (!config) throw new Error("robot-admin 未注册");
  const selected: SelectedTemplate = { key: "robot-admin", ...config };
  let source: string;
  if (options.local) {
    const repository = path.resolve(options.local);
    const commit = await run("git", ["rev-parse", "HEAD"], repository);
    const dirty = Boolean(
      await run(
        "git",
        ["status", "--porcelain", "--untracked-files=no"],
        repository,
      ),
    );
    const snapshot = path.join(root, "template-source");
    const archive = path.join(root, "template.tar");
    await fs.ensureDir(snapshot);
    await run(
      "git",
      ["archive", "--format=tar", "--output", archive, "HEAD"],
      repository,
    );
    await run("tar", ["-xf", archive, "-C", snapshot], root);
    source = snapshot;
    report.source = {
      kind: "local-git-head",
      repository,
      commit,
      ignoredUncommittedChanges: dirty,
    };
    console.log(
      `PC 模板来源：本地已提交快照 ${repository}@${commit}${dirty ? "（未提交修改未包含）" : ""}`,
    );
  } else {
    const downloaded = await downloadTemplate(selected, { noCache: true });
    cleanupPath = downloaded.cleanupPath;
    source = downloaded.path;
    report.source = {
      kind: "download",
      repository: config.repoUrl,
      branch: config.branch || "main",
      actualSource: downloaded.source,
      fromCache: downloaded.fromCache || false,
    };
    console.log(
      `PC 模板来源：${downloaded.source || config.repoUrl} · ${config.branch || "main"}（绕过缓存）`,
    );
  }
  const node = (await run("node", ["--version"], root)).replace(/^v/, "");
  const bun = await run("bun", ["--version"], root);
  const template = await resolveDownloadedTemplateRuntime(
    source,
    selected,
    node,
  );
  if (template.runtime?.packageManager !== "bun")
    throw new Error(
      `PC 冒烟暂只支持模板声明的 Bun 工具链，实际为 ${template.runtime?.packageManager || "未声明"}`,
    );
  if (!isVersionSupported(bun, template.runtime.packageManagerVersion))
    throw new Error(
      `Bun ${bun} 不满足模板要求 ${template.runtime.packageManagerVersion}`,
    );
  const original = await fs.readJson(path.join(source, "package.json"));
  const lockFile = path.join(source, "bun.lock");
  if (!(await fs.pathExists(lockFile)))
    throw new Error("PC 模板缺少 bun.lock，不能验证可复现安装。");
  const lockSha256 = createHash("sha256")
    .update(await fs.readFile(lockFile))
    .digest("hex");
  report.template = {
    name: original.name,
    version: original.version,
    lockSha256,
    node,
    bun,
    runtime: template.runtime,
  };
  console.log(
    `模板：${original.name}@${original.version} · Node ${node} · Bun ${bun} · lock sha256 ${lockSha256}`,
  );
  const presets: Preset[] =
    options.preset === "all" ? ["full", "lite"] : [options.preset];
  for (const preset of presets) {
    const started = Date.now();
    const projectPath = path.join(root, `robot-admin-${preset}`);
    const result: CaseResult = {
      preset,
      status: "running",
      projectPath,
      install:
        preset === "full"
          ? "bun install --frozen-lockfile"
          : "bun install（按裁剪后的 package.json 更新模板锁文件）",
      checks: ["bun run type-build", "bun run build"],
    };
    report.cases.push(result);
    try {
      await copyTemplate(source, projectPath);
      if (await fs.pathExists(path.join(projectPath, "node_modules")))
        throw new Error("临时项目意外包含 node_modules，拒绝复用现有依赖。");
      await executeTrimming(projectPath, getPresetSelection(preset));
      const hooks = path.join(root, "empty-hooks");
      await fs.ensureDir(hooks);
      const gitConfig = [
        "-c",
        "user.name=Robot CLI Smoke",
        "-c",
        "user.email=robot-cli-smoke@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        `core.hooksPath=${hooks}`,
      ];
      await run(
        "git",
        [...gitConfig, "init", "--initial-branch=main", "--template="],
        projectPath,
      );
      await run("git", [...gitConfig, "add", "."], projectPath);
      await run(
        "git",
        [
          ...gitConfig,
          "commit",
          "--no-gpg-sign",
          "-m",
          "test: initialize PC smoke fixture",
        ],
        projectPath,
      );
      console.log(
        `\n[${preset}] 全新安装依赖（空 node_modules，隔离 Bun 缓存）…`,
      );
      await run(
        "bun",
        ["install", ...(preset === "full" ? ["--frozen-lockfile"] : [])],
        projectPath,
        true,
      );
      const vuePath = await fs.realpath(
        path.join(projectPath, "node_modules/vue/package.json"),
      );
      const relativeVue = path.relative(await fs.realpath(projectPath), vuePath);
      if (relativeVue.startsWith("..") || path.isAbsolute(relativeVue))
        throw new Error(`依赖解析到了临时项目之外：${vuePath}`);
      console.log(`[${preset}] 检查应用及构建工具类型…`);
      await run("bun", ["run", "type-build"], projectPath, true);
      console.log(`[${preset}] 构建生产产物…`);
      await run("bun", ["run", "build"], projectPath, true);
      result.status = "passed";
      result.durationMs = Date.now() - started;
      console.log(
        `[${preset}] 全新安装、类型检查及生产构建通过（${result.durationMs}ms）。`,
      );
    } catch (error) {
      result.status = "failed";
      result.durationMs = Date.now() - started;
      result.error = (error as Error).message;
      throw error;
    }
  }
  report.status = "passed";
  console.log(
    `\nRobot Admin smoke passed: ${original.name}@${original.version} · ${presets.join(" + ")} · fresh install + type-build + production build`,
  );
} catch (error) {
  report.status = "failed";
  report.error = (error as Error).message;
  console.error(report.error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  if (options.report) {
    await fs.outputJson(path.resolve(options.report), report, { spaces: 2 });
    console.log(`验证记录：${path.resolve(options.report)}`);
  }
  if (cleanupPath) await fs.remove(cleanupPath).catch(() => {});
  if (options.keepTemp) console.log(`已保留临时目录：${root}`);
  else await fs.remove(root).catch(() => {});
}
