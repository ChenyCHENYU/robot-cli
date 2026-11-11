import type { Ora } from "ora";

// ── Package Manager ──────────────────────────────────────────────
export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

export type TemplateStatus = "beta" | "coming-soon";

export interface TemplateRuntimeConfig {
  /** Node.js semver range required by the template. */
  node?: string;
  /** Package manager mandated by the template. */
  packageManager?: PackageManager;
  /** Package-manager semver range, used to decide whether auto-install is safe. */
  packageManagerVersion?: string;
}

export interface TemplateInitializerConfig {
  /** Manifest shipped by the template and validated before initialization. */
  manifestPath: string;
  /** Expected manifest id, preventing a repository/config mismatch. */
  manifestId: string;
  /** Only Node.js scripts are allowed, and they are invoked without a shell. */
  command: "node";
  /** Supports {projectName} and {projectTitle} placeholders. */
  args: string[];
}

// ── Template Config (4-layer nested structure) ───────────────────
export interface TemplateConfig {
  name: string;
  description: string;
  repoUrl: string;
  giteeUrl?: string;
  branch?: string;
  features: string[];
  version: "full" | "base" | "micro";
  status?: TemplateStatus;
  runtime?: TemplateRuntimeConfig;
  initializer?: TemplateInitializerConfig;
  startScript?: string;
  /** Kept behind the advanced architecture picker. */
  advanced?: boolean;
}

export interface TemplateManifest {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  category: string;
  runtime?: {
    node?: string;
    packageManager?: string;
  };
  entry?: {
    interactive?: string;
    nonInteractive?: string;
  };
}

export interface PatternConfig {
  name: string;
  templates: Record<string, TemplateConfig>;
}

export interface StackConfig {
  name: string;
  patterns: Record<string, PatternConfig>;
}

export interface CategoryConfig {
  name: string;
  stacks: Record<string, StackConfig>;
}

export type TemplateCategories = Record<string, CategoryConfig>;

// ── Runtime types ────────────────────────────────────────────────
export interface SelectedTemplate extends TemplateConfig {
  key: string;
}

export interface ProjectConfig {
  initGit: boolean;
  installDeps: boolean;
  packageManager: PackageManager;
  description: string;
  author: string;
  /** Product title, independent from the package description. */
  title?: string;
}

export interface CreateOptions {
  template?: string;
  skipInstall?: boolean;
  dryRun?: boolean;
  from?: string;
  noCache?: boolean;
  yes?: boolean;
  preset?: "full" | "lite" | "custom";
  packageManager?: PackageManager;
  title?: string;
  description?: string;
  author?: string;
  git?: boolean;
  advanced?: boolean;
}

export interface ProjectStats {
  files: number;
  directories: number;
  size: number;
  fileTypes: Record<string, number>;
}

export interface DownloadOptions {
  spinner?: Ora;
  noCache?: boolean;
  giteeUrl?: string;
  signal?: AbortSignal;
}

export interface DownloadedTemplate {
  path: string;
  /** Only paths owned by the current process may be cleaned up. Cache paths omit this. */
  cleanupPath?: string;
  source?: string;
  fromCache?: boolean;
  cachedAt?: string;
  /** Resolved Git commit when the download transport can verify it. */
  revision?: string;
}

// ── Cache ────────────────────────────────────────────────────────
export interface CacheEntry {
  repoUrl: string;
  downloadedAt: string;
  branch: string;
  size: number;
  source?: string;
  revision?: string;
}

export interface CacheIndex {
  version: number;
  entries: Record<string, CacheEntry>;
}
