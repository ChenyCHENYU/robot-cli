// lib/templates.js - 使用 repoUrl 配置
export const TEMPLATE_CATEGORIES = {
  frontend: {
    name: '🎨 前端项目',
    stacks: {
      vue: {
        name: 'Vue.js',
        patterns: {
          monolith: {
            name: '单体应用',
            templates: {
              'robot-admin': {
                name: 'Robot Admin 完整版',
                description: '包含30+完整示例、权限管理、图表组件、最佳实践等等',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Admin',
                features: ['Naive UI', 'Vue Router', 'Pinia', '权限管理', '动态路由', '图表组件', '性能优化等等'],
                version: 'full'
              },
              'robot-admin-base': {
                name: 'Robot Admin 精简版',
                description: '基础架构、核心功能、快速启动',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Admin_Base',
                features: ['Naive UI', 'Vue Router', 'Pinia', '基础布局'],
                version: 'base'
              }
            }
          },
          monorepo: {
            name: 'Monorepo 架构',
            templates: {
              'robot-monorepo': {
                name: 'Robot Monorepo 完整版',
                description: 'bun workspace + 多包管理 + 共享组件库',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Monorepo',
                features: ['bun workspace', 'shared components', 'build tools', 'CI/CD'],
                version: 'full'
              },
              'robot-monorepo-base': {
                name: 'Robot Monorepo 精简版',
                description: '基础 monorepo 结构 + 核心配置',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Monorepo_Base',
                features: ['bun workspace', 'basic structure'],
                version: 'base'
              }
            }
          },
          microfrontend: {
            name: '微前端架构',
            templates: {
              'robot-micro': {
                name: 'Robot微前端 完整版',
                description: 'MicroApp + Vite插件模块联邦 + 多应用示例',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Micro',
                features: ['MicroApp', 'Vite模块联邦', '多应用', '路由共享'],
                version: 'full'
              },
              'robot-micro-base': {
                name: 'Robot微前端 精简版',
                description: '基础 MicroApp 架构 + 主子应用',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Micro_Base',
                features: ['MicroApp', '基础配置'],
                version: 'base'
              }
            }
          }
        }
      },
      react: {
        name: 'React.js',
        patterns: {
          monolith: {
            name: '单体应用',
            templates: {
              'robot-react': {
                name: 'Robot React 完整版',
                description: 'Ant Design + 完整功能演示',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_React',
                features: ['Ant Design', 'React Router', 'Redux Toolkit'],
                version: 'full'
              },
              'robot-react-base': {
                name: 'Robot React 精简版',
                description: '基础React + 核心功能',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_React_Base',
                features: ['React', 'React Router', '基础组件'],
                version: 'base'
              }
            }
          }
        }
      }
    }
  },
  mobile: {
    name: '📱 移动端项目',
    stacks: {
      uniapp: {
        name: 'uni-app',
        patterns: {
          multiplatform: {
            name: '多端应用',
            templates: {
              'robot-uniapp': {
                name: 'Robot uni-app 完整版',
                description: '多端适配 + 插件市场 + 完整示例',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Uniapp',
                features: ['多端发布', 'uView UI', '插件集成'],
                version: 'full'
              },
              'robot-uniapp-base': {
                name: 'Robot uni-app 精简版',
                description: '基础框架 + 核心功能',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Uniapp_Base',
                features: ['基础框架', '路由配置'],
                version: 'base'
              }
            }
          }
        }
      },
      tarao: {
        name: 'Tarao',
        patterns: {
          native: {
            name: '原生应用',
            templates: {
              'robot-tarao': {
                name: 'Robot Tarao 完整版',
                description: '原生性能 + 跨平台 + 完整功能（暂无，后续完善）',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Tarao',
                features: ['原生性能', '跨平台', '完整功能'],
                version: 'full',
                status: 'coming-soon'
              },
              'robot-tarao-base': {
                name: 'Robot Tarao 精简版',
                description: '基础 Tarao 框架(暂无，后续完善)',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Tarao_Base',
                features: ['基础框架', '核心功能'],
                version: 'base',
                status: 'coming-soon'
              }
            }
          }
        }
      }
    }
  },
  backend: {
    name: '🚀 后端项目',
    stacks: {
      nestjs: {
        name: 'NestJS',
        patterns: {
          api: {
            name: 'API服务',
            templates: {
              'robot-nest': {
                name: 'Robot NestJS 完整版',
                description: 'NestJS + TypeORM + JWT + Swagger + Redis + 完整生态',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Nest',
                features: ['NestJS', 'TypeORM', 'JWT认证', 'ApiFox文档', 'Redis', '微服务'],
                version: 'full'
              },
              'robot-nest-base': {
                name: 'Robot NestJS 精简版',
                description: '基础 NestJS + 核心模块',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Nest_Base',
                features: ['NestJS', '基础路由', '错误处理'],
                version: 'base'
              }
            }
          },
          microservice: {
            name: '微服务架构',
            templates: {
              'robot-nest-micro': {
                name: 'Robot NestJS微服务版',
                description: 'NestJS + 微服务架构 + gRPC + 服务发现',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Nest_Micro',
                features: ['NestJS', '微服务', 'gRPC', 'Redis', '服务发现'],
                version: 'micro'
              }
            }
          }
        }
      },
      koa: {
        name: 'Koa3',
        patterns: {
          api: {
            name: 'API服务',
            templates: {
              'robot-koa': {
                name: 'Robot Koa3 完整版',
                description: 'Koa3 + TypeScript + JWT + 数据库 + 中间件',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Koa',
                features: ['Koa3', 'TypeScript', 'JWT认证', 'MySQL', '中间件'],
                version: 'full'
              },
              'robot-koa-base': {
                name: 'Robot Koa3 精简版',
                description: '基础Koa3 + 核心中间件',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Koa_Base',
                features: ['Koa3', '基础路由', '错误处理'],
                version: 'base'
              }
            }
          }
        }
      }
    }
  },
  desktop: {
    name: '💻 桌面端项目',
    stacks: {
      electron: {
        name: 'Electron',
        patterns: {
          desktop: {
            name: '桌面应用',
            templates: {
              'robot-electron': {
                name: 'Robot Electron 完整版',
                description: 'Vue3 + Electron + 自动更新 + 原生能力',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Electron',
                features: ['Vue3', 'Electron', '自动更新', '原生API'],
                version: 'full'
              },
              'robot-electron-base': {
                name: 'Robot Electron 精简版',
                description: '基础Electron + Vue框架',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Electron_Base',
                features: ['Vue3', 'Electron', '基础功能'],
                version: 'base'
              }
            }
          }
        }
      },
      tauri: {
        name: 'Tauri',
        patterns: {
          desktop: {
            name: '桌面应用',
            templates: {
              'robot-tauri': {
                name: 'Robot Tauri 完整版',
                description: 'Rust后端 + Vue前端 + 原生性能',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Tauri',
                features: ['Tauri', 'Vue3', 'Rust backend', '原生性能'],
                version: 'full'
              },
              'robot-tauri-base': {
                name: 'Robot Tauri 精简版',
                description: '基础Tauri + Vue框架',
                repoUrl: 'https://github.com/ChenyCHENYU/Robot_Tauri_Base',
                features: ['Tauri', 'Vue3', '基础功能'],
                version: 'base'
              }
            }
          }
        }
      }
    }
  }
};

