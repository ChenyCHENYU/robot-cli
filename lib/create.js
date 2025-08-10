// lib/create.js - 完整优化版，移除缓存功能 + 美化展示
import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { execSync } from "child_process";
import { downloadTemplate } from "./download.js";
import {
  TEMPLATE_CATEGORIES,
  getAllTemplates,
  getTemplatesByCategory,
  searchTemplates,
  getRecommendedTemplates,
} from "./templates.js";
import {
  validateProjectName,
  copyTemplate,
  installDependencies,
  generateProjectStats,
  printProjectStats,
} from "./utils.js";

/**
 * 创建项目主函数
 */
export async function createProject(projectName, options = {}) {
  console.log();
  console.log(chalk.cyan("🚀 Robot CLI - 开始创建项目"));
  console.log();

  // 1. 选择模板
  const template = await selectTemplate(options.template);

  // 2. 处理项目名称
  const finalProjectName = await handleProjectName(projectName, template);

  // 3. 项目配置选项
  const projectConfig = await configureProject(options);

  // 4. 确认创建
  await confirmCreation(finalProjectName, template, projectConfig);

  // 5. 创建项目
  await executeCreation(finalProjectName, template, projectConfig);
}

/**
 * 处理项目名称
 */
async function handleProjectName(projectName, template) {
  if (projectName) {
    // 验证项目名称
    const validation = validateProjectName(projectName);
    if (!validation.valid) {
      console.log(chalk.red("❌ 项目名称不合法:"));
      validation.errors.forEach((error) => {
        console.log(chalk.red(`   ${error}`));
      });
      console.log();

      const { newName } = await inquirer.prompt([
        {
          type: "input",
          name: "newName",
          message: "请输入新的项目名称:",
          validate: (input) => {
            const result = validateProjectName(input);
            return result.valid || result.errors[0];
          },
        },
      ]);
      return newName;
    }
    return projectName;
  } else {
    // 根据模板名称生成默认项目名称
    const defaultName = generateDefaultProjectName(template);

    const { name } = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "请输入项目名称:",
        default: defaultName,
        validate: (input) => {
          if (!input.trim()) return "项目名称不能为空";
          const result = validateProjectName(input);
          return result.valid || result.errors[0];
        },
      },
    ]);
    return name;
  }
}

/**
 * 根据模板生成默认项目名称
 */
function generateDefaultProjectName(template) {
  if (!template) return "my-project";

  const templateKey = template.key || "project";
  const timestamp = Date.now().toString().slice(-4);

  // 移除版本后缀 (-full, -lite)
  const baseName = templateKey.replace(/-(full|lite|base)$/, "");

  return `my-${baseName}-${timestamp}`;
}

/**
 * 选择模板 - 多种方式（带返回功能）
 */
async function selectTemplate(templateOption) {
  if (templateOption) {
    // 命令行指定了模板
    const allTemplates = getAllTemplates();
    if (allTemplates[templateOption]) {
      return { key: templateOption, ...allTemplates[templateOption] };
    } else {
      console.log(chalk.yellow(`⚠️  模板 "${templateOption}" 不存在`));
      console.log();
    }
  }

  // 交互式选择 - 主选择方式
  return await selectTemplateMethod();
}

/**
 * 选择模板方式 - 优化主菜单
 */
