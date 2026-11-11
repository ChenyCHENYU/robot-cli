import fs from "fs-extra";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { satisfies, validRange } from "semver";
import type { Ora } from "ora";
import type {
  PackageManager,
  ProjectConfig,
  SelectedTemplate,
  TemplateManifest,
} from "./types";

const INITIALIZER_TIMEOUT_MS = 60_000;

interface PackageManagerSpec {
  name: PackageManager;
  version?: string;
}

/** Bun reports a compatibility Node version; template Node scripts use the actual PATH binary. */
export function getNodeRuntimeVersion(): string {
  if (!process.versions.bun) return process.versions.node;
  try {
    return execFileSync("node", ["-p", "process.versions.node"], {
      encoding: "utf8", timeout: 5_000, windowsHide: true,
    }).trim();
  } catch {
    throw new Error("无法运行模板所需的 Node.js，请安装 node 并确认它在 PATH 中。");
  }
}

function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`模板契约路径越界: ${relativePath}`);
  }
  return resolved;
}

async function assertContainedFile(root: string, file: string): Promise<void> {
  const realRoot = await fs.realpath(root);
  const realFile = await fs.realpath(file);
  resolveInside(realRoot, realFile);
  if (!(await fs.stat(realFile)).isFile()) throw new Error(`模板契约入口必须是文件: ${path.relative(root, file)}`);
}

function parsePackageManagerSpec(spec?: string): PackageManagerSpec | null {
  if (!spec) return null;
  if (typeof spec !== "string") throw new Error("模板包管理器声明必须是字符串");
  const match = /^(bun|pnpm|yarn|npm)(?:@(.+))?$/.exec(spec.trim());
  if (!match) throw new Error(`不支持的模板包管理器声明: ${spec}`);
  return {
    name: match[1] as PackageManager,
    version: match[2],
  };
}

export function isVersionSupported(version: string, range?: string): boolean {
  if (!range) return true;
  return Boolean(validRange(range)) && satisfies(version, range, {
    includePrerelease: true,
  });
}

export function assertTemplateRuntime(
  template: SelectedTemplate,
  nodeVersion = getNodeRuntimeVersion(),
): void {
  const range = template.runtime?.node;
  if (!range) return;
  if (!validRange(range)) {
    throw new Error(`模板 ${template.name} 的 Node.js 版本声明无效: ${range}`);
  }
  if (!isVersionSupported(nodeVersion, range)) {
    throw new Error(
      `${template.name} 要求 Node.js ${range}，当前为 ${nodeVersion}。请切换到满足要求的 Node.js 后重试。`,
    );
  }
}

export function getRequiredPackageManager(
  template: SelectedTemplate,
): PackageManager | undefined {
  return template.runtime?.packageManager;
}

export async function loadAndValidateTemplateManifest(
  projectPath: string,
  template: SelectedTemplate,
  nodeVersion = getNodeRuntimeVersion(),
): Promise<TemplateManifest | null> {
  const initializer = template.initializer;
  if (!initializer) return null;

  if (initializer.command !== "node" || !initializer.args[0]) {
    throw new Error("模板初始化器只支持带脚本路径的 node 命令");
  }

  const manifestPath = resolveInside(projectPath, initializer.manifestPath);
  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(
      `模板缺少契约文件: ${initializer.manifestPath}。如命中了旧缓存，请使用 --no-cache 重试`,
    );
  }
  await assertContainedFile(projectPath, manifestPath);

  let manifest: TemplateManifest;
  try {
    manifest = (await fs.readJson(manifestPath)) as TemplateManifest;
  } catch (error) {
    throw new Error(`模板契约不是有效 JSON: ${(error as Error).message}`);
  }

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("模板契约必须是 JSON 对象");
  }
  if (manifest.schemaVersion !== 1) {
    throw new Error(`不支持的模板契约版本: ${manifest.schemaVersion}`);
  }
  if (manifest.id !== initializer.manifestId) {
    throw new Error(
      `模板契约不匹配: 期望 ${initializer.manifestId}，实际 ${manifest.id || "<empty>"}`,
    );
  }
  if (!manifest.name || !manifest.version || !manifest.category) {
    throw new Error("模板契约缺少 name、version 或 category");
  }

  const manifestNode = manifest.runtime?.node;
  if (!manifestNode || !validRange(manifestNode)) {
    throw new Error(
      `模板 Node.js 契约缺失或无效: ${manifestNode || "<empty>"}`,
    );
  }
  assertTemplateRuntime({ ...template, runtime: { node: manifestNode } }, nodeVersion);

  const manifestManager = parsePackageManagerSpec(
    manifest.runtime?.packageManager,
  );
  const configuredManager = template.runtime?.packageManager;
  if (configuredManager && configuredManager !== manifestManager?.name) {
    throw new Error(
      `模板包管理器契约漂移: CLI=${configuredManager}，manifest=${manifestManager?.name || "<empty>"}`,
    );
  }
  if (!manifestManager?.version || !validRange(manifestManager.version)) {
    throw new Error(
      `模板包管理器版本契约缺失或无效: ${manifestManager?.version || "<empty>"}`,
    );
  }

  if (!manifest.entry?.nonInteractive || typeof manifest.entry.nonInteractive !== "string") {
    throw new Error("模板契约缺少非交互初始化入口: entry.nonInteractive");
  }

  const [command, entryScript] = manifest.entry.nonInteractive.trim().split(/\s+/);
  if (command !== "node" || !entryScript || resolveInside(projectPath, entryScript) !== resolveInside(projectPath, initializer.args[0])) {
    throw new Error("模板非交互初始化入口与 CLI 配置不一致");
  }

  const scriptPath = resolveInside(projectPath, initializer.args[0]);
  if (!(await fs.pathExists(scriptPath))) {
    throw new Error(`模板初始化脚本不存在: ${initializer.args[0]}`);
  }
  await assertContainedFile(projectPath, scriptPath);

  return manifest;
}

