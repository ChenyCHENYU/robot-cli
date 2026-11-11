import fs from "fs-extra";
import path from "node:path";
import * as p from "@clack/prompts";
import { babelParse, parse } from "@vue/compiler-sfc";
import type { Ora } from "ora";
import type { SelectedTemplate } from "../types";
import { CreationCancelled } from "../interaction";

export type TrimMode = "full" | "lite" | "custom";
export interface TrimSelection {
  mode: TrimMode;
  groupsToTrim: string[];
}

const TOGGLES = [
  { id: "demo", label: "组件演示与预览", hint: "示例页面及其菜单", lite: true },
  { id: "dashboard", label: "分析仪表盘", hint: "分析与统计页面", lite: true },
  {
    id: "sys-manage",
    label: "系统管理",
    hint: "用户、角色、菜单和权限页面",
    lite: false,
  },
  {
    id: "iframe-about",
    label: "外部页面与关于",
    hint: "内嵌页面、项目介绍",
    lite: true,
  },
  {
    id: "spline-3d",
    label: "登录页 3D 背景",
    hint: "联网加载 Spline 场景",
    lite: true,
  },
  {
    id: "analytics",
    label: "Vercel 访问统计",
    hint: "保留后仍需显式配置才启用",
    lite: true,
  },
] as const;
const SHARED_RUNTIME = "保留认证、布局、国际化、共享工具及行业样例";

export function isTrimmableTemplate(template: SelectedTemplate): boolean {
  return template.key === "robot-admin" && !template.branch;
}

export function getTrimSelection(mode: TrimMode): TrimSelection {
  if (mode === "custom") {
    throw new Error(
      "自定义配置需要逐项选择，请移除 --yes 或改用 lite/full 预设。",
    );
  }
  return {
    mode,
    groupsToTrim:
      mode === "lite" ? TOGGLES.filter((t) => t.lite).map((t) => t.id) : [],
  };
}

export function getPresetSelection(mode: "full" | "lite"): TrimSelection {
  return getTrimSelection(mode);
}

export async function selectTrimMode(): Promise<TrimSelection> {
  const mode = await p.select<TrimMode>({
    message: "如何开始这个 PC 项目？",
    options: [
      {
        value: "lite",
        label: "精简示例",
        hint: "移除组件演示与 3D；保留系统管理和行业样例",
      },
      {
        value: "full",
        label: "完整演示",
        hint: "保留全部示例，适合体验与参考",
      },
      { value: "custom", label: "自定义", hint: "选择要保留的页面与可选功能" },
    ],
    initialValue: "lite",
  });
  if (p.isCancel(mode)) throw new CreationCancelled();
  if (mode !== "custom") return getTrimSelection(mode);

  p.log.info(`${SHARED_RUNTIME}。空格切换，回车完成；可全部取消。`);
  const kept = await p.multiselect({
    message: "保留哪些内容？",
    options: TOGGLES.map((t) => ({
      value: t.id,
      label: t.label,
      hint: t.hint,
    })),
    initialValues: TOGGLES.filter((t) => !t.lite).map((t) => t.id),
    required: false,
  });
  if (p.isCancel(kept)) throw new CreationCancelled();
  return {
    mode: "custom",
    groupsToTrim: TOGGLES.filter((t) => !kept.includes(t.id)).map((t) => t.id),
  };
}

export function getTrimSummary(selection: TrimSelection): string {
  if (selection.mode === "full") return "完整演示（保留全部内容）";
  if (selection.mode === "lite")
    return `精简示例（移除组件演示与 3D；${SHARED_RUNTIME}）`;
  const removed = selection.groupsToTrim.map(
    (id) => TOGGLES.find((t) => t.id === id)?.label ?? id,
  );
  return removed.length
    ? `自定义：移除${removed.join("、")}；${SHARED_RUNTIME}`
    : "自定义（保留全部内容）";
}

interface AstNode {
  type: string;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
}
interface Edit {
  start: number;
  end: number;
  text: string;
}
interface Source {
  content: string;
  ast: AstNode;
  offset: number;
  externalSource?: string;
}

