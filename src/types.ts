import type { Ora } from "ora";

// ── Package Manager ──────────────────────────────────────────────
export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

// ── Template Config (4-layer nested structure) ───────────────────
export interface TemplateConfig {
  name: string;
  description: string;
  repoUrl: string;
  giteeUrl?: string;
  branch?: string;
  features: string[];
  version: "full" | "base" | "micro";
  status?: "coming-soon";
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
}

export interface CreateOptions {
  template?: string;
  skipInstall?: boolean;
  dryRun?: boolean;
  from?: string;
  noCache?: boolean;
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
}

// ── Cache ────────────────────────────────────────────────────────
export interface CacheEntry {
  repoUrl: string;
  downloadedAt: string;
  branch: string;
  size: number;
}

export interface CacheIndex {
  version: number;
  entries: Record<string, CacheEntry>;
}
