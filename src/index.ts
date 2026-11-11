import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import chalk from "chalk";
import * as p from "@clack/prompts";
import { Command, Option } from "commander";
import {
  getAvailableTemplates,
  getAllTemplates,
  getRecommendedTemplates,
  searchTemplates,
  getCategoryForTemplate,
} from "./templates";
import type { CreateOptions, TemplateConfig } from "./types";

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

function templateStatusBadge(template: TemplateConfig): string {
  const badges: string[] = [];
  if (template.status === "beta") badges.push(chalk.magenta("Beta"));
  if (template.status === "coming-soon") badges.push(chalk.yellow("规划中"));
  if (template.advanced) badges.push(chalk.dim("高级架构"));
  return badges.length ? `  ${badges.join(" · ")}` : "";
}

function showWelcome(): void {
  console.log();
  console.log(`  ${chalk.bold.cyan("Robot CLI")} ${chalk.dim(`v${VERSION}`)}`);
  const tagline = (process.stdout.columns || 80) < 48
    ? "从模板开始，专注业务。"
    : "创建 PC 管理后台与移动 H5 项目。";
  console.log(`  ${chalk.dim(tagline)}`);
  console.log();
}

async function showMainMenu(): Promise<void> {
  p.intro("开始一个新项目");
  const action = await p.select({
    message: "需要做什么？",
    options: [
      { value: "create", label: "创建项目", hint: "PC 管理端 / 移动端" },
      { value: "list", label: "浏览模板", hint: "查看用途与创建命令" },
      { value: "search", label: "搜索模板", hint: "按名称或功能查找" },
      { value: "doctor", label: "检查开发环境", hint: "Node、包管理器与网络" },
      { value: "exit", label: "退出" },
    ],
  });

  if (p.isCancel(action) || action === "exit") {
    p.outro(chalk.dim("已退出"));
    return;
  }

  switch (action) {
    case "create": {
      const { createProject } = await import("./create");
      await createProject(undefined, {});
      break;
    }
    case "list":
      showTemplateList({});
      break;
    case "search":
      await searchInteractive();
      break;
    case "doctor": {
      const { runDoctor } = await import("./doctor");
      await runDoctor();
      break;
    }
  }
}

function showTemplateList(options: { recommended?: boolean; all?: boolean }): void {
  const templates = options.recommended
    ? getRecommendedTemplates()
    : options.all ? getAllTemplates() : getAvailableTemplates();
  const entries = Object.entries(templates);
  const title = options.recommended ? "推荐起点" : options.all ? "模板与规划" : "可用模板";

  console.log(`\n${chalk.bold(title)}\n`);
  for (const [key, template] of entries) {
    const category = getCategoryForTemplate(key);
    console.log(`  ${chalk.bold(template.name)}${templateStatusBadge(template)}`);
    console.log(`  ${chalk.dim(template.description)}`);
    if (category) console.log(`  ${chalk.dim(category.name)} · ${key}`);
    if (template.status !== "coming-soon") {
      console.log(`  ${chalk.cyan(`robot create my-app -t ${key}`)}`);
    } else {
      console.log(`  ${chalk.dim("暂不支持创建")}`);
    }
    console.log();
  }

  if (!options.all && !options.recommended) {
    console.log(chalk.dim("使用 robot list --all 查看尚未上线的规划。\n"));
  }
}

async function searchInteractive(): Promise<void> {
  const keyword = await p.text({
    message: "输入名称、技术或功能：",
    validate: (input) => input?.trim() ? undefined : "请输入关键词",
  });
  if (p.isCancel(keyword)) return;
  showSearchResults(keyword);
}

function showSearchResults(keyword: string, includePlanned = false): void {
  const results = searchTemplates(keyword, { includePlanned });
  const entries = Object.entries(results);
  console.log();
  if (entries.length === 0) {
    console.log(chalk.yellow(`未找到与「${keyword}」相关的${includePlanned ? "模板或规划" : "可用模板"}。`));
    console.log(chalk.dim("使用 robot list 浏览模板，或 search <关键词> --all 查看规划。\n"));
    return;
  }

  console.log(chalk.bold(`「${keyword}」的搜索结果\n`));
  for (const [key, template] of entries) {
    console.log(`  ${chalk.bold(template.name)}${templateStatusBadge(template)}`);
    console.log(`  ${chalk.dim(template.description)}`);
    if (template.status !== "coming-soon") {
      console.log(`  ${chalk.cyan(`robot create my-app -t ${key}`)}`);
    }
    console.log();
  }
}