async function selectTemplateMethod() {
  console.log();
  console.log(chalk.blue.bold("🎯 选择模板创建方式"));
  console.log(chalk.dim("请选择最适合你的模板浏览方式"));
  console.log();

  const { selectionMode } = await inquirer.prompt([
    {
      type: "list",
      name: "selectionMode",
      message: "模板选择方式:",
      choices: [
        { 
          name: `${chalk.white('●')} ${chalk.bold('推荐模板')} ${chalk.dim('(常用模板快速选择) - 基于团队使用频率推荐的热门模板')}`, 
          value: "recommended" 
        },
        {
          name: chalk.dim("─".repeat(70)),
          value: "sep1",
          disabled: "─"
        },
        { 
          name: `${chalk.white('●')} ${chalk.bold('分类模板')} ${chalk.dim('(按项目类型分类选择) - 前端、后端、移动端、桌面端分类浏览')}`, 
          value: "category" 
        },
        {
          name: chalk.dim("─".repeat(70)),
          value: "sep2",
          disabled: "─"
        },
        { 
          name: `${chalk.white('●')} ${chalk.bold('搜索模板')} ${chalk.dim('(关键词搜索) - 通过技术栈、功能特性等关键词快速查找')}`, 
          value: "search" 
        },
        {
          name: chalk.dim("─".repeat(70)),
          value: "sep3",
          disabled: "─"
        },
        { 
          name: `${chalk.white('●')} ${chalk.bold('全部模板')} ${chalk.dim('(查看所有可用模板) - 按分类展示所有可用的项目模板')}`, 
          value: "all" 
        },
      ],
      pageSize: 10
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

/**
 * 从推荐模板中选择 - 优化后的展示
 */
async function selectFromRecommended() {
  const recommended = getRecommendedTemplates();

  if (Object.keys(recommended).length === 0) {
    console.log(chalk.yellow("⚠️  暂无推荐模板"));
    return await selectTemplateMethod();
  }

  console.log();
  console.log(chalk.blue.bold("🎯 推荐模板"));
  console.log(chalk.dim("基于团队使用频率和项目成熟度推荐"));
  console.log();

  // 创建更美观的选择项
  const choices = Object.entries(recommended).map(([key, template]) => {
    // 构建特性标签
    const featureTags = template.features.slice(0, 3).map(f => 
      chalk.dim(`[${f}]`)
    ).join(' ');
    
    // 版本标签 - 只保留方括号内的版本
    const versionTag = template.version === 'full' ? 
      chalk.green('[完整版]') : 
      chalk.yellow('[精简版]');

    return {
      name: `${chalk.bold.white(template.name.replace(/\s*(完整版|精简版)\s*$/, ''))} ${versionTag} - ${chalk.dim(template.description)}
   ${chalk.dim(featureTags)}${template.features.length > 3 ? chalk.dim(` +${template.features.length - 3}more`) : ''}`,
      value: { key, ...template },
      short: template.name,
    };
  });

  // 为每个推荐模板添加分隔符
  const choicesWithSeparators = [];
  choices.forEach((choice, index) => {
    choicesWithSeparators.push(choice);
    if (index < choices.length - 1) {
      choicesWithSeparators.push({
        name: chalk.dim("─".repeat(70)),
        value: `sep_${index}`,
        disabled: "─"
      });
    }
  });

  choicesWithSeparators.push({
    name: chalk.dim("⬅️  返回选择其他方式"),
    value: "back",
  });

  const { selectedTemplate } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedTemplate",
      message: "选择推荐模板:",
      choices: choicesWithSeparators,
      pageSize: 15,
      loop: false
    },
  ]);

  if (selectedTemplate === "back") {
    return await selectTemplateMethod();
  }

  return selectedTemplate;
}

/**
 * 按分类选择模板（完整的返回功能）
 */
async function selectByCategory() {
  // 1. 选择项目类型
  while (true) {
    const categoryResult = await selectCategory();
    if (categoryResult === "back_to_method") {
      return await selectTemplateMethod();
    }

    // 2. 选择技术栈
    const stackResult = await selectStack(categoryResult);
    if (stackResult === "back_to_category") {
      continue; // 返回到项目类型选择
    }
    if (stackResult === "back_to_method") {
      return await selectTemplateMethod();
    }

    // 3. 选择架构模式
    const patternResult = await selectPattern(categoryResult, stackResult);
    if (patternResult === "back_to_stack") {
      continue; // 返回到技术栈选择，会重新开始while循环
    }
    if (patternResult === "back_to_category") {
      continue; // 返回到项目类型选择
    }
    if (patternResult === "back_to_method") {
      return await selectTemplateMethod();
    }

    // 4. 选择具体模板
    const templateResult = await selectSpecificTemplate(
      categoryResult,
      stackResult,
      patternResult
    );
    if (templateResult === "back_to_pattern") {
      continue; // 返回到架构模式选择
    }
    if (templateResult === "back_to_stack") {
      continue; // 返回到技术栈选择
    }
    if (templateResult === "back_to_category") {
      continue; // 返回到项目类型选择
    }
    if (templateResult === "back_to_method") {
      return await selectTemplateMethod();
    }

    // 成功选择了模板
    return templateResult;
  }
}

/**
 * 选择项目类型
 */
async function selectCategory() {
  const categoryChoices = Object.entries(TEMPLATE_CATEGORIES).map(
    ([key, category]) => ({
      name: category.name,
      value: key,
    })
  );

  categoryChoices.push({
    name: chalk.dim("← 返回模板选择方式"),
    value: "back_to_method",
  });

  const { categoryKey } = await inquirer.prompt([
    {
      type: "list",
      name: "categoryKey",
      message: "请选择项目类型:",
      choices: categoryChoices,
    },
  ]);

  return categoryKey;
}

/**
 * 选择技术栈
 */
async function selectStack(categoryKey) {
  if (categoryKey === "back_to_method") return categoryKey;

  const category = TEMPLATE_CATEGORIES[categoryKey];
  const stackChoices = Object.entries(category.stacks).map(([key, stack]) => ({
    name: stack.name,
    value: key,
  }));

  stackChoices.push(
    {
      name: chalk.dim("─────────────────────"),
      value: "separator",
      disabled: true,
    },
    { name: chalk.dim("← 返回项目类型选择"), value: "back_to_category" },
    { name: chalk.dim("← 返回模板选择方式"), value: "back_to_method" }
  );

  if (stackChoices.length === 3) {
    // 只有一个技术栈 + 分隔线 + 返回选项
    return stackChoices[0].value;
  }

  const { stackKey } = await inquirer.prompt([
    {
      type: "list",
      name: "stackKey",
      message: "请选择技术栈:",
      choices: stackChoices,
    },
  ]);

  return stackKey;
}

/**
 * 选择架构模式
 */
async function selectPattern(categoryKey, stackKey) {
  if (["back_to_category", "back_to_method"].includes(stackKey))
    return stackKey;

  const category = TEMPLATE_CATEGORIES[categoryKey];
  const stack = category.stacks[stackKey];
  const patternChoices = Object.entries(stack.patterns).map(
    ([key, pattern]) => ({
      name: pattern.name,
      value: key,
    })
  );

  patternChoices.push(
    {
      name: chalk.dim("─────────────────────"),
      value: "separator",
      disabled: true,
    },
    { name: chalk.dim("← 返回技术栈选择"), value: "back_to_stack" },
    { name: chalk.dim("← 返回项目类型选择"), value: "back_to_category" },
    { name: chalk.dim("← 返回模板选择方式"), value: "back_to_method" }
  );

  if (patternChoices.length === 4) {
    // 只有一个模式 + 分隔线 + 返回选项
    return patternChoices[0].value;
  }

  const { patternKey } = await inquirer.prompt([
    {
      type: "list",
      name: "patternKey",
      message: "请选择架构模式:",
      choices: patternChoices,
    },
  ]);

  return patternKey;
}

/**
 * 选择具体模板
 */
async function selectSpecificTemplate(categoryKey, stackKey, patternKey) {
  if (
    ["back_to_stack", "back_to_category", "back_to_method"].includes(patternKey)
  ) {
    return patternKey;
  }

  const templates = getTemplatesByCategory(categoryKey, stackKey, patternKey);
  const templateChoices = Object.entries(templates).map(([key, template]) => ({
    name: `${template.name} - ${chalk.dim(template.description)}`,
    value: { key, ...template },
    short: template.name,
  }));

  templateChoices.push(
    {
      name: chalk.dim("─────────────────────"),
      value: "separator",
      disabled: true,
    },
    { name: chalk.dim("← 返回架构模式选择"), value: "back_to_pattern" },
    { name: chalk.dim("← 返回技术栈选择"), value: "back_to_stack" },
    { name: chalk.dim("← 返回项目类型选择"), value: "back_to_category" },
    { name: chalk.dim("← 返回模板选择方式"), value: "back_to_method" }
  );

  const { selectedTemplate } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedTemplate",
      message: "请选择模板版本:",
      choices: templateChoices,
    },
  ]);

  return selectedTemplate;
}

