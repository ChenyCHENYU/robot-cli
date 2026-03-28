import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
import * as p from "@clack/prompts";
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
import { START_COMMAND_MAP, VERSION_LABELS } from "./config";
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

// ── Helpers ──────────────────────────────────────────────────────

const STRIP_VERSION_RE = /\s*(完整版|精简版|微服务版)\s*$/;

/** 过滤掉尚未发布（status: "coming-soon"）的模板 */
function filterAvailable<T extends { status?: string }>(
  map: Record<string, T>,
): Record<string, T> {
  return Object.fromEntries(Object.entries(map).filter(([, t]) => t.status !== "coming-soon"));
}

// ── Main Entry ───────────────────────────────────────────────────

export async function createProject(
  projectName: string | undefined,
  options: CreateOptions = {},
): Promise<void> {
  p.intro(chalk.bgCyan.black(" Robot CLI - 开始创建项目 "));

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
    console.log(chalk.blue(`使用自定义模板: ${chalk.dim(options.from)}`));
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
      chalk.yellow("Dry Run 模式 - 以下为预览信息，未实际执行任何操作:"),
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
      p.log.error("项目名称不合法:");
      v.errors.forEach((e) => p.log.warn(`  ${e}`));

      const newName = await p.text({
        message: "请输入新的项目名称:",
        validate: (input) => {
          if (!input) return "项目名称不能为空";
          const r = validateProjectName(input);
          return r.valid ? undefined : r.errors[0];
        },
      });
      if (p.isCancel(newName)) process.exit(0);
      return newName;
    }
    return projectName;
  }

  const defaultName = generateDefaultProjectName(template);

  const name = await p.text({
    message: "请输入项目名称:",
    defaultValue: defaultName,
    placeholder: defaultName,
    validate: (input) => {
      if (!input?.trim()) return "项目名称不能为空";
      const r = validateProjectName(input);
      return r.valid ? undefined : r.errors[0];
    },
  });

  if (p.isCancel(name)) process.exit(0);
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
    console.log(chalk.yellow(`模板 "${templateOption}" 不存在`));
    console.log();
  }
  return await selectTemplateMethod();
}

async function selectTemplateMethod(): Promise<SelectedTemplate> {
  const selectionMode = await p.select({
    message: "模板选择方式:",
    options: [
      { value: "recommended", label: "推荐模板", hint: "基于团队使用频率推荐的热门模板" },
      { value: "category", label: "分类浏览", hint: "前端、后端、移动端、桌面端分类" },
      { value: "search", label: "关键词搜索", hint: "按技术栈、功能特性查找" },
      { value: "all", label: "全部模板", hint: "查看所有可用模板" },
    ],
  });

  if (p.isCancel(selectionMode)) process.exit(0);

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
    p.log.warn("暂无推荐模板");
    return await selectTemplateMethod();
  }

  p.log.info(chalk.bold("推荐模板") + chalk.dim(" — 基于团队使用频率和项目成熟度推荐"));

  const options: { value: string; label: string; hint?: string }[] = [];

  for (const [key, template] of Object.entries(recommended)) {
    if (template.status === "coming-soon") continue;
    const ver = VERSION_LABELS[template.version] || template.version;
    const tags = template.features.slice(0, 3).join(", ");
    options.push({
      value: key,
      label: `${template.name.replace(STRIP_VERSION_RE, "")} [${ver}]`,
      hint: `${template.description} | ${tags}`,
    });
  }

  options.push({ value: "back", label: "<- 返回选择其他方式" });

  const selected = await p.select({
    message: "选择推荐模板:",
    options,
  });

  if (p.isCancel(selected)) process.exit(0);
  if (selected === "back") return await selectTemplateMethod();

  const t = recommended[selected];
  return { key: selected, ...t };
}

// ── Category selection ───────────────────────────────────────────

