import fs from "fs-extra";
import path from "node:path";
import chalk from "chalk";
import * as p from "@clack/prompts";
import type { Ora } from "ora";
import type { SelectedTemplate } from "../types";

// ── Types ────────────────────────────────────────────────────────

export type TrimMode = "full" | "lite" | "custom";

export interface TrimSelection {
  mode: TrimMode;
  groupsToTrim: string[];
}

interface TrimToggle {
  id: string;
  label: string;
  hint: string;
  category: "pages" | "features" | "packages";
  /** Default checked (= keep) in Custom mode */
  defaultKeep: boolean;
  /** Trimmed in Lite preset */
  liteTrims: boolean;
}

// ── Toggle Definitions ───────────────────────────────────────────

const TRIM_TOGGLES: TrimToggle[] = [
  // ── Page modules
  {
    id: "demo",
    label: "演示页面（56 个组件示例 + 预览系统）",
    hint: "demo + plugins + editor + large-screen + hooks + directives",
    category: "pages",
    defaultKeep: true,
    liteTrims: true,
  },
  {
    id: "dashboard",
    label: "仪表盘（ECharts 图表页面）",
    hint: "dashboard/analysis + statistics",
    category: "pages",
    defaultKeep: true,
    liteTrims: true,
  },
  {
    id: "sys-manage",
    label: "系统管理页面（用户/角色/权限/菜单/字典）",
    hint: "5 个管理页面 + API",
    category: "pages",
    defaultKeep: true,
    liteTrims: false,
  },
  {
    id: "iframe-about",
    label: "外部页面 + 关于",
    hint: "iframe 内嵌 + about 页",
    category: "pages",
    defaultKeep: true,
    liteTrims: true,
  },
  // ── Feature modules
  {
    id: "i18n",
    label: "国际化（i18n 多语言支持）",
    hint: "语言切换 + 路由翻译",
    category: "features",
    defaultKeep: true,
    liteTrims: true,
  },
  {
    id: "spline-3d",
    label: "登录页 3D 背景（Spline 动画）",
    hint: "~200KB gzip",
    category: "features",
    defaultKeep: true,
    liteTrims: true,
  },
  {
    id: "analytics",
    label: "Vercel Analytics（线上统计）",
    hint: "仅线上演示站需要，推荐关闭",
    category: "features",
    defaultKeep: false,
    liteTrims: true,
  },
  // ── @robot-admin optional packages
  {
    id: "directives",
    label: "@robot-admin/directives（自定义指令集）",
    hint: "v-copy/v-watermark/v-drag 等",
    category: "packages",
    defaultKeep: true,
    liteTrims: true,
  },
  {
    id: "file-utils",
    label: "@robot-admin/file-utils（文件处理工具）",
    hint: "文件上传/下载/预览",
    category: "packages",
    defaultKeep: true,
    liteTrims: true,
  },
  {
    id: "form-validate",
    label: "@robot-admin/form-validate（表单验证）",
    hint: "表单校验规则集",
    category: "packages",
    defaultKeep: true,
    liteTrims: true,
  },
  {
    id: "git-standards",
    label: "@robot-admin/git-standards（Git 提交规范）",
    hint: "commit-lint + husky",
    category: "packages",
    defaultKeep: true,
    liteTrims: true,
  },
];

const LITE_GROUPS = TRIM_TOGGLES.filter((t) => t.liteTrims).map((t) => t.id);

// ── Public API ───────────────────────────────────────────────────

/** Check if a template is robot-admin main branch (only template that supports trimming) */
export function isTrimmableTemplate(template: SelectedTemplate): boolean {
  return template.key === "robot-admin" && !template.branch;
}

