import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import {
  assertTemplateRuntime,
  getRequiredPackageManager,
  loadAndValidateTemplateManifest,
  runTemplateInitializer,
  resolveDownloadedTemplateRuntime,
} from "../src/template-runtime";
import type { SelectedTemplate } from "../src/types";

// General contract fixtures run on every CLI CI version; real H5 requirements are tested explicitly.
const FIXTURE_NODE_RANGE = ">=20.0.0";

function makeTemplate(
  overrides: Partial<SelectedTemplate> = {},
): SelectedTemplate {
  return {
    key: "robot-h5",
    name: "Robot H5 企业移动端",
    description: "fixture",
    repoUrl: "https://example.invalid/robot-h5",
    features: ["Vant 4"],
    version: "full",
    status: "beta",
    runtime: {
      node: FIXTURE_NODE_RANGE,
      packageManager: "pnpm",
      packageManagerVersion: "^11.8.0",
    },
    initializer: {
      manifestPath: "template.manifest.json",
      manifestId: "mobile.robot-h5",
      command: "node",
      args: [
        "scripts/setup-project.mjs",
        "--yes",
        "--project-name",
        "{projectName}",
        "--title",
        "{projectTitle}",
        "--created-by",
        "robot-cli",
      ],
    },
    startScript: "dev",
    ...overrides,
  };
}

