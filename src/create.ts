import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { execSync } from "node:child_process";
import { downloadTemplate } from "./download";
import {
  TEMPLATE_CATEGORIES,
  getAllTemplates,
  getTemplatesByCategory,
  searchTemplates,
  getRecommendedTemplates,
} from "./templates";
import { START_COMMAND_MAP } from "./config";
import {
  validateProjectName,
  copyTemplate,
  installDependencies,
  generateProjectStats,
  printProjectStats,
  detectPackageManager,
  getGitUser,
} from "./utils";
import type { SelectedTemplate, ProjectConfig, CreateOptions } from "./types";

// ── Main Entry ───────────────────────────────────────────────────

export async function createProject(
  projectName: string | undefined,
  options: CreateOptions = {},
): Promise<void> {
  console.log();
  console.log(chalk.cyan("🚀 Robot CLI - 开始创建项目"));
  console.log();

  // 1. Select template
  let template: SelectedTemplate;

  if (options.from) {
    // Custom template source via --from
    template = {
      key: "custom",
      name: "Custom Template",
      description: `来自 ${options.from}`,
      repoUrl: options.from,
      features: [],
      version: "full",
    };
    console.log(chalk.blue(`📦 使用自定义模板: ${chalk.dim(options.from)}`));
    console.log();
  } else {
    template = await selectTemplate(options.template);
  }

  // 2. Handle project name
  const finalProjectName = await handleProjectName(projectName, template);

  // 3. Project configuration
  const projectConfig = await configureProject(options);

  // 4. Confirm creation
  await confirmCreation(finalProjectName, template, projectConfig);

  // 5. Dry-run mode
  if (options.dryRun) {
    console.log();
    console.log(
      chalk.yellow("🔍 Dry Run 模式 - 以下为预览信息，未实际执行任何操作:"),
    );
    console.log();
    console.log(`  项目路径: ${chalk.cyan(path.resolve(finalProjectName))}`);
    console.log(`  下载来源: ${chalk.dim(template.repoUrl)}`);
    console.log("  执行步骤:");
    console.log(chalk.dim(`    1. 从 ${template.repoUrl} 下载最新模板`));
    console.log(chalk.dim(`    2. 解压并复制到 ./${finalProjectName}`));
    console.log(
      chalk.dim("    3. 更新 package.json (name, description, author)"),
    );
    let step = 4;
    if (projectConfig.initGit) {
      console.log(chalk.dim(`    ${step}. 初始化 Git 仓库并提交初始代码`));
      step++;
    }
    if (projectConfig.installDeps) {
      console.log(
        chalk.dim(`    ${step}. 使用 ${projectConfig.packageManager} 安装依赖`),
      );
    }
    console.log();
    console.log(chalk.dim("移除 --dry-run 参数以执行创建。"));
    console.log();
    return;
  }

  // 6. Execute creation
  await executeCreation(finalProjectName, template, projectConfig, options);
}

// ── Project Name ─────────────────────────────────────────────────

async function handleProjectName(
  projectName: string | undefined,
  template: SelectedTemplate,
): Promise<string> {
  if (projectName) {
    const v = validateProjectName(projectName);
    if (!v.valid) {
      console.log(chalk.red("❌ 项目名称不合法:"));
      v.errors.forEach((e) => console.log(chalk.red(`   ${e}`)));
      console.log();

      const { newName } = await inquirer.prompt<{ newName: string }>([
        {
          type: "input",
          name: "newName",
          message: "请输入新的项目名称:",
          validate: (input: string) => {
            const r = validateProjectName(input);
            return r.valid || r.errors[0];
          },
        },
      ]);
      return newName;
    }
    return projectName;
  }

  const defaultName = generateDefaultProjectName(template);

  const { name } = await inquirer.prompt<{ name: string }>([
    {
      type: "input",
      name: "name",
      message: "请输入项目名称:",
      default: defaultName,
      validate: (input: string) => {
        if (!input.trim()) return "项目名称不能为空";
        const r = validateProjectName(input);
        return r.valid || r.errors[0];
      },
    },
  ]);
  return name;
}