/**
 * 搜索选择模板 - 优化结果展示
 */
async function selectBySearch() {
  while (true) {
    const { keyword } = await inquirer.prompt([
      {
        type: "input",
        name: "keyword",
        message: "请输入搜索关键词 (名称、描述、技术栈):",
        validate: (input) => (input.trim() ? true : "关键词不能为空"),
      },
    ]);

    const results = searchTemplates(keyword);

    if (Object.keys(results).length === 0) {
      console.log();
      console.log(chalk.yellow("🔍 没有找到匹配的模板"));
      console.log(chalk.dim(`搜索关键词: "${keyword}"`));
      console.log();

      const { action } = await inquirer.prompt([
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

      if (action === "retry") {
        continue;
      } else {
        return await selectTemplateMethod();
      }
    }

    console.log();
    console.log(chalk.green.bold(`🔍 搜索结果`));
    console.log(chalk.dim(`关键词: "${keyword}" • 找到 ${Object.keys(results).length} 个匹配模板`));
    console.log();

    const choices = Object.entries(results).map(([key, template]) => {
      // 高亮匹配的关键词
      const highlightText = (text) => {
        const regex = new RegExp(`(${keyword})`, 'gi');
        return text.replace(regex, chalk.bgYellow.black('$1'));
      };

      const techInfo = template.features.slice(0, 2).join(' • ');
      const versionTag = template.version === 'full' ? 
        chalk.green('[完整版]') : chalk.yellow('[精简版]');

      return {
        name: `${chalk.bold(highlightText(template.name.replace(/\s*(完整版|精简版)\s*$/, '')))} ${versionTag}
   ${chalk.dim(highlightText(template.description))}
   ${chalk.dim(`${techInfo} • 模板key: ${key}`)}
   ${chalk.dim('─'.repeat(60))}`,
        value: { key, ...template },
        short: template.name,
      };
    });

    choices.push(
      {
        name: chalk.dim("━".repeat(70)),
        value: "separator",
        disabled: "━",
      },
      { name: "🔍 重新搜索", value: "search_again" },
      { name: "⬅️  返回模板选择方式", value: "back_to_mode" }
    );

    const { selectedTemplate } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedTemplate",
        message: "选择模板:",
        choices,
        pageSize: 15,
        loop: false
      },
    ]);

    if (selectedTemplate === "search_again") {
      continue;
    } else if (selectedTemplate === "back_to_mode") {
      return await selectTemplateMethod();
    } else {
      return selectedTemplate;
    }
  }
}

