import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import {
  isTrimmableTemplate,
  getTrimSummary,
  executeTrimming,
} from "../src/trimmer";
import type { SelectedTemplate } from "../src/types";

// ── Test Helpers ─────────────────────────────────────────────────

function makeTemplate(
  overrides: Partial<SelectedTemplate> = {},
): SelectedTemplate {
  return {
    key: "robot-admin",
    name: "Robot Admin 完整版",
    description: "test",
    repoUrl: "https://github.com/ChenyCHENYU/Robot_Admin",
    features: [],
    version: "full",
    ...overrides,
  };
}

let testDir: string;

async function setupTestProject(): Promise<string> {
  testDir = path.join(os.tmpdir(), `robot-cli-test-${Date.now()}`);
  await fs.ensureDir(testDir);

  // Create minimal project structure for trimming tests
  await fs.writeJson(
    path.join(testDir, "package.json"),
    {
      name: "test-project",
      dependencies: {
        vue: "^3.5.0",
        echarts: "^6.0.0",
        "@splinetool/runtime": "^1.12.68",
        "@vercel/analytics": "^1.6.1",
        "@robot-admin/directives": "workspace:*",
        "@robot-admin/file-utils": "workspace:*",
        "@robot-admin/form-validate": "workspace:*",
        "@robot-admin/git-standards": "workspace:*",
        "vue-command-palette": "^0.2.3",
        "motion-v": "^1.10.3",
        "@antv/x6": "^2.19.2",
        "highlight.js": "^11.11.1",
      },
      devDependencies: {
        "vite-auto-i18n-plugin": "^1.1.16",
      },
      scripts: {
        dev: "vite",
        "gen:route-i18n": "ts-node scripts/generate-route-translations.ts",
      },
    },
    { spaces: 2 },
  );

  // Create dynamicRouter.json
  const routerDir = path.join(testDir, "src", "assets", "json");
  await fs.ensureDir(routerDir);
  await fs.writeJson(
    path.join(routerDir, "dynamicRouter.json"),
    {
      data: [
        { path: "/home", name: "Home" },
        { path: "/dashboard", name: "Dashboard", children: [] },
        { path: "/demo", name: "Demo" },
        { path: "/plugins", name: "Plugins" },
        { path: "/editor", name: "Editor" },
        { path: "/large-screen", name: "LargeScreen" },
        { path: "/hooks", name: "Hooks" },
        { path: "/directives", name: "Directives" },
        { path: "/sys-manage", name: "SysManage" },
        { path: "/iframe", name: "Iframe" },
        { path: "/about", name: "About" },
        { path: "/error-page", name: "ErrorPage" },
      ],
    },
    { spaces: 2 },
  );

  // Create source directories
  const dirs = [
    "src/views/demo/01-icon",
    "src/views/demo/02-button",
    "src/views/preview",
    "src/views/dashboard/analysis",
    "src/views/dashboard/statistics",
    "src/views/sys-manage/user",
    "src/views/iframe",
    "src/views/about",
    "src/views/login/components",
    "src/components/local/c_vTitle",
    "src/components/local/c_detail",
    "src/components/local/c_role",
    "src/plugins",
    "src/stores/language",
    "src/config/vite",
    "src/styles",
    "src/router",
    "src/api",
    "src/assets/data",
    "lang",
    "scripts",
  ];
  for (const dir of dirs) {
    await fs.ensureDir(path.join(testDir, dir));
  }

  // Create source files
  const files: Record<string, string> = {
    "src/main.ts": `
import '../lang/index.js'
import './utils/plugins/i18n-route.ts'
import { setupHighlight } from './plugins/highlight'
import { setupMarkdown } from './plugins/markdown'
import { setupDynamicComponents } from './plugins/dynamic-components'
import { setupDirectives } from '@robot-admin/directives'
import { setupFileUtils } from './plugins/file-utils'
import { setupAnalytics } from './plugins/analytics'
const app = createApp(App)
setupHighlight(app)
setupMarkdown(app)
setupDynamicComponents(app)
setupDirectives(app)
setupFileUtils(app)
setupAnalytics(app)
app.mount('#app')
`,
    "src/plugins/index.ts": `
export { setupHighlight } from './highlight'
export { setupMarkdown } from './markdown'
export { setupDynamicComponents } from './dynamic-components'
export { setupFileUtils } from './file-utils'
export { setupAnalytics } from './analytics'
`,
    "src/plugins/highlight.ts": "export function setupHighlight() {}",
    "src/plugins/markdown.ts": "export function setupMarkdown() {}",
    "src/plugins/dynamic-components.ts":
      "export function setupDynamicComponents() {}",
    "src/plugins/file-utils.ts": "export function setupFileUtils() {}",
    "src/plugins/analytics.ts": "export function setupAnalytics() {}",
    "src/router/previewRouter.ts": "export const previewRoutes = []",
    "src/router/publicRouter.ts": `
import { previewRoutes } from './previewRouter'
export const routes = [...previewRoutes]
`,
    "src/router/dynamicRouter.ts": `
const EAGER_DASH = import.meta.glob('./dashboard/**/*.vue', { eager: true })
const VIEW_MODULES = { ...EAGER_DASH }
`,
    "src/config/vite/heavyPages.ts": `export default ['/demo/01', '/demo/02']`,
    "src/config/vite/viteI18nConfig.ts":
      "export function createI18nPlugin() {}",
    "src/config/vite/index.ts": `
export { createI18nPlugin } from './viteI18nConfig'
export { default as heavyPages } from './heavyPages'
`,
    "src/config/vite/viteBuildConfig.ts": `
export default {
  rollupOptions: {
    output: {
      manualChunks: {
        splinetool: ['@splinetool/runtime'],
      }
    }
  }
}
`,
    "src/styles/antv-common.scss": ".antv { color: red; }",
    "src/styles/v-md-editor-dark-theme.scss": ".v-md-editor { color: dark; }",
    "src/styles/workflow-theme.scss": ".workflow { color: blue; }",
    "src/stores/language/index.ts": "export const s_languageStore = {}",
    "src/utils/plugins/i18n-route.ts": "export default {}",
    "src/api/permission-manage.ts": "export function getPermissions() {}",
    "src/assets/data/echarts-package-size.json": "{}",
    "src/views/login/components/Spline.vue":
      "<template><div>Spline</div></template>",
    "src/views/login/index.vue": `
<template>
  <Spline />
  <div>Login</div>
</template>
<script setup>
import Spline from './components/Spline.vue'
import { s_languageStore } from '@/stores/language'
const langStore = s_languageStore()
</script>
`,
    "src/components/global/C_NavbarRight/index.vue": `
<template>
  <C_Language />
  <div>NavbarRight</div>
</template>
<script setup>
import { s_languageStore } from '@/stores/language'
import { translateRouteTitle } from '@/utils/plugins/i18n-route'
const languageStore = s_languageStore()
</script>
`,
    "src/components/global/C_Layout/index.vue": `
<template>
  <div :label-formatter="translateRouteTitle">Layout</div>
</template>
<script setup>
import { translateRouteTitle } from '@/utils/plugins/i18n-route'
</script>
`,
    "src/components/global/C_Header/index.vue": `
<template>
  <div :label-formatter="translateRouteTitle">Header</div>
</template>
<script setup>
import { translateRouteTitle } from '@/utils/plugins/i18n-route'
</script>
`,
    "src/App.vue": `
<template>
  <n-config-provider :locale="languageStore.naiveLocale" :date-locale="languageStore.naiveDateLocale">
    <router-view />
  </n-config-provider>
</template>
<script setup>
import { s_languageStore } from '@/stores/language'
const languageStore = s_languageStore()
</script>
`,
    "lang/index.js": "export default {}",
    "lang/index.json": "{}",
    "scripts/generate-route-translations.ts": "console.log('gen i18n')",
    "vite.config.ts": `
import { createI18nPlugin } from './src/config/vite'
export default {
  optimizeDeps: {
    include: [
      '@antv/x6',
      'echarts',
      'echarts/core',
      'echarts/charts',
      'echarts/renderers',
    ]
  },
  plugins: [
    createI18nPlugin(),
  ]
}
`,
  };

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(testDir, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
  }

  return testDir;
}

