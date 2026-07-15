import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { downloadTemplate } from "../src/download";
import { getAllTemplates } from "../src/templates";
import { copyTemplate } from "../src/utils";
import {
  assertTemplateRuntime,
  isVersionSupported,
  runTemplateInitializer,
} from "../src/template-runtime";
import type { SelectedTemplate } from "../src/types";

const projectName = "robot-h5-contract-smoke";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "robot-h5-smoke-"));
const projectPath = path.join(root, projectName);
let cleanupPath: string | undefined;

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
        timeout: 8 * 60_000,
        windowsHide: true,
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

  const template: SelectedTemplate = { key: "robot-h5", ...config };
  assertTemplateRuntime(template);

  const downloaded = await downloadTemplate(template, { noCache: true });
  cleanupPath = downloaded.cleanupPath;
  await copyTemplate(downloaded.path, projectPath);
  const manifest = await runTemplateInitializer(
    projectPath,
    projectName,
    template,
    { description: "Robot H5 Contract Smoke" },
  );

  const packageJson = await fs.readJson(path.join(projectPath, "package.json"));
  const metadataPath = path.join(projectPath, ".jhlc", "project.json");
  if (packageJson.name !== projectName) {
    throw new Error(`初始化后的包名不正确: ${packageJson.name}`);
  }
  if (!(await fs.pathExists(metadataPath))) {
    throw new Error("模板初始化后缺少 .jhlc/project.json");
  }

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
    `Robot H5 smoke passed: ${manifest?.id}@${manifest?.version} -> ${packageJson.name} (install + build)`,
  );
} finally {
  if (cleanupPath) await fs.remove(cleanupPath).catch(() => {});
  await fs.remove(root).catch(() => {});
}