function generateDefaultProjectName(template: SelectedTemplate): string {
  const key = template.key || "project";
  const ts = Date.now().toString().slice(-4);
  const base = key.replace(/-(full|lite|base)$/, "");
  return `my-${base}-${ts}`;
}

// ── Template Selection ───────────────────────────────────────────

async function selectTemplate(
  templateOption?: string,
): Promise<SelectedTemplate> {
  if (templateOption) {
    const all = getAllTemplates();
    if (all[templateOption]) {
      return { key: templateOption, ...all[templateOption] };
    }
    console.log(chalk.yellow(`⚠️  模板 "${templateOption}" 不存在`));
    console.log();
  }
  return await selectTemplateMethod();
}

async function selectTemplateMethod(): Promise<SelectedTemplate> {
  console.log();
  console.log(chalk.blue.bold("🎯 选择模板创建方式"));
  console.log(chalk.dim("请选择最适合你的模板浏览方式"));
  console.log();

  const { selectionMode } = await inquirer.prompt<{ selectionMode: string }>([
    {
      type: "list",
      name: "selectionMode",
      message: "模板选择方式:",
      choices: [
        {
          name: `● ${chalk.bold("推荐模板")} ${chalk.dim("(常用模板快速选择) - 基于团队使用频率推荐的热门模板")}`,
          value: "recommended",
        },
        { name: chalk.dim("─".repeat(70)), value: "sep1", disabled: true },
        {
          name: `● ${chalk.bold("分类模板")} ${chalk.dim("(按项目类型分类选择) - 前端、后端、移动端、桌面端分类浏览")}`,
          value: "category",
        },
        { name: chalk.dim("─".repeat(70)), value: "sep2", disabled: true },
        {
          name: `● ${chalk.bold("搜索模板")} ${chalk.dim("(关键词搜索) - 通过技术栈、功能特性等关键词快速查找")}`,
          value: "search",
        },
        { name: chalk.dim("─".repeat(70)), value: "sep3", disabled: true },
        {
          name: `● ${chalk.bold("全部模板")} ${chalk.dim("(查看所有可用模板) - 按分类展示所有可用的项目模板")}`,
          value: "all",
        },
      ],
      pageSize: 10,
    },
  ]);

  switch (selectionMode) {
    case "recommended":
      return await selectFromRecommended();
    case "category":
      return await selectByCategory();
    case "search":
      return await selectBySearch();
    case "all":
      return await selectFromAll();
    default:
      return await selectByCategory();
  }
}

// ── Recommended ──────────────────────────────────────────────────

async function selectFromRecommended(): Promise<SelectedTemplate> {
  const recommended = getRecommendedTemplates();

  if (Object.keys(recommended).length === 0) {
    console.log(chalk.yellow("⚠️  暂无推荐模板"));
    return await selectTemplateMethod();
  }

  console.log();
  console.log(chalk.blue.bold("🎯 推荐模板"));
  console.log(chalk.dim("基于团队使用频率和项目成熟度推荐"));
  console.log();

  const choices: object[] = [];
  const entries = Object.entries(recommended);

  entries.forEach(([key, template], index) => {
    const tags = template.features
      .slice(0, 3)
      .map((f) => chalk.dim(`[${f}]`))
      .join(" ");
    const ver =
      template.version === "full"
        ? chalk.green("[完整版]")
        : chalk.yellow("[精简版]");

    choices.push({
      name: `${chalk.bold.white(template.name.replace(/\s*(完整版|精简版)\s*$/, ""))} ${ver} - ${chalk.dim(template.description)}\n   ${tags}${template.features.length > 3 ? chalk.dim(` +${template.features.length - 3}more`) : ""}`,
      value: { key, ...template },
      short: template.name,
    });

    if (index < entries.length - 1) {
      choices.push({
        name: chalk.dim("─".repeat(70)),
        value: `sep_${index}`,
        disabled: true,
      });
    }
  });

  choices.push({ name: chalk.dim("⬅️  返回选择其他方式"), value: "back" });

  const { selectedTemplate } = await inquirer.prompt<{
    selectedTemplate: SelectedTemplate | string;
  }>([
    {
      type: "list",
      name: "selectedTemplate",
      message: "选择推荐模板:",
      choices,
      pageSize: 15,
      loop: false,
    },
  ]);

  if (selectedTemplate === "back") return await selectTemplateMethod();
  return selectedTemplate as SelectedTemplate;
}