async function selectByCategory(): Promise<SelectedTemplate> {
  while (true) {
    // Step 1: Select category
    const catOptions = Object.entries(TEMPLATE_CATEGORIES).map(([key, c]) => ({
      value: key,
      label: c.name,
    }));
    catOptions.push({ value: "back_to_method", label: "<- 返回模板选择方式" });

    const catKey = await p.select({
      message: "请选择项目类型:",
      options: catOptions,
    });

    if (p.isCancel(catKey)) process.exit(0);
    if (catKey === "back_to_method") return await selectTemplateMethod();

    const category = TEMPLATE_CATEGORIES[catKey];

    // Step 2: Select stack (auto-select if only one)
    const stackEntries = Object.entries(category.stacks);
    let stackKey: string;

    if (stackEntries.length === 1) {
      stackKey = stackEntries[0][0];
    } else {
      const stackOptions = stackEntries.map(([key, s]) => ({
        value: key,
        label: s.name,
      }));
      stackOptions.push({ value: "back", label: "<- 返回" });

      const sk = await p.select({
        message: "请选择技术栈:",
        options: stackOptions,
      });

      if (p.isCancel(sk)) process.exit(0);
      if (sk === "back") continue;
      stackKey = sk;
    }

    const stack = category.stacks[stackKey];

    // Step 3: Select pattern (auto-select if only one)
    const patternEntries = Object.entries(stack.patterns);
    let patternKey: string;

    if (patternEntries.length === 1) {
      patternKey = patternEntries[0][0];
    } else {
      const patternOptions = patternEntries.map(([key, pt]) => ({
        value: key,
        label: pt.name,
      }));
      patternOptions.push({ value: "back", label: "<- 返回" });

      const pk = await p.select({
        message: "请选择架构模式:",
        options: patternOptions,
      });

      if (p.isCancel(pk)) process.exit(0);
      if (pk === "back") continue;
      patternKey = pk;
    }

    // Step 4: Select template
    const allTemplates = getTemplatesByCategory(catKey, stackKey, patternKey);
    const templates = filterAvailable(allTemplates);
    const comingSoonCount = Object.keys(allTemplates).length - Object.keys(templates).length;

    if (Object.keys(templates).length === 0) {
      const names = Object.values(allTemplates).map((t) => t.name).join("、");
      p.log.warn(`该分类下的模板正在建设中，敬请期待 (${names})`);
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }

    const tplOptions = Object.entries(templates).map(([key, t]) => {
      const ver = VERSION_LABELS[t.version] || t.version;
      return {
        value: key,
        label: `${t.name} [${ver}]`,
        hint: t.description,
      };
    });
    if (comingSoonCount > 0) {
      tplOptions.push({
        value: "__coming_soon__",
        label: chalk.dim(`+ ${comingSoonCount} 个模板开发中...`),
        hint: "敬请期待",
      });
    }
    tplOptions.push({ value: "back", label: "<- 返回", hint: "" });

    const tplKey = await p.select({
      message: "请选择模板版本:",
      options: tplOptions,
    });

    if (p.isCancel(tplKey)) process.exit(0);
    if (tplKey === "back") continue;
    if (tplKey === "__coming_soon__") {
      p.log.warn("该模板正在开发中，敬请期待！");
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }

    const t = templates[tplKey];
    return { key: tplKey, ...t };
  }
}

// ── Search selection ─────────────────────────────────────────────

async function selectBySearch(): Promise<SelectedTemplate> {
  while (true) {
    const keyword = await p.text({
      message: "请输入搜索关键词 (名称、描述、技术栈):",
      validate: (input) => (input?.trim() ? undefined : "关键词不能为空"),
    });

    if (p.isCancel(keyword)) return await selectTemplateMethod();

    const results = searchTemplates(keyword);
    const availableResults = filterAvailable(results);

    if (Object.keys(availableResults).length === 0) {
      p.log.warn(`没有找到匹配的模板 (关键词: "${keyword}")`);

      const action = await p.select({
        message: "请选择下一步操作:",
        options: [
          { value: "retry", label: "重新搜索" },
          { value: "back", label: "<- 返回模板选择方式" },
        ],
      });

      if (p.isCancel(action) || action === "back") return await selectTemplateMethod();
      continue;
    }

    p.log.info(`关键词: "${keyword}" -- 找到 ${Object.keys(availableResults).length} 个匹配模板`);

    const options: { value: string; label: string; hint?: string }[] = [];

    for (const [key, t] of Object.entries(availableResults)) {
      const ver = VERSION_LABELS[t.version] || t.version;
      const info = t.features.slice(0, 3).join(", ");
      options.push({
        value: key,
        label: `${t.name.replace(STRIP_VERSION_RE, "")} [${ver}]`,
        hint: `${t.description} | ${info}`,
      });
    }

    options.push(
      { value: "search_again", label: "重新搜索" },
      { value: "back_to_mode", label: "<- 返回模板选择方式" },
    );

    const selected = await p.select({
      message: "选择模板:",
      options,
    });

    if (p.isCancel(selected)) process.exit(0);
    if (selected === "search_again") continue;
    if (selected === "back_to_mode") return await selectTemplateMethod();

    const t = availableResults[selected];
    return { key: selected, ...t };
  }
}

// ── All templates ────────────────────────────────────────────────