// ── Tests ────────────────────────────────────────────────────────

describe("isTrimmableTemplate", () => {
  it("should return true for robot-admin main branch", () => {
    expect(isTrimmableTemplate(makeTemplate())).toBe(true);
  });

  it("should return false for robot-admin with branch", () => {
    expect(isTrimmableTemplate(makeTemplate({ branch: "monorepo" }))).toBe(
      false,
    );
  });

  it("should return false for other templates", () => {
    expect(isTrimmableTemplate(makeTemplate({ key: "robot-uniapp" }))).toBe(
      false,
    );
    expect(
      isTrimmableTemplate(
        makeTemplate({ key: "robot-monorepo", branch: "monorepo" }),
      ),
    ).toBe(false);
  });
});

describe("getTrimSummary", () => {
  it("should return correct summary for full mode", () => {
    const summary = getTrimSummary({ mode: "full", groupsToTrim: [] });
    expect(summary).toContain("完整版");
  });

  it("should return correct summary for lite mode", () => {
    const summary = getTrimSummary({
      mode: "lite",
      groupsToTrim: ["demo", "dashboard"],
    });
    expect(summary).toContain("精简版");
  });

  it("should return correct summary for custom mode", () => {
    const summary = getTrimSummary({ mode: "custom", groupsToTrim: ["demo"] });
    expect(summary).toContain("自定义");
    expect(summary).toContain("演示页面");
  });

  it("should handle empty custom selection", () => {
    const summary = getTrimSummary({ mode: "custom", groupsToTrim: [] });
    expect(summary).toContain("自定义");
    expect(summary).toContain("保留全部");
  });
});