/** Babel 与 Vue 的 AST 坐标用于整节点修改，不按关键字删行。 */
function walk(
  node: unknown,
  visit: (node: AstNode, parent?: AstNode) => void,
  parent?: AstNode,
): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit, parent);
    return;
  }
  const value = node as AstNode;
  if (typeof value.type === "string") visit(value, parent);
  for (const [key, child] of Object.entries(value)) {
    if (
      [
        "loc",
        "tokens",
        "comments",
        "leadingComments",
        "trailingComments",
        "extra",
      ].includes(key)
    )
      continue;
    if (child && typeof child === "object") walk(child, visit, value);
  }
}

function applyEdits(content: string, edits: Edit[]): string {
  const ordered = edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const unique: Edit[] = [];
  for (const edit of ordered) {
    const previous = unique[unique.length - 1];
    if (previous && edit.start < previous.end) {
      if (edit.end <= previous.end) continue;
      throw new Error(
        "模板结构已变化：修改范围重叠，已停止裁剪。请选择完整演示。",
      );
    }
    unique.push(edit);
  }
  for (const edit of unique.reverse())
    content =
      content.slice(0, edit.start) + edit.text + content.slice(edit.end);
  return content;
}

function scriptSources(content: string, file: string): Source[] {
  let blocks = [
    { content, offset: 0, externalSource: undefined as string | undefined },
  ];
  if (file.endsWith(".vue")) {
    const result = parse(content, { filename: file });
    if (result.errors.length)
      throw new Error(`模板 ${file} 不是有效的 Vue 文件，已停止裁剪。`);
    const scripts = [
      result.descriptor.scriptSetup,
      result.descriptor.script,
    ].filter((block) => block !== null);
    blocks = scripts.length
      ? scripts.map((block) => ({
          content: block.content,
          offset: block.loc.start.offset,
          externalSource: block.src,
        }))
      : [{ content: "", offset: 0, externalSource: undefined }];
  }
  try {
    return blocks.map((block) => ({
      content,
      offset: block.offset,
      externalSource: block.externalSource,
      ast: babelParse(block.content, {
        sourceType: "unambiguous",
        plugins: [
          "typescript",
          ...(file.endsWith(".tsx") || file.endsWith(".jsx")
            ? ["jsx" as const]
            : []),
        ],
      }) as unknown as AstNode,
    }));
  } catch {
    throw new Error(
      `模板 ${file} 的脚本结构无法识别，已停止裁剪。请选择完整演示。`,
    );
  }
}

function scriptSource(content: string, file: string): Source {
  return scriptSources(content, file)[0]!;
}

function nodeEdit(node: AstNode, offset: number, text = ""): Edit {
  if (typeof node.start !== "number" || typeof node.end !== "number")
    throw new Error("模板节点缺少位置信息");
  return { start: node.start + offset, end: node.end + offset, text };
}

function identifier(node: unknown): string | undefined {
  const value = node as AstNode | undefined;
  return value?.type === "Identifier" ? (value.name as string) : undefined;
}

function stringValue(node: unknown): string | undefined {
  const value = node as AstNode | undefined;
  return value?.type === "StringLiteral" ? (value.value as string) : undefined;
}

/** 动态 import 的固定前缀也必须检查，不能漏掉 `import(`.../${name}.vue`)`。 */
function importPrefix(node: unknown): string | undefined {
  const literal = stringValue(node);
  if (literal !== undefined) return literal;
  const value = node as AstNode | undefined;
  if (value?.type !== "TemplateLiteral") return undefined;
  const first = (value.quasis as Array<{ value: { cooked?: string } }>)[0];
  return first?.value.cooked;
}

function invokesBinding(node: unknown, names: string[]): boolean {
  const value = node as AstNode | undefined;
  if (!value) return false;
  if (
    ["AwaitExpression", "TSAsExpression", "TSNonNullExpression"].includes(
      value.type,
    )
  )
    return invokesBinding(value.argument ?? value.expression, names);
  return (
    ["CallExpression", "OptionalCallExpression"].includes(value.type) &&
    names.includes(identifier(value.callee) ?? "")
  );
}

function references(node: unknown, names: string[]): boolean {
  let found = false;
  walk(node, (n) => {
    if (names.includes(identifier(n) ?? "")) found = true;
  });
  return found;
}