async function selectFromAll(): Promise<SelectedTemplate> {
  const allTemplates = getAllTemplates();
  const availableTemplates = filterAvailable(allTemplates);
  const comingSoonCount = Object.keys(allTemplates).length - Object.keys(availableTemplates).length;

  const countInfo = comingSoonCount > 0
    ? chalk.dim(` -- 共 ${Object.keys(availableTemplates).length} 个可用，${comingSoonCount} 个开发中`)
    : chalk.dim(` -- 共 ${Object.keys(availableTemplates).length} 个模板可选`);
  p.log.info(chalk.bold("所有可用模板") + countInfo);

  const options: { value: string; label: string; hint?: string }[] = [];

  for (const [_catKey, category] of Object.entries(TEMPLATE_CATEGORIES)) {
    for (const [_sKey, stack] of Object.entries(category.stacks)) {
      for (const _pattern of Object.values(stack.patterns)) {
        for (const [key, t] of Object.entries(_pattern.templates)) {
          if (t.status === "coming-soon") continue;
          const ver = VERSION_LABELS[t.version] || t.version;
          options.push({
            value: key,
            label: `${t.name.replace(STRIP_VERSION_RE, "")} [${ver}]`,
            hint: `${category.name} > ${stack.name} | ${t.description}`,
          });
        }
      }
    }
  }

  options.push({ value: "back_to_mode", label: "<- 返回模板选择方式" });

  const selected = await p.select({
    message: "选择模板:",
    options,
  });

  if (p.isCancel(selected)) process.exit(0);
  if (selected === "back_to_mode") return await selectTemplateMethod();

  const t = availableTemplates[selected];
  return { key: selected, ...t };
}

// ── Project Configuration ─────────────────────────────────────────

async function configureProject(
  options: CreateOptions,
): Promise<ProjectConfig> {
  p.log.step(chalk.bold("项目配置"));

  const available = detectPackageManager();
  const hasBun = available.includes("bun");
  const hasPnpm = available.includes("pnpm");

  const initGit = await p.confirm({
    message: "是否初始化 Git 仓库?",
    initialValue: true,
  });
  if (p.isCancel(initGit)) process.exit(0);

  const installDeps = await p.confirm({
    message: "是否立即安装依赖?",
    initialValue: !options.skipInstall,
  });
  if (p.isCancel(installDeps)) process.exit(0);

  let packageManager = hasBun ? "bun" : hasPnpm ? "pnpm" : "npm";

  if (installDeps) {
    const managerOptions: { value: string; label: string; hint?: string }[] = [];
    if (available.includes("bun"))
      managerOptions.push({ value: "bun", label: "bun", hint: "推荐 - 极速安装" });
    if (available.includes("pnpm"))
      managerOptions.push({ value: "pnpm", label: "pnpm", hint: "推荐 - 节省磁盘空间" });
    if (available.includes("yarn"))
      managerOptions.push({ value: "yarn", label: "yarn", hint: "兼容性好" });
    if (available.includes("npm"))
      managerOptions.push({ value: "npm", label: "npm", hint: "Node.js 内置" });

    if (managerOptions.length === 0) {
      managerOptions.push(
        { value: "npm", label: "npm" },
        { value: "bun", label: "bun" },
        { value: "pnpm", label: "pnpm" },
        { value: "yarn", label: "yarn" },
      );
    }

    const pm = await p.select({
      message: "选择包管理器:",
      options: managerOptions,
      initialValue: hasBun ? "bun" : hasPnpm ? "pnpm" : "npm",
    });
    if (p.isCancel(pm)) process.exit(0);
    packageManager = pm;
  }

  const description = await p.text({
    message: "项目描述 (可选):",
    defaultValue: "",
    placeholder: "输入项目描述或直接回车跳过",
  });
  if (p.isCancel(description)) process.exit(0);

  const author = await p.text({
    message: "作者 (可选):",
    defaultValue: getGitUser(),
    placeholder: getGitUser() || "输入作者名",
  });
  if (p.isCancel(author)) process.exit(0);

  return {
    initGit,
    installDeps,
    packageManager: packageManager as ProjectConfig["packageManager"],
    description,
    author,
  };
}

// ── Confirm ────────────────────────────────────────────────────────────

