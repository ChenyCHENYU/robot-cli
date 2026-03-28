import type {
  TemplateCategories,
  TemplateConfig,
  CategoryConfig,
} from "./types";

// ── Remote Registry URL ──────────────────────────────────────────
const REMOTE_REGISTRY_URL =
  "https://raw.githubusercontent.com/ChenyCHENYU/robot-cli/main/registry.json";

let remoteTemplates: Record<string, TemplateConfig> | null = null;

// ── Built-in Template Registry ───────────────────────────────────
export const TEMPLATE_CATEGORIES: TemplateCategories = {
  frontend: {
    name: "🎨 前端项目",
    stacks: {
      vue: {
        name: "Vue.js",
        patterns: {
          monolith: {
            name: "单体应用",
            templates: {
              "robot-admin": {
                name: "Robot Admin 完整版",
                description:
                  "包含30+完整示例、权限管理、图表组件、最佳实践等等",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Admin",
                features: [
                  "Naive UI",
                  "Vue Router",
                  "Pinia",
                  "权限管理",
                  "动态路由",
                  "图表组件",
                  "性能优化等等",
                ],
                version: "full",
              },
              "robot-admin-base": {
                name: "Robot Admin 精简版",
                description: "基础架构、核心功能、快速启动",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Admin_Base",
                features: ["Naive UI", "Vue Router", "Pinia", "基础布局"],
                version: "base",
              },
            },
          },
          monorepo: {
            name: "Monorepo 架构",
            templates: {
              "robot-monorepo": {
                name: "Robot Monorepo",
                description: "bun workspace + Monorepo 多包管理架构",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Admin",
                branch: "monorepo",
                features: [
                  "bun workspace",
                  "Monorepo",
                  "多包管理",
                  "共享组件",
                ],
                version: "full",
              },
            },
          },
          microfrontend: {
            name: "微前端架构",
            templates: {
              "robot-micro-app": {
                name: "Robot MicroApp 微前端",
                description: "基于 MicroApp 的微前端架构方案",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Admin",
                branch: "micro-app",
                features: [
                  "MicroApp",
                  "微前端",
                  "主子应用",
                  "路由共享",
                ],
                version: "full",
              },
              "robot-module-federation": {
                name: "Robot Module Federation 模块联邦",
                description: "基于 Vite Module Federation 的模块联邦方案",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Admin",
                branch: "module-federation",
                features: [
                  "Module Federation",
                  "模块联邦",
                  "Vite",
                  "远程模块",
                ],
                version: "full",
              },
            },
          },
        },
      },
      react: {
        name: "React.js",
        patterns: {
          monolith: {
            name: "单体应用",
            templates: {
              "robot-react": {
                name: "Robot React 完整版",
                description: "Ant Design + 完整功能演示",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_React",
                features: ["Ant Design", "React Router", "Redux Toolkit"],
                version: "full",
              },
              "robot-react-base": {
                name: "Robot React 精简版",
                description: "基础React + 核心功能",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_React_Base",
                features: ["React", "React Router", "基础组件"],
                version: "base",
              },
            },
          },
        },
      },
    },
  },
  mobile: {
    name: "📱 移动端项目",
    stacks: {
      uniapp: {
        name: "uni-app",
        patterns: {
          multiplatform: {
            name: "多端应用",
            templates: {
              "robot-uniapp": {
                name: "Robot uni-app 完整版",
                description: "多端适配 + 插件市场 + 完整示例",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Uniapp",
                features: ["多端发布", "uView UI", "插件集成"],
                version: "full",
              },
              "robot-uniapp-base": {
                name: "Robot uni-app 精简版",
                description: "基础框架 + 核心功能",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Uniapp_Base",
                features: ["基础框架", "路由配置"],
                version: "base",
              },
            },
          },
        },
      },
      taro: {
        name: "Taro",
        patterns: {
          native: {
            name: "跨端应用",
            templates: {
              "robot-taro": {
                name: "Robot Taro 完整版",
                description: "原生性能 + 跨平台 + 完整功能（暂无，后续完善）",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Taro",
                features: ["原生性能", "跨平台", "完整功能"],
                version: "full",
                status: "coming-soon",
              },
              "robot-taro-base": {
                name: "Robot Taro 精简版",
                description: "基础 Taro 框架(暂无，后续完善)",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Taro_Base",
                features: ["基础框架", "核心功能"],
                version: "base",
                status: "coming-soon",
              },
            },
          },
        },
      },
    },
  },
  backend: {
    name: "🚀 后端项目",
    stacks: {
      nestjs: {
        name: "NestJS",
        patterns: {
          api: {
            name: "API服务",
            templates: {
              "robot-nest": {
                name: "Robot NestJS 完整版",
                description:
                  "NestJS + TypeORM + JWT + Swagger + Redis + 完整生态",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Nest",
                features: [
                  "NestJS",
                  "TypeORM",
                  "JWT认证",
                  "ApiFox文档",
                  "Redis",
                  "微服务",
                ],
                version: "full",
              },
              "robot-nest-base": {
                name: "Robot NestJS 精简版",
                description: "基础 NestJS + 核心模块",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Nest_Base",
                features: ["NestJS", "基础路由", "错误处理"],
                version: "base",
              },
            },
          },
          microservice: {
            name: "微服务架构",
            templates: {
              "robot-nest-micro": {
                name: "Robot NestJS微服务版",
                description: "NestJS + 微服务架构 + gRPC + 服务发现",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Nest_Micro",
                features: ["NestJS", "微服务", "gRPC", "Redis", "服务发现"],
                version: "micro",
              },
            },
          },
        },
      },
      koa: {
        name: "Koa3",
        patterns: {
          api: {
            name: "API服务",
            templates: {
              "robot-koa": {
                name: "Robot Koa3 完整版",
                description: "Koa3 + TypeScript + JWT + 数据库 + 中间件",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Koa",
                features: ["Koa3", "TypeScript", "JWT认证", "MySQL", "中间件"],
                version: "full",
              },
              "robot-koa-base": {
                name: "Robot Koa3 精简版",
                description: "基础Koa3 + 核心中间件",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Koa_Base",
                features: ["Koa3", "基础路由", "错误处理"],
                version: "base",
              },
            },
          },
        },
      },
    },
  },
  desktop: {
    name: "💻 桌面端项目",
    stacks: {
      electron: {
        name: "Electron",
        patterns: {
          desktop: {
            name: "桌面应用",
            templates: {
              "robot-electron": {
                name: "Robot Electron 完整版",
                description: "Vue3 + Electron + 自动更新 + 原生能力",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Electron",
                features: ["Vue3", "Electron", "自动更新", "原生API"],
                version: "full",
              },
              "robot-electron-base": {
                name: "Robot Electron 精简版",
                description: "基础Electron + Vue框架",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Electron_Base",
                features: ["Vue3", "Electron", "基础功能"],
                version: "base",
              },
            },
          },
        },
      },
      tauri: {
        name: "Tauri",
        patterns: {
          desktop: {
            name: "桌面应用",
            templates: {
              "robot-tauri": {
                name: "Robot Tauri 完整版",
                description: "Rust后端 + Vue前端 + 原生性能",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Tauri",
                features: ["Tauri", "Vue3", "Rust backend", "原生性能"],
                version: "full",
              },
              "robot-tauri-base": {
                name: "Robot Tauri 精简版",
                description: "基础Tauri + Vue框架",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Tauri_Base",
                features: ["Tauri", "Vue3", "基础功能"],
                version: "base",
              },
            },
          },
        },
      },
    },
  },
};

