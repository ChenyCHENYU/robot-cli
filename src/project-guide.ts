import fs from "fs-extra";
import path from "node:path";
import type { DownloadedTemplate, ProjectConfig, SelectedTemplate } from "./types";
import { getTrimSummary, type TrimSelection } from "./trimmer";
import { START_COMMAND_MAP } from "./config";

/** Suggest only a script that is present in the generated package. */
export async function getProjectStartCommand(root: string, template: SelectedTemplate, manager: ProjectConfig["packageManager"]): Promise<string | undefined> {
  const pkg = await fs.readJson(path.join(root, "package.json"));
  const candidates = [template.startScript, START_COMMAND_MAP[template.key], "dev", "start"];
  const script = candidates.find((name) => name && typeof pkg.scripts?.[name] === "string" && pkg.scripts[name].trim());
  return script ? `${manager} run ${script}` : undefined;
}

/** Guidance describes the delivered template, including integration still needed. */
export function getProjectGuidance(template: SelectedTemplate, config: ProjectConfig): string[] {
  const notes: string[] = [];
  if (template.key === "robot-admin") {
    notes.push("本地演示含 Mock；正式接入请核对 envs/ 中的接口、认证和菜单配置。");
  } else if (template.key === "robot-h5") {
    notes.push("H5 Beta · 当前模板包含 wl-mbase 集成环境，请先核对 project.config.json 与 build/environments.json。");
    notes.push("构建环境由 dev / sit / uat / pre / main 分支决定；独立 H5 的宿主模式和部署路径需按模板文档调整。");
    if (!config.initGit) notes.push("未初始化 Git：运行构建前，请先建立对应的发布分支；本地开发可先运行 pnpm dev。");
  } else if (template.advanced) {
    notes.push("高级架构：主子应用入口、端口和部署约定请先阅读模板 README。");
  } else if (template.key === "custom") {
    notes.push("自定义仓库只执行通用项目初始化，启动脚本和业务接入方式请以原仓库 README 为准。");
  }
  if (template.runtime?.packageManagerVersion) {
    notes.push(`安装前确认 ${config.packageManager} 版本满足 ${template.runtime.packageManagerVersion}。`);
  }
  return notes;
}

/** Keep provenance and first-run guidance with the generated project. */
export async function writeProjectGuide(
  root: string,
  name: string,
  template: SelectedTemplate,
  config: ProjectConfig,
  downloaded: DownloadedTemplate,
  selection?: TrimSelection,
): Promise<void> {
  const pkg = await fs.readJson(path.join(root, "package.json"));
  const pm = config.packageManager;
  const start = await getProjectStartCommand(root, template, pm);
  const scripts = pkg.scripts || {};
  const checkCandidates = template.key === "robot-admin"
    ? ["type-build", "build"]
    : template.key === "robot-h5"
      ? ["type-check", "test:compat", "build"]
      : ["typecheck", "type-check", "test", "build"];
  const checks = checkCandidates.filter((key) => typeof scripts[key] === "string" && scripts[key].trim());
  const guide = [
    `# ${config.title || name} · 项目启动指引`,
    "",
    `由 Robot CLI 创建，模板：${template.name}。原模板 README 保留供查阅。`,
    "",
    "## 启动项目", "", "```sh", `${pm} install`, ...(start ? [start] : []), "```",
    ...(start ? [] : ["", "模板未声明 dev/start 启动脚本，请按 README 与 package.json 选择运行方式。"]), "",
    "## 当前配置", "",
    `- 包名：${name}`,
    `- 用途预设：${selection ? getTrimSummary(selection) : "模板默认配置"}`,
    `- Node.js：${template.runtime?.node || pkg.engines?.node || "参考 package.json"}`,
    `- 包管理器：${pm}${template.runtime?.packageManagerVersion ? ` ${template.runtime.packageManagerVersion}` : ""}`,
    "",
    "## 首次接入", "",
    ...getProjectGuidance(template, config).map((note) => `- ${note}`),
    "- 已生成项目文件；正式接口、宿主能力和部署环境仍需按实际项目配置与验证。",
    "",
    "## 检查项目", "",
    ...(checks.length ? ["```sh", ...checks.map((check) => `${pm} run ${check}`), "```"] : ["请查看 package.json 中的检查与构建命令。"]),
    "",
    "## 模板来源", "",
    `- 仓库：${template.repoUrl}`,
    `- 分支：${template.branch || "main"}`,
    `- 提交：${downloaded.revision || "未提供（归档下载或旧缓存）"}`,
    `- 模板包版本：${pkg.version || "未声明"}`,
    `- 下载来源：${downloaded.source || template.repoUrl}${downloaded.fromCache ? "（缓存）" : ""}`,
    ...(downloaded.cachedAt ? [`- 缓存时间：${downloaded.cachedAt}`] : []),
    "- 创建记录：.robot-cli/project.json", "",
  ].join("\n");
  await fs.outputJson(path.join(root, ".robot-cli/project.json"), {
    schemaVersion: 1, createdBy: "robot-cli", createdAt: new Date().toISOString(),
    projectName: name, title: config.title || name,
    template: { id: template.key, repo: template.repoUrl, branch: template.branch || "main", version: pkg.version || null, revision: downloaded.revision || null },
    preset: selection?.mode || "full", runtime: template.runtime || null,
    download: { source: downloaded.source || template.repoUrl, fromCache: downloaded.fromCache || false, cachedAt: downloaded.cachedAt || null },
  }, { spaces: 2 });
  await fs.writeFile(path.join(root, "ROBOT_PROJECT.md"), guide);
}