describe("template runtime contract", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "robot-runtime-test-"));
    await fs.ensureDir(path.join(root, "scripts"));
    await fs.writeJson(path.join(root, "package.json"), { name: "fixture" });
    await fs.writeJson(path.join(root, "template.manifest.json"), {
      schemaVersion: 1,
      id: "mobile.robot-h5",
      name: "Robot H5",
      version: "1.6.1",
      category: "mobile",
      runtime: {
        node: FIXTURE_NODE_RANGE,
        packageManager: "pnpm@11.8.0",
      },
      entry: {
        nonInteractive: "node scripts/setup-project.mjs --yes",
      },
    });
    await fs.writeFile(
      path.join(root, "scripts", "setup-project.mjs"),
      `
        import { writeFile } from "node:fs/promises";
        import path from "node:path";
        const args = process.argv.slice(2);
        const read = (name) => args[args.indexOf(name) + 1];
        await writeFile(path.join(process.cwd(), "initialized.json"), JSON.stringify({
          projectName: read("--project-name"),
          title: read("--title"),
          createdBy: read("--created-by")
        }));
      `,
      "utf8",
    );
  });

  afterEach(async () => {
    await fs.remove(root);
  });

  it("accepts supported Node.js versions and rejects unsupported ones", () => {
    const template = makeTemplate({ runtime: { node: "^22.13.0 || ^24.0.0" } });
    expect(() => assertTemplateRuntime(template, "22.13.0")).not.toThrow();
    expect(() => assertTemplateRuntime(template, "24.1.0")).not.toThrow();
    expect(() => assertTemplateRuntime(template, "22.12.0")).toThrow(/要求 Node\.js/);
    expect(() => assertTemplateRuntime(template, "20.19.0")).toThrow(
      /要求 Node\.js/,
    );
  });

  it("checks the actual Node binary when hosted by Bun instead of its compatibility version", () => {
    const descriptor = Object.getOwnPropertyDescriptor(process, "versions")!;
    Object.defineProperty(process, "versions", { ...descriptor, value: { ...process.versions, node: "99.0.0", bun: "fixture" } });
    try {
      expect(() => assertTemplateRuntime(makeTemplate({ runtime: { node: ">=20.0.0 <30" } }))).not.toThrow();
    } finally { Object.defineProperty(process, "versions", descriptor); }
  });

  it("exposes the package manager required by the template", () => {
    expect(getRequiredPackageManager(makeTemplate())).toBe("pnpm");
    expect(
      getRequiredPackageManager(makeTemplate({ runtime: undefined })),
    ).toBeUndefined();
  });

  it.each(["20.19.0", "22.18.0", "24.1.0"])("validates general fixtures on CLI CI Node %s", async (version) => {
    await expect(loadAndValidateTemplateManifest(root, makeTemplate(), version)).resolves.toMatchObject({ id: "mobile.robot-h5" });
  });

  it("validates the manifest and runs the initializer without a shell", async () => {
    const template = makeTemplate();
    const manifest = await runTemplateInitializer(
      root,
      "mobile-demo",
      template,
      { description: "Mobile Demo" },
    );
    const initialized = await fs.readJson(path.join(root, "initialized.json"));

    expect(manifest?.id).toBe("mobile.robot-h5");
    expect(initialized).toEqual({
      projectName: "mobile-demo",
      title: "Mobile Demo",
      createdBy: "robot-cli",
    });
  });

  it("rejects a repository whose manifest id does not match", async () => {
    const manifestPath = path.join(root, "template.manifest.json");
    const manifest = await fs.readJson(manifestPath);
    manifest.id = "mobile.another-template";
    await fs.writeJson(manifestPath, manifest);

    await expect(
      loadAndValidateTemplateManifest(root, makeTemplate()),
    ).rejects.toThrow(/模板契约不匹配/);
  });

  it("rejects package-manager contract drift", async () => {
    const manifestPath = path.join(root, "template.manifest.json");
    const manifest = await fs.readJson(manifestPath);
    manifest.runtime.packageManager = "bun@1.3.0";
    await fs.writeJson(manifestPath, manifest);

    await expect(
      loadAndValidateTemplateManifest(root, makeTemplate()),
    ).rejects.toThrow(/包管理器契约漂移/);
  });

  it("rejects a missing package-manager version contract", async () => {
    const manifestPath = path.join(root, "template.manifest.json");
    const manifest = await fs.readJson(manifestPath);
    manifest.runtime.packageManager = "pnpm";
    await fs.writeJson(manifestPath, manifest);

    await expect(
      loadAndValidateTemplateManifest(root, makeTemplate()),
    ).rejects.toThrow(/包管理器版本契约/);
  });

  it("rejects an incomplete runtime contract", async () => {
    const manifestPath = path.join(root, "template.manifest.json");
    const manifest = await fs.readJson(manifestPath);
    delete manifest.runtime.node;
    await fs.writeJson(manifestPath, manifest);

    await expect(
      loadAndValidateTemplateManifest(root, makeTemplate()),
    ).rejects.toThrow(/Node\.js 契约/);
  });

  it("rejects a manifest that declares a different initialization script", async () => {
    const manifestPath = path.join(root, "template.manifest.json");
    const manifest = await fs.readJson(manifestPath);
    manifest.entry.nonInteractive = "node scripts/other.mjs --yes";
    await fs.writeJson(manifestPath, manifest);
    await expect(loadAndValidateTemplateManifest(root, makeTemplate())).rejects.toThrow(/初始化入口与 CLI 配置不一致/);
  });

  it("rejects initializer commands other than Node.js", async () => {
    const template = makeTemplate();
    if (!template.initializer) throw new Error("initializer fixture missing");
    template.initializer.command = "bash" as "node";

    await expect(
      loadAndValidateTemplateManifest(root, template),
    ).rejects.toThrow(/只支持带脚本路径的 node 命令/);
  });

  it("accepts changed Node ranges when the actual Node version remains supported", async () => {
    const manifestPath = path.join(root, "template.manifest.json");
    const manifest = await fs.readJson(manifestPath);
    manifest.runtime.node = "^22.13.0 || ^24.0.0";
    await fs.writeJson(manifestPath, manifest);
    const template = makeTemplate({ runtime: { node: "^22.12.0 || ^24.0.0" } });
    await expect(loadAndValidateTemplateManifest(root, template, "24.1.0")).resolves.toMatchObject({ id: "mobile.robot-h5" });
    await expect(loadAndValidateTemplateManifest(root, template, "22.12.0")).rejects.toThrow(/要求 Node\.js/);
  });

  it("uses the downloaded manifest package-manager version rather than stale registry hints", async () => {
    const manifestPath = path.join(root, "template.manifest.json");
    const manifest = await fs.readJson(manifestPath);
    manifest.runtime.packageManager = "pnpm@12.0.0";
    await fs.writeJson(manifestPath, manifest);
    const resolved = await resolveDownloadedTemplateRuntime(root, makeTemplate(), "24.1.0");
    expect(resolved.runtime?.packageManagerVersion).toBe("12.0.0");
  });

  it("reads Node and Bun requirements from a downloaded PC template", async () => {
    await fs.writeJson(path.join(root, "package.json"), {
      name: "pc-fixture",
      packageManager: "bun@1.4.2",
      engines: { node: ">=22.18.0", bun: ">=1.4.2" },
    });
    const template = makeTemplate({ initializer: undefined, runtime: undefined });
    const resolved = await resolveDownloadedTemplateRuntime(root, template, "22.18.0");
    expect(resolved.runtime).toEqual({ node: ">=22.18.0", packageManager: "bun", packageManagerVersion: ">=1.4.2" });
    await expect(resolveDownloadedTemplateRuntime(root, template, "22.17.0")).rejects.toThrow(/要求 Node\.js/);
  });

  it("also checks package.json engines when the manifest permits an older Node version", async () => {
    await fs.writeJson(path.join(root, "package.json"), { name: "fixture", engines: { node: ">=24" } });
    await expect(resolveDownloadedTemplateRuntime(root, makeTemplate(), "22.18.0")).rejects.toThrow(/要求 Node\.js >=24/);
  });

  it("rejects inconsistent manifest and package-manager pins", async () => {
    await fs.writeJson(path.join(root, "package.json"), { name: "fixture", packageManager: "pnpm@12.0.0" });
    await expect(resolveDownloadedTemplateRuntime(root, makeTemplate(), "24.1.0")).rejects.toThrow(/模板包管理器声明不一致/);
  });

  it.skipIf(process.platform === "win32")("rejects a symlinked initializer outside the template", async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "robot-initializer-outside-"));
    try {
      const script = path.join(root, "scripts/setup-project.mjs");
      const external = path.join(outside, "setup.mjs");
      await fs.writeFile(external, "throw new Error('outside')");
      await fs.remove(script);
      await fs.symlink(external, script);
      await expect(loadAndValidateTemplateManifest(root, makeTemplate())).rejects.toThrow(/模板契约路径越界/);
    } finally { await fs.remove(outside); }
  });

  it("terminates an active initializer when creation is cancelled", async () => {
    await fs.writeFile(path.join(root, "scripts/setup-project.mjs"), "import { writeFileSync } from 'node:fs'; writeFileSync('started', 'yes'); setInterval(() => {}, 1000);");
    const controller = new AbortController();
    const pending = runTemplateInitializer(root, "cancelled", makeTemplate(), { description: "" }, undefined, controller.signal);
    const rejected = expect(pending).rejects.toThrow(/模板初始化失败/);
    await vi.waitFor(async () => expect(await fs.pathExists(path.join(root, "started"))).toBe(true));
    controller.abort();
    await rejected;
  });

  it("keeps the application title independent of the package description", async () => {
    await runTemplateInitializer(root, "mobile-demo", makeTemplate(), { description: "Package description", title: "现场作业" });
    expect((await fs.readJson(path.join(root, "initialized.json"))).title).toBe("现场作业");
  });
});