async function notifyUpdate(): Promise<void> {
  const { checkForUpdates } = await import("./utils");
  const newVersion = await checkForUpdates("@agile-team/robot-cli", VERSION).catch(() => null);
  if (!newVersion) return;
  console.log(chalk.dim(`\n有新版本 ${VERSION} → ${newVersion}`));
  console.log(chalk.dim("更新：bun add -g @agile-team/robot-cli\n"));
}

type ParsedCreateOptions = Omit<CreateOptions, "noCache"> & { cache?: boolean };

export function createProgram(): Command {
  const program = new Command();
  program
    .name("robot")
    .description("Robot CLI · 从真实项目模板开始")
    .version(VERSION, "-v, --version", "查看 CLI 版本")
    .helpOption("-h, --help", "查看帮助")
    .showHelpAfterError("\n运行 robot --help 查看可用命令。")
    .showSuggestionAfterError()
    .addHelpText("after", `\n常用命令：\n  robot create                       交互式创建\n  robot create my-app --yes           使用 PC 管理端精简预设\n  robot list                         查看可用模板\n  robot create --help                 查看创建选项\n`);

  program
    .command("create [project-name]")
    .description("创建 PC 或移动端项目")
    .option("-t, --template <name>", "指定模板，例如 robot-admin、robot-h5")
    .option("-y, --yes", "使用默认值，无需交互确认")
    .addOption(new Option("--preset <mode>", "PC 管理端预设：精简、完整或自定义").choices(["lite", "full", "custom"]))
    .addOption(new Option("--package-manager <name>", "指定模板支持的包管理器").choices(["bun", "pnpm", "yarn", "npm"]))
    .option("--title <title>", "应用展示名称")
    .option("--description <description>", "项目描述")
    .option("--author <author>", "项目作者")
    .option("--no-git", "跳过 Git 初始化")
    .option("--skip-install", "跳过依赖安装")
    .option("--dry-run", "预览创建计划，不写入项目")
    .option("--from <url>", "从自定义 Git 仓库创建")
    .option("--no-cache", "绕过模板缓存，重新下载")
    .option("--advanced", "显示 Monorepo、微前端等高级架构入口")
    .addHelpText("after", `
示例：
  robot create my-admin --yes --skip-install
  robot create my-admin --yes --preset full --no-git
  robot create mobile-app -t robot-h5 --yes --title "现场作业"
  robot create my-app --yes --dry-run
  robot create --advanced

自动化或重定向输入时请加 --yes；Custom 预设需要交互式终端。
`)
    .action(async (projectName: string | undefined, parsed: ParsedCreateOptions) => {
      const { cache, ...rest } = parsed;
      const options: CreateOptions = {
        ...rest,
        ...(cache === false ? { noCache: true } : {}),
      };
      if (process.stdout.isTTY && !options.yes) showWelcome();
      const { createProject } = await import("./create");
      const created = await createProject(projectName, options);
      if (created === true && process.stdin.isTTY && process.stdout.isTTY && !options.dryRun && !options.yes) {
        await notifyUpdate();
      }
    });

  program
    .command("list")
    .description("浏览可用模板与用途")
    .option("-r, --recommended", "只显示默认推荐起点")
    .option("-a, --all", "同时显示尚未上线的规划")
    .action((options: { recommended?: boolean; all?: boolean }) => showTemplateList(options));

  program
    .command("search <keyword>")
    .description("按名称、技术或功能查找模板")
    .option("-a, --all", "搜索范围包含尚未上线的规划")
    .action((keyword: string, options: { all?: boolean }) => showSearchResults(keyword, options.all));

  program
    .command("doctor")
    .description("检查开发环境")
    .option("-t, --template <name>", "按指定模板检查 Node 与包管理器要求")
    .option("--clear-cache", "清理模板缓存")
    .action(async (options: { clearCache?: boolean; template?: string }) => {
      const { runDoctor } = await import("./doctor");
      await runDoctor(options);
    });

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();
  if (argv.length <= 2) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      program.outputHelp();
      return;
    }
    showWelcome();
    await showMainMenu();
    return;
  }
  await program.parseAsync(argv);
}
