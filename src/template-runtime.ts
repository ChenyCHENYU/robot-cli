import fs from "fs-extra";
import path from "node:path";
import { execFile } from "node:child_process";
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

function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`模板契约路径越界: ${relativePath}`);
  }
  return resolved;
}

function parsePackageManagerSpec(spec?: string): PackageManagerSpec | null {
  if (!spec) return null;
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
  nodeVersion = process.versions.node,
): void {
  const range = template.runtime?.node;
  if (!range) return;
  if (!validRange(range)) {
    throw new Error(`模板 ${template.name} 的 Node.js 版本声明无效: ${range}`);
  }
  if (!isVersionSupported(nodeVersion, range)) {
    throw new Error(
      `${template.name} 要求 Node.js ${range}，当前为 ${nodeVersion}。请切换到 Node.js 24 后重试。`,
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

  let manifest: TemplateManifest;
  try {
    manifest = (await fs.readJson(manifestPath)) as TemplateManifest;
  } catch (error) {
    throw new Error(`模板契约不是有效 JSON: ${(error as Error).message}`);
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

  const configuredNode = template.runtime?.node;
  if (configuredNode && configuredNode !== manifest.runtime?.node) {
    throw new Error(
      `模板 Node.js 契约漂移: CLI=${configuredNode}，manifest=${manifest.runtime?.node || "<empty>"}`,
    );
  }

  const manifestManager = parsePackageManagerSpec(
    manifest.runtime?.packageManager,
  );
  const configuredManager = template.runtime?.packageManager;
  if (configuredManager && configuredManager !== manifestManager?.name) {
    throw new Error(
      `模板包管理器契约漂移: CLI=${configuredManager}，manifest=${manifestManager?.name || "<empty>"}`,
    );
  }
  const configuredManagerVersion = template.runtime?.packageManagerVersion;
  if (configuredManagerVersion && !manifestManager?.version) {
    throw new Error(
      `模板包管理器版本契约漂移: manifest=<empty>，CLI=${configuredManagerVersion}`,
    );
  }
  if (
    manifestManager?.version &&
    configuredManagerVersion &&
    !isVersionSupported(manifestManager.version, configuredManagerVersion)
  ) {
    throw new Error(
      `模板包管理器版本契约漂移: manifest=${manifestManager.version}，CLI=${configuredManagerVersion}`,
    );
  }

  if (!manifest.entry?.nonInteractive) {
    throw new Error("模板契约缺少非交互初始化入口: entry.nonInteractive");
  }

  const scriptPath = resolveInside(projectPath, initializer.args[0]);
  if (!(await fs.pathExists(scriptPath))) {
    throw new Error(`模板初始化脚本不存在: ${initializer.args[0]}`);
  }

  return manifest;
}

function executeInitializer(
  executable: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      {
        cwd,
        timeout: INITIALIZER_TIMEOUT_MS,
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
  config: Pick<ProjectConfig, "description">,
  spinner?: Ora,
): Promise<TemplateManifest | null> {
  const initializer = template.initializer;
  if (!initializer) return null;

  if (spinner) spinner.text = "校验模板契约...";
  const manifest = await loadAndValidateTemplateManifest(projectPath, template);

  const replacements: Record<string, string> = {
    "{projectName}": projectName,
    "{projectTitle}": config.description.trim() || projectName,
  };
  const args = initializer.args.map((arg) =>
    Object.entries(replacements).reduce(
      (value, [token, replacement]) => value.replaceAll(token, replacement),
      arg,
    ),
  );
  if (spinner) spinner.text = `初始化模板 ${manifest?.name || template.name}...`;
  await executeInitializer("node", args, projectPath);
  return manifest;
}
