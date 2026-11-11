import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { parse, compileScript } from "@vue/compiler-sfc";
import {
  isTrimmableTemplate,
  getPresetSelection,
  getTrimSelection,
  getTrimSummary,
  executeTrimming,
} from "../src/trimmer";
import type { SelectedTemplate } from "../src/types";

let root: string;
const read = (file: string) => fs.readFile(path.join(root, file), "utf8");
const exists = (file: string) => fs.pathExists(path.join(root, file));
const write = (file: string, content: string) =>
  fs.outputFile(path.join(root, file), content);
const files: Record<string, string> = {
  "src/main.ts": `import App from './App.vue'
import { createDirectives } from '@robot-admin/directives'
import { setupHighlight } from '@/plugins/highlight'
import { setupAnalytics } from '@/plugins/analytics'
import { setupRoutePrefetch } from '@/router/routePrefetch'
async function bootstrap() {
  const app = createApp(App)
  setupHighlight(app)
  app.use(
    createDirectives({ notify: (type, text) => message[type](text) })
  )
  // analytics is optional; this comment and unrelated calls must survive.
  const analyticsLabel = 'analytics'
  console.log(analyticsLabel)
  setupAnalytics(
    router
  )
  setupRoutePrefetch(router)
  app.mount('#app')
}
bootstrap()
`,
  "src/App.vue": `<template><NConfigProvider :locale="languageStore.naiveLocale" :hljs="hljs"><RouterView /></NConfigProvider></template>
<script setup lang="ts">
import { useHighlight } from '@/plugins/highlight'
import { s_languageStore } from '@/stores/language'
const languageStore = s_languageStore()
const hljs = useHighlight()
</script>`,
  "src/plugins/highlight.ts":
    "import hljs from 'highlight.js'; export const useHighlight = () => hljs; export const setupHighlight = () => {}",
  "src/plugins/analytics.ts":
    "import { inject } from '@vercel/analytics'; import { injectSpeedInsights } from '@vercel/speed-insights'; export const setupAnalytics = () => { inject(); injectSpeedInsights() }",
  "src/plugins/index.ts":
    "export * from './highlight'\nexport * from './analytics'\n",
  "src/stores/language/index.ts":
    "export const s_languageStore = () => ({ naiveLocale: {} })",
  "src/utils/plugins/i18n-route.ts":
    "export const translateRouteTitle = (title: string) => title",
  "src/components/global/C_NavbarRight/d_searchMenu.ts":
    "import { translateRouteTitle } from '@/utils/plugins/i18n-route'; export const label = translateRouteTitle('菜单')",
  "src/views/login/index.vue": `<template>
  <div class="login-container">
    <div class="spline-background">
      <Spline
        scene="https://example.com/scene.splinecode"
        :paused="loading || captchaVisible"
        :on-load="handleRobotLoad"
      />
    </div>
    <section v-if="!robotReady" class="workspace-visual">工作空间</section>
    <C_Login @captcha-visible-change="captchaVisible = $event" />
  </div>
</template>
<script setup lang="ts">
import Spline from './components/Spline.vue'
const loading = ref(false)
const captchaVisible = ref(false)
const robotReady = ref(false)
const handleRobotLoad = () => {
  robotReady.value = true
}
</script>`,
  "src/views/login/components/Spline.vue":
    "<template><div /></template><script setup>import { Application } from '@splinetool/runtime'; const scene = Application</script>",
  "src/views/home/index.vue": "<template><div>首页</div></template>",
  "src/views/production-sales/sales-orders/index.vue":
    "<template><div>行业样例</div></template>",
  "src/views/demo/01-icon/index.vue":
    "<template><div /></template><script setup>import { Graph } from '@antv/x6'; const graph = Graph</script>",
  "src/views/dashboard/index.vue":
    "<template><div /></template><script setup>import * as echarts from 'echarts/core'; const charts = echarts</script>",
  "src/views/sys-manage/index.vue": "<template><div>管理</div></template>",
  "src/views/iframe/index.vue": "<template><div /></template>",
  "src/views/about/index.vue": "<template><div /></template>",
  "src/views/preview/index.vue": "<template><div /></template>",
  "src/router/previewRouter.ts":
    "export const previewRoutes = { path: '/preview', component: () => import('@/views/demo/01-icon/index.vue') }",
  "src/router/publicRouter.ts":
    "import { previewRoutes } from './previewRouter'\nexport const routes = [previewRoutes, {path:'/login', component: () => import('@/views/login/index.vue')}]",
  "src/router/routePrefetch.ts": `import { HEAVY_PAGES } from '@/config/heavyPages'
type RouteLoader = () => Promise<unknown>
type HeavyRoute = (typeof HEAVY_PAGES)[number]['routePath']
const HEAVY_ROUTE_LOADERS = {
  '/demo': () => import('@/views/demo/01-icon/index.vue')
} satisfies Record<HeavyRoute, RouteLoader>
export const setupRoutePrefetch = () => HEAVY_ROUTE_LOADERS
`,
  "src/config/heavyPages.ts":
    "export const HEAVY_PAGES = [{routePath:'/demo', viewPath:'/demo/01-icon', priority:1}] as const; export const HEAVY_PAGE_ROUTES = HEAVY_PAGES.map(p=>p.routePath)",
  "src/config/vite/heavyPages.ts": "export default ['/demo/01-icon']",
  "vite.config.ts": "export default { optimizeDeps: {include: ['vue']} }",
  "lang/index.js": "export const language = 'zh-cn'",
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "robot-trim-test-"));
  for (const [file, content] of Object.entries(files))
    await write(file, content);
  await fs.writeJson(path.join(root, "package.json"), {
    name: "fixture",
    dependencies: {
      vue: "3.5.42",
      echarts: "6.1.0",
      "@antv/x6": "2.19.2",
      "highlight.js": "11.11.1",
      "@splinetool/runtime": "1.12.68",
      "@vercel/analytics": "1.6.1",
      "@vercel/speed-insights": "2.0.0",
      "@robot-admin/directives": "2.0.1",
      "@robot-admin/form-validate": "3.4.4",
    },
    devDependencies: {
      "@robot-admin/git-standards": "1.0.5",
      "vite-auto-i18n-plugin": "1.1.16",
    },
  });
  await write(
    "src/assets/data/dynamicRouter.json",
    JSON.stringify({
      data: [
        { path: "/", children: [{ path: "home" }] },
        ...[
          "demo",
          "plugins",
          "editor",
          "hooks",
          "directives",
          "large-screen",
          "dashboard",
          "sys-manage",
          "iframe",
          "about",
          "production-sales",
        ].map((name) => ({ path: `/${name}` })),
      ],
    }),
  );
});
afterEach(async () => {
  await fs.remove(root);
});