async function confirmCreation(
  projectName: string,
  template: SelectedTemplate,
  config: ProjectConfig,
): Promise<void> {
  p.note(
    [
      `${chalk.dim("项目名称:")} ${chalk.cyan(projectName)}`,
      `${chalk.dim("选择模板:")} ${chalk.cyan(template.name)}`,
      `${chalk.dim("模板描述:")} ${template.description}`,
      `${chalk.dim("包含功能:")} ${template.features.join(", ") || "自定义模板"}`,
      config.description ? `${chalk.dim("项目描述:")} ${config.description}` : "",
      config.author ? `${chalk.dim("作    者:")} ${config.author}` : "",
      `${chalk.dim("初始化Git:")} ${config.initGit ? chalk.green("是") : "否"}`,
      `${chalk.dim("安装依赖:")} ${config.installDeps ? chalk.green("是") + ` (${config.packageManager})` : "否"}`,
      `${chalk.dim("源码仓库:")} ${template.repoUrl}`,
    ].filter(Boolean).join("\n"),
    "项目创建信息确认",
  );

  const confirmed = await p.confirm({
    message: "确认创建项目?",
    initialValue: true,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.outro(chalk.yellow("取消创建"));
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
    text: "准备创建项目...",
    spinner: "dots",
    color: "cyan",
  }).start();
  let tempPath: string | undefined;

  try {
    // 1. Check directory
    spinner.text = "检查项目目录...";
    const projectPath = path.resolve(projectName);

    if (fs.existsSync(projectPath)) {
      spinner.stop();
      p.log.warn("项目目录已存在");

      const overwrite = await p.confirm({
        message: "目录已存在，是否覆盖?",
        initialValue: false,
      });

      if (p.isCancel(overwrite) || !overwrite) {
        p.outro(chalk.yellow("取消创建"));
        process.exit(0);
      }

      spinner.start("清理现有目录...");
      await fs.remove(projectPath);
      spinner.text = "准备创建新目录...";
    }

    // 2. Download template
    spinner.text = "下载最新模板...";
    try {
      tempPath = await downloadTemplate(template, {
        spinner,
        noCache: options.noCache,
      });
      if (!tempPath || !fs.existsSync(tempPath))
        throw new Error(`模板路径无效: ${tempPath}`);
    } catch (error) {
      // 只在这里处理下载错误，不再向上抛出到外层 catch
      spinner.fail("模板下载失败");
      console.log();
      console.log(chalk.dim(`  ${(error as Error).message}`));
      console.log();
      return;
    }

    // 3. Copy template
    await copyTemplate(tempPath, projectPath, spinner);

    // 4. Process config
    spinner.text = "处理项目配置...";
    await processProjectConfig(projectPath, projectName, template, config);

    // 5. Git init
    if (config.initGit) {
      spinner.text = "初始化 Git 仓库...";
      initializeGitRepository(projectPath);
    }

    // 6. Install dependencies
    if (config.installDeps) {
      spinner.text = `使用 ${config.packageManager} 安装依赖...`;
      await installDependencies(projectPath, spinner, config.packageManager);
    }

    // 7. Clean up temp
    if (tempPath) {
      spinner.text = "清理临时文件...";
      await fs.remove(tempPath).catch(() => {});
    }

    // 8. Done!
    spinner.succeed(chalk.green("项目创建成功!"));

    const pm = config.packageManager || "bun";
    const cmd = getStartCommand(template, pm);
    const steps = [`cd ${projectName}`];
    if (!config.installDeps) steps.push(`${pm} install`);
    if (cmd) steps.push(cmd);

    p.note(
      [
        `${chalk.dim("位置:")}   ${chalk.cyan(projectPath)}`,
        `${chalk.dim("模板:")}   ${chalk.cyan(template.name)}`,
        `${chalk.dim("Git:")}    ${config.initGit ? chalk.green("已初始化") : "未初始化"}`,
        `${chalk.dim("依赖:")}   ${config.installDeps ? chalk.green("已完成") : "需手动安装"}`,
        "",
        chalk.bold("快速开始:"),
        ...steps.map((s) => `  ${chalk.cyan(s)}`),
      ].join("\n"),
      "项目创建完成",
    );

    // Stats
    const statsSpinner = ora("统计项目信息...").start();
    const stats = await generateProjectStats(projectPath);
    statsSpinner.stop();
    if (stats) {
      printProjectStats(stats);
      console.log();
    }

    p.outro(chalk.green("Happy coding!"));
  } catch (error) {
    if (tempPath) await fs.remove(tempPath).catch(() => {});
    if (spinner.isSpinning) spinner.fail("创建项目失败");
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
    console.log(chalk.yellow("Git 不可用，跳过仓库初始化"));
  }
}

function getStartCommand(template: SelectedTemplate, pm: string): string {
  const script = START_COMMAND_MAP[template.key] || "dev";
  return `${pm} run ${script}`;
}