/** Show trim mode selection UI, returns TrimSelection */
export async function selectTrimMode(): Promise<TrimSelection> {
  p.log.step(chalk.bold("模板配置"));

  const mode = await p.select<TrimMode>({
    message: "选择模板配置:",
    options: [
      {
        value: "full",
        label: "完整版（Full）",
        hint: "包含所有演示页面和功能模块",
      },
      {
        value: "lite",
        label: "精简版（Lite）",
        hint: "移除演示页面，保留核心业务框架  ⭐ 推荐",
      },
      {
        value: "custom",
        label: "自定义（Custom）",
        hint: "自行选择要保留的模块",
      },
    ],
    initialValue: "lite" as TrimMode,
  });

  if (p.isCancel(mode)) process.exit(0);

  if (mode === "full") {
    return { mode: "full", groupsToTrim: [] };
  }

  if (mode === "lite") {
    return { mode: "lite", groupsToTrim: LITE_GROUPS };
  }

  // Custom mode — multiselect
  const categoryLabels: Record<string, string> = {
    pages: "页面模块",
    features: "功能模块",
    packages: "@robot-admin 可选包",
  };

  const selectOptions = TRIM_TOGGLES.map((t) => ({
    value: t.id,
    label: `${categoryLabels[t.category]} > ${t.label}`,
    hint: t.hint,
  }));

  const kept = await p.multiselect({
    message: "选择要保留的模块（空格切换，回车确认）:",
    options: selectOptions,
    initialValues: TRIM_TOGGLES.filter((t) => t.defaultKeep).map((t) => t.id),
    required: false,
  });

  if (p.isCancel(kept)) process.exit(0);

  const keptSet = new Set(kept);
  const groupsToTrim = TRIM_TOGGLES.filter((t) => !keptSet.has(t.id)).map(
    (t) => t.id,
  );

  return { mode: "custom", groupsToTrim };
}

/** Get a human-readable summary of the trim selection */
export function getTrimSummary(selection: TrimSelection): string {
  if (selection.mode === "full") return "完整版（保留全部功能）";
  if (selection.mode === "lite") return "精简版（移除演示 + 保留业务框架）";

  const trimCount = selection.groupsToTrim.length;
  if (trimCount === 0) return "自定义（保留全部功能）";

  const trimmed = selection.groupsToTrim
    .map((id) => TRIM_TOGGLES.find((t) => t.id === id)?.label || id)
    .join("、");
  return `自定义（移除: ${trimmed}）`;
}

// ── Trimming Executor ────────────────────────────────────────────

/** Execute trimming on a cloned project */
export async function executeTrimming(
  projectPath: string,
  selection: TrimSelection,
  spinner?: Ora,
): Promise<void> {
  const { groupsToTrim } = selection;
  const trimSet = new Set(groupsToTrim);

  const log = (msg: string) => {
    if (spinner) spinner.text = msg;
  };

  // Group Z always executes
  log("清理零使用依赖...");
  await executeGroupZ(projectPath);

  if (trimSet.size === 0) return;

  // Execute each enabled group
  if (trimSet.has("demo")) {
    log("移除演示页面...");
    await executeGroupA(projectPath);
  }

  if (trimSet.has("dashboard")) {
    log("移除仪表盘...");
    await executeGroupB(projectPath);
  }

  if (trimSet.has("i18n")) {
    log("移除国际化...");
    await executeGroupC(projectPath);
  }

  if (trimSet.has("analytics")) {
    log("移除 Vercel Analytics...");
    await executeGroupD(projectPath);
  }

  if (trimSet.has("sys-manage")) {
    log("移除系统管理页面...");
    await executeGroupE(projectPath);
  }

  // Group F sub-items
  if (trimSet.has("directives")) {
    log("移除 @robot-admin/directives...");
    await executeGroupF_directives(projectPath);
  }
  if (trimSet.has("file-utils")) {
    log("移除 @robot-admin/file-utils...");
    await executeGroupF_fileUtils(projectPath);
  }
  if (trimSet.has("form-validate")) {
    log("移除 @robot-admin/form-validate...");
    await executeGroupF_formValidate(projectPath);
  }
  if (trimSet.has("git-standards")) {
    log("移除 @robot-admin/git-standards...");
    await executeGroupF_gitStandards(projectPath);
  }

  if (trimSet.has("iframe-about")) {
    log("移除外部页面和关于...");
    await executeGroupG(projectPath);
  }

  if (trimSet.has("spline-3d")) {
    log("移除登录页 3D 背景...");
    await executeGroupH(projectPath);
  }

  log("模板裁剪完成");
}

// ── Helpers ──────────────────────────────────────────────────────

/** Safely remove a path (file or directory) */
async function safeRemove(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  const fullPath = path.join(projectPath, relativePath);
  if (await fs.pathExists(fullPath)) {
    await fs.remove(fullPath);
  }
}

/** Safely remove multiple paths */
async function safeRemoveAll(
  projectPath: string,
  paths: string[],
): Promise<void> {
  for (const p of paths) {
    await safeRemove(projectPath, p);
  }
}