function expectVueValid(content: string): void {
  const { descriptor, errors } = parse(content);
  expect(errors).toEqual([]);
  if (descriptor.scriptSetup)
    expect(() => compileScript(descriptor, { id: "test" })).not.toThrow();
}

describe("trim selection", () => {
  it("supports only the PC main template and provides truthful preset summaries", () => {
    const template = {
      key: "robot-admin",
      name: "PC",
      features: [],
      description: "",
      repoUrl: "",
      version: "full",
    } as SelectedTemplate;
    expect(isTrimmableTemplate(template)).toBe(true);
    expect(isTrimmableTemplate({ ...template, branch: "monorepo" })).toBe(
      false,
    );
    expect(getPresetSelection("full").groupsToTrim).toEqual([]);
    expect(getPresetSelection("lite").groupsToTrim).not.toContain("i18n");
    expect(getTrimSummary(getPresetSelection("lite"))).toContain("国际化");
    expect(getTrimSummary(getPresetSelection("lite"))).toContain("行业样例");
    expect(() => getTrimSelection("custom")).toThrow("逐项选择");
  });
});

describe("checked AST trimming", () => {
  it("produces a valid Lite project while keeping shared runtimes and business examples", async () => {
    await executeTrimming(root, getPresetSelection("lite"));
    for (const file of [
      "src/views/demo",
      "src/views/dashboard",
      "src/router/previewRouter.ts",
      "src/views/login/components/Spline.vue",
      "src/plugins/analytics.ts",
    ])
      expect(await exists(file)).toBe(false);
    for (const file of [
      "src/views/sys-manage",
      "src/views/production-sales",
      "src/plugins/highlight.ts",
      "src/stores/language",
      "src/utils/plugins/i18n-route.ts",
      "lang/index.js",
    ])
      expect(await exists(file)).toBe(true);
    expectVueValid(await read("src/views/login/index.vue"));
    expectVueValid(await read("src/App.vue"));
    expect(await read("src/views/login/index.vue")).not.toMatch(
      /Spline|robotReady|captchaVisible|handleRobotLoad/,
    );
    expect(await read("src/main.ts")).toContain("createDirectives(");
    expect(await read("src/main.ts")).toContain("setupHighlight(app)");
    expect(await read("src/main.ts")).not.toContain("setupAnalytics");
    expect(await read("src/main.ts")).toContain(
      "const analyticsLabel = 'analytics'",
    );
    expect(await read("src/router/routePrefetch.ts")).not.toContain(
      "import('@/views/demo/",
    );
    expect(await read("src/config/heavyPages.ts")).toContain(
      "DEV_WARMUP_FILES",
    );
    const menu = JSON.parse(await read("src/assets/data/dynamicRouter.json"));
    expect(menu.data.map((r: { path: string }) => r.path)).toEqual([
      "/",
      "/sys-manage",
      "/production-sales",
    ]);
    const pkg = JSON.parse(await read("package.json"));
    expect(pkg.dependencies["highlight.js"]).toBeDefined();
    expect(pkg.dependencies["@robot-admin/directives"]).toBeDefined();
    expect(pkg.dependencies["@robot-admin/form-validate"]).toBeDefined();
    expect(pkg.devDependencies["vite-auto-i18n-plugin"]).toBeDefined();
    for (const name of [
      "echarts",
      "@antv/x6",
      "@splinetool/runtime",
      "@vercel/analytics",
      "@vercel/speed-insights",
    ])
      expect(pkg.dependencies[name]).toBeUndefined();
  });

  it("supports old menu locations and nested relative route paths", async () => {
    await fs.move(
      path.join(root, "src/assets/data/dynamicRouter.json"),
      path.join(root, "src/assets/json/dynamicRouter.json"),
    );
    await write(
      "src/assets/json/dynamicRouter.json",
      JSON.stringify({
        data: [
          { path: "/", children: [{ path: "dashboard" }, { path: "home" }] },
        ],
      }),
    );
    await executeTrimming(root, {
      mode: "custom",
      groupsToTrim: ["dashboard"],
    });
    expect(
      JSON.parse(await read("src/assets/json/dynamicRouter.json")).data[0]
        .children,
    ).toEqual([{ path: "home" }]);
  });

  it("retains a dependency still used by another kept module", async () => {
    await write(
      "src/views/demo/02-chart/index.vue",
      "<template><div /></template><script setup>import * as echarts from 'echarts'; const charts = echarts</script>",
    );
    await executeTrimming(root, {
      mode: "custom",
      groupsToTrim: ["dashboard"],
    });
    expect(
      JSON.parse(await read("package.json")).dependencies.echarts,
    ).toBeDefined();
    expect(await exists("src/views/demo")).toBe(true);
  });

  it("checks both script blocks before pruning a shared dependency", async () => {
    await write(
      "src/components/chart.vue",
      `<script lang="ts">import { init } from 'echarts/core'; export default { methods: { chart: init } }</script><script setup lang="ts">const title = 'shared chart'</script><template><div>{{ title }}</div></template>`,
    );
    await executeTrimming(root, {
      mode: "custom",
      groupsToTrim: ["dashboard"],
    });
    expect(
      JSON.parse(await read("package.json")).dependencies.echarts,
    ).toBeDefined();
  });

  it("refuses an optional binding inside an unrelated call instead of deleting that call", async () => {
    const main =
      "import { setupAnalytics } from '@/plugins/analytics'\nconsole.log('inspect', setupAnalytics)\n";
    await write("src/main.ts", main);
    await expect(
      executeTrimming(root, { mode: "custom", groupsToTrim: ["analytics"] }),
    ).rejects.toThrow("仍使用");
    expect(await read("src/main.ts")).toBe(main);
  });

  it("checks dynamic import prefixes and Vue query imports before applying deletion", async () => {
    await write(
      "src/router/extra.ts",
      "export const load = (name: string) => import(`@/views/demo/${name}/index.vue`)",
    );
    await expect(
      executeTrimming(root, getPresetSelection("lite")),
    ).rejects.toThrow("extra.ts");
    expect(await exists("src/views/demo")).toBe(true);
    await write(
      "src/router/extra.ts",
      "export const source = () => import('@/views/login/components/Spline.vue?raw')",
    );
    await expect(
      executeTrimming(root, { mode: "custom", groupsToTrim: ["spline-3d"] }),
    ).rejects.toThrow("Spline.vue?raw");
  });

  it("removes aliased Spline components while keeping non-background wrappers", async () => {
    await write(
      "src/views/login/index.vue",
      `<template><div id="login"><Scene /></div></template><script setup lang="ts">import Scene from './components/Spline.vue'</script>`,
    );
    await executeTrimming(root, {
      mode: "custom",
      groupsToTrim: ["spline-3d"],
    });
    expect(await read("src/views/login/index.vue")).toContain('id="login"');
    expect(await read("src/views/login/index.vue")).not.toContain("Scene");
    expectVueValid(await read("src/views/login/index.vue"));
  });

  it("refuses unfamiliar Spline template bindings before changing source", async () => {
    const login = files["src/views/login/index.vue"]!.replace(
      'v-if="!robotReady"',
      'v-if="robotReady === false"',
    );
    await write("src/views/login/index.vue", login);
    await expect(
      executeTrimming(root, { mode: "custom", groupsToTrim: ["spline-3d"] }),
    ).rejects.toThrow("仍使用 3D 背景绑定");
    expect(await read("src/views/login/index.vue")).toBe(login);
  });

  it("removes aliased multiline plugin calls without deleting unrelated statements", async () => {
    await write(
      "src/main.ts",
      "import { setupAnalytics as enableStats } from '@/plugins/analytics'\nfunction bootstrap() { enableStats(\n router\n); console.log('keep') }\nbootstrap()\n",
    );
    await executeTrimming(root, {
      mode: "custom",
      groupsToTrim: ["analytics"],
    });
    expect(await read("src/main.ts")).not.toContain("enableStats");
    expect(await read("src/main.ts")).toContain("console.log('keep')");
  });

  it("rejects an unrecognized plugin binding use before removing the import", async () => {
    const main =
      "import { setupAnalytics } from '@/plugins/analytics'\nexport const initializer = setupAnalytics\n";
    await write("src/main.ts", main);
    await expect(
      executeTrimming(root, { mode: "custom", groupsToTrim: ["analytics"] }),
    ).rejects.toThrow("仍使用");
    expect(await read("src/main.ts")).toBe(main);
    expect(await exists("src/plugins/analytics.ts")).toBe(true);
  });

  it("rejects an unknown route-prefetch shape before touching files", async () => {
    await write(
      "src/router/routePrefetch.ts",
      "export const load = () => import('@/views/demo/01-icon/index.vue')",
    );
    const before = await read("package.json");
    await expect(
      executeTrimming(root, getPresetSelection("lite")),
    ).rejects.toThrow("routePrefetch.ts");
    expect(await exists("src/views/demo")).toBe(true);
    expect(await read("package.json")).toBe(before);
    expect(await read("src/views/login/index.vue")).toBe(
      files["src/views/login/index.vue"],
    );
  });

  it("rejects missing menu contracts before changing the project", async () => {
    await fs.remove(path.join(root, "src/assets/data/dynamicRouter.json"));
    await expect(
      executeTrimming(root, { mode: "custom", groupsToTrim: ["dashboard"] }),
    ).rejects.toThrow("菜单位置已变化");
    expect(await exists("src/views/dashboard")).toBe(true);
  });

  it("rejects legacy shared-runtime deletion without changing files", async () => {
    await expect(
      executeTrimming(root, {
        mode: "custom",
        groupsToTrim: ["i18n", "directives"],
      }),
    ).rejects.toThrow("核心运行时");
    expect(await read("src/main.ts")).toBe(files["src/main.ts"]);
  });

  it("preserves every file and dependency in Full mode", async () => {
    const pkg = await read("package.json");
    await executeTrimming(root, getPresetSelection("full"));
    expect(await read("package.json")).toBe(pkg);
    for (const [file, content] of Object.entries(files))
      expect(await read(file)).toBe(content);
  });

  it("is idempotent on a previously generated Lite project", async () => {
    await executeTrimming(root, getPresetSelection("lite"));
    const login = await read("src/views/login/index.vue");
    await executeTrimming(root, getPresetSelection("lite"));
    expect(await read("src/views/login/index.vue")).toBe(login);
    expectVueValid(login);
  });
});