/** 删除数组项时连同它的分隔逗号；支持首项、末项和 spread。 */
function listEdit(node: AstNode, source: Source): Edit {
  const edit = nodeEdit(node, source.offset);
  const following = /^\s*,/.exec(source.content.slice(edit.end));
  if (following) edit.end += following[0].length;
  else {
    const preceding = /,\s*$/.exec(source.content.slice(0, edit.start));
    if (preceding) edit.start -= preceding[0].length;
  }
  return edit;
}

class TrimPlan {
  readonly writes = new Map<string, string>();
  readonly removals = new Set<string>();
  readonly removedPackages = new Set<string>();
  constructor(readonly root: string) {}
  async read(file: string): Promise<string | null> {
    if (this.writes.has(file)) return this.writes.get(file)!;
    return (await fs.pathExists(path.join(this.root, file)))
      ? fs.readFile(path.join(this.root, file), "utf8")
      : null;
  }
  removes(file: string): boolean {
    return [...this.removals].some(
      (item) => file === item || file.startsWith(item + "/"),
    );
  }
  async rewrite(
    file: string,
    transform: (content: string) => string,
  ): Promise<void> {
    const content = await this.read(file);
    if (content !== null) this.writes.set(file, transform(content));
  }
  async sources(): Promise<string[]> {
    const result: string[] = [];
    const walkDir = async (relative: string): Promise<void> => {
      for (const entry of await fs.readdir(path.join(this.root, relative), {
        withFileTypes: true,
      })) {
        if (
          entry.name.startsWith(".") ||
          ["node_modules", "dist", "tests", "e2e"].includes(entry.name)
        )
          continue;
        const file = path.posix.join(relative, entry.name);
        if (this.removes(file)) continue;
        if (entry.isDirectory()) await walkDir(file);
        else if (/\.(?:[cm]?[jt]sx?|vue)$/.test(file)) result.push(file);
      }
    };
    await walkDir("");
    return result;
  }
  async removePackages(packages: string[]): Promise<void> {
    await this.rewrite("package.json", (content) => {
      const pkg = JSON.parse(content);
      for (const field of [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
      ]) {
        for (const name of packages) {
          if (pkg[field]?.[name]) {
            delete pkg[field][name];
            this.removedPackages.add(name);
          }
        }
      }
      return JSON.stringify(pkg, null, 2) + "\n";
    });
  }
  /** 仅删除没有剩余源码使用的演示依赖，共享运行时始终保留。 */
  async prunePackages(packages: string[]): Promise<void> {
    const used = new Set<string>();
    for (const file of await this.sources()) {
      for (const source of scriptSources((await this.read(file))!, file)) {
        const record = (value?: string): void => {
          if (value)
            for (const name of packages)
              if (value === name || value.startsWith(name + "/"))
                used.add(name);
        };
        record(source.externalSource);
        walk(source.ast, (node) => {
          record(importPrefix(node));
        });
      }
    }
    await this.removePackages(packages.filter((name) => !used.has(name)));
  }
  async validate(): Promise<void> {
    for (const file of await this.sources()) {
      const imports: string[] = [];
      for (const source of scriptSources((await this.read(file))!, file)) {
        if (source.externalSource) imports.push(source.externalSource);
        walk(source.ast, (node) => {
          if (
            [
              "ImportDeclaration",
              "ExportNamedDeclaration",
              "ExportAllDeclaration",
            ].includes(node.type)
          ) {
            const value = stringValue(node.source);
            if (value) imports.push(value);
          }
          if (
            node.type === "CallExpression" &&
            ((node.callee as AstNode)?.type === "Import" ||
              identifier(node.callee) === "require")
          ) {
            const value = importPrefix((node.arguments as unknown[])?.[0]);
            if (value) imports.push(value);
          }
          if (node.type === "ImportExpression") {
            const value = importPrefix(node.source);
            if (value) imports.push(value);
          }
        });
      }
      for (const source of imports) {
        const removedPackage = [...this.removedPackages].find(
          (name) => source === name || source.startsWith(name + "/"),
        );
        let resolved: string | undefined;
        const localSource = source.split(/[?#]/, 1)[0]!;
        if (localSource.startsWith("@/"))
          resolved = "src/" + localSource.slice(2);
        else if (localSource.startsWith("_views/"))
          resolved = "src/views/" + localSource.slice(7);
        else if (localSource.startsWith("."))
          resolved = path.posix.normalize(
            path.posix.join(path.posix.dirname(file), localSource),
          );
        if (
          removedPackage ||
          (resolved &&
            [
              resolved,
              resolved + ".ts",
              resolved + ".vue",
              resolved + "/index.ts",
              resolved.replace(/\.[cm]?js$/, ".ts"),
            ].some((target) => this.removes(target)))
        ) {
          throw new Error(
            `模板裁剪未应用：${file} 仍依赖将被移除的 ${source}。模板结构可能已更新，请选择完整演示或保留对应模块。`,
          );
        }
      }
    }
  }
  async apply(): Promise<void> {
    await this.validate();
    for (const [file, content] of this.writes)
      if (!this.removes(file))
        await fs.outputFile(path.join(this.root, file), content);
    for (const file of this.removals)
      await fs.remove(path.join(this.root, file));
  }
}

async function removeSymbols(
  plan: TrimPlan,
  file: string,
  names: string[],
  modules: string[] = [],
): Promise<void> {
  await plan.rewrite(file, (content) => {
    const source = scriptSource(content, file);
    const edits: Edit[] = [];
    const bindings = new Set(names);
    walk(source.ast, (node) => {
      if (
        node.type === "ImportDeclaration" &&
        modules.includes(stringValue(node.source) ?? "")
      ) {
        for (const specifier of node.specifiers as AstNode[]) {
          const name = identifier(specifier.local);
          if (name) bindings.add(name);
        }
      }
    });
    const removable = [...bindings];
    walk(source.ast, (node, parent) => {
      if (
        [
          "ImportDeclaration",
          "ExportNamedDeclaration",
          "ExportAllDeclaration",
        ].includes(node.type) &&
        modules.includes(stringValue(node.source) ?? "")
      )
        edits.push(nodeEdit(node, source.offset));
      if (
        node.type === "ExpressionStatement" &&
        invokesBinding(node.expression, removable)
      )
        edits.push(nodeEdit(node, source.offset));
      if (node.type === "VariableDeclaration") {
        const declarations = node.declarations as AstNode[];
        const selected = declarations.filter((item) =>
          names.includes(identifier(item.id) ?? ""),
        );
        if (selected.length === declarations.length)
          edits.push(nodeEdit(node, source.offset));
        else for (const item of selected) edits.push(listEdit(item, source));
      }
      if (
        parent?.type === "ArrayExpression" &&
        (node.type === "Identifier" || node.type === "SpreadElement") &&
        references(node, removable)
      )
        edits.push(listEdit(node, source));
    });
    const result = applyEdits(content, edits);
    if (references(scriptSource(result, file).ast, removable)) {
      throw new Error(
        `模板 ${file} 仍使用将被移除的 ${removable.join("、")}，已停止裁剪。请保留对应功能或选择完整演示。`,
      );
    }
    return result;
  });
}

interface Route {
  path?: string;
  children?: Route[];
}
async function trimRoutes(plan: TrimPlan, prefixes: string[]): Promise<void> {
  if (!prefixes.length) return;
  let found = false;
  for (const file of [
    "src/assets/data/dynamicRouter.json",
    "src/assets/json/dynamicRouter.json",
  ]) {
    if ((await plan.read(file)) === null) continue;
    found = true;
    await plan.rewrite(file, (content) => {
      const data = JSON.parse(content);
      if (!Array.isArray(data.data))
        throw new Error(`模板菜单格式已变化：${file}，已停止裁剪。`);
      const filter = (routes: Route[], parent = ""): Route[] =>
        routes.flatMap((route) => {
          const absolute = route.path?.startsWith("/")
            ? route.path
            : path.posix.join(parent || "/", route.path ?? "");
          if (
            prefixes.some(
              (prefix) =>
                absolute === prefix || absolute.startsWith(prefix + "/"),
            )
          )
            return [];
          return [
            {
              ...route,
              ...(route.children
                ? { children: filter(route.children, absolute) }
                : {}),
            },
          ];
        });
      data.data = filter(data.data);
      return JSON.stringify(data, null, 2) + "\n";
    });
  }
  if (!found)
    throw new Error(
      "模板菜单位置已变化，无法安全移除页面。请选择完整演示，或更新 CLI 后重试。",
    );
}

async function trimSpline(plan: TrimPlan): Promise<void> {
  const file = "src/views/login/index.vue";
  await plan.rewrite(file, (content) => {
    const { descriptor, errors } = parse(content, { filename: file });
    if (errors.length)
      throw new Error("登录页模板无法解析，已停止裁剪 3D 背景。");
    const edits: Edit[] = [];
    const splineTags = new Set(["Spline"]);
    for (const source of scriptSources(content, file))
      walk(source.ast, (node) => {
        if (
          node.type === "ImportDeclaration" &&
          stringValue(node.source) === "./components/Spline.vue"
        ) {
          for (const specifier of node.specifiers as AstNode[]) {
            const name = identifier(specifier.local);
            if (name) splineTags.add(name);
          }
        }
      });
    // Vue 模板 AST 使用整个 SFC 的坐标；同时移除仅为 3D 服务的绑定。
    const visit = (node: unknown, parent?: Record<string, unknown>): void => {
      if (!node || typeof node !== "object") return;
      const element = node as Record<string, unknown>;
      const loc = element.loc as
        { start: { offset: number }; end: { offset: number } } | undefined;
      if (element.type === 1 && splineTags.has(String(element.tag)) && loc) {
        const siblings = parent?.children as
          Array<Record<string, unknown>> | undefined;
        const meaningful = siblings?.filter(
          (item) =>
            item.type !== 3 &&
            !(item.type === 2 && !String(item.content).trim()),
        );
        const parentLoc = parent?.loc as typeof loc;
        const background = (
          parent?.props as Array<Record<string, unknown>> | undefined
        )?.some(
          (prop) =>
            prop.type === 6 &&
            prop.name === "class" &&
            (prop.value as { content?: string } | undefined)?.content
              ?.split(/\s+/)
              .includes("spline-background"),
        );
        if (
          parent?.tag === "div" &&
          background &&
          meaningful?.length === 1 &&
          parentLoc
        )
          edits.push({
            start: parentLoc.start.offset,
            end: parentLoc.end.offset,
            text: "",
          });
        else
          edits.push({
            start: loc.start.offset,
            end: loc.end.offset,
            text: "",
          });
        return;
      }
      for (const prop of (element.props ?? []) as Array<
        Record<string, unknown>
      >) {
        const expression = prop.exp as { content?: string } | undefined;
        const argument = prop.arg as { content?: string } | undefined;
        if (
          prop.type === 7 &&
          ((prop.name === "if" && expression?.content === "!robotReady") ||
            (prop.name === "on" &&
              argument?.content === "captcha-visible-change"))
        ) {
          const range = prop.loc as typeof loc;
          if (range)
            edits.push({
              start: range.start.offset,
              end: range.end.offset,
              text: "",
            });
        }
      }
      for (const child of (element.children ?? []) as unknown[])
        visit(child, element);
    };
    visit(descriptor.template?.ast);
    return applyEdits(content, edits);
  });
  await removeSymbols(
    plan,
    file,
    ["robotReady", "handleRobotLoad", "captchaVisible"],
    ["./components/Spline.vue"],
  );
  await plan.rewrite(file, (content) => {
    const { descriptor } = parse(content, { filename: file });
    const removedBinding = /\b(?:robotReady|handleRobotLoad|captchaVisible)\b/;
    const check = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const element = node as Record<string, unknown>;
      const interpolation =
        element.type === 5
          ? (element.content as { content?: string })?.content
          : undefined;
      const expressions = (
        (element.props ?? []) as Array<Record<string, unknown>>
      ).map((prop) => (prop.exp as { content?: string } | undefined)?.content);
      if (
        [interpolation, ...expressions].some(
          (expression) => expression && removedBinding.test(expression),
        )
      ) {
        throw new Error(
          "登录页仍使用 3D 背景绑定，模板结构已变化；请保留登录页 3D 背景或选择完整演示。",
        );
      }
      for (const child of (element.children ?? []) as unknown[]) check(child);
    };
    check(descriptor.template?.ast);
    return content;
  });
  plan.removals.add("src/views/login/components/Spline.vue");
  await plan.prunePackages(["@splinetool/runtime"]);
}

/** 全部修改先在内存规划并检查；模板漂移时拒绝，不写入半成品。 */
export async function executeTrimming(
  projectPath: string,
  selection: TrimSelection,
  spinner?: Ora,
): Promise<void> {
  const groups = new Set(selection.groupsToTrim);
  const unsupported = [...groups].filter(
    (id) => !TOGGLES.some((t) => t.id === id),
  );
  if (unsupported.length)
    throw new Error(
      `不能安全移除 ${unsupported.join("、")}：国际化和共享工具属于核心运行时。请保留它们，或使用新版精简示例预设。`,
    );
  if (!groups.size) return;
  const plan = new TrimPlan(projectPath);
  const prefixes: string[] = [];
  if (spinner) spinner.text = "检查模板结构与模块依赖…";
  if (groups.has("demo")) {
    for (const file of [
      "src/views/demo",
      "src/views/preview",
      "src/router/previewRouter.ts",
    ])
      plan.removals.add(file);
    prefixes.push(
      "/demo",
      "/plugins",
      "/editor",
      "/large-screen",
      "/hooks",
      "/directives",
    );
    await removeSymbols(
      plan,
      "src/router/publicRouter.ts",
      ["previewRoutes", "previewRoute"],
      ["./previewRouter", "./previewRouter.ts"],
    );
    await plan.rewrite("src/router/routePrefetch.ts", (content) => {
      const source = scriptSource(content, "src/router/routePrefetch.ts");
      const edits: Edit[] = [];
      walk(source.ast, (node) => {
        if (
          node.type === "VariableDeclaration" &&
          (node.declarations as AstNode[]).some(
            (item) => identifier(item.id) === "HEAVY_ROUTE_LOADERS",
          )
        ) {
          edits.push(
            nodeEdit(
              node,
              0,
              "const HEAVY_ROUTE_LOADERS: Record<string, RouteLoader> = {}",
            ),
          );
        }
      });
      return applyEdits(content, edits);
    });
    await plan.rewrite(
      "src/config/heavyPages.ts",
      () =>
        "export const HEAVY_PAGES: Array<{ routePath: string; viewPath: string; reason: string; priority: number }> = []\nexport const HEAVY_PAGE_ROUTES: string[] = []\nexport const DEV_WARMUP_FILES: string[] = []\n",
    );
    await plan.rewrite(
      "src/config/vite/heavyPages.ts",
      () => "export default []\n",
    );
  }
  if (groups.has("dashboard")) {
    plan.removals.add("src/views/dashboard");
    prefixes.push("/dashboard");
  }
  if (groups.has("sys-manage")) {
    plan.removals.add("src/views/sys-manage");
    prefixes.push("/sys-manage");
  }
  if (groups.has("iframe-about")) {
    plan.removals.add("src/views/iframe");
    plan.removals.add("src/views/about");
    prefixes.push("/iframe", "/about");
  }
  await trimRoutes(plan, prefixes);
  if (groups.has("analytics")) {
    await removeSymbols(
      plan,
      "src/main.ts",
      ["setupAnalytics"],
      ["@/plugins/analytics", "./plugins/analytics"],
    );
    await removeSymbols(plan, "src/plugins/index.ts", [], ["./analytics"]);
    plan.removals.add("src/plugins/analytics.ts");
    await plan.prunePackages(["@vercel/analytics", "@vercel/speed-insights"]);
  }
  if (groups.has("spline-3d")) await trimSpline(plan);
  const demoPackages = [
    "@antv/x6",
    "@kangc/v-md-editor",
    "@visactor/vtable-gantt",
    "@visactor/vtable-editors",
    "html2canvas",
    "print-js",
  ];
  if (groups.has("demo")) await plan.prunePackages(demoPackages);
  if (groups.has("demo") || groups.has("dashboard"))
    await plan.prunePackages(["echarts"]);
  await plan.apply();
  if (spinner) spinner.text = "模块与菜单已同步，共享运行时已保留";
}
