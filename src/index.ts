import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import chalk from "chalk";
import inquirer from "inquirer";
import { Command } from "commander";
import { createProject } from "./create";
import { runDoctor } from "./doctor";
import {
  getAllTemplates,
  getRecommendedTemplates,
  searchTemplates,
  getCategoryForTemplate,
} from "./templates";
import { checkForUpdates } from "./utils";
import { VERSION_LABELS } from "./config";
import type { CreateOptions } from "./types";

// ── Version ──────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf8"),
    );
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = getPackageVersion();

// ── Welcome Banner ───────────────────────────────────────────────

function showWelcome(): void {
  const supportsColor =
    process.stdout.isTTY && process.stdout.getColorDepth() > 1;

  console.log();

  if (supportsColor) {
    console.log(chalk.bold.cyan("  R O B O T   C L I"));
  } else {
    console.log("  R O B O T   C L I");
  }

  console.log(
    chalk.dim(`  v${VERSION}  |  ${chalk.reset.dim("工程化项目脚手架")}`),
  );
  console.log(chalk.dim("  前端 / 后端 / 移动端 / 桌面端"));
  console.log();
}

// ── Main Menu ────────────────────────────────────────────────────

async function showMainMenu(): Promise<void> {
  const allTemplates = getAllTemplates();
  const count = Object.keys(allTemplates).length;

  console.log(
    chalk.dim(
      `  ${count} 个模板可用  ·  Node ${process.version}  ·  v${VERSION}`,
    ),
  );
  console.log();

  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: "list",
      name: "action",
      message: "请选择操作:",
      choices: [
        {
          name: `${chalk.cyan(">")} ${chalk.bold("创建新项目")}  ${chalk.dim("— 选择模板创建项目")}`,
          value: "create",
        },
        {
          name: `${chalk.cyan(">")} ${chalk.bold("查看模板列表")}  ${chalk.dim("— 浏览所有可用模板")}`,
          value: "list",
        },
        {
          name: `${chalk.cyan(">")} ${chalk.bold("搜索模板")}  ${chalk.dim("— 按关键词搜索模板")}`,
          value: "search",
        },
        {
          name: `${chalk.cyan(">")} ${chalk.bold("环境诊断")}  ${chalk.dim("— 检查开发环境")}`,
          value: "doctor",
        },
        { name: chalk.dim("─".repeat(50)), value: "sep", disabled: true },
        { name: `${chalk.dim("  退出")}`, value: "exit" },
      ],
    },
  ]);

  switch (action) {
    case "create":
      await createProject(undefined, {});
      break;
    case "list":
      showTemplateList(false);
      break;
    case "search":
      await searchInteractive();
      break;
    case "doctor":
      await runDoctor();
      break;
    case "exit":
      console.log(chalk.dim("  再见!"));
      process.exit(0);
  }
}

// ── List Command ─────────────────────────────────────────────────

function showTemplateList(recommended: boolean): void {
  const templates = recommended ? getRecommendedTemplates() : getAllTemplates();
  const title = recommended ? "推荐模板" : "所有模板";
  const entries = Object.entries(templates);

  console.log();
  console.log(chalk.blue.bold(title));
  console.log(chalk.dim(`共 ${entries.length} 个模板`));
  console.log();

  for (const [key, t] of entries) {
    const ver = VERSION_LABELS[t.version]
      ? (t.version === "full" ? chalk.green : t.version === "micro" ? chalk.blue : chalk.yellow)(`[${VERSION_LABELS[t.version]}]`)
      : chalk.dim(`[${t.version}]`);
    const cat = getCategoryForTemplate(key);
    const catLabel = cat ? chalk.dim(`[${cat.name}]`) : "";

    console.log(`  ${chalk.bold(t.name)} ${ver} ${catLabel}`);
    console.log(`  ${chalk.dim(t.description)}`);
    console.log(`  ${chalk.dim(`命令: robot create my-app -t ${key}`)}`);
    console.log(`  ${chalk.dim(`features: ${t.features.join(", ")}`)}`);
    console.log();
  }
}

// ── Search Command ───────────────────────────────────────────────

async function searchInteractive(): Promise<void> {
  const { keyword } = await inquirer.prompt<{ keyword: string }>([
    {
      type: "input",
      name: "keyword",
      message: "搜索关键词:",
      validate: (i: string) => (i.trim() ? true : "请输入关键词"),
    },
  ]);

  showSearchResults(keyword);
}

function showSearchResults(keyword: string): void {
  const results = searchTemplates(keyword);
  const entries = Object.entries(results);

  console.log();

  if (entries.length === 0) {
    console.log(chalk.yellow(`没有找到「${keyword}」相关模板`));
    console.log();
    return;
  }

  console.log(chalk.green.bold(`搜索结果: "${keyword}"`));
  console.log(chalk.dim(`找到 ${entries.length} 个匹配`));
  console.log();

  for (const [key, t] of entries) {
    const ver = VERSION_LABELS[t.version]
      ? (t.version === "full" ? chalk.green : t.version === "micro" ? chalk.blue : chalk.yellow)(`[${VERSION_LABELS[t.version]}]`)
      : chalk.dim(`[${t.version}]`);
    console.log(`  ${chalk.bold(t.name)} ${ver}`);
    console.log(`  ${chalk.dim(t.description)}`);
    console.log(`  ${chalk.dim(`robot create my-app -t ${key}`)}`);
    console.log();
  }
}

// ── Update Check ─────────────────────────────────────────────────

async function notifyUpdate(): Promise<void> {
  const newVersion = await checkForUpdates(
    "@agile-team/robot-cli",
    VERSION,
  ).catch(() => null);
  if (newVersion) {
    console.log();
    console.log(
      chalk.yellow(
        `  ┌─ 发现新版本: ${chalk.dim(VERSION)} → ${chalk.bold.green(newVersion)}`,
      ),
    );
    console.log(
      chalk.yellow(
        `  └─ 更新命令:  ${chalk.cyan("bun add -g @agile-team/robot-cli")}`,
      ),
    );
    console.log();
  }
}

// ── CLI Setup ────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const program = new Command();

  program
    .name("robot")
    .description("Robot CLI - 工程化项目脚手架")
    .version(VERSION, "-v, --version");

  program
    .command("create [project-name]")
    .description("创建新项目")
    .option("-t, --template <name>", "指定模板名称")
    .option("--skip-install", "跳过依赖安装")
    .option("--dry-run", "预览模式，不实际创建")
    .option("--from <url>", "从自定义 Git 仓库创建")
    .option("--no-cache", "不使用缓存")
    .action(async (projectName: string | undefined, opts: CreateOptions) => {
      showWelcome();
      await createProject(projectName, opts);
      await notifyUpdate();
    });

  program
    .command("list")
    .description("查看模板列表")
    .option("-r, --recommended", "只显示推荐模板")
    .action((opts: { recommended?: boolean }) => {
      showTemplateList(!!opts.recommended);
    });

  program
    .command("search <keyword>")
    .description("搜索模板")
    .action((keyword: string) => {
      showSearchResults(keyword);
    });

  program
    .command("doctor")
    .description("诊断开发环境")
    .option("--clear-cache", "清理模板缓存")
    .action(async (opts: { clearCache?: boolean }) => {
      await runDoctor(opts);
    });

  // No arguments → show main menu
  if (process.argv.length <= 2) {
    showWelcome();
    await showMainMenu();
    return;
  }

  await program.parseAsync(process.argv);
}