/** Reconcile registry hints with the downloaded template before configuring installation. */
export async function resolveDownloadedTemplateRuntime(
  projectPath: string,
  template: SelectedTemplate,
  nodeVersion = getNodeRuntimeVersion(),
): Promise<SelectedTemplate> {
  const manifest = await loadAndValidateTemplateManifest(projectPath, template, nodeVersion);
  const pkg = await fs.readJson(path.join(projectPath, "package.json"));
  if (pkg.engines?.node) assertTemplateRuntime({ ...template, runtime: { node: pkg.engines.node } }, nodeVersion);
  if (manifest && pkg.packageManager) {
    const packageManager = parsePackageManagerSpec(pkg.packageManager);
    const manifestManager = parsePackageManagerSpec(manifest.runtime?.packageManager);
    if (packageManager?.name !== manifestManager?.name || (packageManager?.version && !isVersionSupported(packageManager.version, manifestManager?.version))) {
      throw new Error(`模板包管理器声明不一致: manifest=${manifest.runtime?.packageManager}，package.json=${pkg.packageManager}`);
    }
    const engine = packageManager && pkg.engines?.[packageManager.name];
    if (engine && manifestManager?.version && !isVersionSupported(manifestManager.version, engine)) {
      throw new Error(`模板包管理器版本不满足 package.json 引擎要求: ${manifestManager.version} / ${engine}`);
    }
  }
  const manager = parsePackageManagerSpec(manifest?.runtime?.packageManager || pkg.packageManager);
  const runtime = {
    ...template.runtime,
    node: manifest?.runtime?.node || pkg.engines?.node || template.runtime?.node,
    packageManager: manager?.name || template.runtime?.packageManager,
    packageManagerVersion: manager
      ? (manifest ? manager.version : pkg.engines?.[manager.name] || manager.version)
      : template.runtime?.packageManagerVersion,
  };
  if (runtime.packageManagerVersion && !validRange(runtime.packageManagerVersion)) {
    throw new Error(`模板包管理器版本声明无效: ${runtime.packageManagerVersion}`);
  }
  const resolved = { ...template, runtime };
  assertTemplateRuntime(resolved, nodeVersion);
  return resolved;
}

function executeInitializer(
  executable: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      {
        cwd,
        timeout: INITIALIZER_TIMEOUT_MS,
        killSignal: "SIGKILL",
        signal,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || stdout || error.message).trim();
          reject(new Error(`模板初始化失败: ${detail}`));
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

export async function runTemplateInitializer(
  projectPath: string,
  projectName: string,
  template: SelectedTemplate,
  config: Pick<ProjectConfig, "description" | "title">,
  spinner?: Ora,
  signal?: AbortSignal,
): Promise<TemplateManifest | null> {
  const initializer = template.initializer;
  if (!initializer) return null;
  signal?.throwIfAborted();

  if (spinner) spinner.text = "校验模板契约...";
  const manifest = await loadAndValidateTemplateManifest(projectPath, template);

  const replacements: Record<string, string> = {
    "{projectName}": projectName,
    "{projectTitle}": config.title?.trim() || config.description.trim() || projectName,
  };
  const args = initializer.args.map((arg) =>
    Object.entries(replacements).reduce(
      (value, [token, replacement]) => value.replaceAll(token, replacement),
      arg,
    ),
  );
  if (spinner) spinner.text = `初始化模板 ${manifest?.name || template.name}...`;
  await executeInitializer(process.versions.bun ? "node" : process.execPath, args, projectPath, signal);
  return manifest;
}
