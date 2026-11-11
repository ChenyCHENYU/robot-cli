import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { downloadTemplate } from "../src/download";
import { getAllTemplates } from "../src/templates";
import { copyTemplate } from "../src/utils";
import {
  isVersionSupported,
  resolveDownloadedTemplateRuntime,
  runTemplateInitializer,
} from "../src/template-runtime";
import type { DownloadedTemplate, SelectedTemplate } from "../src/types";

const args = process.argv.slice(2);
const localIndex = args.indexOf("--local");
if (args.length && (localIndex !== 0 || args.length !== 2 || !args[1])) {
  throw new Error("用法：bun run smoke:robot-h5 [--local /absolute/path/to/Robot_H5]");
}
const localTemplate = localIndex === 0 ? path.resolve(args[1]) : undefined;
const projectName = "robot-h5-contract-smoke";
const projectTitle = "Robot H5 Contract Smoke";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "robot-h5-smoke-"));
const projectPath = path.join(root, projectName);
let cleanupPath: string | undefined;

// The generated repository, not the CLI checkout's CI branch/commit, defines the H5 build identity.
const subprocessEnv = { ...process.env };
for (const key of [
  "CI_COMMIT_REF_NAME", "CI_COMMIT_BRANCH", "BRANCH_NAME", "GITHUB_HEAD_REF", "GITHUB_REF_NAME",
  "BUILD_SOURCEBRANCHNAME", "GIT_LOCAL_BRANCH", "GIT_BRANCH", "CI_COMMIT_SHA", "GIT_COMMIT",
  "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES",
]) delete subprocessEnv[key];

function run(
  executable: string,
  args: string[],
  cwd: string,
  streamOutput = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      executable,
      args,
      {
        cwd,
        env: subprocessEnv,
        timeout: 8 * 60_000,
        windowsHide: true,
        // Fixed package-manager commands use .cmd shims on Windows.
        shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executable),
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr || stdout || error.message).trim()));
          return;
        }
        resolve(String(stdout).trim());
      },
    );
    if (streamOutput) {
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
    }
  });
}

try {
  const config = getAllTemplates()["robot-h5"];
  if (!config) throw new Error("robot-h5 未注册");

  const selectedTemplate: SelectedTemplate = { key: "robot-h5", ...config };

  const downloaded: DownloadedTemplate = localTemplate
    ? { path: localTemplate, source: `local:${localTemplate}` }
    : await downloadTemplate(selectedTemplate, { noCache: true });
  cleanupPath = downloaded.cleanupPath;
  const actualNode = await run("node", ["-p", "process.versions.node"], root);
  const template = await resolveDownloadedTemplateRuntime(downloaded.path, selectedTemplate, actualNode);
  const sourceRevision = localTemplate
    ? await run("git", ["-C", localTemplate, "rev-parse", "HEAD"], root).catch(() => "unversioned")
    : downloaded.revision || "revision unavailable (HTTP archive)";
  const sourceDirty = localTemplate
    ? Boolean(await run("git", ["-C", localTemplate, "status", "--porcelain"], root).catch(() => "unknown"))
    : false;
  console.log(`H5 smoke source: ${downloaded.source} @ ${sourceRevision}${sourceDirty ? " (working tree changes included)" : ""}`);
  await copyTemplate(downloaded.path, projectPath);
  if (await fs.pathExists(path.join(projectPath, "node_modules"))) {
    throw new Error("冒烟目录不能复用模板的 node_modules");
  }
  const manifest = await runTemplateInitializer(
    projectPath,
    projectName,
    template,
    { description: "H5 template installation and production build smoke", title: projectTitle },
  );

  const packageJson = await fs.readJson(path.join(projectPath, "package.json"));
  const metadataPath = path.join(projectPath, ".jhlc", "project.json");
  if (packageJson.name !== projectName) {
    throw new Error(`初始化后的包名不正确: ${packageJson.name}`);
  }
  if (!(await fs.pathExists(metadataPath))) {
    throw new Error("模板初始化后缺少 .jhlc/project.json");
  }
  const metadata = await fs.readJson(metadataPath);
  if (metadata.parameters?.title !== projectTitle) {
    throw new Error("模板初始化后未应用独立的产品标题");
  }

  const hooksDirectory = path.join(root, "empty-hooks");
  await fs.ensureDir(hooksDirectory);
  const gitConfig = [
    "-c", "user.name=Robot CLI Smoke",
    "-c", "user.email=robot-cli-smoke@example.invalid",
    "-c", "commit.gpgsign=false",
    "-c", "tag.gpgsign=false",
    "-c", `core.hooksPath=${hooksDirectory}`,
  ];
  await run("git", [...gitConfig, "init", "--initial-branch=main", "--template="], projectPath);
  await run("git", [...gitConfig, "add", "."], projectPath);
  await run("git", [...gitConfig, "commit", "--no-gpg-sign", "-m", "test: initialize H5 smoke fixture"], projectPath);

  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const pnpmVersion = await run(pnpm, ["--version"], projectPath);
  const requiredPnpm = template.runtime?.packageManagerVersion;
  if (!isVersionSupported(pnpmVersion, requiredPnpm)) {
    throw new Error(`pnpm ${pnpmVersion} 不满足模板要求 ${requiredPnpm}`);
  }

  console.log(`Installing Robot H5 with pnpm ${pnpmVersion}...`);
  await run(pnpm, ["install", "--frozen-lockfile"], projectPath, true);
  console.log("Building Robot H5 production bundle...");
  await run(pnpm, ["run", "build"], projectPath, true);

  console.log(
    `Robot H5 smoke passed: ${manifest?.id}@${manifest?.version} -> ${packageJson.name} (fresh install + production build; Node ${actualNode}; ${sourceRevision})`,
  );
} finally {
  if (cleanupPath) await fs.remove(cleanupPath).catch(() => {});
  await fs.remove(root).catch(() => {});
}
