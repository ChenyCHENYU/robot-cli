import fs from "fs-extra";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import chalk from "chalk";
import * as p from "@clack/prompts";
import ora from "ora";
import { downloadTemplate } from "./download";
import { getAllTemplates } from "./templates";
import {
  validateProjectName, copyTemplate, installDependencies,
  detectPackageManager, getPackageManagerVersion, getGitUser,
} from "./utils";
import type {
  SelectedTemplate, TemplateConfig, ProjectConfig, CreateOptions,
  DownloadedTemplate, PackageManager,
} from "./types";
import {
  isTrimmableTemplate, selectTrimMode, getPresetSelection,
  executeTrimming, getTrimSummary, type TrimSelection,
} from "./trimmer";
import {
  assertTemplateRuntime, getRequiredPackageManager, isVersionSupported,
  resolveDownloadedTemplateRuntime, runTemplateInitializer,
} from "./template-runtime";
import { getProjectGuidance, getProjectStartCommand, writeProjectGuide } from "./project-guide";
import { CreationCancelled } from "./interaction";

function answer<T>(value: T | symbol): T {
  if (p.isCancel(value)) throw new CreationCancelled();
  return value as T;
}

function step(number: number, title: string): void {
  p.log.step(`${chalk.cyan(`${number}/3`)} ${chalk.bold(title)}`);
}

/** A single creation path for both the wizard and automation. */
export async function createProject(
  projectName: string | undefined,
  options: CreateOptions = {},
): Promise<boolean> {
  if (options.from && options.template) {
    throw new Error("--from 与 --template 只能选择一个。内置模板用 -t，自定义仓库用 --from。");
  }
  if (!options.yes && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new Error("当前终端无法交互。请加 --yes 使用默认设置，例如：robot create my-app -t robot-admin --yes --skip-install");
  }
  if (options.yes && !projectName?.trim()) {
    throw new Error("使用 --yes 时请提供项目目录，例如：robot create my-app --yes。");
  }
  if (options.yes && options.preset === "custom") {
    throw new Error("自定义预设需要交互选择功能。请移除 --yes，或改用 --preset lite / full。");
  }
  p.intro(chalk.bgCyan.black(options.dryRun ? " 创建预览 " : " 创建 Robot 项目 "));
  try {
    step(1, "选择项目与用途");
    const template = options.from ? customTemplate(options.from) : await selectTemplate(options);
    assertTemplateRuntime(template);
    const name = await handleProjectName(projectName, template, options);
    let selection: TrimSelection | undefined;
    if (isTrimmableTemplate(template)) {
      selection = options.preset && options.preset !== "custom"
        ? getPresetSelection(options.preset)
        : options.yes ? getPresetSelection("lite") : await selectTrimMode();
    } else if (options.preset && options.preset !== "full") {
      throw new Error(`${template.name} 暂不支持 ${options.preset} 预设，请移除 --preset。`);
    }
    step(2, "设置产品与初始化方式");
    const config = await configureProject(name, options, template);
    step(3, options.dryRun ? "核对创建预览" : "核对并创建");
    showCreationPlan(name, template, config, options, selection);
    if (options.dryRun) {
      p.outro("预览完成，未下载模板或写入项目。移除 --dry-run 后即可创建。");
      return false;
    }
    if (!options.yes && !answer(await p.confirm({ message: "按以上设置创建项目？", initialValue: true }))) {
      throw new CreationCancelled();
    }
    return await executeCreation(name, template, config, options, selection);
  } catch (error) {
    if (error instanceof CreationCancelled) {
      p.outro("已取消创建。");
      return false;
    }
    throw error;
  }
}

function customTemplate(source: string): SelectedTemplate {
  const repoUrl = source.trim();
  if (!/^(https?:\/\/|ssh:\/\/|git@)/.test(repoUrl)) {
    throw new Error("请提供有效的 Git 仓库地址，例如 https://github.com/org/repo 或 git@github.com:org/repo.git。");
  }
  return {
    key: "custom", name: "自定义 Git 模板", description: "按仓库自身的文档与运行约定初始化",
    repoUrl, features: [], version: "full",
  };
}

async function selectTemplate(options: CreateOptions): Promise<SelectedTemplate> {
  const all = getAllTemplates();
  if (options.template) {
    const template = all[options.template];
    if (!template) throw new Error(`模板「${options.template}」不存在。运行 robot list 查看可用模板，或用 --from 指定仓库。`);
    if (template.status === "coming-soon") throw new Error(`模板「${options.template}」尚未上线。运行 robot list 查看当前可用模板。`);
    return { key: options.template, ...template };
  }
  if (options.yes) return { key: "robot-admin", ...all["robot-admin"] };
  const available = Object.entries(all).filter(([, template]) => template.status !== "coming-soon");
  if (options.advanced) return selectAdvancedTemplate(available);
  const selected = answer(await p.select({
    message: "你要创建哪类项目？",
    options: [
      { value: "robot-admin", label: "PC 管理后台", hint: "Vue · Naive UI · 登录、权限与业务组件" },
      { value: "robot-h5", label: "移动 H5 / 企业 WebView", hint: "Beta · Vant · 含 wl-mbase 集成配置" },
      { value: "advanced", label: "更多架构", hint: "Monorepo、微前端、模块联邦" },
    ], initialValue: "robot-admin",
  }));
  if (selected === "advanced") return selectAdvancedTemplate(available);
  return { key: selected, ...all[selected] };
}

