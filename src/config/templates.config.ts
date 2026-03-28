import type { TemplateCategories } from "../types";

// ── Built-in Template Registry ───────────────────────────────────
// 模板配置独立管理，方便未来扩展（自定义包选择、功能开关等）

export const TEMPLATE_CATEGORIES: TemplateCategories = {
  frontend: {
    name: "前端项目",
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
                  "包含50+完整示例、权限管理、图表组件、最佳实践等等",
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
                features: ["bun workspace", "Monorepo", "多包管理", "共享组件"],
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
                features: ["MicroApp", "微前端", "主子应用", "路由共享"],
                version: "full",
              },
              "robot-module-federation": {
                name: "Robot Module Federation 模块联邦",
                description: "基于 Vite Module Federation 的模块联邦方案",
                repoUrl: "https://github.com/ChenyCHENYU/Robot_Admin",
                branch: "module-federation",
                features: ["Module Federation", "模块联邦", "Vite", "远程模块"],
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
    name: "移动端项目",
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
    },
  },
  backend: {
    name: "后端项目",
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
    },
  },
  desktop: {
    name: "桌面端项目",
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
    },
  },
};