/** Remove dependencies from package.json */
async function removeDeps(
  projectPath: string,
  deps: string[],
  dev = false,
): Promise<void> {
  const pkgPath = path.join(projectPath, "package.json");
  if (!(await fs.pathExists(pkgPath))) return;

  const pkg = await fs.readJson(pkgPath);
  const field = dev ? "devDependencies" : "dependencies";
  if (!pkg[field]) return;

  for (const dep of deps) {
    delete pkg[field][dep];
  }
  await fs.writeJson(pkgPath, pkg, { spaces: 2 });
}

/** Remove scripts from package.json */
async function removeScripts(
  projectPath: string,
  scripts: string[],
): Promise<void> {
  const pkgPath = path.join(projectPath, "package.json");
  if (!(await fs.pathExists(pkgPath))) return;

  const pkg = await fs.readJson(pkgPath);
  if (!pkg.scripts) return;

  for (const s of scripts) {
    delete pkg.scripts[s];
  }
  await fs.writeJson(pkgPath, pkg, { spaces: 2 });
}

/** Remove route groups from dynamicRouter.json by path prefix */
async function removeRouteGroups(
  projectPath: string,
  pathPrefixes: string[],
): Promise<void> {
  const routerPath = path.join(
    projectPath,
    "src",
    "assets",
    "json",
    "dynamicRouter.json",
  );
  if (!(await fs.pathExists(routerPath))) return;

  const data = await fs.readJson(routerPath);
  if (!Array.isArray(data?.data)) return;

  data.data = data.data.filter((route: { path?: string }) => {
    if (!route.path) return true;
    return !pathPrefixes.some(
      (prefix) => route.path === prefix || route.path?.startsWith(prefix + "/"),
    );
  });

  await fs.writeJson(routerPath, data, { spaces: 2 });
}

/** Remove lines matching any of the patterns from a file */
async function removeLinesMatching(
  projectPath: string,
  filePath: string,
  patterns: (string | RegExp)[],
): Promise<void> {
  const fullPath = path.join(projectPath, filePath);
  if (!(await fs.pathExists(fullPath))) return;

  let content = await fs.readFile(fullPath, "utf8");
  const lines = content.split("\n");

  const filtered = lines.filter((line) => {
    return !patterns.some((pat) => {
      if (typeof pat === "string") return line.includes(pat);
      return pat.test(line);
    });
  });

  await fs.writeFile(fullPath, filtered.join("\n"));
}

/** Replace text in a file */
async function replaceInFile(
  projectPath: string,
  filePath: string,
  search: string | RegExp,
  replacement: string,
): Promise<void> {
  const fullPath = path.join(projectPath, filePath);
  if (!(await fs.pathExists(fullPath))) return;

  let content = await fs.readFile(fullPath, "utf8");
  if (typeof search === "string") {
    content = content.replace(search, replacement);
  } else {
    content = content.replace(search, replacement);
  }
  await fs.writeFile(fullPath, content);
}

/** Clear a file's content but keep it */
async function clearFile(projectPath: string, filePath: string): Promise<void> {
  const fullPath = path.join(projectPath, filePath);
  if (!(await fs.pathExists(fullPath))) return;
  await fs.writeFile(fullPath, "export default [];\n");
}

// ── Group Executors ──────────────────────────────────────────────

/** Group Z: Zero-usage dependencies (always execute) */
async function executeGroupZ(projectPath: string): Promise<void> {
  await removeDeps(projectPath, ["vue-command-palette", "motion-v"]);
}

