import chalk from "chalk";
import ora from "ora";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { minVersion } from "semver";
import { getCacheStats, clearCache } from "./download";
import { checkNetworkConnection, formatBytes } from "./utils";
import { getAllTemplates } from "./templates";
import { isVersionSupported } from "./template-runtime";
import type { PackageManager, TemplateConfig } from "./types";
import { CLI_NODE_RANGE } from "./config";

export interface DoctorOptions {
  clearCache?: boolean;
  template?: string;
}
interface Check {
  name: string;
  status: "ok" | "info" | "warn" | "error";
  detail: string;
}

const MANAGERS: PackageManager[] = ["bun", "pnpm", "yarn", "npm"];

/** 只探测固定工具，不启动安装、交互 shell 或项目脚本。 */
function toolVersion(tool: string): string | null {
  try {
    return (
      execFileSync(tool, ["--version"], {
        encoding: "utf8",
        timeout: 5_000,
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
        cwd: os.tmpdir(),
        env: {
          ...process.env,
          COREPACK_ENABLE_NETWORK: "0",
          COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
        },
      })
        .trim()
        .replace(/^v/, "") || null
    );
  } catch {
    return null;
  }
}

function runtimeLabel(template: TemplateConfig): string {
  const runtime = template.runtime;
  return `Node.js ${runtime?.node || "未声明"} · ${runtime?.packageManager || "包管理器未声明"}${runtime?.packageManagerVersion ? ` ${runtime.packageManagerVersion}` : ""}`;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  const templates = getAllTemplates();
  const template = options.template ? templates[options.template] : undefined;
  const results: Check[] = [];
  const nextSteps = new Set<string>();
  console.log();
  console.log(chalk.bold.cyan("Robot CLI 环境诊断"));
  console.log(
    chalk.dim("只检查本机工具、下载连接和 CLI 缓存；不读取或修改项目。"),
  );

  if (options.template && (!template || template.status === "coming-soon")) {
    console.log(
      chalk.red(
        `\n模板 ${options.template} ${template ? "尚未开放" : "不存在"}。`,
      ),
    );
    console.log("查看可用模板：robot list");
    process.exitCode = 1;
    return;
  }
  if (template) {
    console.log(`\n目标：${template.name} (${options.template})`);
    console.log(chalk.dim(runtimeLabel(template)));
    if (!template.runtime?.node || !template.runtime?.packageManager) {
      results.push({
        name: "模板契约",
        status: "warn",
        detail: "该模板未声明完整运行要求，本次只能检查 CLI 通用环境。",
      });
    }
  } else {
    console.log(chalk.dim("\n这是通用检查。PC 与移动端使用各自的工具链："));
    for (const [key, item] of Object.entries(templates)) {
      if (!item.advanced && item.status !== "coming-soon" && item.runtime) {
        console.log(`  ${item.name} (${key})：${runtimeLabel(item)}`);
      }
    }
    nextSteps.add("robot doctor --template robot-admin");
    nextSteps.add("robot doctor --template robot-h5");
  }

  const nodeRange = template?.runtime?.node || CLI_NODE_RANGE;
  const nodeVersion = toolVersion("node");
  const nodeOk = Boolean(
    nodeVersion && isVersionSupported(nodeVersion, nodeRange),
  );
  results.push({
    name: "Node.js",
    status: nodeOk ? "ok" : "error",
    detail: `${nodeVersion || "未检测到"} · ${template ? "模板" : "CLI"}要求 ${nodeRange}`,
  });
  if (!nodeOk)
    nextSteps.add(
      `切换到满足 ${nodeRange} 的 Node.js，然后运行：node --version`,
    );

  const git = toolVersion("git");
  results.push({
    name: "Git（可选）",
    status: git ? "ok" : "info",
    detail: git
      ? git.replace(/^git version\s+/, "")
      : "未安装；仍可通过 ZIP 下载，创建时使用 --no-git。",
  });

  const versions = new Map<PackageManager, string | null>();
  const required = template?.runtime?.packageManager;
  for (const manager of MANAGERS) {
    const version = toolVersion(manager);
    versions.set(manager, version);
    const range =
      manager === required
        ? template?.runtime?.packageManagerVersion
        : undefined;
    const supported = Boolean(version && isVersionSupported(version, range));
    results.push({
      name: `${manager}${manager === required ? "（必需）" : "（可选）"}`,
      status:
        manager === required
          ? supported
            ? "ok"
            : "error"
          : version
            ? "ok"
            : "info",
      detail: `${version || "未安装"}${range ? ` · 要求 ${range}` : manager === required ? " · 模板指定工具" : " · 不影响当前检查"}`,
    });
  }
  if (
    required &&
    !isVersionSupported(
      versions.get(required) || "",
      template?.runtime?.packageManagerVersion,
    )
  ) {
    const range = template?.runtime?.packageManagerVersion;
    const minimum = range ? minVersion(range)?.version : undefined;
    if (versions.get("npm"))
      nextSteps.add(
        `npm install -g ${required}${minimum ? `@${minimum}` : ""}`,
      );
    else
      nextSteps.add(
        `安装 ${required}${range ? ` ${range}` : ""} 后检查：${required} --version`,
      );
  } else if (required && !versions.get(required)) {
    // 未指定版本范围的模板同样要求工具存在。
    nextSteps.add(`安装 ${required} 后检查：${required} --version`);
  }
  if (!required && ![...versions.values()].some(Boolean)) {
    results.push({
      name: "依赖安装",
      status: "warn",
      detail: "未检测到包管理器；可先创建文件并使用 --skip-install。",
    });
  }

  const endpoints = [
    { name: "GitHub", url: "https://github.com" },
    { name: "npm Registry", url: "https://registry.npmjs.org" },
    ...(template?.giteeUrl
      ? [{ name: "Gitee 备用源", url: "https://gitee.com" }]
      : []),
  ];
  const spinner = ora({ text: "检查下载连接…", spinner: "dots" }).start();
  let offline = false;
  try {
    const connections = await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          return await checkNetworkConnection(endpoint.url);
        } catch {
          return false;
        }
      }),
    );
    for (let index = 0; index < endpoints.length; index++) {
      const endpoint = endpoints[index]!;
      const ok = connections[index];
      if (!ok) offline = true;
      results.push({
        name: endpoint.name,
        status: ok ? "ok" : "warn",
        detail: ok
          ? "连接正常（不代表模板下载和安装已通过）"
          : "当前无法访问；请检查网络或代理。",
      });
    }
  } finally {
    spinner.stop();
  }

  if (options.clearCache) {
    try {
      await clearCache();
      results.push({
        name: "清理缓存",
        status: "ok",
        detail: "已清理 CLI 模板缓存。",
      });
    } catch (error) {
      results.push({
        name: "清理缓存",
        status: "error",
        detail: `清理失败：${(error as Error).message}`,
      });
    }
  }
  try {
    const cache = await getCacheStats();
    results.push({
      name: "模板缓存",
      status: "ok",
      detail: cache.count
        ? `${cache.count} 个模板 · ${formatBytes(cache.totalSize)}（总数，不保证包含当前模板）`
        : "空；首次创建需要下载模板。",
    });
    if (offline)
      nextSteps.add(
        cache.count
          ? "连接失败时仅已有匹配缓存可能可用；恢复网络后使用 --no-cache 重新下载。"
          : "先恢复网络，再创建项目；当前没有模板缓存。",
      );
  } catch (error) {
    results.push({
      name: "模板缓存",
      status: "warn",
      detail: `无法读取：${(error as Error).message}`,
    });
    nextSteps.add("robot doctor --clear-cache");
  }

  const icons = {
    ok: chalk.green("[OK]"),
    info: chalk.dim("[--]"),
    warn: chalk.yellow("[!!]"),
    error: chalk.red("[NO]"),
  };
  console.log();
  for (const result of results)
    console.log(
      `  ${icons[result.status]} ${chalk.bold(result.name)}  ${result.detail}`,
    );
  const hasError = results.some((result) => result.status === "error");
  const hasWarn = results.some((result) => result.status === "warn");
  console.log();
  if (hasError) {
    process.exitCode = 1;
    console.log(chalk.red("必需环境尚未满足，请先处理 [NO] 项。"));
  } else if (hasWarn)
    console.log(chalk.yellow("工具检查通过；连接或模板声明仍有待确认项。"));
  else
    console.log(
      chalk.green(
        template
          ? "目标模板的工具检查通过。"
          : "CLI 通用工具检查通过，创建前请按目标模板复查。",
      ),
    );

  if (template) {
    if (hasError) nextSteps.add(`robot doctor --template ${options.template}`);
    else
      nextSteps.add(
        `robot create my-app --template ${options.template}${git ? "" : " --no-git"}`,
      );
  }
  if (nextSteps.size) {
    console.log(chalk.bold("\n下一步："));
    for (const step of nextSteps) console.log(`  ${step}`);
  }
  console.log();
}
