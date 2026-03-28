import chalk from "chalk";
import ora from "ora";
import { execSync } from "node:child_process";
import { getCacheStats, clearCache } from "./download";
import { checkNetworkConnection, formatBytes } from "./utils";

export interface DoctorOptions {
  clearCache?: boolean;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  console.log();
  console.log(chalk.blue.bold("🏥 Robot CLI 环境诊断"));
  console.log();

  const results: {
    name: string;
    status: "ok" | "warn" | "error";
    detail: string;
  }[] = [];

  // Node.js
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1), 10);
  results.push({
    name: "Node.js",
    status: nodeMajor >= 20 ? "ok" : "error",
    detail:
      nodeMajor >= 20
        ? `${nodeVersion} (要求 >= 20)`
        : `${nodeVersion} ${chalk.red("(需要升级到 Node.js 20+)")}`,
  });

  // Git
  try {
    const gitVer = execSync("git --version", { encoding: "utf8" })
      .trim()
      .replace("git version ", "");
    results.push({ name: "Git", status: "ok", detail: gitVer });
  } catch {
    results.push({ name: "Git", status: "error", detail: "未安装" });
  }

  // Package Managers
  for (const pm of ["bun", "pnpm", "yarn", "npm"] as const) {
    try {
      const ver = execSync(`${pm} --version`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
      const rec = pm === "bun" ? " (推荐)" : "";
      results.push({
        name: pm,
        status: "ok",
        detail: `v${ver.replace(/^v/, "")}${rec}`,
      });
    } catch {
      results.push({
        name: pm,
        status: pm === "npm" ? "error" : "warn",
        detail: "未安装",
      });
    }
  }

  // Network
  const spinner = ora({ text: "检查网络...", spinner: "dots" }).start();

  const githubOk = await checkNetworkConnection("https://github.com");
  results.push({
    name: "GitHub",
    status: githubOk ? "ok" : "warn",
    detail: githubOk ? "连接正常" : "无法访问 (可能需要代理)",
  });

  const npmOk = await checkNetworkConnection("https://registry.npmjs.org");
  results.push({
    name: "npm Registry",
    status: npmOk ? "ok" : "warn",
    detail: npmOk ? "连接正常" : "无法访问",
  });

  spinner.stop();

  // Cache
  const cacheStats = await getCacheStats();
  results.push({
    name: "缓存",
    status: "ok",
    detail:
      cacheStats.count > 0
        ? `${cacheStats.count} 个模板 (${formatBytes(cacheStats.totalSize)})`
        : "空",
  });

  // Display results
  const icons = {
    ok: chalk.green("✅"),
    warn: chalk.yellow("⚠️ "),
    error: chalk.red("❌"),
  };

  for (const r of results) {
    const icon = icons[r.status];
    console.log(`  ${icon} ${chalk.bold(r.name.padEnd(14))} ${r.detail}`);
  }

  console.log();

  // Overall
  const hasError = results.some((r) => r.status === "error");
  const hasWarn = results.some((r) => r.status === "warn");

  if (hasError) {
    console.log(chalk.red("  诊断结果: 环境存在问题，请修复上述错误 ❌"));
  } else if (hasWarn) {
    console.log(chalk.yellow("  诊断结果: 环境基本正常，部分组件缺失 ⚠️"));
  } else {
    console.log(chalk.green("  诊断结果: 环境健康 ✅"));
  }
  console.log();

  // Clear cache
  if (options.clearCache) {
    const cSpinner = ora("清理模板缓存...").start();
    await clearCache();
    cSpinner.succeed("模板缓存已清理");
    console.log();
  }
}