/** Group A: Demo pages (56 demo dirs + preview + plugins/markdown/highlight/dynamic-components) */
async function executeGroupA(projectPath: string): Promise<void> {
  // 1. Remove demo views directory
  await safeRemove(projectPath, "src/views/demo");

  // 2. Remove preview system
  await safeRemoveAll(projectPath, [
    "src/views/preview",
    "src/router/previewRouter.ts",
  ]);

  // 3. Remove demo-only local components
  await safeRemove(projectPath, "src/components/local/c_vTitle");

  // 4. Remove demo-only styles
  await safeRemoveAll(projectPath, [
    "src/styles/antv-common.scss",
    "src/styles/v-md-editor-dark-theme.scss",
    "src/styles/workflow-theme.scss",
  ]);

  // 5. Remove demo-only plugins
  await safeRemoveAll(projectPath, [
    "src/plugins/highlight.ts",
    "src/plugins/markdown.ts",
    "src/plugins/dynamic-components.ts",
  ]);

  // 6. Clear heavyPages config (keep file structure)
  await clearFile(projectPath, "src/config/vite/heavyPages.ts");

  // 7. Remove demo-only dependencies
  await removeDeps(projectPath, [
    "@antv/x6",
    "@kangc/v-md-editor",
    "@visactor/vtable-gantt",
    "highlight.js",
    "html2canvas",
    "print-js",
  ]);

  // 8. Remove demo route groups from dynamicRouter.json
  await removeRouteGroups(projectPath, [
    "/demo",
    "/plugins",
    "/editor",
    "/large-screen",
    "/hooks",
    "/directives",
  ]);

  // 9. Modify main.ts — remove setupHighlight / setupMarkdown / setupDynamicComponents
  await removeLinesMatching(projectPath, "src/main.ts", [
    "setupHighlight",
    "setupMarkdown",
    "setupDynamicComponents",
  ]);

  // 10. Modify plugins/index.ts — remove related exports
  await removeLinesMatching(projectPath, "src/plugins/index.ts", [
    "highlight",
    "markdown",
    "dynamic-components",
  ]);

  // 11. Modify publicRouter.ts — remove previewRoutes
  await removeLinesMatching(projectPath, "src/router/publicRouter.ts", [
    "previewRoute",
    "previewRouter",
  ]);

  // 12. Modify vite.config.ts — remove @antv/x6 from optimizeDeps
  await removeLinesMatching(projectPath, "vite.config.ts", ["@antv/x6"]);
}

/** Group B: Dashboard + ECharts */
async function executeGroupB(projectPath: string): Promise<void> {
  // 1. Remove dashboard views
  await safeRemove(projectPath, "src/views/dashboard");

  // 2. Remove ECharts data
  await safeRemove(projectPath, "src/assets/data/echarts-package-size.json");

  // 3. Remove ECharts dependency
  await removeDeps(projectPath, ["echarts"]);

  // 4. Remove dashboard route group
  await removeRouteGroups(projectPath, ["/dashboard"]);

  // 5. Modify dynamicRouter.ts — remove EAGER_DASH references
  await removeLinesMatching(projectPath, "src/router/dynamicRouter.ts", [
    "EAGER_DASH",
    /dashboard.*glob/i,
  ]);

  // 6. Modify vite.config.ts — remove echarts from optimizeDeps
  await removeLinesMatching(projectPath, "vite.config.ts", [/echarts/]);
}

/** Group C: i18n system */
async function executeGroupC(projectPath: string): Promise<void> {
  // 1. Remove i18n files
  await safeRemoveAll(projectPath, [
    "lang",
    "src/utils/plugins/i18n-route.ts",
    "src/stores/language",
    "src/config/vite/viteI18nConfig.ts",
    "scripts/generate-route-translations.ts",
  ]);

  // 2. Remove i18n devDependency
  await removeDeps(projectPath, ["vite-auto-i18n-plugin"], true);

  // 3. Remove i18n scripts from package.json
  await removeScripts(projectPath, ["gen:route-i18n"]);

  // 4. Modify main.ts — remove lang import + i18n-route import
  await removeLinesMatching(projectPath, "src/main.ts", [
    "lang/index",
    "i18n-route",
  ]);

  // 5. Modify vite.config.ts — remove i18n plugin
  await removeLinesMatching(projectPath, "vite.config.ts", [
    "createI18nPlugin",
    "i18nPlugin",
    "viteI18nConfig",
  ]);

  // 6. Modify src/config/vite/index.ts — remove i18n export
  await removeLinesMatching(projectPath, "src/config/vite/index.ts", [
    "I18n",
    "i18n",
  ]);

  // 7. Modify C_NavbarRight — remove C_Language + languageStore + translateRouteTitle
  await removeLinesMatching(
    projectPath,
    "src/components/global/C_NavbarRight/index.vue",
    ["C_Language", "s_languageStore", "languageStore", "translateRouteTitle"],
  );

  // 8. Modify C_Layout — remove translateRouteTitle
  await removeLinesMatching(
    projectPath,
    "src/components/global/C_Layout/index.vue",
    ["translateRouteTitle"],
  );

  // 9. Modify C_Header — remove translateRouteTitle
  await removeLinesMatching(
    projectPath,
    "src/components/global/C_Header/index.vue",
    ["translateRouteTitle"],
  );

  // 10. Modify App.vue — hardcode zhCN locale, remove languageStore
  await removeLinesMatching(projectPath, "src/App.vue", [
    "s_languageStore",
    "languageStore",
  ]);
  // Replace dynamic locale with hardcoded zhCN
  await replaceInFile(
    projectPath,
    "src/App.vue",
    /languageStore\.naiveLocale/g,
    "zhCN",
  );
  await replaceInFile(
    projectPath,
    "src/App.vue",
    /languageStore\.naiveDateLocale/g,
    "dateZhCN",
  );

  // 11. Modify login page — remove language switching
  await removeLinesMatching(projectPath, "src/views/login/index.vue", [
    "langStore",
    "s_languageStore",
    "languageStore",
    /changeLang/,
  ]);
}