/**
 * 从全部模板中选择 - 优化后的展示
 */
async function selectFromAll() {
  const allTemplates = getAllTemplates();

  console.log();
  console.log(chalk.blue.bold(`📋 所有可用模板`));
  console.log(chalk.dim(`共 ${Object.keys(allTemplates).length} 个模板可选`));
  console.log();

  // 按分类组织模板
  const categorizedChoices = [];
  
  // 前端模板
  categorizedChoices.push({
    name: chalk.yellow.bold("🎨 前端项目"),
    value: "frontend_header",
    disabled: "🎨"
  });

  Object.entries(allTemplates)
    .filter(([key]) => key.includes('admin') || key.includes('react') || key.includes('micro'))
    .forEach(([key, template]) => {
      const techStack = key.includes('admin') ? 'Vue3' : 
                       key.includes('react') ? 'React' : 'Vue3';
      const versionTag = template.version === 'full' ? 
        chalk.green('[完整版]') : chalk.yellow('[精简版]');
      
      categorizedChoices.push({
        name: `  ${chalk.white('●')} ${chalk.bold(template.name.replace(/\s*(完整版|精简版)\s*$/, ''))} ${versionTag} - ${chalk.dim(template.description)}
     ${chalk.dim(`技术栈: ${techStack} • 命令: robot create my-app -t ${key}`)}`,
        value: { key, ...template },
        short: template.name
      });
      
      // 添加分隔符
      categorizedChoices.push({
        name: chalk.dim("    " + "─".repeat(66)),
        value: `sep_${key}`,
        disabled: "─"
      });
    });

  // 移动端模板
  categorizedChoices.push({
    name: chalk.yellow.bold("📱 移动端项目"),
    value: "mobile_header", 
    disabled: "📱"
  });

  Object.entries(allTemplates)
    .filter(([key]) => key.includes('uniapp') || key.includes('tarao'))
    .forEach(([key, template]) => {
      const versionTag = template.version === 'full' ? 
        chalk.green('[完整版]') : chalk.yellow('[精简版]');
      
      categorizedChoices.push({
        name: `  ${chalk.white('●')} ${chalk.bold(template.name.replace(/\s*(完整版|精简版)\s*$/, ''))} ${versionTag} - ${chalk.dim(template.description)}
     ${chalk.dim(`跨平台: 小程序/H5/App • 命令: robot create my-app -t ${key}`)}`,
        value: { key, ...template },
        short: template.name
      });
      
      // 添加分隔符
      categorizedChoices.push({
        name: chalk.dim("    " + "─".repeat(66)),
        value: `sep_${key}`,
        disabled: "─"
      });
    });

  // 后端模板
  categorizedChoices.push({
    name: chalk.yellow.bold("🚀 后端项目"),
    value: "backend_header",
    disabled: "🚀"
  });

  Object.entries(allTemplates)
    .filter(([key]) => key.includes('nest') || key.includes('koa'))
    .forEach(([key, template]) => {
      const framework = key.includes('nest') ? 'NestJS' : 'Koa3';
      const versionTag = template.version === 'full' ? 
        chalk.green('[完整版]') : chalk.yellow('[精简版]');
      
      categorizedChoices.push({
        name: `  ${chalk.white('●')} ${chalk.bold(template.name.replace(/\s*(完整版|精简版)\s*$/, ''))} ${versionTag} - ${chalk.dim(template.description)}
     ${chalk.dim(`框架: ${framework} • 命令: robot create my-app -t ${key}`)}`,
        value: { key, ...template },
        short: template.name
      });
      
      // 添加分隔符
      categorizedChoices.push({
        name: chalk.dim("    " + "─".repeat(66)),
        value: `sep_${key}`,
        disabled: "─"
      });
    });

  // 桌面端模板
  categorizedChoices.push({
    name: chalk.yellow.bold("💻 桌面端项目"),
    value: "desktop_header",
    disabled: "💻"
  });

  Object.entries(allTemplates)
    .filter(([key]) => key.includes('electron') || key.includes('tauri'))
    .forEach(([key, template]) => {
      const framework = key.includes('electron') ? 'Electron' : 'Tauri';
      const versionTag = template.version === 'full' ? 
        chalk.green('[完整版]') : chalk.yellow('[精简版]');
      
      categorizedChoices.push({
        name: `  ${chalk.white('●')} ${chalk.bold(template.name.replace(/\s*(完整版|精简版)\s*$/, ''))} ${versionTag} - ${chalk.dim(template.description)}
     ${chalk.dim(`框架: ${framework} • 命令: robot create my-app -t ${key}`)}`,
        value: { key, ...template },
        short: template.name
      });
      
      // 添加分隔符
      categorizedChoices.push({
        name: chalk.dim("    " + "─".repeat(66)),
        value: `sep_${key}`,
        disabled: "─"
      });
    });

  // 添加返回选项
  categorizedChoices.push(
    {
      name: chalk.dim("━".repeat(70)),
      value: "separator",
      disabled: "━",
    },
    { 
      name: chalk.dim("⬅️  返回模板选择方式"), 
      value: "back_to_mode" 
    }
  );

  const { selectedTemplate } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedTemplate",
      message: "选择模板:",
      choices: categorizedChoices,
      pageSize: 25,
      loop: false
    },
  ]);

  if (selectedTemplate === "back_to_mode") {
    return await selectTemplateMethod();
  }

  return selectedTemplate;
}