describe("executeTrimming", () => {
  beforeEach(async () => {
    await setupTestProject();
  });

  afterEach(async () => {
    if (testDir) await fs.remove(testDir).catch(() => {});
  });

  it("should always execute group Z (zero-use deps)", async () => {
    await executeTrimming(testDir, { mode: "full", groupsToTrim: [] });

    const pkg = await fs.readJson(path.join(testDir, "package.json"));
    expect(pkg.dependencies["vue-command-palette"]).toBeUndefined();
    expect(pkg.dependencies["motion-v"]).toBeUndefined();
    // Other deps should remain
    expect(pkg.dependencies["vue"]).toBeDefined();
  });

  it("should trim demo pages (group A)", async () => {
    await executeTrimming(testDir, { mode: "custom", groupsToTrim: ["demo"] });

    // Demo dirs removed
    expect(await fs.pathExists(path.join(testDir, "src/views/demo"))).toBe(
      false,
    );
    expect(await fs.pathExists(path.join(testDir, "src/views/preview"))).toBe(
      false,
    );
    expect(
      await fs.pathExists(path.join(testDir, "src/components/local/c_vTitle")),
    ).toBe(false);

    // Demo styles removed
    expect(
      await fs.pathExists(path.join(testDir, "src/styles/antv-common.scss")),
    ).toBe(false);

    // Demo plugins removed
    expect(
      await fs.pathExists(path.join(testDir, "src/plugins/highlight.ts")),
    ).toBe(false);
    expect(
      await fs.pathExists(path.join(testDir, "src/plugins/markdown.ts")),
    ).toBe(false);

    // Demo deps removed
    const pkg = await fs.readJson(path.join(testDir, "package.json"));
    expect(pkg.dependencies["@antv/x6"]).toBeUndefined();
    expect(pkg.dependencies["highlight.js"]).toBeUndefined();

    // Demo routes removed from dynamicRouter.json
    const router = await fs.readJson(
      path.join(testDir, "src/assets/json/dynamicRouter.json"),
    );
    const paths = router.data.map((r: { path: string }) => r.path);
    expect(paths).not.toContain("/demo");
    expect(paths).not.toContain("/plugins");
    expect(paths).toContain("/home"); // preserved
    expect(paths).toContain("/dashboard"); // preserved

    // main.ts modified
    const mainTs = await fs.readFile(path.join(testDir, "src/main.ts"), "utf8");
    expect(mainTs).not.toContain("setupHighlight");
    expect(mainTs).not.toContain("setupMarkdown");
    expect(mainTs).toContain("app.mount"); // preserved
  });

  it("should trim dashboard (group B)", async () => {
    await executeTrimming(testDir, {
      mode: "custom",
      groupsToTrim: ["dashboard"],
    });

    expect(await fs.pathExists(path.join(testDir, "src/views/dashboard"))).toBe(
      false,
    );

    const pkg = await fs.readJson(path.join(testDir, "package.json"));
    expect(pkg.dependencies["echarts"]).toBeUndefined();

    const router = await fs.readJson(
      path.join(testDir, "src/assets/json/dynamicRouter.json"),
    );
    const paths = router.data.map((r: { path: string }) => r.path);
    expect(paths).not.toContain("/dashboard");
    expect(paths).toContain("/home");
  });

  it("should trim i18n (group C)", async () => {
    await executeTrimming(testDir, { mode: "custom", groupsToTrim: ["i18n"] });

    // i18n files removed
    expect(await fs.pathExists(path.join(testDir, "lang"))).toBe(false);
    expect(await fs.pathExists(path.join(testDir, "src/stores/language"))).toBe(
      false,
    );

    // DevDeps removed
    const pkg = await fs.readJson(path.join(testDir, "package.json"));
    expect(pkg.devDependencies["vite-auto-i18n-plugin"]).toBeUndefined();

    // Scripts removed
    expect(pkg.scripts["gen:route-i18n"]).toBeUndefined();
    expect(pkg.scripts["dev"]).toBeDefined(); // preserved

    // main.ts modified
    const mainTs = await fs.readFile(path.join(testDir, "src/main.ts"), "utf8");
    expect(mainTs).not.toContain("lang/index");
    expect(mainTs).not.toContain("i18n-route");

    // C_NavbarRight modified
    const navbar = await fs.readFile(
      path.join(testDir, "src/components/global/C_NavbarRight/index.vue"),
      "utf8",
    );
    expect(navbar).not.toContain("C_Language");
    expect(navbar).not.toContain("translateRouteTitle");
  });

  it("should trim analytics (group D)", async () => {
    await executeTrimming(testDir, {
      mode: "custom",
      groupsToTrim: ["analytics"],
    });

    expect(
      await fs.pathExists(path.join(testDir, "src/plugins/analytics.ts")),
    ).toBe(false);

    const pkg = await fs.readJson(path.join(testDir, "package.json"));
    expect(pkg.dependencies["@vercel/analytics"]).toBeUndefined();

    const mainTs = await fs.readFile(path.join(testDir, "src/main.ts"), "utf8");
    expect(mainTs).not.toContain("setupAnalytics");
  });

  it("should trim sys-manage (group E)", async () => {
    await executeTrimming(testDir, {
      mode: "custom",
      groupsToTrim: ["sys-manage"],
    });

    expect(
      await fs.pathExists(path.join(testDir, "src/views/sys-manage")),
    ).toBe(false);
    expect(
      await fs.pathExists(path.join(testDir, "src/api/permission-manage.ts")),
    ).toBe(false);
    expect(
      await fs.pathExists(path.join(testDir, "src/components/local/c_detail")),
    ).toBe(false);
    expect(
      await fs.pathExists(path.join(testDir, "src/components/local/c_role")),
    ).toBe(false);

    const router = await fs.readJson(
      path.join(testDir, "src/assets/json/dynamicRouter.json"),
    );
    const paths = router.data.map((r: { path: string }) => r.path);
    expect(paths).not.toContain("/sys-manage");
  });

  it("should trim @robot-admin optional packages (group F)", async () => {
    await executeTrimming(testDir, {
      mode: "custom",
      groupsToTrim: [
        "directives",
        "file-utils",
        "form-validate",
        "git-standards",
      ],
    });

    const pkg = await fs.readJson(path.join(testDir, "package.json"));
    expect(pkg.dependencies["@robot-admin/directives"]).toBeUndefined();
    expect(pkg.dependencies["@robot-admin/file-utils"]).toBeUndefined();
    expect(pkg.dependencies["@robot-admin/form-validate"]).toBeUndefined();
    expect(pkg.dependencies["@robot-admin/git-standards"]).toBeUndefined();

    const mainTs = await fs.readFile(path.join(testDir, "src/main.ts"), "utf8");
    expect(mainTs).not.toContain("setupDirectives");
    expect(mainTs).not.toContain("setupFileUtils");
    expect(mainTs).not.toContain("@robot-admin/directives");

    expect(
      await fs.pathExists(path.join(testDir, "src/plugins/file-utils.ts")),
    ).toBe(false);
  });

  it("should trim iframe + about (group G)", async () => {
    await executeTrimming(testDir, {
      mode: "custom",
      groupsToTrim: ["iframe-about"],
    });

    expect(await fs.pathExists(path.join(testDir, "src/views/iframe"))).toBe(
      false,
    );
    expect(await fs.pathExists(path.join(testDir, "src/views/about"))).toBe(
      false,
    );

    const router = await fs.readJson(
      path.join(testDir, "src/assets/json/dynamicRouter.json"),
    );
    const paths = router.data.map((r: { path: string }) => r.path);
    expect(paths).not.toContain("/iframe");
    expect(paths).not.toContain("/about");
    expect(paths).toContain("/home");
  });

  it("should trim Spline 3D (group H)", async () => {
    await executeTrimming(testDir, {
      mode: "custom",
      groupsToTrim: ["spline-3d"],
    });

    expect(
      await fs.pathExists(
        path.join(testDir, "src/views/login/components/Spline.vue"),
      ),
    ).toBe(false);

    const pkg = await fs.readJson(path.join(testDir, "package.json"));
    expect(pkg.dependencies["@splinetool/runtime"]).toBeUndefined();

    const loginVue = await fs.readFile(
      path.join(testDir, "src/views/login/index.vue"),
      "utf8",
    );
    expect(loginVue).not.toContain("Spline");
    expect(loginVue).toContain("Login"); // preserved
  });

  it("should execute full lite preset correctly", async () => {
    const liteGroups = [
      "demo",
      "dashboard",
      "i18n",
      "analytics",
      "directives",
      "file-utils",
      "form-validate",
      "git-standards",
      "iframe-about",
      "spline-3d",
    ];

    await executeTrimming(testDir, { mode: "lite", groupsToTrim: liteGroups });

    // Group Z always runs
    const pkg = await fs.readJson(path.join(testDir, "package.json"));
    expect(pkg.dependencies["vue-command-palette"]).toBeUndefined();
    expect(pkg.dependencies["motion-v"]).toBeUndefined();

    // Demo pages removed
    expect(await fs.pathExists(path.join(testDir, "src/views/demo"))).toBe(
      false,
    );

    // Dashboard removed
    expect(await fs.pathExists(path.join(testDir, "src/views/dashboard"))).toBe(
      false,
    );
    expect(pkg.dependencies["echarts"]).toBeUndefined();

    // i18n removed
    expect(await fs.pathExists(path.join(testDir, "lang"))).toBe(false);

    // Analytics removed
    expect(
      await fs.pathExists(path.join(testDir, "src/plugins/analytics.ts")),
    ).toBe(false);

    // Optional packages removed
    expect(pkg.dependencies["@robot-admin/directives"]).toBeUndefined();
    expect(pkg.dependencies["@robot-admin/form-validate"]).toBeUndefined();

    // iframe + about removed
    expect(await fs.pathExists(path.join(testDir, "src/views/iframe"))).toBe(
      false,
    );
    expect(await fs.pathExists(path.join(testDir, "src/views/about"))).toBe(
      false,
    );

    // Spline removed
    expect(
      await fs.pathExists(
        path.join(testDir, "src/views/login/components/Spline.vue"),
      ),
    ).toBe(false);

    // Core preserved
    expect(pkg.dependencies["vue"]).toBeDefined();
    expect(
      await fs.pathExists(path.join(testDir, "src/views/login/index.vue")),
    ).toBe(true);

    // sys-manage preserved (not in lite)
    expect(
      await fs.pathExists(path.join(testDir, "src/views/sys-manage")),
    ).toBe(true);

    // Router core preserved
    const router = await fs.readJson(
      path.join(testDir, "src/assets/json/dynamicRouter.json"),
    );
    const paths = router.data.map((r: { path: string }) => r.path);
    expect(paths).toContain("/home");
    expect(paths).toContain("/error-page");
    expect(paths).toContain("/sys-manage"); // preserved in lite
  });

  it("should preserve everything in full mode (except group Z)", async () => {
    await executeTrimming(testDir, { mode: "full", groupsToTrim: [] });

    // Group Z still runs
    const pkg = await fs.readJson(path.join(testDir, "package.json"));
    expect(pkg.dependencies["vue-command-palette"]).toBeUndefined();

    // Everything else preserved
    expect(await fs.pathExists(path.join(testDir, "src/views/demo"))).toBe(
      true,
    );
    expect(await fs.pathExists(path.join(testDir, "src/views/dashboard"))).toBe(
      true,
    );
    expect(
      await fs.pathExists(path.join(testDir, "src/views/sys-manage")),
    ).toBe(true);
    expect(pkg.dependencies["echarts"]).toBeDefined();
    expect(pkg.dependencies["@robot-admin/directives"]).toBeDefined();
  });

  it("should handle missing files gracefully", async () => {
    // Remove some files before trimming to test resilience
    await fs.remove(path.join(testDir, "src/plugins/highlight.ts"));
    await fs.remove(path.join(testDir, "src/views/dashboard"));

    // Should not throw
    await expect(
      executeTrimming(testDir, {
        mode: "lite",
        groupsToTrim: ["demo", "dashboard"],
      }),
    ).resolves.not.toThrow();
  });
});