async function selectAdvancedTemplate(available: [string, TemplateConfig][]): Promise<SelectedTemplate> {
  const selected = answer(await p.select({
    message: "选择项目架构",
    options: available.map(([key, template]) => ({
      value: key, label: template.name.replace(/\s*完整版$/, ""),
      hint: `${template.status === "beta" ? "Beta · " : ""}${template.description}`,
    })),
  }));
  return { key: selected, ...available.find(([key]) => key === selected)![1] };
}

async function handleProjectName(name: string | undefined, template: SelectedTemplate, options: CreateOptions): Promise<string> {
  const defaultName = template.key === "robot-h5" ? "my-mobile-app" : "my-admin-app";
  const candidate = name?.trim();
  if (candidate) {
    const result = validateProjectName(candidate);
    if (result.valid) return candidate;
    if (options.yes) throw new Error(`项目目录无效：${result.errors.join("；")}`);
    p.log.warn(result.errors.join("；"));
  }
  return answer(await p.text({
    message: "项目目录",
    placeholder: defaultName,
    defaultValue: defaultName,
    validate: (input) => validateProjectName(input?.trim() || defaultName).errors[0],
  })).trim();
}

async function configureProject(name: string, options: CreateOptions, template: SelectedTemplate): Promise<ProjectConfig> {
  const title = options.title?.trim() || (options.yes ? name : answer(await p.text({
    message: "产品名称（用于应用标题）", placeholder: name, defaultValue: name,
  })).trim());
  if (Array.from(title).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new Error("产品名称请使用单行文字，不要包含换行或控制字符。");
  }
  const required = getRequiredPackageManager(template);
  if (required && options.packageManager && options.packageManager !== required) {
    throw new Error(`${template.name} 使用 ${required}，不能选择 ${options.packageManager}。请移除 --package-manager 或指定 ${required}。`);
  }
  const available = detectPackageManager();
  let packageManager: PackageManager = required || options.packageManager || available[0] || "npm";
  let initGit = options.git !== false;
  let installDeps = !options.skipInstall;
  let description = options.description?.trim() || "";
  let author = options.author?.trim() ?? getGitUser();
  if (!options.yes) {
    p.log.info(required
      ? `模板使用 ${required}${template.runtime?.packageManagerVersion ? ` ${template.runtime.packageManagerVersion}` : ""}，已自动匹配。`
      : `默认使用 ${packageManager} 安装依赖。`);
    const mode = answer(await p.select({
      message: "如何完成初始化？",
      options: [
        { value: "quick", label: "使用默认设置", hint: `${installDeps ? `${packageManager} 安装依赖` : "跳过安装"} · ${initGit ? "Git main 分支" : "不初始化 Git"}` },
        { value: "files", label: "先生成项目文件", hint: "跳过依赖安装，稍后按指引启动" },
        { value: "custom", label: "调整初始化设置", hint: "安装方式、Git、描述与作者" },
      ], initialValue: "quick",
    }));
    if (mode === "files") installDeps = false;
    if (mode === "custom") {
      if (!options.skipInstall) installDeps = answer(await p.confirm({ message: "现在安装依赖？", initialValue: true }));
      if (!required && !options.packageManager) packageManager = answer(await p.select({
        message: "包管理器", options: available.map((manager) => ({ value: manager, label: manager })), initialValue: packageManager,
      }));
      if (options.git !== false) initGit = answer(await p.confirm({ message: "初始化 Git main 分支并创建首次提交？", initialValue: true }));
      description = options.description ?? answer(await p.text({ message: "项目描述（可选）", placeholder: "回车跳过", defaultValue: description }));
      author = options.author ?? answer(await p.text({ message: "作者（可选）", placeholder: "回车使用 Git 用户名", defaultValue: author }));
    }
  }
  const config = { title, initGit, installDeps, packageManager, description, author };
  checkInstallAvailability(template, config);
  return config;
}