/**
 * 项目配置选项 - 移除缓存相关配置
 */
async function configureProject(options) {
  console.log();
  console.log(chalk.blue("⚙️  项目配置"));
  console.log();

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
      choices: [
        { name: "bun (推荐 - 极速安装，现代化)", value: "bun" },
        { name: "pnpm (推荐 - 快速安装，节省空间)", value: "pnpm" },
        { name: "yarn (兼容 - 适用于现有yarn项目)", value: "yarn" },
        { name: "npm (兼容 - Node.js默认)", value: "npm" },
      ],
      default: "bun",
      when: (answers) => answers.installDeps,
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
      default: "CHENY",
    },
    {
      type: "confirm",
      name: "confirmConfig",
      message: "确认以上配置?",
      default: true,
    },
  ]);

  if (!config.confirmConfig) {
    const { action } = await inquirer.prompt([
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

    if (action === "reconfigure") {
      return await configureProject(options);
    } else {
      console.log(chalk.yellow("❌ 取消创建项目"));
      process.exit(0);
    }
  }

  return config;
}

/**
 * 确认创建 - 移除缓存相关信息显示
 */
async function confirmCreation(projectName, template, projectConfig) {
  console.log();
  console.log(chalk.blue("📋 项目创建信息确认:"));
  console.log();
  console.log(`  项目名称: ${chalk.cyan(projectName)}`);
  console.log(`  选择模板: ${chalk.cyan(template.name)}`);
  console.log(`  模板描述: ${chalk.dim(template.description)}`);
  console.log(`  包含功能: ${chalk.dim(template.features.join(", "))}`);

  if (projectConfig.description) {
    console.log(`  项目描述: ${chalk.dim(projectConfig.description)}`);
  }

  if (projectConfig.author) {
    console.log(`  作　　者: ${chalk.dim(projectConfig.author)}`);
  }

  console.log(
    `  初始化Git: ${
      projectConfig.initGit ? chalk.green("是") : chalk.dim("否")
    }`
  );
  console.log(
    `  安装依赖: ${
      projectConfig.installDeps
        ? chalk.green("是") + chalk.dim(` (${projectConfig.packageManager})`)
        : chalk.dim("否")
    }`
  );
  console.log(`  源码仓库: ${chalk.dim(template.repoUrl)}`);
  console.log();

  const { confirmed } = await inquirer.prompt([
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

/**
 * 执行创建流程 - 简化版本，总是下载最新模板
 */
async function executeCreation(projectName, template, projectConfig) {
  if (!projectName || typeof projectName !== "string") {
    throw new Error(`项目名称无效: ${projectName}`);
  }

  if (!template || !template.name) {
    throw new Error(`模板数据无效: ${JSON.stringify(template)}`);
  }

  const spinner = ora({
    text: "🚀 准备创建项目...",
    spinner: 'dots',
    color: 'cyan'
  }).start();

  let tempTemplatePath; // 用于清理临时文件

  try {
    // 1. 检查目录是否存在
    spinner.text = "📁 检查项目目录...";
    const projectPath = path.resolve(projectName);
    if (fs.existsSync(projectPath)) {
      spinner.stop();
      console.log(chalk.yellow("⚠️  项目目录已存在"));

      const { overwrite } = await inquirer.prompt([
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

    // 2. 下载最新模板
    spinner.text = "🌐 下载最新模板...";
    try {
      tempTemplatePath = await downloadTemplate(template, { spinner });

      if (!tempTemplatePath || !fs.existsSync(tempTemplatePath)) {
        throw new Error(`模板路径无效: ${tempTemplatePath}`);
      }
    } catch (error) {
      spinner.fail("模板下载失败");
      console.log();
      console.log(chalk.red("❌ 模板下载错误:"));
      console.log(chalk.dim(`   ${error.message}`));
      console.log();
      console.log(chalk.blue("💡 可能的解决方案:"));
      console.log(chalk.dim("   1. 检查网络连接"));
      console.log(chalk.dim("   2. 重试命令"));
      console.log(chalk.dim("   3. 检查仓库地址是否正确"));
      console.log();
      throw error;
    }

    // 3. 复制模板文件 - 带详细进度
    await copyTemplate(tempTemplatePath, projectPath, spinner);

    // 4. 处理项目配置
    spinner.text = "⚙️  处理项目配置...";
    await processProjectConfig(
      projectPath,
      projectName,
      template,
      projectConfig
    );

    // 5. 初始化Git仓库
    if (projectConfig.initGit) {
      spinner.text = "📝 初始化 Git 仓库...";
      await initializeGitRepository(projectPath);
    }

    // 6. 安装依赖
    if (projectConfig.installDeps) {
      spinner.text = `📦 使用 ${projectConfig.packageManager} 安装依赖...`;
      await installDependencies(
        projectPath,
        spinner,
        projectConfig.packageManager
      );
    }

    // 7. 清理临时文件
    if (tempTemplatePath) {
      spinner.text = "🧹 清理临时文件...";
      await fs.remove(tempTemplatePath).catch(() => {});
    }

    // 8. 创建成功
    spinner.succeed(chalk.green("🎉 项目创建成功!"));

    console.log();
    console.log(chalk.green("🎉 项目创建完成!"));
    console.log();
    console.log(chalk.blue("📁 项目信息:"));
    console.log(`   位置: ${chalk.cyan(projectPath)}`);
    console.log(`   模板: ${chalk.cyan(template.name)}`);
    console.log(
      `   Git仓库: ${
        projectConfig.initGit ? chalk.green("已初始化") : chalk.dim("未初始化")
      }`
    );
    console.log(
      `   依赖安装: ${
        projectConfig.installDeps
          ? chalk.green("已完成")
          : chalk.dim("需手动安装")
      }`
    );
    console.log();
    console.log(chalk.blue("🚀 快速开始:"));
    console.log(chalk.cyan(`   cd ${projectName}`));
    if (!projectConfig.installDeps) {
      console.log(
        chalk.cyan(`   ${projectConfig.packageManager || "npm"} install`)
      );
    }

    const startCommand = getStartCommand(template);
    if (startCommand) {
      console.log(chalk.cyan(`   ${startCommand}`));
    }
    console.log();

    // 显示项目统计
    spinner.start("📊 统计项目信息...");
    const stats = await generateProjectStats(projectPath);
    spinner.stop();
    
    if (stats) {
      printProjectStats(stats);
      console.log();
    }
  } catch (error) {
    // 清理临时文件
    if (tempTemplatePath) {
      await fs.remove(tempTemplatePath).catch(() => {});
    }
    
    spinner.fail("创建项目失败");
    throw error;
  }
}

/**
 * 处理项目配置
 */
async function processProjectConfig(
  projectPath,
  projectName,
  template,
  projectConfig
) {
  // 更新 package.json
  const packageJsonPath = path.join(projectPath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    packageJson.name = projectName;

    if (projectConfig.description) {
      packageJson.description = projectConfig.description;
    } else {
      packageJson.description = `基于 ${template.name} 创建的项目`;
    }

    if (projectConfig.author) {
      packageJson.author = projectConfig.author;
    }

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }

  // 处理 README.md
  const readmePath = path.join(projectPath, "README.md");
  if (fs.existsSync(readmePath)) {
    let readme = await fs.readFile(readmePath, "utf8");
    readme = readme.replace(/# .+/, `# ${projectName}`);

    const description =
      projectConfig.description || `基于 ${template.name} 创建的项目`;
    readme = readme.replace(/项目描述.*/, description);

    if (projectConfig.author) {
      readme += `\n\n## 作者\n\n${projectConfig.author}\n`;
    }

    await fs.writeFile(readmePath, readme);
  }

  // 处理 .gitignore (如果是 _gitignore)
  const gitignoreSource = path.join(projectPath, "_gitignore");
  const gitignoreDest = path.join(projectPath, ".gitignore");
  if (fs.existsSync(gitignoreSource)) {
    await fs.move(gitignoreSource, gitignoreDest);
  }

  // 处理 .env.example
  const envSource = path.join(projectPath, "_env.example");
  const envDest = path.join(projectPath, ".env.example");
  if (fs.existsSync(envSource)) {
    await fs.move(envSource, envDest);
  }
}

/**
 * 初始化Git仓库
 */
async function initializeGitRepository(projectPath) {
  const originalCwd = process.cwd();

  try {
    process.chdir(projectPath);

    // 检查是否安装了git
    execSync("git --version", { stdio: "ignore" });

    // 初始化git仓库
    execSync("git init", { stdio: "ignore" });
    execSync("git add .", { stdio: "ignore" });
    execSync('git commit -m "feat: 初始化项目"', { stdio: "ignore" });
  } catch (error) {
    // Git不可用，跳过初始化
    console.log(chalk.yellow("⚠️  Git 不可用，跳过仓库初始化"));
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * 获取启动命令
 */
function getStartCommand(template) {
  if (!template.key) return "bun run dev";

  const startCommands = {
    // Vue前端项目
    "robot-admin": "bun run dev",
    "robot-admin-base": "bun run dev",
    "robot-monorepo": "bun run dev:packages",
    "robot-monorepo-base": "bun run dev",
    "robot-micro": "bun run dev:main",
    "robot-micro-base": "bun run dev",

    // React前端项目
    "robot-react": "bun run start",
    "robot-react-base": "bun run start",

    // 移动端项目
    "robot-uniapp": "bun run dev:h5",
    "robot-uniapp-base": "bun run dev:h5",
    "robot-tarao": "bun run android",
    "robot-tarao-base": "bun run android",

    // 后端项目
    "robot-nest": "bun run start:dev",
    "robot-nest-base": "bun run start:dev",
    "robot-nest-micro": "bun run start:dev",
    "robot-koa": "bun run dev",
    "robot-koa-base": "bun run dev",

    // 桌面端项目
    "robot-electron": "bun run electron:dev",
    "robot-electron-base": "bun run electron:dev",
    "robot-tauri": "bun run tauri dev",
    "robot-tauri-base": "bun run tauri dev",
  };

  return startCommands[template.key] || "bun run dev";
}