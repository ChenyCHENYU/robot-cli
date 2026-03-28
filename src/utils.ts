import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
import { execSync } from "node:child_process";
import type { PackageManager, ProjectStats } from "./types";

// ── Package Manager Detection ────────────────────────────────────

export function detectPackageManager(): PackageManager[] {
  const managers: PackageManager[] = [];
  const checks: PackageManager[] = ["bun", "pnpm", "yarn", "npm"];

  for (const pm of checks) {
    try {
      execSync(`${pm} --version`, { stdio: "ignore" });
      managers.push(pm);
    } catch {
      // not installed
    }
  }
  return managers.length > 0 ? managers : ["npm"];
}

// ── Git Helpers ──────────────────────────────────────────────────

export function getGitUser(): string {
  try {
    return execSync("git config user.name", {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

// ── Project Name Validation ──────────────────────────────────────

export function validateProjectName(name: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!name || typeof name !== "string") {
    return { valid: false, errors: ["项目名称不能为空"] };
  }

  const t = name.trim();
  if (t.length === 0) errors.push("项目名称不能为空");
  if (t.length > 214) errors.push("项目名称不能超过214个字符");
  if (t.toLowerCase() !== t) errors.push("项目名称只能包含小写字母");
  if (/^[._]/.test(t)) errors.push('项目名称不能以 "." 或 "_" 开头');
  if (!/^[a-z0-9._-]+$/.test(t))
    errors.push("项目名称只能包含字母、数字、点、下划线和短横线");

  const reserved = [
    "node_modules",
    "favicon.ico",
    ".git",
    ".env",
    "package.json",
    "npm",
    "yarn",
    "pnpm",
    "bun",
    "robot",
  ];
  if (reserved.includes(t)) errors.push(`"${t}" 是保留名称，请使用其他名称`);

  return { valid: errors.length === 0, errors };
}

// ── Network ──────────────────────────────────────────────────────

export async function checkNetworkConnection(
  testUrl?: string,
): Promise<boolean> {
  const urls = testUrl
    ? [testUrl]
    : ["https://api.github.com", "https://www.npmjs.com"];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return true;
    } catch {
      // try next
    }
  }
  return false;
}

export async function checkForUpdates(
  packageName: string,
  currentVersion: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${packageName}/latest`,
      {
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { version: string };
    return data.version !== currentVersion ? data.version : null;
  } catch {
    return null;
  }
}

// ── File Operations ──────────────────────────────────────────────

async function countFiles(dirPath: string): Promise<number> {
  let count = 0;
  const skip = new Set(["node_modules", ".git", ".DS_Store"]);

  async function walk(dir: string): Promise<void> {
    const items = await fs.readdir(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        if (!skip.has(item)) await walk(full);
      } else {
        count++;
      }
    }
  }

  await walk(dirPath);
  return count;
}

export async function copyTemplate(
  sourcePath: string,
  targetPath: string,
  spinner?: import("ora").Ora,
): Promise<void> {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`源路径不存在: ${sourcePath}`);
  }

  await fs.ensureDir(targetPath);

  if (spinner) spinner.text = "统计文件数量...";
  const totalFiles = await countFiles(sourcePath);
  if (spinner) spinner.text = `开始复制 ${totalFiles} 个文件...`;

  let copied = 0;
  const skipDirs = new Set([
    "node_modules",
    ".git",
    ".DS_Store",
    ".vscode",
    ".idea",
  ]);

  async function copyDir(src: string, dest: string): Promise<void> {
    const items = await fs.readdir(src);
    for (const item of items) {
      const s = path.join(src, item);
      const d = path.join(dest, item);
      const stat = await fs.stat(s);

      if (stat.isDirectory()) {
        if (skipDirs.has(item)) continue;
        await fs.ensureDir(d);
        await copyDir(s, d);
      } else {
        await fs.copy(s, d);
        copied++;
        if (spinner && (copied % 10 === 0 || copied === totalFiles)) {
          const pct = Math.round((copied / totalFiles) * 100);
          spinner.text = `复制中 ${copied}/${totalFiles} (${pct}%)`;
        }
      }
    }
  }

  await copyDir(sourcePath, targetPath);
  if (spinner) spinner.text = `文件复制完成 (${copied} 个文件)`;
}

export async function installDependencies(
  projectPath: string,
  spinner: import("ora").Ora | undefined,
  packageManager: PackageManager = "npm",
): Promise<void> {
  try {
    const pkgJson = path.join(projectPath, "package.json");
    if (!fs.existsSync(pkgJson)) {
      if (spinner) spinner.text = "跳过依赖安装 (无 package.json)";
      return;
    }

    const cmds: Record<PackageManager, string> = {
      bun: "bun install",
      pnpm: "pnpm install",
      yarn: "yarn install",
      npm: "npm install",
    };

    if (spinner) spinner.text = `使用 ${packageManager} 安装依赖...`;

    execSync(cmds[packageManager], {
      cwd: projectPath,
      stdio: "ignore",
      timeout: 300_000,
    });

    if (spinner) spinner.text = `依赖安装完成 (${packageManager})`;
  } catch (error) {
    if (spinner) spinner.text = "依赖安装失败，请手动安装";
    console.log();
    console.log(chalk.yellow("自动安装依赖失败"));
    console.log(chalk.dim(`   错误: ${(error as Error).message}`));
    console.log();
    console.log(chalk.blue("请手动安装:"));
    console.log(chalk.cyan(`   cd ${path.basename(projectPath)}`));
    console.log(chalk.cyan(`   ${packageManager} install`));
    console.log();
  }
}

// ── Project Stats ────────────────────────────────────────────────

export async function generateProjectStats(
  projectPath: string,
): Promise<ProjectStats | null> {
  try {
    const stats: ProjectStats = {
      files: 0,
      directories: 0,
      size: 0,
      fileTypes: {},
    };
    const skip = new Set(["node_modules", ".git", ".DS_Store"]);

    async function walk(dir: string): Promise<void> {
      const items = await fs.readdir(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          if (!skip.has(item)) {
            stats.directories++;
            await walk(full);
          }
        } else {
          stats.files++;
          stats.size += stat.size;
          const ext = path.extname(item).toLowerCase();
          if (ext) stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
        }
      }
    }

    await walk(projectPath);
    return stats;
  } catch {
    return null;
  }
}

export function printProjectStats(stats: ProjectStats): void {
  console.log(chalk.blue("项目统计:"));
  console.log(`   文件数量: ${chalk.cyan(String(stats.files))} 个`);
  console.log(`   目录数量: ${chalk.cyan(String(stats.directories))} 个`);
  console.log(`   项目大小: ${chalk.cyan(formatBytes(stats.size))}`);

  const top = Object.entries(stats.fileTypes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (top.length > 0) {
    console.log("   主要文件类型:");
    for (const [ext, count] of top) {
      console.log(`     ${ext}: ${chalk.cyan(String(count))} 个`);
    }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