/**
 * 获取所有模板的扁平化列表
 */
export function getAllTemplates() {
  const templates = {};
  
  Object.values(TEMPLATE_CATEGORIES).forEach(category => {
    Object.values(category.stacks).forEach(stack => {
      Object.values(stack.patterns).forEach(pattern => {
        Object.assign(templates, pattern.templates);
      });
    });
  });
  
  return templates;
}

/**
 * 根据分类获取模板
 */
export function getTemplatesByCategory(categoryKey, stackKey, patternKey) {
  const category = TEMPLATE_CATEGORIES[categoryKey];
  if (!category) return {};
  
  const stack = category.stacks[stackKey];
  if (!stack) return {};
  
  const pattern = stack.patterns[patternKey];
  if (!pattern) return {};
  
  return pattern.templates;
}

/**
 * 搜索模板
 */
export function searchTemplates(keyword) {
  const allTemplates = getAllTemplates();
  const results = {};
  
  Object.entries(allTemplates).forEach(([key, template]) => {
    const searchText = `${template.name} ${template.description} ${template.features.join(' ')}`.toLowerCase();
    if (searchText.includes(keyword.toLowerCase())) {
      results[key] = template;
    }
  });
  
  return results;
}

/**
 * 获取推荐模板（基于使用频率或团队偏好）- 统一Robot命名
 */
export function getRecommendedTemplates() {
  const allTemplates = getAllTemplates();
  const recommended = {};
  
  // 使用统一的Robot命名风格
  const recommendedKeys = [
    'robot-admin',       // Vue后台管理 - 最常用
    'robot-uniapp',      // 移动端开发 - 跨平台
    'robot-nest',        // 后端API - 企业级
    'robot-electron',    // 桌面应用 - 全栈
    'robot-react',       // React项目 - 前端选择
    'robot-koa'          // 轻量后端 - 快速开发
  ];
  
  recommendedKeys.forEach(key => {
    if (allTemplates[key]) {
      recommended[key] = allTemplates[key];
    }
  });
  
  // 如果没有找到足够的推荐模板，补充一些
  if (Object.keys(recommended).length < 4) {
    const availableKeys = Object.keys(allTemplates);
    for (const key of availableKeys) {
      if (!recommended[key] && Object.keys(recommended).length < 6) {
        recommended[key] = allTemplates[key];
      }
    }
  }
  
  return recommended;
}