// ── Category selection ───────────────────────────────────────────

async function selectByCategory(): Promise<SelectedTemplate> {
  while (true) {
    const cat = await selectCategory();
    if (cat === "back_to_method") return await selectTemplateMethod();

    const stack = await selectStack(cat);
    if (stack === "back_to_category") continue;
    if (stack === "back_to_method") return await selectTemplateMethod();

    const pattern = await selectPattern(cat, stack);
    if (pattern === "back_to_stack" || pattern === "back_to_category") continue;
    if (pattern === "back_to_method") return await selectTemplateMethod();

    const tpl = await selectSpecificTemplate(cat, stack, pattern);
    if (typeof tpl === "string") continue; // any back action
    return tpl;
  }
}

async function selectCategory(): Promise<string> {
  const choices = Object.entries(TEMPLATE_CATEGORIES).map(([key, c]) => ({
    name: c.name,
    value: key,
  }));
  choices.push({
    name: chalk.dim("← 返回模板选择方式"),
    value: "back_to_method",
  });

  const { categoryKey } = await inquirer.prompt<{ categoryKey: string }>([
    { type: "list", name: "categoryKey", message: "请选择项目类型:", choices },
  ]);
  return categoryKey;
}

async function selectStack(categoryKey: string): Promise<string> {
  const category = TEMPLATE_CATEGORIES[categoryKey];
  const choices = Object.entries(category.stacks).map(([key, s]) => ({
    name: s.name,
    value: key,
  }));

  choices.push(
    {
      name: chalk.dim("─────────────────────"),
      value: "separator",
      disabled: true,
    } as any,
    { name: chalk.dim("← 返回项目类型选择"), value: "back_to_category" },
    { name: chalk.dim("← 返回模板选择方式"), value: "back_to_method" },
  );

  if (choices.length === 4) return choices[0].value; // only 1 stack + separators

  const { stackKey } = await inquirer.prompt<{ stackKey: string }>([
    { type: "list", name: "stackKey", message: "请选择技术栈:", choices },
  ]);
  return stackKey;
}

async function selectPattern(
  catKey: string,
  stackKey: string,
): Promise<string> {
  if (["back_to_category", "back_to_method"].includes(stackKey))
    return stackKey;

  const stack = TEMPLATE_CATEGORIES[catKey].stacks[stackKey];
  const choices = Object.entries(stack.patterns).map(([key, p]) => ({
    name: p.name,
    value: key,
  }));

  choices.push(
    {
      name: chalk.dim("─────────────────────"),
      value: "separator",
      disabled: true,
    } as any,
    { name: chalk.dim("← 返回技术栈选择"), value: "back_to_stack" },
    { name: chalk.dim("← 返回项目类型选择"), value: "back_to_category" },
    { name: chalk.dim("← 返回模板选择方式"), value: "back_to_method" },
  );

  if (choices.length === 5) return choices[0].value; // only 1 pattern + nav

  const { patternKey } = await inquirer.prompt<{ patternKey: string }>([
    { type: "list", name: "patternKey", message: "请选择架构模式:", choices },
  ]);
  return patternKey;
}

