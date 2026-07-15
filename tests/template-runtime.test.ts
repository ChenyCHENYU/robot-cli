import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import {
  assertTemplateRuntime,
  getRequiredPackageManager,
  loadAndValidateTemplateManifest,
  runTemplateInitializer,
} from "../src/template-runtime";
import type { SelectedTemplate } from "../src/types";

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
      node: "^22.12.0 || ^24.0.0",
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
    await fs.writeJson(path.join(root, "template.manifest.json"), {
      schemaVersion: 1,
      id: "mobile.robot-h5",
      name: "Robot H5",
      version: "1.6.1",
      category: "mobile",
      runtime: {
        node: "^22.12.0 || ^24.0.0",
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
    const template = makeTemplate();
    expect(() => assertTemplateRuntime(template, "22.12.0")).not.toThrow();
    expect(() => assertTemplateRuntime(template, "24.1.0")).not.toThrow();
    expect(() => assertTemplateRuntime(template, "20.19.0")).toThrow(
      /要求 Node\.js/,
    );
  });

  it("exposes the package manager required by the template", () => {
    expect(getRequiredPackageManager(makeTemplate())).toBe("pnpm");
    expect(
      getRequiredPackageManager(makeTemplate({ runtime: undefined })),
    ).toBeUndefined();
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
    ).rejects.toThrow(/包管理器版本契约漂移/);
  });

  it("rejects an incomplete runtime contract", async () => {
    const manifestPath = path.join(root, "template.manifest.json");
    const manifest = await fs.readJson(manifestPath);
    delete manifest.runtime.node;
    await fs.writeJson(manifestPath, manifest);

    await expect(
      loadAndValidateTemplateManifest(root, makeTemplate()),
    ).rejects.toThrow(/Node\.js 契约漂移/);
  });

  it("rejects initializer commands other than Node.js", async () => {
    const template = makeTemplate();
    if (!template.initializer) throw new Error("initializer fixture missing");
    template.initializer.command = "bash" as "node";

    await expect(
      loadAndValidateTemplateManifest(root, template),
    ).rejects.toThrow(/只支持带脚本路径的 node 命令/);
  });
});