// ── Remote Registry ──────────────────────────────────────────────

export async function loadRemoteRegistry(): Promise<void> {
  try {
    const response = await fetch(REMOTE_REGISTRY_URL, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      remoteTemplates = (await response.json()) as Record<
        string,
        TemplateConfig
      >;
    }
  } catch {
    // Silently fall back to built-in templates
  }
}

// ── Helpers ──────────────────────────────────────────────────────

export function getAllTemplates(): Record<string, TemplateConfig> {
  const templates: Record<string, TemplateConfig> = {};

  for (const category of Object.values(TEMPLATE_CATEGORIES)) {
    for (const stack of Object.values(category.stacks)) {
      for (const pattern of Object.values(stack.patterns)) {
        Object.assign(templates, pattern.templates);
      }
    }
  }

  // Merge remote templates (built-in takes precedence)
  if (remoteTemplates) {
    for (const [key, template] of Object.entries(remoteTemplates)) {
      if (!templates[key]) {
        templates[key] = template;
      }
    }
  }

  return templates;
}

export function getTemplatesByCategory(
  categoryKey: string,
  stackKey: string,
  patternKey: string,
): Record<string, TemplateConfig> {
  const category = TEMPLATE_CATEGORIES[categoryKey];
  if (!category) return {};
  const stack = category.stacks[stackKey];
  if (!stack) return {};
  const pattern = stack.patterns[patternKey];
  if (!pattern) return {};
  return pattern.templates;
}

export function searchTemplates(
  keyword: string,
): Record<string, TemplateConfig> {
  const all = getAllTemplates();
  const results: Record<string, TemplateConfig> = {};
  const lower = keyword.toLowerCase();

  for (const [key, t] of Object.entries(all)) {
    const haystack =
      `${t.name} ${t.description} ${t.features.join(" ")}`.toLowerCase();
    if (haystack.includes(lower)) {
      results[key] = t;
    }
  }
  return results;
}

export function getRecommendedTemplates(): Record<string, TemplateConfig> {
  const all = getAllTemplates();
  const recommended: Record<string, TemplateConfig> = {};
  const keys = [
    "robot-admin",
    "robot-monorepo",
    "robot-micro-app",
    "robot-module-federation",
    "robot-nest",
    "robot-react",
  ];

  for (const key of keys) {
    if (all[key]) recommended[key] = all[key];
  }

  // Pad to at least 4 if not enough
  if (Object.keys(recommended).length < 4) {
    for (const key of Object.keys(all)) {
      if (!recommended[key] && Object.keys(recommended).length < 6) {
        recommended[key] = all[key];
      }
    }
  }

  return recommended;
}

export function getCategoryForTemplate(
  templateKey: string,
): CategoryConfig | undefined {
  for (const category of Object.values(TEMPLATE_CATEGORIES)) {
    for (const stack of Object.values(category.stacks)) {
      for (const pattern of Object.values(stack.patterns)) {
        if (templateKey in pattern.templates) return category;
      }
    }
  }
  return undefined;
}