async function selectSpecificTemplate(
  catKey: string,
  stackKey: string,
  patternKey: string,
): Promise<SelectedTemplate | string> {
  if (
    ["back_to_stack", "back_to_category", "back_to_method"].includes(patternKey)
  ) {
    return patternKey;
  }

  const templates = getTemplatesByCategory(catKey, stackKey, patternKey);
  const choices: object[] = Object.entries(templates).map(([key, t]) => ({
    name: `${t.name} - ${chalk.dim(t.description)}`,
    value: { key, ...t },
    short: t.name,
  }));

  choices.push(
    {
      name: chalk.dim("─────────────────────"),
      value: "separator",
      disabled: true,
    },
    { name: chalk.dim("← 返回架构模式选择"), value: "back_to_pattern" },
    { name: chalk.dim("← 返回技术栈选择"), value: "back_to_stack" },
    { name: chalk.dim("← 返回项目类型选择"), value: "back_to_category" },
    { name: chalk.dim("← 返回模板选择方式"), value: "back_to_method" },
  );

  const { selectedTemplate } = await inquirer.prompt<{
    selectedTemplate: SelectedTemplate | string;
  }>([
    {
      type: "list",
      name: "selectedTemplate",
      message: "请选择模板版本:",
      choices,
    },
  ]);
  return selectedTemplate;
}

// ── Search selection ─────────────────────────────────────────────

async function selectBySearch(): Promise<SelectedTemplate> {
  while (true) {
    const { keyword } = await inquirer.prompt<{ keyword: string }>([
      {
        type: "input",
        name: "keyword",
        message: "请输入搜索关键词 (名称、描述、技术栈):",
        validate: (input: string) => (input.trim() ? true : "关键词不能为空"),
      },
    ]);

    const results = searchTemplates(keyword);

    if (Object.keys(results).length === 0) {
      console.log();
      console.log(chalk.yellow("🔍 没有找到匹配的模板"));
      console.log(chalk.dim(`搜索关键词: "${keyword}"`));
      console.log();

      const { action } = await inquirer.prompt<{ action: string }>([
        {
          type: "list",
          name: "action",
          message: "请选择下一步操作:",
          choices: [
            { name: "🔍 重新搜索", value: "retry" },
            { name: "⬅️  返回模板选择方式", value: "back" },
          ],
        },
      ]);

      if (action === "retry") continue;
      return await selectTemplateMethod();
    }

    console.log();
    console.log(chalk.green.bold("🔍 搜索结果"));
    console.log(
      chalk.dim(
        `关键词: "${keyword}" • 找到 ${Object.keys(results).length} 个匹配模板`,
      ),
    );
    console.log();

    const choices: object[] = Object.entries(results).map(([key, t]) => {
      const hl = (text: string) =>
        text.replace(
          new RegExp(`(${keyword})`, "gi"),
          chalk.bgYellow.black("$1"),
        );
      const ver =
        t.version === "full"
          ? chalk.green("[完整版]")
          : chalk.yellow("[精简版]");
      const info = t.features.slice(0, 2).join(" • ");

      return {
        name: `${chalk.bold(hl(t.name.replace(/\s*(完整版|精简版)\s*$/, "")))} ${ver}\n   ${chalk.dim(hl(t.description))}\n   ${chalk.dim(`${info} • key: ${key}`)}\n   ${chalk.dim("─".repeat(60))}`,
        value: { key, ...t },
        short: t.name,
      };
    });

    choices.push(
      { name: chalk.dim("━".repeat(70)), value: "separator", disabled: true },
      { name: "🔍 重新搜索", value: "search_again" },
      { name: "⬅️  返回模板选择方式", value: "back_to_mode" },
    );

    const { selectedTemplate } = await inquirer.prompt<{
      selectedTemplate: SelectedTemplate | string;
    }>([
      {
        type: "list",
        name: "selectedTemplate",
        message: "选择模板:",
        choices,
        pageSize: 15,
        loop: false,
      },
    ]);

    if (selectedTemplate === "search_again") continue;
    if (selectedTemplate === "back_to_mode")
      return await selectTemplateMethod();
    return selectedTemplate as SelectedTemplate;
  }
}

// ── All templates ────────────────────────────────────────────────

