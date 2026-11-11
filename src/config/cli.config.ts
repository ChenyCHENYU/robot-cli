// ── CLI Configuration ────────────────────────────────────────────
// CLI 品牌、运行时配置独立管理，方便二次开发时快速定制

/** 模板缓存目录名（位于 ~/.robot-cli/ 下） */
export const CACHE_DIR_NAME = "cache";

/** Clack uses util.styleText, available from Node 20.12. */
export const CLI_NODE_RANGE = "^20.12.0 || >=22.0.0";

/** 版本标签映射 */
export const VERSION_LABELS: Record<string, string> = {
  full: "完整版",
  base: "精简版",
  micro: "微服务版",
};

/** 默认推荐维护中的 PC 单体；高级架构由用户按需选择。 */
export const RECOMMENDED_TEMPLATE_KEYS = ["robot-admin"];

/** 模板 key → 启动脚本名 映射 */
export const START_COMMAND_MAP: Record<string, string> = {
  "robot-admin": "dev",
  "robot-admin-base": "dev",
  "robot-monorepo": "dev",
  "robot-micro-app": "dev",
  "robot-module-federation": "dev",
  "robot-react": "start",
  "robot-react-base": "start",
  "robot-nest": "start:dev",
  "robot-nest-base": "start:dev",
  "robot-nest-micro": "start:dev",
  "robot-electron": "electron:dev",
  "robot-electron-base": "electron:dev",
};
