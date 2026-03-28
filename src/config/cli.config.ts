// ── CLI Configuration ────────────────────────────────────────────
// CLI 品牌、运行时配置独立管理，方便二次开发时快速定制

/** 远程模板注册表 URL */
export const REMOTE_REGISTRY_URL =
  "https://raw.githubusercontent.com/ChenyCHENYU/robot-cli/main/registry.json";

/** 模板缓存目录名（位于 ~/.robot-cli/ 下） */
export const CACHE_DIR_NAME = "cache";

/** 版本标签映射 */
export const VERSION_LABELS: Record<string, string> = {
  full: "完整版",
  base: "精简版",
  micro: "微服务版",
};

/** 推荐模板 key 列表 */
export const RECOMMENDED_TEMPLATE_KEYS = [
  "robot-admin",
  "robot-monorepo",
  "robot-micro-app",
  "robot-module-federation",
  "robot-nest",
  "robot-react",
];

/** 模板 key → 启动脚本名 映射 */
export const START_COMMAND_MAP: Record<string, string> = {
  "robot-admin": "dev",
  "robot-admin-base": "dev",
  "robot-monorepo": "dev",
  "robot-micro-app": "dev",
  "robot-module-federation": "dev",
  "robot-react": "start",
  "robot-react-base": "start",
  "robot-uniapp": "dev:h5",
  "robot-uniapp-base": "dev:h5",
  "robot-nest": "start:dev",
  "robot-nest-base": "start:dev",
  "robot-nest-micro": "start:dev",
  "robot-electron": "electron:dev",
  "robot-electron-base": "electron:dev",
};