async function selectFromAll(): Promise<SelectedTemplate> {
  const allTemplates = getAllTemplates();

  console.log();
  console.log(chalk.blue.bold("📋 所有可用模板"));
  console.log(chalk.dim(`共 ${Object.keys(allTemplates).length} 个模板可选`));
  console.log();

  const categorizedChoices: object[] = [];

  for (const [_catKey, category] of Object.entries(TEMPLATE_CATEGORIES)) {
    categorizedChoices.push({
      name: chalk.yellow.bold(category.name),
      value: `${_catKey}_header`,
      disabled: true,
    });

    for (const [_sKey, stack] of Object.entries(category.stacks)) {
      for (const _pattern of Object.values(stack.patterns)) {
        for (const [key, t] of Object.entries(_pattern.templates)) {
          const ver =
            t.version === "full"
              ? chalk.green("[完整版]")
              : chalk.yellow("[精简版]");
          categorizedChoices.push({
            name: `  ● ${chalk.bold(t.name.replace(/\s*(完整版|精简版)\s*$/, ""))} ${ver} - ${chalk.dim(t.description)}\n     ${chalk.dim(`技术栈: ${stack.name} • 命令: robot create my-app -t ${key}`)}`,
            value: { key, ...t },
            short: t.name,
          });
          categorizedChoices.push({
            name: chalk.dim("    " + "─".repeat(66)),
            value: `sep_${key}`,
            disabled: true,
          });
        }
      }
    }
  }

  categorizedChoices.push(
    { name: chalk.dim("━".repeat(70)), value: "separator", disabled: true },
    { name: chalk.dim("⬅️  返回模板选择方式"), value: "back_to_mode" },
  );

  const { selectedTemplate } = await inquirer.prompt<{
    selectedTemplate: SelectedTemplate | string;
  }>([
    {
      type: "list",
      name: "selectedTemplate",
      message: "选择模板:",
      choices: categorizedChoices,
      pageSize: 25,
      loop: false,
    },
  ]);

  if (selectedTemplate === "back_to_mode") return await selectTemplateMethod();
  return selectedTemplate as SelectedTemplate;
}

// ── Project Configuration ────────────────────────────────────────

async function configureProject(
  options: CreateOptions,
): Promise<ProjectConfig> {
  console.log();
  console.log(chalk.blue("⚙️  项目配置"));
  console.log();

  const available = detectPackageManager();
  const hasBun = available.includes("bun");
  const hasPnpm = available.includes("pnpm");

  const managerChoices: { name: string; value: string }[] = [];
  if (available.includes("bun"))
    managerChoices.push({
      name: "bun (推荐 - 极速安装，现代化，性能最佳)",
      value: "bun",
    });
  if (available.includes("pnpm"))
    managerChoices.push({
      name: "pnpm (推荐 - 快速安装，节省磁盘空间)",
      value: "pnpm",
    });
  if (available.includes("yarn"))
    managerChoices.push({
      name: "yarn (兼容性好 - 适用于现有yarn项目)",
      value: "yarn",
    });
  if (available.includes("npm"))
    managerChoices.push({
      name: "npm (默认 - Node.js内置，兼容性最好)",
      value: "npm",
    });

  if (managerChoices.length === 0) {
    managerChoices.push(
      { name: "npm (默认)", value: "npm" },
      { name: "bun (如已安装)", value: "bun" },
      { name: "pnpm (如已安装)", value: "pnpm" },
      { name: "yarn (如已安装)", value: "yarn" },
    );
  }

  const config = await inquirer.prompt([
    {
      type: "confirm",
      name: "initGit",
      message: "是否初始化 Git 仓库?",
      default: true,
    },
    {
      type: "confirm",
      name: "installDeps",
      message: "是否立即安装依赖?",
      default: !options.skipInstall,
    },
    {
      type: "list",
      name: "packageManager",
      message: "选择包管理器:",
      choices: managerChoices,
      default: hasBun ? "bun" : hasPnpm ? "pnpm" : "npm",
      when: (a: Record<string, boolean>) => a.installDeps,
    },
    {
      type: "input",
      name: "description",
      message: "项目描述 (可选):",
      default: "",
    },
    {
      type: "input",
      name: "author",
      message: "作者 (可选):",
      default: getGitUser(),
    },
    {
      type: "confirm",
      name: "confirmConfig",
      message: "确认以上配置?",
      default: true,
    },
  ]);

  if (!config.confirmConfig) {
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: "list",
        name: "action",
        message: "请选择操作:",
        choices: [
          { name: "🔄 重新配置", value: "reconfigure" },
          { name: "❌ 取消创建", value: "cancel" },
        ],
      },
    ]);

    if (action === "reconfigure") return await configureProject(options);
    console.log(chalk.yellow("❌ 取消创建项目"));
    process.exit(0);
  }

  return config as unknown as ProjectConfig;
}