/** Group D: Vercel Analytics */
async function executeGroupD(projectPath: string): Promise<void> {
  // 1. Remove analytics plugin
  await safeRemove(projectPath, "src/plugins/analytics.ts");

  // 2. Remove dependency
  await removeDeps(projectPath, ["@vercel/analytics"]);

  // 3. Modify main.ts — remove setupAnalytics
  await removeLinesMatching(projectPath, "src/main.ts", [
    "setupAnalytics",
    "analytics",
  ]);

  // 4. Modify plugins/index.ts — remove analytics export
  await removeLinesMatching(projectPath, "src/plugins/index.ts", ["analytics"]);
}

/** Group E: Sys-Manage pages */
async function executeGroupE(projectPath: string): Promise<void> {
  // 1. Remove sys-manage views
  await safeRemove(projectPath, "src/views/sys-manage");

  // 2. Remove related API files
  await safeRemove(projectPath, "src/api/permission-manage.ts");

  // 3. Remove local components used only by sys-manage
  await safeRemoveAll(projectPath, [
    "src/components/local/c_detail",
    "src/components/local/c_role",
  ]);

  // 4. Remove route group
  await removeRouteGroups(projectPath, ["/sys-manage"]);
}

/** Group F.1: @robot-admin/directives */
async function executeGroupF_directives(projectPath: string): Promise<void> {
  await removeDeps(projectPath, ["@robot-admin/directives"]);
  await removeLinesMatching(projectPath, "src/main.ts", [
    "setupDirectives",
    "@robot-admin/directives",
  ]);
}

/** Group F.2: @robot-admin/file-utils */
async function executeGroupF_fileUtils(projectPath: string): Promise<void> {
  await removeDeps(projectPath, ["@robot-admin/file-utils"]);
  await safeRemove(projectPath, "src/plugins/file-utils.ts");
  await removeLinesMatching(projectPath, "src/main.ts", [
    "setupFileUtils",
    "file-utils",
  ]);
  await removeLinesMatching(projectPath, "src/plugins/index.ts", [
    "file-utils",
  ]);
}

/** Group F.3: @robot-admin/form-validate */
async function executeGroupF_formValidate(projectPath: string): Promise<void> {
  await removeDeps(projectPath, ["@robot-admin/form-validate"]);
}

/** Group F.4: @robot-admin/git-standards */
async function executeGroupF_gitStandards(projectPath: string): Promise<void> {
  await removeDeps(projectPath, ["@robot-admin/git-standards"]);
}

/** Group G: iframe + about */
async function executeGroupG(projectPath: string): Promise<void> {
  await safeRemoveAll(projectPath, ["src/views/iframe", "src/views/about"]);
  await removeRouteGroups(projectPath, ["/iframe", "/about"]);
}

/** Group H: Login 3D background (Spline) */
async function executeGroupH(projectPath: string): Promise<void> {
  // 1. Remove Spline component
  await safeRemove(projectPath, "src/views/login/components/Spline.vue");

  // 2. Remove dependency
  await removeDeps(projectPath, ["@splinetool/runtime"]);

  // 3. Modify login page — remove Spline import and usage
  await removeLinesMatching(projectPath, "src/views/login/index.vue", [
    "Spline",
    "spline",
  ]);

  // 4. Modify vite build config — remove splinetool chunk config
  await removeLinesMatching(projectPath, "src/config/vite/viteBuildConfig.ts", [
    "splinetool",
    "spline",
  ]);
}