/** Missing tools leave usable files and an explicit next step. */
function checkInstallAvailability(template: SelectedTemplate, config: ProjectConfig): void {
  const required = getRequiredPackageManager(template);
  if (required && required !== config.packageManager) {
    p.log.info(`已按下载后的模板要求改用 ${required}。`);
    config.packageManager = required;
  }
  if (!config.installDeps) return;
  const version = getPackageManagerVersion(config.packageManager);
  const range = required ? template.runtime?.packageManagerVersion : undefined;
  if (!version || !isVersionSupported(version, range)) {
    p.log.warn(`${config.packageManager}${version ? ` ${version}` : " 未安装"}${range ? `，模板要求 ${range}` : ""}。将先生成文件，完成页会提供安装指引。`);
    config.installDeps = false;
  }
}

function showCreationPlan(name: string, template: SelectedTemplate, config: ProjectConfig, options: CreateOptions, selection?: TrimSelection): void {
  const lines = [
    `产品名称  ${config.title}`,
    `项目目录  ${path.resolve(name)}`,
    `项目模板  ${template.name}${template.status === "beta" ? " · Beta" : ""}`,
    selection ? `用途预设  ${getTrimSummary(selection)}` : "",
    `运行要求  Node ${template.runtime?.node || "以下载后的 package.json 为准"}`,
    `包管理器  ${config.packageManager}${template.runtime?.packageManagerVersion ? ` ${template.runtime.packageManagerVersion}` : ""}`,
    `初始化    ${config.initGit ? "Git main 分支" : "不初始化 Git"} · ${config.installDeps ? "安装依赖" : "跳过依赖安装"}`,
    `模板来源  ${template.repoUrl}${template.branch ? ` #${template.branch}` : ""}`,
    `缓存策略  ${options.noCache ? "重新下载，忽略缓存" : "优先有效缓存，过期后刷新"}`,
  ].filter(Boolean);
  p.note(lines.join("\n"), options.dryRun ? "创建计划 · 预览" : "创建计划");
  const guidance = getProjectGuidance(template, config);
  if (guidance.length) p.note(guidance.join("\n"), "开始前了解");
  if (options.dryRun) p.log.info("执行时会读取下载后的真实运行契约；版本不兼容会在写入项目之前停止。");
}