// ── Confirm ──────────────────────────────────────────────────────

async function confirmCreation(
  projectName: string,
  template: SelectedTemplate,
  config: ProjectConfig,
): Promise<void> {
  console.log();
  console.log(chalk.blue("📋 项目创建信息确认:"));
  console.log();
  console.log(`  项目名称: ${chalk.cyan(projectName)}`);
  console.log(`  选择模板: ${chalk.cyan(template.name)}`);
  console.log(`  模板描述: ${chalk.dim(template.description)}`);
  console.log(
    `  包含功能: ${chalk.dim(template.features.join(", ") || "自定义模板")}`,
  );
  if (config.description)
    console.log(`  项目描述: ${chalk.dim(config.description)}`);
  if (config.author) console.log(`  作　　者: ${chalk.dim(config.author)}`);
  console.log(
    `  初始化Git: ${config.initGit ? chalk.green("是") : chalk.dim("否")}`,
  );
  console.log(
    `  安装依赖: ${config.installDeps ? chalk.green("是") + chalk.dim(` (${config.packageManager})`) : chalk.dim("否")}`,
  );
  console.log(`  源码仓库: ${chalk.dim(template.repoUrl)}`);
  console.log();

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: "confirm",
      name: "confirmed",
      message: "确认创建项目?",
      default: true,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.yellow("❌ 取消创建"));
    process.exit(0);
  }
}

// ── Execute Creation ─────────────────────────────────────────────

async function executeCreation(
  projectName: string,
  template: SelectedTemplate,
  config: ProjectConfig,
  options: CreateOptions,
): Promise<void> {
  if (!projectName) throw new Error(`项目名称无效: ${projectName}`);
  if (!template?.name)
    throw new Error(`模板数据无效: ${JSON.stringify(template)}`);

  const spinner = ora({
    text: "🚀 准备创建项目...",
    spinner: "dots",
    color: "cyan",
  }).start();
  let tempPath: string | undefined;

  try {
    // 1. Check directory
    spinner.text = "📁 检查项目目录...";
    const projectPath = path.resolve(projectName);

    if (fs.existsSync(projectPath)) {
      spinner.stop();
      console.log(chalk.yellow("⚠️  项目目录已存在"));

      const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
        {
          type: "confirm",
          name: "overwrite",
          message: "目录已存在，是否覆盖?",
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow("❌ 取消创建"));
        process.exit(0);
      }

      spinner.start("🗑️  清理现有目录...");
      await fs.remove(projectPath);
      spinner.text = "📁 准备创建新目录...";
    }

    // 2. Download template
    spinner.text = "🌐 下载最新模板...";
    try {
      tempPath = await downloadTemplate(template, {
        spinner,
        noCache: options.noCache,
      });
      if (!tempPath || !fs.existsSync(tempPath))
        throw new Error(`模板路径无效: ${tempPath}`);
    } catch (error) {
      spinner.fail("模板下载失败");
      console.log();
      console.log(chalk.red("❌ 模板下载错误:"));
      console.log(chalk.dim(`   ${(error as Error).message}`));
      console.log();
      throw error;
    }

    // 3. Copy template
    await copyTemplate(tempPath, projectPath, spinner);

    // 4. Process config
    spinner.text = "⚙️  处理项目配置...";
    await processProjectConfig(projectPath, projectName, template, config);

    // 5. Git init
    if (config.initGit) {
      spinner.text = "📝 初始化 Git 仓库...";
      initializeGitRepository(projectPath);
    }

    // 6. Install dependencies
    if (config.installDeps) {
      spinner.text = `📦 使用 ${config.packageManager} 安装依赖...`;
      await installDependencies(projectPath, spinner, config.packageManager);
    }

    // 7. Clean up temp
    if (tempPath) {
      spinner.text = "🧹 清理临时文件...";
      await fs.remove(tempPath).catch(() => {});
    }

    // 8. Done!
    spinner.succeed(chalk.green("🎉 项目创建成功!"));

    console.log();
    console.log(chalk.green("🎉 项目创建完成!"));
    console.log();
    console.log(chalk.blue("📁 项目信息:"));
    console.log(`   位置: ${chalk.cyan(projectPath)}`);
    console.log(`   模板: ${chalk.cyan(template.name)}`);
    console.log(
      `   Git仓库: ${config.initGit ? chalk.green("已初始化") : chalk.dim("未初始化")}`,
    );
    console.log(
      `   依赖安装: ${config.installDeps ? chalk.green("已完成") : chalk.dim("需手动安装")}`,
    );
    console.log();
    console.log(chalk.blue("🚀 快速开始:"));
    console.log(chalk.cyan(`   cd ${projectName}`));

    const pm = config.packageManager || "bun";
    if (!config.installDeps) {
      console.log(chalk.cyan(`   ${pm} install`));
    }

    const cmd = getStartCommand(template, pm);
    if (cmd) console.log(chalk.cyan(`   ${cmd}`));

    if (pm === "bun")
      console.log(chalk.dim("   # 或使用 npm: npm install && npm run dev"));
    else if (pm === "npm")
      console.log(
        chalk.dim("   # 或使用 bun: bun install && bun run dev (如已安装)"),
      );
    console.log();

    // Stats
    spinner.start("📊 统计项目信息...");
    const stats = await generateProjectStats(projectPath);
    spinner.stop();
    if (stats) {
      printProjectStats(stats);
      console.log();
    }
  } catch (error) {
    if (tempPath) await fs.remove(tempPath).catch(() => {});
    spinner.fail("创建项目失败");
    throw error;
  }
}

// ── Post-creation helpers ────────────────────────────────────────

async function processProjectConfig(
  projectPath: string,
  projectName: string,
  template: SelectedTemplate,
  config: ProjectConfig,
): Promise<void> {
  // package.json
  const pkgPath = path.join(projectPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    pkg.name = projectName;
    pkg.description = config.description || `基于 ${template.name} 创建的项目`;
    if (config.author) pkg.author = config.author;
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }

  // README.md
  const readmePath = path.join(projectPath, "README.md");
  if (fs.existsSync(readmePath)) {
    let readme = await fs.readFile(readmePath, "utf8");
    readme = readme.replace(/# .+/, `# ${projectName}`);
    const desc = config.description || `基于 ${template.name} 创建的项目`;
    readme = readme.replace(/项目描述.*/, desc);
    if (config.author) readme += `\n\n## 作者\n\n${config.author}\n`;
    await fs.writeFile(readmePath, readme);
  }

  // Rename dotfiles
  for (const [from, to] of [
    ["_gitignore", ".gitignore"],
    ["_env.example", ".env.example"],
  ]) {
    const src = path.join(projectPath, from);
    const dest = path.join(projectPath, to);
    if (fs.existsSync(src)) await fs.move(src, dest);
  }
}

function initializeGitRepository(projectPath: string): void {
  try {
    execSync("git --version", { stdio: "ignore" });
    execSync("git init", { cwd: projectPath, stdio: "ignore" });
    execSync("git add .", { cwd: projectPath, stdio: "ignore" });
    execSync('git commit -m "feat: 初始化项目"', {
      cwd: projectPath,
      stdio: "ignore",
    });
  } catch {
    console.log(chalk.yellow("⚠️  Git 不可用，跳过仓库初始化"));
  }
}

function getStartCommand(template: SelectedTemplate, pm: string): string {
  const script = START_COMMAND_MAP[template.key] || "dev";
  return `${pm} run ${script}`;
}