async function executeCreation(name: string, selectedTemplate: SelectedTemplate, config: ProjectConfig, options: CreateOptions, selection?: TrimSelection): Promise<boolean> {
  const projectPath = path.resolve(name);
  const spinner = ora({ text: "准备项目…", color: "cyan" }).start();
  const controller = new AbortController();
  const onInterrupt = () => controller.abort(new Error("已取消创建"));
  const checkCancelled = () => { if (controller.signal.aborted) throw new CreationCancelled(); };
  process.once("SIGINT", onInterrupt);
  let downloaded: DownloadedTemplate | undefined;
  let backupPath: string | undefined;
  let projectCreated = false;
  let generationComplete = false;
  let template = selectedTemplate;
  try {
    if (await fs.pathExists(projectPath)) {
      spinner.stop();
      if (options.yes) throw new Error(`目录已存在：${projectPath}。--yes 不会覆盖已有文件，请使用新目录或交互式创建。`);
      p.log.warn(`目录已存在：${projectPath}`);
      const overwrite = answer(await p.confirm({ message: "备份现有目录后，用新项目替换？创建失败将自动恢复。", initialValue: false }));
      if (!overwrite) throw new CreationCancelled();
      backupPath = path.join(path.dirname(projectPath), `.${name.slice(0, 80)}.robot-backup-${randomUUID()}`);
      spinner.start("先下载并校验模板，现有目录暂不改动…");
    }
    downloaded = await downloadTemplate(template, { spinner, noCache: options.noCache, signal: controller.signal });
    template = await resolveDownloadedTemplateRuntime(downloaded.path, template);
    checkInstallAvailability(template, config);
    checkCancelled();
    if (backupPath) await fs.move(projectPath, backupPath);
    // Claim an empty directory atomically; a concurrently created path is never ours to delete.
    await fs.mkdir(projectPath);
    projectCreated = true;
    spinner.text = "复制项目与团队配置…";
    await copyTemplate(downloaded.path, projectPath, spinner);
    checkCancelled();
    if (selection && selection.mode !== "full") await executeTrimming(projectPath, selection, spinner);
    checkCancelled();
    spinner.text = "写入产品名称与项目配置…";
    await processProjectConfig(projectPath, name, template, config);
    checkCancelled();
    if (template.initializer) await runTemplateInitializer(projectPath, name, template, config, spinner, controller.signal);
    checkCancelled();
    await writeProjectGuide(projectPath, name, template, config, downloaded, selection);
    checkCancelled();
    let gitInitialized = false;
    if (config.initGit) {
      spinner.text = "初始化 Git main 分支…";
      gitInitialized = initializeGitRepository(projectPath);
    }
    checkCancelled();
    generationComplete = true;
    // Dependency installation is recoverable: preserve a fully generated project.
    let installed: boolean | null = null;
    if (config.installDeps) {
      spinner.stop();
      p.log.step(`安装依赖 · ${config.packageManager} install`);
      installed = await installDependencies(projectPath, undefined, config.packageManager, controller.signal);
      spinner.start("整理启动指引…");
    }
    if (backupPath) {
      const completedBackup = backupPath;
      backupPath = undefined;
      if (installed === false) {
        p.log.warn(`新项目已保留，原目录备份位于 ${completedBackup}。确认安装成功后可手动删除备份。`);
      } else {
        await fs.remove(completedBackup).catch(() => p.log.warn(`旧目录备份保留在 ${completedBackup}，可在确认新项目后手动删除。`));
      }
    }
    spinner.succeed(installed === false ? "项目文件已生成，依赖安装需要重试" : "项目文件已准备好");
    const start = await getProjectStartCommand(projectPath, template, config.packageManager);
    p.note([
      `cd ${name}`, ...(installed === true ? [] : [`${config.packageManager} install`]),
      start || "按 README 与 package.json 选择项目运行方式（未声明 dev/start）。",
    ].join("\n"), "下一步 · 启动项目");
    p.note([
      `目录  ${projectPath}`,
      `来源  ${downloaded.source || template.repoUrl}${downloaded.fromCache ? " · 缓存" : ""}`,
      `提交  ${downloaded.revision ? downloaded.revision.slice(0, 12) : "未提供（归档下载或旧缓存）"}`,
      `Git   ${gitInitialized ? "main 分支，已创建首次提交" : config.initGit ? "首次提交未完成，请检查 Git 身份配置" : "未初始化"}`,
      `依赖  ${installed === true ? "安装完成" : installed === false ? "安装失败，项目文件已保留" : "未安装"}`,
      "指引  ROBOT_PROJECT.md · 项目配置、检查命令与接入事项",
      "状态  已生成项目文件，尚未验证正式接口与部署环境",
    ].join("\n"), "创建结果");
    const guidance = getProjectGuidance(template, config);
    if (guidance.length) p.note(guidance.join("\n"), "首次运行提示");
    if (installed === false) process.exitCode = 1;
    p.outro(installed === false ? "按上方命令重试安装后即可继续。" : "准备就绪，从第一条启动命令开始。");
    return installed !== false;
  } catch (error) {
    if (projectCreated && !generationComplete) await fs.remove(projectPath).catch(() => {});
    if (backupPath && generationComplete) {
      p.log.warn(`项目文件已保留在 ${projectPath}，原目录备份位于 ${backupPath}。`);
    } else if (backupPath && await fs.pathExists(backupPath)) {
      try {
        await fs.move(backupPath, projectPath);
        p.log.warn("创建未完成，原目录已恢复。");
      } catch (restoreError) {
        throw new Error(`${(error as Error).message}\n原目录恢复失败，备份保留在：${backupPath}\n${(restoreError as Error).message}`);
      }
    }
    if (spinner.isSpinning) spinner.stop();
    if (controller.signal.aborted) throw new CreationCancelled();
    throw error;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    if (downloaded?.cleanupPath) await fs.remove(downloaded.cleanupPath).catch(() => {});
  }
}

async function processProjectConfig(projectPath: string, name: string, template: SelectedTemplate, config: ProjectConfig): Promise<void> {
  const pkgPath = path.join(projectPath, "package.json");
  const pkg = await fs.readJson(pkgPath);
  pkg.name = name;
  pkg.description = config.description || `基于 ${template.name} 创建的项目`;
  if (config.author) pkg.author = config.author;
  else delete pkg.author;
  delete pkg.repository;
  delete pkg.bugs;
  delete pkg.homepage;
  await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  for (const [from, to] of [["_gitignore", ".gitignore"], ["_env.example", ".env.example"]]) {
    const source = path.join(projectPath, from);
    if (await fs.pathExists(source)) await fs.move(source, path.join(projectPath, to), { overwrite: false });
  }
  if (template.key === "robot-admin" && config.title) {
    const envPath = path.join(projectPath, "envs/.env");
    if (await fs.pathExists(envPath)) {
      const env = await fs.readFile(envPath, "utf8");
      const title = JSON.stringify(config.title).replace(/\$/g, "\\$");
      await fs.writeFile(envPath, env.replace(/^VITE_APP_TITLE\s*=.*$/m, () => `VITE_APP_TITLE=${title}`));
    }
  }
}

function initializeGitRepository(projectPath: string): boolean {
  try {
    execFileSync("git", ["init", "-b", "main"], { cwd: projectPath, stdio: "ignore", timeout: 10_000 });
    execFileSync("git", ["add", "."], { cwd: projectPath, stdio: "ignore", timeout: 30_000 });
    execFileSync("git", ["commit", "-m", "feat: 初始化项目"], { cwd: projectPath, stdio: "ignore", timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}
